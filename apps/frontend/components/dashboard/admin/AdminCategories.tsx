"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CornerDownRight, Pencil, Plus, Trash2 } from "lucide-react";
import { apiClient } from "@/lib/api";
import { useToast } from "@/lib/toast";
import { buildCategoryTree } from "@/lib/categories";
import { CACHE_TAGS, STOREFRONT_REFRESH_FAILED, revalidateCache } from "@/lib/cache-tags";
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
  /** "" = top-level category; undefined while the select is disabled */
  parentId: z.string().optional(),
  position: z.string().regex(/^\d{0,4}$/, "Whole number, 0 or more"),
});

type CategoryForm = z.infer<typeof categorySchema>;

/** What the modal edits: an existing category, or a new one (optionally under a parent). */
type Editing = { category: Category } | { parentId: string } | null;

export default function AdminCategories() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const search = useAdminSearch();
  const [editing, setEditing] = useState<Editing>(null);

  const categoriesQuery = useCategories();
  const productsQuery = useAdminProducts();

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiClient.del(`/admin/categories/${id}`),
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      toast.success("Category deleted");
      if (!(await revalidateCache(CACHE_TAGS.categories))) toast.error(STOREFRONT_REFRESH_FAILED);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (categoriesQuery.isPending) return <Loading label="Loading categories…" />;
  if (categoriesQuery.isError)
    return <ErrorBox message={(categoriesQuery.error as Error).message} onRetry={() => categoriesQuery.refetch()} />;

  const categories = categoriesQuery.data;
  const tree = buildCategoryTree(categories);
  const products = productsQuery.data ?? [];
  const countFor = (id: string) => products.filter((p) => p.categoryId === id).length;
  const subCount = categories.length - tree.length;

  // Tree order; a subcategory that matches the search keeps its parent row visible
  const rows: { category: Category; isSub: boolean; childCount: number }[] = [];
  for (const root of tree) {
    const rootHit = matchesSearch(search, root.name, root.slug, root.description);
    const subs = root.children.filter((c) => rootHit || matchesSearch(search, c.name, c.slug, c.description));
    if (!rootHit && subs.length === 0) continue;
    rows.push({ category: root, isSub: false, childCount: root.children.length });
    for (const sub of subs) rows.push({ category: sub, isSub: true, childCount: 0 });
  }

  const onDelete = (c: Category) => {
    if (window.confirm(`Delete category "${c.name}"?`)) deleteMutation.mutate(c.id);
  };

  return (
    <section>
      <div className="grid kpi-grid">
        <Kpi label="Categories" value={bdNumber(tree.length)} sub="Top-level sections" />
        <Kpi label="Subcategories" value={bdNumber(subCount)} sub="Shown under their category" />
        <Kpi label="Products" value={bdNumber(products.length)} sub="Across all categories" />
        <Kpi
          label="Empty"
          value={bdNumber(categories.filter((c) => countFor(c.id) === 0).length)}
          sub="No products of their own"
        />
      </div>

      <Card>
        <CardHead
          title="All categories"
          right={
            <button className="btn sm" onClick={() => setEditing({ parentId: "" })}>
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
                  <th className="num">Order</th>
                  <th className="num">Products</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows.map(({ category: c, isSub, childCount }) => {
                  const count = countFor(c.id);
                  const locked = count > 0 || childCount > 0;
                  return (
                    <tr key={c.id}>
                      <td className="prod-name">
                        {isSub ? (
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 6, paddingLeft: 18 }}>
                            <CornerDownRight size={14} style={{ opacity: 0.45 }} />
                            <span style={{ fontWeight: 500 }}>{c.name}</span>
                          </span>
                        ) : (
                          <>
                            {c.name}
                            {childCount > 0 && (
                              <span className="muted" style={{ fontWeight: 400, fontSize: 12, marginLeft: 8 }}>
                                {childCount} sub{childCount === 1 ? "" : "s"}
                              </span>
                            )}
                          </>
                        )}
                      </td>
                      <td className="mono muted">{c.slug}</td>
                      <td className="num muted">{c.position ?? 0}</td>
                      <td className="num">{count}</td>
                      <td className="num" style={{ whiteSpace: "nowrap" }}>
                        {!isSub && (
                          <>
                            <button
                              className="btn sm ghost"
                              title={`Add a subcategory under ${c.name}`}
                              onClick={() => setEditing({ parentId: c.id })}
                            >
                              <Plus />
                              Sub
                            </button>{" "}
                          </>
                        )}
                        <button className="btn sm ghost" onClick={() => setEditing({ category: c })}>
                          <Pencil />
                          Edit
                        </button>{" "}
                        <button
                          className="btn sm danger"
                          disabled={locked || deleteMutation.isPending}
                          title={
                            childCount > 0
                              ? "Delete or move its subcategories first"
                              : count > 0
                                ? "Only empty categories can be deleted"
                                : "Delete category"
                          }
                          onClick={() => onDelete(c)}
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
          Subcategories appear under their category in the navbar dropdown and the mobile menu. A category&apos;s page
          also lists its subcategories&apos; products. Lower &ldquo;Order&rdquo; numbers show first. Only categories
          with no products and no subcategories can be deleted.
        </p>
      </Card>

      {editing && <CategoryModal editing={editing} categories={categories} onClose={() => setEditing(null)} />}
    </section>
  );
}

function CategoryModal({
  editing,
  categories,
  onClose,
}: {
  editing: NonNullable<Editing>;
  categories: Category[];
  onClose: () => void;
}) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const category = "category" in editing ? editing.category : null;
  // A category with subcategories must stay top-level (two levels only)
  const hasChildren = category ? categories.some((c) => c.parentId === category.id) : false;
  const parentOptions = categories.filter((c) => !c.parentId && c.id !== category?.id);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CategoryForm>({
    resolver: zodResolver(categorySchema),
    defaultValues: category
      ? {
          name: category.name,
          slug: category.slug,
          description: category.description ?? "",
          parentId: category.parentId ?? "",
          position: String(category.position ?? 0),
        }
      : { name: "", slug: "", description: "", parentId: "parentId" in editing ? editing.parentId : "", position: "0" },
  });

  const saveMutation = useMutation({
    mutationFn: (values: CategoryForm) => {
      const body = {
        name: values.name,
        slug: values.slug,
        description: values.description,
        parentId: values.parentId || null,
        position: Number(values.position || 0),
      };
      return category
        ? apiClient.patch<Category>(`/admin/categories/${category.id}`, body)
        : apiClient.post<Category>("/admin/categories", body);
    },
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      toast.success(category ? "Category updated" : "Category created");
      onClose();
      if (!(await revalidateCache(CACHE_TAGS.categories))) toast.error(STOREFRONT_REFRESH_FAILED);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const parentName =
    "parentId" in editing && editing.parentId ? categories.find((c) => c.id === editing.parentId)?.name : null;
  const title = category ? `Edit — ${category.name}` : parentName ? `New subcategory in ${parentName}` : "New Category";

  return (
    <Modal title={title} onClose={onClose}>
      <form onSubmit={handleSubmit((v) => saveMutation.mutate(v))} noValidate>
        <div className="form-2col">
          <Field label="Name" error={errors.name?.message}>
            <input {...register("name")} placeholder="Smartwatch" />
          </Field>
          <Field label="Slug" error={errors.slug?.message}>
            <input className="mono" {...register("slug")} placeholder="smartwatch" />
          </Field>
        </div>
        <div className="form-2col">
          <Field label="Parent category" error={errors.parentId?.message}>
            <select {...register("parentId")} disabled={hasChildren}>
              <option value="">None — top-level category</option>
              {parentOptions.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Display order" error={errors.position?.message}>
            <input type="number" min={0} {...register("position")} placeholder="0" />
          </Field>
        </div>
        {hasChildren && (
          <p className="muted" style={{ fontSize: 12, marginTop: -6, marginBottom: 12 }}>
            This category has subcategories, so it stays top-level.
          </p>
        )}
        <Field label="Description" error={errors.description?.message}>
          <textarea {...register("description")} placeholder="Smartwatches from Apple, Samsung and more" />
        </Field>
        <button type="submit" className="btn block" disabled={isSubmitting || saveMutation.isPending}>
          {saveMutation.isPending ? "Saving…" : category ? "Save Category" : "Create Category"}
        </button>
      </form>
    </Modal>
  );
}
