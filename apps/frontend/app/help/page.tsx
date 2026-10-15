import Link from "next/link";
import { MessageCircle, Package, RotateCcw, Truck } from "lucide-react";

const topics = [
  {
    icon: Truck,
    title: "Shipping & Delivery",
    text: "Orders are dispatched within 24 hours. Standard delivery takes 2–5 business days with live tracking on every order.",
  },
  {
    icon: RotateCcw,
    title: "Returns & Warranty",
    text: "Changed your mind? Return unused items within 14 days. All gadgets carry a minimum 6-month warranty.",
  },
  {
    icon: Package,
    title: "Track your order",
    text: "Head to your dashboard to see live status updates for every order, from payment to doorstep.",
  },
  {
    icon: MessageCircle,
    title: "Contact us",
    text: "Still stuck? Email support@gadgetlax.example and we will get back within one business day.",
  },
];

export default function HelpPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-primary-700">
          Support
        </p>
        <h1 className="mt-1 font-display text-3xl font-bold tracking-tight text-zinc-900">
          We&apos;re here to help
        </h1>
        <p className="mt-2 text-sm text-zinc-600">
          Answers to the most common questions about orders, shipping and returns.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {topics.map((t) => {
          const Icon = t.icon;
          return (
            <div
              key={t.title}
              className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-zinc-200"
            >
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary-100 text-primary-700">
                <Icon className="h-5 w-5" />
              </span>
              <h2 className="mt-4 font-display text-base font-bold text-zinc-900">
                {t.title}
              </h2>
              <p className="mt-1.5 text-sm leading-relaxed text-zinc-600">{t.text}</p>
            </div>
          );
        })}
      </div>
      <div className="rounded-2xl bg-primary-600 p-6 text-white shadow-sm sm:p-8">
        <h2 className="font-display text-xl font-bold">Need a hand with an order?</h2>
        <p className="mt-1 text-sm text-primary-50">
          Log in to see your orders and reach support with one tap.
        </p>
        <Link
          href="/login"
          className="mt-4 inline-block rounded-full bg-white px-6 py-2.5 text-sm font-semibold text-primary-700 transition hover:bg-primary-50"
        >
          Go to My Account
        </Link>
      </div>
    </div>
  );
}
