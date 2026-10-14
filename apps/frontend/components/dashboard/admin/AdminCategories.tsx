"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { apiClient } from "@/lib/api";
import { useToast } from "@/lib/toast";
import type { Category } from "@/lib/types";
import { ErrorState, Field, Spinner, inputClass } from "@/components/ui";

const categorySchema = z.object({
  name: z.string().min(1, "Name is required"),
  slug: z.string().min(1, "Slug is required").regex(/^[a-z0-9-]+$/, "Use lowercase letters, numbers and hyphens"),
  description: z.string().optional(),
});

export default function AdminCategories() {
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
        <h1 className="font-display text-2xl font-bold tracking-tight text-zinc-50">
          Categories
        </h1>
        <button
          onClick={openCreate}
          className="inline-flex items-center gap-1.5 rounded-lg bg-lime-400 px-4 py-2 text-sm font-medium text-zinc-950 hover:bg-lime-300"
        >
          <Plus className="h-4 w-4" />
          New category
        </button>
      </div>
      <p className="text-sm text-zinc-500">{categoriesQuery.data.length} categories</p>

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

      {/* Mobile cards */}
      <ul className="space-y-3 lg:hidden">
        {categoriesQuery.data.map((c) => (
          <li key={c.id} className="rounded-xl bg-zinc-900 p-4 ring-1 ring-zinc-800">
            <p className="font-medium text-zinc-50">{c.name}</p>
            <p className="font-mono text-xs text-zinc-500">{c.slug}</p>
            <div className="mt-3 flex gap-2">
              <button
                onClick={() => openEdit(c)}
                className="inline-flex flex-1 items-center justify-center gap-1 rounded-lg px-3 py-1.5 text-xs font-medium text-lime-400 ring-1 ring-zinc-700 hover:bg-zinc-800"
              >
                <Pencil className="h-3.5 w-3.5" />
                Edit
              </button>
              <button
                onClick={() => {
                  if (window.confirm(`Delete category "${c.name}"? Only empty categories can be deleted.`))
                    deleteMutation.mutate(c.id);
                }}
                className="inline-flex flex-1 items-center justify-center gap-1 rounded-lg px-3 py-1.5 text-xs font-medium text-rose-400 ring-1 ring-zinc-700 hover:bg-zinc-800"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Delete
              </button>
            </div>
          </li>
        ))}
      </ul>

      {/* Desktop table */}
      <div className="hidden overflow-x-auto rounded-xl bg-zinc-900 ring-1 ring-zinc-800 lg:block">
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
                      className="inline-flex items-center gap-1 text-xs font-medium text-lime-400 hover:underline"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                      Edit
                    </button>
                    <button
                      onClick={() => {
                        if (window.confirm(`Delete category "${c.name}"? Only empty categories can be deleted.`))
                          deleteMutation.mutate(c.id);
                      }}
                      className="inline-flex items-center gap-1 text-xs font-medium text-rose-400 hover:underline"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
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
