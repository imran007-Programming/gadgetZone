"use client";

import { useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, MessageSquare, Trash2, X } from "lucide-react";
import { apiClient } from "@/lib/api";
import { useToast } from "@/lib/toast";
import type { AdminReview, ReviewStatus } from "@/lib/types";
import {
  Badge,
  Card,
  CardHead,
  ErrorBox,
  HBars,
  Kpi,
  Loading,
  PALETTE,
  bdNumber,
  matchesSearch,
  useAdminSearch,
} from "./kit";

const FILTERS: { label: string; value: ReviewStatus | "ALL" }[] = [
  { label: "All", value: "ALL" },
  { label: "Pending", value: "PENDING" },
  { label: "Approved", value: "APPROVED" },
  { label: "Rejected", value: "REJECTED" },
];

export function Stars({ rating, big }: { rating: number; big?: boolean }) {
  const r = Math.round(rating);
  return (
    <span className={`stars${big ? " big" : ""}`} aria-label={`${rating} out of 5`}>
      {"★".repeat(r)}
      {"☆".repeat(5 - r)}
    </span>
  );
}

function statusBadge(status: ReviewStatus) {
  if (status === "APPROVED") return <Badge tone="green">Approved</Badge>;
  if (status === "REJECTED") return <Badge tone="red">Rejected</Badge>;
  return <Badge tone="amber">Pending</Badge>;
}

export default function AdminReviews() {
  const search = useAdminSearch();
  const [filter, setFilter] = useState<ReviewStatus | "ALL">("ALL");

  const reviewsQuery = useQuery({
    queryKey: ["admin", "reviews"],
    queryFn: () => apiClient.get<AdminReview[]>("/admin/reviews"),
  });

  if (reviewsQuery.isPending) return <Loading label="Loading reviews…" />;
  if (reviewsQuery.isError)
    return <ErrorBox message={(reviewsQuery.error as Error).message} onRetry={() => reviewsQuery.refetch()} />;

  const reviews = reviewsQuery.data;
  const approved = reviews.filter((r) => r.status === "APPROVED");
  const pending = reviews.filter((r) => r.status === "PENDING");
  const rejected = reviews.filter((r) => r.status === "REJECTED");
  const avg = approved.length ? approved.reduce((n, r) => n + r.rating, 0) / approved.length : 0;
  const replied = reviews.filter((r) => r.reply).length;
  const rows = reviews.filter(
    (r) =>
      (filter === "ALL" || r.status === filter) &&
      matchesSearch(search, r.user.name, r.product.name, r.comment),
  );

  return (
    <section>
      <div className="grid kpi-grid">
        <div className="card kpi">
          <div className="k-label">Avg rating</div>
          <div className="k-row">
            <div className="k-value">{avg ? avg.toFixed(1) : "—"}</div>
            {avg > 0 && <Stars rating={avg} big />}
          </div>
          <div className="k-sub">Approved reviews</div>
        </div>
        <Kpi label="Total reviews" value={bdNumber(reviews.length)} sub="All statuses" />
        <Kpi
          label="Pending moderation"
          value={bdNumber(pending.length)}
          sub="Awaiting approval"
          pill={pending.length > 0 ? { text: "REVIEW", tone: "warn" } : undefined}
        />
        <Kpi
          label="Response rate"
          value={reviews.length ? `${Math.round((replied / reviews.length) * 100)}%` : "—"}
          sub="Reviews with a reply"
        />
      </div>

      <div className="grid two-col mb">
        <Card>
          <CardHead title="Rating distribution" />
          <HBars
            items={[5, 4, 3, 2, 1].map((s) => {
              const count = approved.filter((r) => r.rating === s).length;
              return { label: `${s} ★`, value: count, display: bdNumber(count) };
            })}
          />
        </Card>
        <Card>
          <CardHead title="Moderation queue" right={<span className="muted" style={{ fontSize: 12 }}>{pending.length} awaiting review</span>} />
          <div className="kv">
            <span className="k">Pending approval</span>
            <span className="v">{pending.length}</span>
          </div>
          <div className="kv">
            <span className="k">Approved (public)</span>
            <span className="v">{approved.length}</span>
          </div>
          <div className="kv">
            <span className="k">Rejected (hidden)</span>
            <span className="v">{rejected.length}</span>
          </div>
          <div className="kv">
            <span className="k">Replied</span>
            <span className="v">{replied}</span>
          </div>
        </Card>
      </div>

      <Card>
        <CardHead
          title="Recent reviews"
          right={
            <div className="chips">
              {FILTERS.map((f) => (
                <button
                  key={f.value}
                  className={`chip${filter === f.value ? " active" : ""}`}
                  onClick={() => setFilter(f.value)}
                >
                  {f.label}
                </button>
              ))}
            </div>
          }
        />
        {rows.length === 0 ? (
          <div className="empty">
            {reviews.length === 0
              ? "No reviews yet. Customers can review products from delivered orders."
              : "No reviews match"}
          </div>
        ) : (
          rows.map((r) => <ReviewCard key={r.id} review={r} />)
        )}
      </Card>
    </section>
  );
}

function ReviewCard({ review }: { review: AdminReview }) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [replyOpen, setReplyOpen] = useState(false);
  const [reply, setReply] = useState(review.reply ?? "");

  const moderateMutation = useMutation({
    mutationFn: (body: { status?: ReviewStatus; reply?: string }) =>
      apiClient.patch<AdminReview>(`/admin/reviews/${review.id}`, body),
    onSuccess: (_r, body) => {
      queryClient.invalidateQueries({ queryKey: ["admin", "reviews"] });
      if (body.reply !== undefined) {
        setReplyOpen(false);
        toast.success(body.reply.trim() ? "Reply published" : "Reply removed");
      } else {
        toast.success(body.status === "APPROVED" ? "Review approved" : "Review rejected");
      }
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: () => apiClient.del(`/admin/reviews/${review.id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "reviews"] });
      toast.success("Review deleted");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const initials = review.user.name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
  const busy = moderateMutation.isPending || deleteMutation.isPending;

  return (
    <div className="card soft review-card">
      <div className="review-head">
        <div className="rep-avatar" style={{ background: PALETTE[review.user.name.length % PALETTE.length] }}>
          {initials}
        </div>
        <div className="r-meta">
          <div className="r-name">
            {review.user.name} <span style={{ marginLeft: 6 }}>{statusBadge(review.status)}</span>
          </div>
          <div className="r-sub">
            <Link href={`/products/${review.product.slug}`} target="_blank" className="sec-link" style={{ fontSize: 11.5, letterSpacing: 0, textTransform: "none", fontWeight: 500 }}>
              {review.product.name}
            </Link>{" "}
            · {new Date(review.createdAt).toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" })}
          </div>
        </div>
        <Stars rating={review.rating} />
      </div>
      <p className="review-text">{review.comment}</p>
      {review.reply && !replyOpen && <div className="review-reply">Store reply: {review.reply}</div>}
      <div className="review-foot">
        {review.status !== "APPROVED" && (
          <button className="btn sm" disabled={busy} onClick={() => moderateMutation.mutate({ status: "APPROVED" })}>
            <Check />
            Approve
          </button>
        )}
        {review.status !== "REJECTED" && (
          <button className="btn sm ghost" disabled={busy} onClick={() => moderateMutation.mutate({ status: "REJECTED" })}>
            <X />
            Reject
          </button>
        )}
        <button className="btn sm ghost" disabled={busy} onClick={() => setReplyOpen((o) => !o)}>
          <MessageSquare />
          {review.reply ? "Edit reply" : "Reply"}
        </button>
        <button
          className="btn sm danger"
          disabled={busy}
          onClick={() => {
            if (window.confirm("Delete this review permanently?")) deleteMutation.mutate();
          }}
          aria-label="Delete review"
        >
          <Trash2 />
        </button>
      </div>
      {replyOpen && (
        <div className="reply-box">
          <textarea value={reply} onChange={(e) => setReply(e.target.value)} placeholder="Write a public reply…" />
          <div style={{ marginTop: 8, display: "flex", gap: 8 }}>
            <button className="btn sm" disabled={busy} onClick={() => moderateMutation.mutate({ reply })}>
              {reply.trim() ? "Publish reply" : "Remove reply"}
            </button>
            <button className="btn sm ghost" onClick={() => setReplyOpen(false)}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
