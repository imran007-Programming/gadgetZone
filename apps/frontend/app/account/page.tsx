"use client";

import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/lib/toast";
import { RequireAuth, Spinner } from "@/components/ui";

export default function AccountPage() {
  return (
    <RequireAuth>
      <AccountContent />
    </RequireAuth>
  );
}

function AccountContent() {
  const { user, logout } = useAuth();
  const toast = useToast();
  const router = useRouter();

  if (!user) return <Spinner />;

  const handleLogout = async () => {
    await logout();
    toast.success("Logged out");
    router.push("/");
  };

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <h1 className="font-display text-2xl font-bold tracking-tight text-zinc-50">Account</h1>
      <div className="rounded-xl bg-zinc-900 p-6 ring-1 ring-zinc-800">
        <dl className="space-y-3 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-zinc-500">Name</dt>
            <dd className="font-medium text-zinc-50">{user.name}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-zinc-500">Email</dt>
            <dd className="font-medium text-zinc-50">{user.email}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-zinc-500">Role</dt>
            <dd className="font-medium text-zinc-50">{user.role}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-zinc-500">Member since</dt>
            <dd className="font-medium text-zinc-50">
              {new Date(user.createdAt).toLocaleDateString()}
            </dd>
          </div>
        </dl>
        <button
          onClick={handleLogout}
          className="mt-6 w-full rounded-xl px-4 py-2.5 text-sm font-semibold text-rose-400 ring-1 ring-rose-400/30 hover:bg-rose-400/10"
        >
          Log out
        </button>
      </div>
    </div>
  );
}
