"use client";

import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";
import type { Category, Product } from "@/lib/types";
import ProductEditor from "@/components/dashboard/admin/ProductEditor";
import { ErrorBox, Loading } from "@/components/dashboard/admin/kit";

export default function EditProductPage() {
  const { id } = useParams<{ id: string }>();

  const productQuery = useQuery({
    queryKey: ["admin", "product", id],
    queryFn: () => apiClient.get<Product>(`/admin/products/${id}`),
  });
  const categoriesQuery = useQuery({
    queryKey: ["categories"],
    queryFn: () => apiClient.get<Category[]>("/categories"),
  });

  if (productQuery.isPending || categoriesQuery.isPending) return <Loading label="Loading product…" />;
  if (productQuery.isError)
    return (
      <ErrorBox
        message={(productQuery.error as Error).message}
        onRetry={() => productQuery.refetch()}
      />
    );

  // Re-mount the form when the product changes so defaults reset
  return (
    <ProductEditor
      key={productQuery.data.id + productQuery.data.updatedAt}
      product={productQuery.data}
      categories={categoriesQuery.data ?? []}
    />
  );
}
