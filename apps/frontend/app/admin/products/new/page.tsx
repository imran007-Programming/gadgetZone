"use client";

import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";
import type { Category } from "@/lib/types";
import ProductEditor from "@/components/dashboard/admin/ProductEditor";
import { Loading } from "@/components/dashboard/admin/kit";

export default function NewProductPage() {
  const categoriesQuery = useQuery({
    queryKey: ["categories"],
    queryFn: () => apiClient.get<Category[]>("/categories"),
  });

  if (categoriesQuery.isPending) return <Loading label="Loading…" />;
  return <ProductEditor categories={categoriesQuery.data ?? []} />;
}
