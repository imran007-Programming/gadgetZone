"use client";

import { useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Star } from "lucide-react";
import { apiClient, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/lib/toast";
import type { ProductReviews as ProductReviewsData, ReviewEligibility } from "@/lib/types";

function StarRow({ value, size = "h-4 w-4" }: { value: number; size?: string }) {
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`${value} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          className={`${size} ${i <= Math.round(value) ? "fill-amber-400 text-amber-400" : "text-zinc-300"}`}
        />
      ))}
    </span>
  );
}

/** Rating summary, approved reviews and (for verified buyers) the review form. */
export default function ProductReviews({ productId }: { productId: string }) {
  const { isAuthenticated } = useAuth();

  const reviewsQuery = useQuery({
    queryKey: ["reviews", productId],
    queryFn: () => apiClient.get<ProductReviewsData>(`/reviews/product/${productId}`),
  });

  const data = reviewsQuery.data;

  return (
    <section className="mt-12 rounded-2xl bg-white p-6 ring-1 ring-zinc-200 sm:p-8">
      <h2 className="font-display text-xl font-bold tracking-tight text-zinc-900">Customer reviews</h2>

      {reviewsQuery.isPending ? (
        <p className="mt-4 text-sm text-zinc-500">Loading reviews…</p>
      ) : reviewsQuery.isError || !data ? (
        <p className="mt-4 text-sm text-zinc-500">Reviews are unavailable right now.</p>
      ) : (
        <div className="mt-6 grid gap-8 lg:grid-cols-[260px_1fr]">
          {/* Summary */}
          <div>
            <div className="flex items-end gap-3">
              <span className="font-display text-4xl font-bold text-zinc-900">
                {data.count ? data.average.toFixed(1) : "—"}
              </span>
              <span className="pb-1 text-sm text-zinc-500">out of 5</span>
            </div>
            <div className="mt-2">
              <StarRow value={data.average} />
            </div>
            <p className="mt-1 text-sm text-zinc-500">
              {data.count} review{data.count === 1 ? "" : "s"}
            </p>
            <ul className="mt-4 space-y-1.5">
              {data.distribution.map((d) => (
                <li key={d.stars} className="flex items-center gap-2 text-xs text-zinc-500">
                  <span className="w-6">{d.stars}★</span>
                  <span className="h-2 flex-1 overflow-hidden rounded-full bg-zinc-100">
                    <span
                      className="block h-full rounded-full bg-amber-400"
                      style={{ width: `${data.count ? (d.count / data.count) * 100 : 0}%` }}
                    />
                  </span>
                  <span className="w-6 text-right">{d.count}</span>
                </li>
              ))}
            </ul>

            <div className="mt-6">
              {isAuthenticated ? (
                <ReviewForm productId={productId} />
              ) : (
                <p className="text-sm text-zinc-500">
                  <Link href="/login" prefetch={false} className="font-semibold text-primary-600 hover:underline">
                    Log in
                  </Link>{" "}
                  to review a product you have received.
                </p>
              )}
            </div>
          </div>

          {/* List */}
          <div>
            {data.reviews.length === 0 ? (
              <p className="rounded-xl bg-zinc-50 px-4 py-8 text-center text-sm text-zinc-500">
                No reviews yet. Customers who receive this product can share their experience.
              </p>
            ) : (
              <ul className="divide-y divide-zinc-100">
                {data.reviews.map((r) => (
                  <li key={r.id} className="py-5 first:pt-0">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-zinc-900">{r.author}</p>
                        <p className="text-xs text-zinc-400">
                          Verified purchase ·{" "}
                          {new Date(r.createdAt).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })}
                        </p>
                      </div>
                      <StarRow value={r.rating} />
                    </div>
                    <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-zinc-600">{r.comment}</p>
                    {r.reply && (
                      <div className="mt-3 rounded-r-lg border-l-4 border-primary-400 bg-primary-50 px-4 py-2 text-sm text-zinc-600">
                        <span className="font-semibold text-zinc-800">Store reply: </span>
                        {r.reply}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

function ReviewForm({ productId }: { productId: string }) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState("");

  const eligibilityQuery = useQuery({
    queryKey: ["review-eligibility", productId],
    queryFn: () => apiClient.get<ReviewEligibility>(`/reviews/eligibility/${productId}`),
  });

  const submit = useMutation({
    mutationFn: () => apiClient.post("/reviews", { productId, rating, comment }),
    onSuccess: () => {
      toast.success("Thanks! Your review will appear after it is approved.");
      setRating(0);
      setComment("");
      queryClient.invalidateQueries({ queryKey: ["review-eligibility", productId] });
    },
    onError: (e: Error) => toast.error(e instanceof ApiError ? e.message : "Could not submit review"),
  });

  if (eligibilityQuery.isPending) return null;
  const eligibility = eligibilityQuery.data;
  if (!eligibility?.canReview) {
    const pending = eligibility?.status === "PENDING";
    return (
      <p className="rounded-xl bg-zinc-50 px-4 py-3 text-sm text-zinc-500">
        {pending ? "Your review is waiting for approval." : eligibility?.reason ?? "You can't review this product yet."}
      </p>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (rating === 0) {
          toast.error("Choose a star rating first");
          return;
        }
        submit.mutate();
      }}
      className="space-y-3 rounded-xl bg-zinc-50 p-4 ring-1 ring-zinc-200"
    >
      <p className="text-sm font-semibold text-zinc-900">Write a review</p>
      <div className="flex gap-1" onMouseLeave={() => setHover(0)}>
        {[1, 2, 3, 4, 5].map((i) => (
          <button
            key={i}
            type="button"
            onClick={() => setRating(i)}
            onMouseEnter={() => setHover(i)}
            aria-label={`${i} star${i === 1 ? "" : "s"}`}
          >
            <Star
              className={`h-6 w-6 ${i <= (hover || rating) ? "fill-amber-400 text-amber-400" : "text-zinc-300"}`}
            />
          </button>
        ))}
      </div>
      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        rows={4}
        maxLength={2000}
        placeholder="How was the product and delivery?"
        className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-primary-500"
      />
      <button
        type="submit"
        disabled={submit.isPending || comment.trim().length < 3}
        className="w-full rounded-xl bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-40"
      >
        {submit.isPending ? "Submitting…" : "Submit review"}
      </button>
    </form>
  );
}
