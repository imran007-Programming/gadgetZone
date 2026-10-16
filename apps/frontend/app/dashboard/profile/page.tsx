"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { LogOut, Mail, Phone, ShieldCheck, User as UserIcon } from "lucide-react";
import { apiClient } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/lib/toast";
import type { User } from "@/lib/types";
import { Spinner, inputClass } from "@/components/ui";

const BD_MOBILE_REGEX = /^01[3-9]\d{8}$/;
const normalizePhone = (v: string) => v.replace(/[\s-]/g, "").replace(/^\+?88(?=01)/, "");

/** Name and mobile number; the mobile also pre-fills checkout. */
function ContactForm({ user }: { user: User }) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [name, setName] = useState(user.name);
  const [phone, setPhone] = useState(user.phone ?? "");
  const cleanPhone = normalizePhone(phone.trim());
  const nameError = name.trim().length < 2 ? "Name must be at least 2 characters" : null;
  const phoneError = cleanPhone && !BD_MOBILE_REGEX.test(cleanPhone) ? "Enter a valid mobile number (01XXXXXXXXX)" : null;
  const dirty = name.trim() !== user.name || cleanPhone !== (user.phone ?? "");

  const save = useMutation({
    mutationFn: () => apiClient.patch<User>("/users/me", { name: name.trim(), phone: cleanPhone || null }),
    onSuccess: (updated) => {
      queryClient.setQueryData(["session"], updated);
      setPhone(updated.phone ?? "");
      toast.success("Profile updated");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!nameError && !phoneError && dirty) save.mutate();
      }}
      className="rounded-xl bg-zinc-50 p-6 ring-1 ring-zinc-200"
      noValidate
    >
      <h2 className="mb-4 text-base font-bold text-zinc-900">Contact details</h2>
      <div className="space-y-4">
        <div>
          <label htmlFor="profile-name" className="mb-1.5 block text-sm font-medium text-zinc-700">
            Full name
          </label>
          <input id="profile-name" className={inputClass} value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
          {nameError && <p className="mt-1 text-xs text-rose-600">{nameError}</p>}
        </div>
        <div>
          <label htmlFor="profile-phone" className="mb-1.5 block text-sm font-medium text-zinc-700">
            Mobile number
          </label>
          <input
            id="profile-phone"
            className={inputClass}
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            inputMode="tel"
            autoComplete="tel"
            placeholder="01XXXXXXXXX"
          />
          {phoneError ? (
            <p className="mt-1 text-xs text-rose-600">{phoneError}</p>
          ) : (
            <p className="mt-1 text-xs text-zinc-400">Used for delivery calls; it also fills in at checkout.</p>
          )}
        </div>
      </div>
      <button
        type="submit"
        disabled={!dirty || !!nameError || !!phoneError || save.isPending}
        className="mt-5 w-full rounded-xl bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-primary-700 disabled:opacity-40"
      >
        {save.isPending ? "Saving…" : "Save changes"}
      </button>
    </form>
  );
}

export default function DashboardProfilePage() {
  const { user, logout } = useAuth();
  const toast = useToast();
  const router = useRouter();

  if (!user) return <Spinner />;

  const handleLogout = async () => {
    await logout();
    toast.success("Logged out");
    router.push("/");
  };

  const rows = [
    {
      icon: UserIcon,
      label: "Name",
      value: user.name,
    },
    {
      icon: Mail,
      label: "Email",
      value: user.email,
    },
    {
      icon: Phone,
      label: "Mobile",
      value: user.phone || "Not added",
    },
    {
      icon: ShieldCheck,
      label: "Role",
      value: user.role,
    },
    {
      icon: UserIcon,
      label: "Member since",
      value: new Date(user.createdAt).toLocaleDateString(),
    },
  ];

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <h1 className="font-display text-2xl font-bold tracking-tight text-zinc-900">
        Profile
      </h1>
      <div className="rounded-xl bg-zinc-50 p-6 ring-1 ring-zinc-200">
        <div className="mb-6 flex items-center gap-4">
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-primary-100 font-display text-2xl font-bold text-primary-700">
            {user.name.charAt(0).toUpperCase()}
          </span>
          <div>
            <p className="font-display text-lg font-bold text-zinc-900">{user.name}</p>
            <p className="text-sm text-zinc-500">{user.email}</p>
          </div>
        </div>
        <dl className="space-y-3">
          {rows.map((r) => {
            const Icon = r.icon;
            return (
              <div
                key={r.label}
                className="flex items-center justify-between gap-4 border-b border-zinc-200 py-2.5 text-sm last:border-0"
              >
                <dt className="flex items-center gap-2 text-zinc-500">
                  <Icon className="h-4 w-4" />
                  {r.label}
                </dt>
                <dd className="font-medium text-zinc-900">{r.value}</dd>
              </div>
            );
          })}
        </dl>
        <button
          onClick={handleLogout}
          className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-rose-600 ring-1 ring-rose-200 hover:bg-rose-50"
        >
          <LogOut className="h-4 w-4" />
          Log out
        </button>
      </div>
      <ContactForm user={user} />
    </div>
  );
}
