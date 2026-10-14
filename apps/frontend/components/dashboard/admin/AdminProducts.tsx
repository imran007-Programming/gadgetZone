"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, X } from "lucide-react";
import { apiClient } from "@/lib/api";
import { useToast } from "@/lib/toast";
import { formatPrice, toNumber } from "@/lib/utils";
import type { Category, Product, ProductsResponse } from "@/lib/types";
import {
  EmptyState,
  ErrorState,
  Field,
  Spinner,
  inputClass,
} from "@/components/ui";

const productSchema = z.object({
  name: z.string().min(1, "Name is required"),
  slug: z.string().min(1, "Slug is required").regex(/^[a-z0-9-]+$/, "Use lowercase letters, numbers and hyphens"),
  description: z.string().min(1, "Description is required"),
  price: z.number().positive("Price must be positive"),
  comparePrice: z.string().optional(),
  stock: z.number().int().min(0, "Stock can't be negative"),
  imageUrl: z.string().url("Must be a valid URL"),
  categoryId: z.string().min(1, "Category is required"),
  isActive: z.boolean(),
});

type ProductForm = z.infer<typeof productSchema>;

export default function AdminProducts() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<Product | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [stockId, setStockId] = useState<string | null>(null);
  const [stockValue, setStockValue] = useState("");

  const productsQuery = useQuery({
    queryKey: ["admin", "products"],
    queryFn: () => apiClient.get<ProductsResponse>("/products?limit=100"),
  });
  const categoriesQuery = useQuery({
    queryKey: ["categories"],
    queryFn: () => apiClient.get<Category[]>("/categories"),
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["admin", "products"] });
    queryClient.invalidateQueries({ queryKey: ["products"] });
    queryClient.invalidateQueries({ queryKey: ["product"] });
  };

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiClient.del(`/admin/products/${id}`),
    onSuccess: () => {
      invalidate();
      toast.success("Product deactivated");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const stockMutation = useMutation({
    mutationFn: ({ id, stock }: { id: string; stock: number }) =>
      apiClient.patch(`/admin/products/${id}/stock`, { stock }),
    onSuccess: () => {
      invalidate();
      setStockId(null);
      toast.success("Stock updated");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const openCreate = () => {
    setEditing(null);
    setShowModal(true);
  };
  const openEdit = (p: Product) => {
    setEditing(p);
    setShowModal(true);
  };

  if (productsQuery.isPending) return <Spinner label="Loading products…" />;
  if (productsQuery.isError)
    return (
      <ErrorState
        message={(productsQuery.error as Error).message}
        onRetry={() => productsQuery.refetch()}
      />
    );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold tracking-tight text-zinc-900">
          Products
        </h1>
        <button
          onClick={openCreate}
          className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-600"
        >
          <Plus className="h-4 w-4" />
          New product
        </button>
      </div>
      <p className="text-sm text-zinc-500">
        {productsQuery.data.meta.total} active products
      </p>

      {/* Mobile cards */}
      <ul className="space-y-3 lg:hidden">
        {productsQuery.data.items.map((p) => (
          <li key={p.id} className="rounded-xl bg-zinc-50 p-4 ring-1 ring-zinc-200">
            <p className="font-medium text-zinc-900">{p.name}</p>
            <p className="font-mono text-xs text-zinc-500">{p.slug}</p>
            <div className="mt-2 flex items-center justify-between text-sm">
              <span className="font-semibold text-zinc-900">{formatPrice(p.price)}</span>
              <span className="text-zinc-500">Stock: <span className="font-semibold text-zinc-900">{p.stock}</span></span>
            </div>
            <div className="mt-3 flex gap-2">
              <button
                onClick={() => openEdit(p)}
                className="inline-flex flex-1 items-center justify-center gap-1 rounded-lg px-3 py-1.5 text-xs font-medium text-blue-600 ring-1 ring-zinc-300 hover:bg-zinc-100"
              >
                <Pencil className="h-3.5 w-3.5" />
                Edit
              </button>
              <button
                onClick={() => {
                  if (window.confirm(`Deactivate "${p.name}"? It will be hidden from the store.`))
                    deleteMutation.mutate(p.id);
                }}
                className="inline-flex flex-1 items-center justify-center gap-1 rounded-lg px-3 py-1.5 text-xs font-medium text-rose-400 ring-1 ring-zinc-300 hover:bg-zinc-100"
              >
                <X className="h-3.5 w-3.5" />
                Deactivate
              </button>
            </div>
          </li>
        ))}
      </ul>

      {/* Desktop table */}
      <div className="hidden overflow-x-auto rounded-xl bg-zinc-50 ring-1 ring-zinc-200 lg:block">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="border-b border-zinc-200 text-xs uppercase text-zinc-500">
            <tr>
              <th className="px-4 py-3">Product</th>
              <th className="px-4 py-3">Price</th>
              <th className="px-4 py-3">Stock</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200">
            {productsQuery.data.items.map((p) => (
              <tr key={p.id} className="hover:bg-white">
                <td className="px-4 py-3">
                  <p className="font-medium text-zinc-900">{p.name}</p>
                  <p className="font-mono text-xs text-zinc-500">{p.slug}</p>
                </td>
                <td className="px-4 py-3 font-medium">{formatPrice(p.price)}</td>
                <td className="px-4 py-3">
                  {stockId === p.id ? (
                    <span className="flex items-center gap-1">
                      <input
                        type="number"
                        min={0}
                        value={stockValue}
                        onChange={(e) => setStockValue(e.target.value)}
                        className="w-20 rounded border border-zinc-300 bg-white px-2 py-1 text-sm text-zinc-900"
                      />
                      <button
                        onClick={() =>
                          stockMutation.mutate({ id: p.id, stock: parseInt(stockValue || "0", 10) })
                        }
                        className="rounded bg-blue-600 px-2 py-1 text-xs font-medium text-white"
                      >
                        Save
                      </button>
                      <button
                        onClick={() => setStockId(null)}
                        className="rounded px-2 py-1 text-xs text-zinc-500"
                        aria-label="Cancel"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </span>
                  ) : (
                    <button
                      onClick={() => {
                        setStockId(p.id);
                        setStockValue(String(p.stock));
                      }}
                      className="font-medium text-zinc-900 hover:text-blue-600 hover:underline"
                      title="Click to update stock"
                    >
                      {p.stock}
                    </button>
                  )}
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-2">
                    <button
                      onClick={() => openEdit(p)}
                      className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:underline"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                      Edit
                    </button>
                    <button
                      onClick={() => {
                        if (window.confirm(`Deactivate "${p.name}"? It will be hidden from the store.`))
                          deleteMutation.mutate(p.id);
                      }}
                      className="text-xs font-medium text-rose-400 hover:underline"
                    >
                      Deactivate
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-zinc-500">
        Note: deactivated products are hidden from this list (the public API only
        returns active products).
      </p>

      {showModal && (
        <ProductModal
          product={editing}
          categories={categoriesQuery.data ?? []}
          onClose={() => setShowModal(false)}
          onSaved={() => {
            setShowModal(false);
            invalidate();
          }}
        />
      )}
    </div>
  );
}

function ProductModal({
  product,
  categories,
  onClose,
  onSaved,
}: {
  product: Product | null;
  categories: Category[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const toast = useToast();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ProductForm>({
    resolver: zodResolver(productSchema),
    defaultValues: product
      ? {
          name: product.name,
          slug: product.slug,
          description: product.description,
          price: toNumber(product.price),
          comparePrice: product.comparePrice != null ? String(toNumber(product.comparePrice)) : "",
          stock: product.stock,
          imageUrl: product.imageUrl,
          categoryId: product.categoryId,
          isActive: product.isActive,
        }
      : { isActive: true, stock: 0 },
  });

  const saveMutation = useMutation({
    mutationFn: (values: ProductForm) => {
      const compare = values.comparePrice?.trim();
      const body = {
        ...values,
        price: Number(values.price),
        stock: Number(values.stock),
        comparePrice: compare ? parseFloat(compare) : undefined,
      };
      return product
        ? apiClient.patch<Product>(`/admin/products/${product.id}`, body)
        : apiClient.post<Product>("/admin/products", body);
    },
    onSuccess: () => {
      toast.success(product ? "Product updated" : "Product created");
      onSaved();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-zinc-50 p-6 ring-1 ring-zinc-200">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-zinc-900">
            {product ? "Edit product" : "New product"}
          </h2>
          <button onClick={onClose} className="rounded-full p-1.5 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>
        <form
          onSubmit={handleSubmit((v) => saveMutation.mutate(v))}
          className="space-y-4"
          noValidate
        >
          <Field label="Name" error={errors.name?.message}>
            <input className={inputClass} {...register("name")} />
          </Field>
          <Field label="Slug" error={errors.slug?.message}>
            <input className={inputClass} {...register("slug")} />
          </Field>
          <Field label="Description" error={errors.description?.message}>
            <textarea className={inputClass} rows={3} {...register("description")} />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Price" error={errors.price?.message}>
              <input type="number" step="0.01" min={0} className={inputClass} {...register("price", { valueAsNumber: true })} />
            </Field>
            <Field label="Compare price (optional)" error={errors.comparePrice?.message}>
              <input
                type="number"
                step="0.01"
                min={0}
                className={inputClass}
                placeholder="—"
                {...register("comparePrice")}
              />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Stock" error={errors.stock?.message}>
              <input type="number" min={0} className={inputClass} {...register("stock", { valueAsNumber: true })} />
            </Field>
            <Field label="Category" error={errors.categoryId?.message}>
              <select className={inputClass} {...register("categoryId")}>
                <option value="">Select…</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <Field label="Image URL" error={errors.imageUrl?.message}>
            <input className={inputClass} {...register("imageUrl")} />
          </Field>
          <label className="flex items-center gap-2 text-sm font-medium text-zinc-700">
            <input type="checkbox" {...register("isActive")} className="h-4 w-4 rounded text-blue-600" />
            Active (visible in store)
          </label>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg px-4 py-2 text-sm font-medium text-zinc-500 hover:bg-zinc-100"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || saveMutation.isPending}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-600 disabled:opacity-40"
            >
              {saveMutation.isPending ? "Saving…" : "Save"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
