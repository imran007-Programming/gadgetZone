"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { apiClient } from "@/lib/api";
import { useToast } from "@/lib/toast";
import type { Category } from "@/lib/types";
import { Card, CardHead, ErrorBox, Field, Kpi, Loading, Modal, bdNumber, matchesSearch, useAdminSearch } from "./kit";
import { useAdminProducts, useCategories } from "./AdminProducts";

const categorySchema = z.object({
  name: z.string().min(1, "Name is required"),
  slug: z
    .string()
    .min(1, "Slug is required")
    .regex(/^[a-z0-9-]+$/, "Use lowercase letters, numbers and hyphens"),
  description: z.string().optional(),
});

type CategoryForm = z.infer<typeof categorySchema>;

export default function AdminCategories() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const search = useAdminSearch();
  // null = closed, "new" = create form, otherwise the category being edited
  const [editing, setEditing] = useState<Category | "new" | null>(null);

  const categoriesQuery = useCategories();
  const productsQuery = useAdminProducts();

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiClient.del(`/admin/categories/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      toast.success("Category deleted");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (categoriesQuery.isPending) return <Loading label="Loading categories…" />;
  if (categoriesQuery.isError)
    return <ErrorBox message={(categoriesQuery.error as Error).message} onRetry={() => categoriesQuery.refetch()} />;

  const categories = categoriesQuery.data;
  const products = productsQuery.data ?? [];
  const countFor = (id: string) => products.filter((p) => p.categoryId === id).length;
  const emptyCount = categories.filter((c) => countFor(c.id) === 0).length;
  const rows = categories.filter((c) => matchesSearch(search, c.name, c.slug, c.description));

  return (
    <section>
      <div className="grid kpi-grid">
        <Kpi label="Categories" value={bdNumber(categories.length)} sub="Catalog sections" />
        <Kpi label="Products" value={bdNumber(products.length)} sub="Across all categories" />
        <Kpi
          label="Avg per category"
          value={categories.length ? (products.length / categories.length).toFixed(1) : "0"}
          sub="Products per category"
        />
        <Kpi label="Empty" value={bdNumber(emptyCount)} sub="No products yet · deletable" />
      </div>

      <Card>
        <CardHead
          title="All categories"
          right={
            <button className="btn sm" onClick={() => setEditing("new")}>
              <Plus />
              New Category
            </button>
          }
        />
        {rows.length === 0 ? (
          <div className="empty">{categories.length === 0 ? "No categories yet" : "No categories match"}</div>
        ) : (
          <div className="tbl-wrap">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Slug</th>
                  <th>Description</th>
                  <th className="num">Products</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows.map((c) => {
                  const count = countFor(c.id);
                  return (
                    <tr key={c.id}>
                      <td className="prod-name">{c.name}</td>
                      <td className="mono muted">{c.slug}</td>
                      <td className="muted" style={{ maxWidth: 320 }}>
                        {c.description || "—"}
                      </td>
                      <td className="num">{count}</td>
                      <td className="num" style={{ whiteSpace: "nowrap" }}>
                        <button className="btn sm ghost" onClick={() => setEditing(c)}>
                          <Pencil />
                          Edit
                        </button>{" "}
                        <button
                          className="btn sm danger"
                          disabled={count > 0 || deleteMutation.isPending}
                          title={count > 0 ? "Only empty categories can be deleted" : "Delete category"}
                          onClick={() => {
                            if (window.confirm(`Delete category "${c.name}"?`)) deleteMutation.mutate(c.id);
                          }}
                        >
                          <Trash2 />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <p className="muted" style={{ fontSize: 12, marginTop: 12 }}>
          Only categories without products can be deleted.
        </p>
      </Card>

      {editing && (
        <CategoryModal category={editing === "new" ? null : editing} onClose={() => setEditing(null)} />
      )}
    </section>
  );
}

function CategoryModal({ category, onClose }: { category: Category | null; onClose: () => void }) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CategoryForm>({
    resolver: zodResolver(categorySchema),
    defaultValues: category
      ? { name: category.name, slug: category.slug, description: category.description ?? "" }
      : { name: "", slug: "", description: "" },
  });

  const saveMutation = useMutation({
    mutationFn: (values: CategoryForm) =>
      category
        ? apiClient.patch<Category>(`/admin/categories/${category.id}`, values)
        : apiClient.post<Category>("/admin/categories", values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      toast.success(category ? "Category updated" : "Category created");
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Modal title={category ? `Edit — ${category.name}` : "New Category"} onClose={onClose}>
      <form onSubmit={handleSubmit((v) => saveMutation.mutate(v))} noValidate>
        <div className="form-2col">
          <Field label="Name" error={errors.name?.message}>
            <input {...register("name")} placeholder="Audio" />
          </Field>
          <Field label="Slug" error={errors.slug?.message}>
            <input className="mono" {...register("slug")} placeholder="audio" />
          </Field>
        </div>
        <Field label="Description" error={errors.description?.message}>
          <textarea {...register("description")} placeholder="Headphones, earbuds and speakers" />
        </Field>
        <button type="submit" className="btn block" disabled={isSubmitting || saveMutation.isPending}>
          {saveMutation.isPending ? "Saving…" : category ? "Save Category" : "Create Category"}
        </button>
      </form>
    </Modal>
  );
}
