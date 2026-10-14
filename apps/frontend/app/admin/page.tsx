"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";
import { useToast } from "@/lib/toast";
import { formatPrice, toNumber } from "@/lib/utils";
import type {
  AdminStats,
  Category,
  Order,
  OrderStatus,
  Product,
  ProductsResponse,
  User,
} from "@/lib/types";
import {
  EmptyState,
  ErrorState,
  Field,
  RequireAuth,
  Spinner,
  StatusBadge,
  inputClass,
} from "@/components/ui";

type Tab = "dashboard" | "products" | "categories" | "orders" | "users";

const TABS: { id: Tab; label: string }[] = [
  { id: "dashboard", label: "Dashboard" },
  { id: "products", label: "Products" },
  { id: "categories", label: "Categories" },
  { id: "orders", label: "Orders" },
  { id: "users", label: "Users" },
];

export default function AdminPage() {
  return (
    <RequireAuth adminOnly>
      <AdminContent />
    </RequireAuth>
  );
}

function AdminContent() {
  const [tab, setTab] = useState<Tab>("dashboard");

  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl font-bold tracking-tight text-zinc-50">Admin panel</h1>
      <div className="flex gap-1 overflow-x-auto border-b border-zinc-800">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`whitespace-nowrap px-4 py-2.5 text-sm font-medium transition ${
              tab === t.id
                ? "border-b-2 border-lime-400 text-lime-300"
                : "text-zinc-500 hover:text-zinc-50"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      {tab === "dashboard" && <DashboardTab />}
      {tab === "products" && <ProductsTab />}
      {tab === "categories" && <CategoriesTab />}
      {tab === "orders" && <OrdersTab />}
      {tab === "users" && <UsersTab />}
    </div>
  );
}

/* ---------------- Dashboard ---------------- */

function DashboardTab() {
  const statsQuery = useQuery({
    queryKey: ["admin", "stats"],
    queryFn: () => apiClient.get<AdminStats>("/admin/stats"),
  });

  if (statsQuery.isPending) return <Spinner label="Loading stats…" />;
  if (statsQuery.isError)
    return (
      <ErrorState
        message={(statsQuery.error as Error).message}
        onRetry={() => statsQuery.refetch()}
      />
    );

  const s = statsQuery.data;
  const cards = [
    { label: "Total revenue", value: formatPrice(s.totalRevenue) },
    { label: "New customers (30d)", value: String(s.newCustomers30d) },
    {
      label: "Total orders",
      value: String(
        Object.values(s.ordersByStatus).reduce((a, b) => a + b, 0)
      ),
    },
    { label: "Low-stock products", value: String(s.lowStock.length) },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {cards.map((c) => (
          <div key={c.label} className="rounded-xl bg-zinc-900 p-5 ring-1 ring-zinc-800">
            <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
              {c.label}
            </p>
            <p className="mt-1 text-2xl font-bold text-zinc-50">{c.value}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl bg-zinc-900 p-5 ring-1 ring-zinc-800">
          <h2 className="mb-3 text-sm font-bold text-zinc-50">Orders by status</h2>
          <ul className="space-y-2">
            {(Object.keys(s.ordersByStatus) as OrderStatus[]).map((st) => (
              <li key={st} className="flex items-center justify-between text-sm">
                <StatusBadge status={st} />
                <span className="font-semibold text-zinc-50">{s.ordersByStatus[st]}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-xl bg-zinc-900 p-5 ring-1 ring-zinc-800">
          <h2 className="mb-3 text-sm font-bold text-zinc-50">
            Low stock (under 10 units)
          </h2>
          {s.lowStock.length === 0 ? (
            <p className="text-sm text-zinc-500">All stocked up.</p>
          ) : (
            <ul className="space-y-2">
              {s.lowStock.map((p) => (
                <li key={p.id} className="flex items-center justify-between text-sm">
                  <span className="truncate font-medium text-zinc-200">{p.name}</span>
                  <span
                    className={`font-bold ${p.stock === 0 ? "text-rose-400" : "text-amber-400"}`}
                  >
                    {p.stock} left
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

/* ---------------- Products ---------------- */

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

function ProductsTab() {
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
        <p className="text-sm text-zinc-500">
          {productsQuery.data.meta.total} active products
        </p>
        <button
          onClick={openCreate}
          className="rounded-lg bg-lime-400 px-4 py-2 text-sm font-medium text-zinc-950 hover:bg-lime-300"
        >
          + New product
        </button>
      </div>

      <div className="overflow-x-auto rounded-xl bg-zinc-900 ring-1 ring-zinc-800">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="border-b border-zinc-800 text-xs uppercase text-zinc-500">
            <tr>
              <th className="px-4 py-3">Product</th>
              <th className="px-4 py-3">Price</th>
              <th className="px-4 py-3">Stock</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800">
            {productsQuery.data.items.map((p) => (
              <tr key={p.id} className="hover:bg-zinc-950">
                <td className="px-4 py-3">
                  <p className="font-medium text-zinc-50">{p.name}</p>
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
                        className="w-20 rounded border border-zinc-700 px-2 py-1 text-sm"
                      />
                      <button
                        onClick={() =>
                          stockMutation.mutate({ id: p.id, stock: parseInt(stockValue || "0", 10) })
                        }
                        className="rounded bg-lime-400 px-2 py-1 text-xs font-medium text-zinc-950"
                      >
                        Save
                      </button>
                      <button
                        onClick={() => setStockId(null)}
                        className="rounded px-2 py-1 text-xs text-zinc-500"
                      >
                        ✕
                      </button>
                    </span>
                  ) : (
                    <button
                      onClick={() => {
                        setStockId(p.id);
                        setStockValue(String(p.stock));
                      }}
                      className="font-medium text-zinc-50 hover:text-lime-400 hover:underline"
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
                      className="text-xs font-medium text-lime-400 hover:underline"
                    >
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
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-zinc-900 p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-zinc-50">
            {product ? "Edit product" : "New product"}
          </h2>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-200" aria-label="Close">
            ✕
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
          <label className="flex items-center gap-2 text-sm font-medium text-zinc-200">
            <input type="checkbox" {...register("isActive")} className="h-4 w-4 rounded text-lime-400" />
            Active (visible in store)
          </label>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg px-4 py-2 text-sm font-medium text-zinc-400 hover:bg-zinc-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || saveMutation.isPending}
              className="rounded-lg bg-lime-400 px-4 py-2 text-sm font-medium text-zinc-950 hover:bg-lime-300 disabled:opacity-40"
            >
              {saveMutation.isPending ? "Saving…" : "Save"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ---------------- Categories ---------------- */

const categorySchema = z.object({
  name: z.string().min(1, "Name is required"),
  slug: z.string().min(1, "Slug is required").regex(/^[a-z0-9-]+$/, "Use lowercase letters, numbers and hyphens"),
  description: z.string().optional(),
});

function CategoriesTab() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<Category | null>(null);
  const [showForm, setShowForm] = useState(false);

  const categoriesQuery = useQuery({
    queryKey: ["admin", "categories"],
    queryFn: () => apiClient.get<Category[]>("/categories"),
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["admin", "categories"] });
    queryClient.invalidateQueries({ queryKey: ["categories"] });
  };

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<z.infer<typeof categorySchema>>({
    resolver: zodResolver(categorySchema),
  });

  const openCreate = () => {
    setEditing(null);
    reset({ name: "", slug: "", description: "" });
    setShowForm(true);
  };
  const openEdit = (c: Category) => {
    setEditing(c);
    reset({ name: c.name, slug: c.slug, description: c.description ?? "" });
    setShowForm(true);
  };

  const saveMutation = useMutation({
    mutationFn: (values: z.infer<typeof categorySchema>) =>
      editing
        ? apiClient.patch<Category>(`/admin/categories/${editing.id}`, values)
        : apiClient.post<Category>("/admin/categories", values),
    onSuccess: () => {
      invalidate();
      setShowForm(false);
      toast.success(editing ? "Category updated" : "Category created");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiClient.del(`/admin/categories/${id}`),
    onSuccess: () => {
      invalidate();
      toast.success("Category deleted");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (categoriesQuery.isPending) return <Spinner label="Loading categories…" />;
  if (categoriesQuery.isError)
    return (
      <ErrorState
        message={(categoriesQuery.error as Error).message}
        onRetry={() => categoriesQuery.refetch()}
      />
    );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-zinc-500">{categoriesQuery.data.length} categories</p>
        <button
          onClick={openCreate}
          className="rounded-lg bg-lime-400 px-4 py-2 text-sm font-medium text-zinc-950 hover:bg-lime-300"
        >
          + New category
        </button>
      </div>

      {showForm && (
        <form
          onSubmit={handleSubmit((v) => saveMutation.mutate(v))}
          className="grid gap-4 rounded-xl bg-zinc-900 p-5 ring-1 ring-zinc-800 sm:grid-cols-3"
          noValidate
        >
          <Field label="Name" error={errors.name?.message}>
            <input className={inputClass} {...register("name")} />
          </Field>
          <Field label="Slug" error={errors.slug?.message}>
            <input className={inputClass} {...register("slug")} />
          </Field>
          <Field label="Description" error={errors.description?.message}>
            <input className={inputClass} {...register("description")} />
          </Field>
          <div className="flex items-end gap-2 sm:col-span-3">
            <button
              type="submit"
              disabled={isSubmitting || saveMutation.isPending}
              className="rounded-lg bg-lime-400 px-4 py-2 text-sm font-medium text-zinc-950 hover:bg-lime-300 disabled:opacity-40"
            >
              {saveMutation.isPending ? "Saving…" : editing ? "Update" : "Create"}
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="rounded-lg px-4 py-2 text-sm font-medium text-zinc-400 hover:bg-zinc-800"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      <div className="overflow-x-auto rounded-xl bg-zinc-900 ring-1 ring-zinc-800">
        <table className="w-full min-w-[560px] text-left text-sm">
          <thead className="border-b border-zinc-800 text-xs uppercase text-zinc-500">
            <tr>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Slug</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800">
            {categoriesQuery.data.map((c) => (
              <tr key={c.id} className="hover:bg-zinc-950">
                <td className="px-4 py-3 font-medium text-zinc-50">{c.name}</td>
                <td className="px-4 py-3 font-mono text-xs text-zinc-500">{c.slug}</td>
                <td className="px-4 py-3">
                  <div className="flex gap-2">
                    <button
                      onClick={() => openEdit(c)}
                      className="text-xs font-medium text-lime-400 hover:underline"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => {
                        if (window.confirm(`Delete category "${c.name}"? Only empty categories can be deleted.`))
                          deleteMutation.mutate(c.id);
                      }}
                      className="text-xs font-medium text-rose-400 hover:underline"
                    >
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ---------------- Orders ---------------- */

const ORDER_STATUSES: OrderStatus[] = ["PENDING", "PAID", "SHIPPED", "DELIVERED", "CANCELLED"];

function OrdersTab() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState("");

  const ordersQuery = useQuery({
    queryKey: ["admin", "orders", statusFilter],
    queryFn: () =>
      apiClient.get<Order[]>(`/admin/orders${statusFilter ? `?status=${statusFilter}` : ""}`),
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: OrderStatus }) =>
      apiClient.patch<Order>(`/admin/orders/${id}/status`, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "orders"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "stats"] });
      toast.success("Order status updated");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (ordersQuery.isPending) return <Spinner label="Loading orders…" />;
  if (ordersQuery.isError)
    return (
      <ErrorState
        message={(ordersQuery.error as Error).message}
        onRetry={() => ordersQuery.refetch()}
      />
    );

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <label className="text-sm font-medium text-zinc-400">Status filter</label>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-lg border border-zinc-700 px-3 py-1.5 text-sm"
        >
          <option value="">All</option>
          {ORDER_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      {ordersQuery.data.length === 0 ? (
        <EmptyState title="No orders found" />
      ) : (
        <div className="overflow-x-auto rounded-xl bg-zinc-900 ring-1 ring-zinc-800">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="border-b border-zinc-800 text-xs uppercase text-zinc-500">
              <tr>
                <th className="px-4 py-3">Order</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Total</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Update</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800">
              {ordersQuery.data.map((o) => (
                <tr key={o.id} className="hover:bg-zinc-950">
                  <td className="px-4 py-3 font-mono text-xs">#{o.id.slice(0, 8)}</td>
                  <td className="px-4 py-3 text-xs text-zinc-500">
                    {new Date(o.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 font-medium">{formatPrice(o.totalAmount)}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={o.status} />
                  </td>
                  <td className="px-4 py-3">
                    <select
                      value={o.status}
                      onChange={(e) =>
                        statusMutation.mutate({ id: o.id, status: e.target.value as OrderStatus })
                      }
                      disabled={statusMutation.isPending}
                      className="rounded-lg border border-zinc-700 px-2 py-1 text-xs"
                      aria-label={`Update status for order ${o.id.slice(0, 8)}`}
                    >
                      {ORDER_STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-xs text-zinc-500">
        Valid transitions: PENDING → PAID/CANCELLED, PAID → SHIPPED, SHIPPED →
        DELIVERED. Invalid moves are rejected by the API.
      </p>
    </div>
  );
}

/* ---------------- Users ---------------- */

function UsersTab() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [expanded, setExpanded] = useState<string | null>(null);

  const usersQuery = useQuery({
    queryKey: ["admin", "users"],
    queryFn: () => apiClient.get<User[]>("/admin/users"),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) =>
      apiClient.patch(`/admin/users/${id}/${active ? "enable" : "disable"}`),
    onSuccess: (_d, v) => {
      queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
      toast.success(v.active ? "Account enabled" : "Account disabled");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (usersQuery.isPending) return <Spinner label="Loading users…" />;
  if (usersQuery.isError)
    return (
      <ErrorState
        message={(usersQuery.error as Error).message}
        onRetry={() => usersQuery.refetch()}
      />
    );

  return (
    <div className="space-y-3">
      {usersQuery.data.length === 0 ? (
        <EmptyState title="No users found" />
      ) : (
        usersQuery.data.map((u) => (
          <div key={u.id} className="rounded-xl bg-zinc-900 p-4 ring-1 ring-zinc-800">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-sm font-semibold text-zinc-50">
                  {u.name}{" "}
                  <span className="ml-1 rounded-full bg-zinc-800 px-2 py-0.5 text-[11px] font-medium text-zinc-400">
                    {u.role}
                  </span>
                  {!u.isActive && (
                    <span className="ml-1 rounded-full bg-rose-400/15 px-2 py-0.5 text-[11px] font-medium text-rose-300">
                      disabled
                    </span>
                  )}
                </p>
                <p className="text-xs text-zinc-500">{u.email}</p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setExpanded(expanded === u.id ? null : u.id)}
                  className="rounded-lg px-3 py-1.5 text-xs font-medium text-zinc-400 ring-1 ring-zinc-800 hover:bg-zinc-950"
                >
                  {expanded === u.id ? "Hide orders" : "View orders"}
                </button>
                {u.role !== "ADMIN" && (
                  <button
                    onClick={() =>
                      toggleMutation.mutate({ id: u.id, active: !u.isActive })
                    }
                    disabled={toggleMutation.isPending}
                    className={`rounded-lg px-3 py-1.5 text-xs font-medium ${
                      u.isActive
                        ? "text-rose-400 ring-1 ring-rose-400/30 hover:bg-rose-400/10"
                        : "text-emerald-400 ring-1 ring-emerald-400/25 hover:bg-emerald-50"
                    }`}
                  >
                    {u.isActive ? "Disable" : "Enable"}
                  </button>
                )}
              </div>
            </div>
            {expanded === u.id && <UserOrders userId={u.id} />}
          </div>
        ))
      )}
    </div>
  );
}

function UserOrders({ userId }: { userId: string }) {
  const ordersQuery = useQuery({
    queryKey: ["admin", "user-orders", userId],
    queryFn: () => apiClient.get<Order[]>(`/admin/users/${userId}/orders`),
  });

  if (ordersQuery.isPending) return <Spinner label="Loading orders…" />;
  if (ordersQuery.isError)
    return (
      <p className="mt-3 text-xs text-rose-400">
        {(ordersQuery.error as Error).message}
      </p>
    );
  if (ordersQuery.data.length === 0)
    return <p className="mt-3 text-xs text-zinc-500">No orders.</p>;

  return (
    <ul className="mt-3 space-y-1.5 border-t border-zinc-800 pt-3">
      {ordersQuery.data.map((o) => (
        <li key={o.id} className="flex items-center justify-between text-xs">
          <span className="font-mono text-zinc-500">#{o.id.slice(0, 8)}</span>
          <span className="text-zinc-500">
            {new Date(o.createdAt).toLocaleDateString()}
          </span>
          <span className="font-medium text-zinc-50">{formatPrice(o.totalAmount)}</span>
          <StatusBadge status={o.status} />
        </li>
      ))}
    </ul>
  );
}
