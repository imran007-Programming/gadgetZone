"use client";

import { useRouter } from "next/navigation";
import { LogOut, Mail, ShieldCheck, User as UserIcon } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/lib/toast";
import { Spinner } from "@/components/ui";

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
      <h1 className="font-display text-2xl font-bold tracking-tight text-zinc-50">
        Profile
      </h1>
      <div className="rounded-xl bg-zinc-900 p-6 ring-1 ring-zinc-800">
        <div className="mb-6 flex items-center gap-4">
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-lime-400/15 font-display text-2xl font-bold text-lime-300">
            {user.name.charAt(0).toUpperCase()}
          </span>
          <div>
            <p className="font-display text-lg font-bold text-zinc-50">{user.name}</p>
            <p className="text-sm text-zinc-500">{user.email}</p>
          </div>
        </div>
        <dl className="space-y-3">
          {rows.map((r) => {
            const Icon = r.icon;
            return (
              <div
                key={r.label}
                className="flex items-center justify-between gap-4 border-b border-zinc-800/60 py-2.5 text-sm last:border-0"
              >
                <dt className="flex items-center gap-2 text-zinc-500">
                  <Icon className="h-4 w-4" />
                  {r.label}
                </dt>
                <dd className="font-medium text-zinc-50">{r.value}</dd>
              </div>
            );
          })}
        </dl>
        <button
          onClick={handleLogout}
          className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-rose-400 ring-1 ring-rose-400/30 hover:bg-rose-400/10"
        >
          <LogOut className="h-4 w-4" />
          Log out
        </button>
      </div>
    </div>
  );
}
