"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { z } from "zod";
import { CatalogApiError, catalogRequest, draftFormSchema, emptyDraft, makeSlug, optionListSchema, type CatalogOption, type DraftForm } from "@/features/products/admin/product-management";
import { selectableAttributes } from "@/features/products/admin/attribute-management";
import { parseProductEdit, productAttributeOptions, productFormValues, type EditableProduct } from "@/features/products/admin/product-edit";

const inputClass = "mt-1 block w-full min-w-0 rounded-lg border border-neutral-200 bg-white p-3 text-sm focus:border-neutral-500 focus:outline-none focus:ring-2 focus:ring-neutral-200";
type Options = Record<"categories" | "collections" | "colors" | "sizes", CatalogOption[]>;
function Field({ name, label, error, children }: { name: string; label: string; error?: string; children: ReactNode }) {
  return <div className="min-w-0"><label htmlFor={name} className="text-sm font-medium text-neutral-700">{label}</label>{children}{error && <p id={`${name}-error`} className="mt-1 text-xs text-red-700">{error}</p>}</div>;
}
export default function ProductForm({ initialProduct }: { initialProduct?: EditableProduct }) {
  const editing = !!initialProduct;
  const [form, setForm] = useState<DraftForm>(() => initialProduct ? productFormValues(initialProduct) : emptyDraft);
  const [status, setStatus] = useState<EditableProduct["status"]>(initialProduct?.status ?? "DRAFT");
  const [slugEdited, setSlugEdited] = useState(editing);
  const [options, setOptions] = useState<Options>({ categories: [], collections: [], colors: [], sizes: [] });
  const [optionsLoading, setOptionsLoading] = useState(true);
  const [optionsError, setOptionsError] = useState("");
  const [reload, setReload] = useState(0);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [created, setCreated] = useState("");
  const submitting = useRef(false);
  useEffect(() => {
    const controller = new AbortController();
    const resources = ["categories", "collections", "colors", "sizes"] as const;
    Promise.all(resources.map(async resource => [resource, await catalogRequest(`/api/admin/${resource}`, optionListSchema, { signal: controller.signal })] as const))
      .then(entries => { if (!controller.signal.aborted) setOptions(Object.fromEntries(entries.map(([resource, items]) => [resource, initialProduct ? productAttributeOptions(resource, items, initialProduct) : selectableAttributes(resource, items)])) as Options); })
      .catch(error => { if (!controller.signal.aborted) setOptionsError(error.message); })
      .finally(() => { if (!controller.signal.aborted) setOptionsLoading(false); });
    return () => controller.abort();
  }, [reload, initialProduct]);
  const update = <K extends keyof DraftForm>(key: K, value: DraftForm[K]) => {
    setForm(current => ({ ...current, [key]: value }));
    setErrors(current => Object.fromEntries(Object.entries(current).filter(([name]) => name !== key && !name.startsWith(`${key}.`))));
    setError("");
  };
  const attrs = (name: string) => ({ id: name, "aria-invalid": !!errors[name], "aria-describedby": errors[name] ? `${name}-error` : undefined });
  function showErrors(next: Record<string, string>) {
    setErrors(next);
    requestAnimationFrame(() => document.getElementById(Object.keys(next)[0])?.focus());
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (submitting.current || created || optionsLoading || optionsError) return;
    setError("");
    const parsed = initialProduct ? parseProductEdit(form, status, initialProduct) : draftFormSchema.safeParse(form);
    if (!parsed.success) {
      const next: Record<string, string> = {};
      for (const issue of parsed.error.issues) next[issue.path.join(".")] ??= issue.message;
      showErrors(next);
      setError("Check the highlighted fields before saving.");
      return;
    }
    if (initialProduct && Object.keys(parsed.data).length === 1) { setError("No changes to save."); return; }
    const invalidSelection = form.categoryIds.some(id => !options.categories.some(item => item.id === id))
      || form.collectionIds.some(id => !options.collections.some(item => item.id === id))
      || form.variants.some(variant => (variant.colorId && !options.colors.some(item => item.id === variant.colorId)) || (variant.sizeId && !options.sizes.some(item => item.id === variant.sizeId)));
    if (invalidSelection) { setError("A selected option is no longer available. Reload the page and select it again."); return; }
    submitting.current = true;
    setSaving(true); setErrors({});
    try {
      const saved = await catalogRequest(initialProduct ? `/api/admin/products/${encodeURIComponent(initialProduct.id)}` : "/api/admin/products", z.object({ id: z.string(), status: editing ? z.enum(["DRAFT", "ACTIVE", "ARCHIVED"]) : z.literal("DRAFT") }), {
        method: editing ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(parsed.data),
      });
      setCreated(saved.id);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Could not save the product. Please try again.");
      if (error instanceof CatalogApiError) showErrors(Object.fromEntries(Object.entries(error.fieldErrors).map(([key, messages]) => [key, messages.join(" ")])));
    } finally { submitting.current = false; setSaving(false); }
  }
  function relations(resource: "categories" | "collections", key: "categoryIds" | "collectionIds", label: string) {
    return <fieldset className="min-w-0"><legend className="text-sm font-medium text-neutral-700">{label}</legend><div className="mt-2 space-y-2 rounded-lg border border-neutral-200 p-3">{!options[resource].length ? <p className="text-sm text-neutral-500">No active {resource} available. <Link href={`/admin/products/${resource}`} className="underline">Create one in Manage Attributes</Link>.</p> : options[resource].map(option => <label key={option.id} className="flex items-start gap-2 text-sm"><input type="checkbox" checked={form[key].includes(option.id)} onChange={e => update(key, e.target.checked ? [...form[key], option.id] : form[key].filter(id => id !== option.id))} className="mt-1 accent-neutral-950" /><span className="break-words">{option.name}{option.isActive === false ? " (inactive · current)" : ""}</span></label>)}</div>{errors[key] && <p className="mt-1 text-xs text-red-700">{errors[key]}</p>}</fieldset>;
  }
  return <section className="mx-auto max-w-5xl space-y-6">
    <div><Link href="/admin/products" className="text-sm text-neutral-500 hover:text-neutral-950">← All Products</Link><h1 className="mt-3 text-2xl font-medium">{editing ? "Edit Product" : "Create Product"}</h1><p className="mt-2 text-sm text-neutral-500">{editing ? "Update product details while preserving images, variants and inventory." : "Build your product details and save as a draft."}</p></div>
    {created ? <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-6"><h2 className="font-medium text-emerald-900">{editing ? "Product changes saved" : "Product saved as DRAFT"}</h2><p className="mt-2 text-sm text-emerald-800">{editing ? "Your changes have been saved." : "Your product is ready for review."}</p>{!editing && <Link href={`/admin/products/${encodeURIComponent(created)}/edit#media-manager`} className="mt-4 mr-3 inline-block rounded-lg border border-emerald-600 px-4 py-2 text-sm">Upload product images</Link>}<Link href="/admin/products" className="mt-4 inline-block rounded-lg bg-neutral-950 px-4 py-2 text-sm text-white">View All Products</Link></div> : <form onSubmit={submit} noValidate className="space-y-6">
      {optionsLoading && <p role="status" className="text-sm text-neutral-500">Loading categories, collections, colors and sizes…</p>}
      {optionsError && <div role="alert" className="rounded-lg bg-red-50 p-4 text-sm text-red-800"><p>{optionsError}</p><button type="button" className="mt-2 underline" onClick={() => { setOptionsError(""); setOptionsLoading(true); setReload(n => n + 1); }}>Reload options</button></div>}
      <fieldset disabled={saving} className="space-y-6 disabled:opacity-70">
        <div className="space-y-4 rounded-xl border border-neutral-200 bg-white p-4 sm:p-6"><h2 className="font-medium">Product details</h2>
          <Field name="name" label="Product name *" error={errors.name}><input {...attrs("name")} className={inputClass} value={form.name} maxLength={255} onChange={e => { update("name", e.target.value); if (!slugEdited) update("slug", makeSlug(e.target.value)); }} /></Field>
          <div className="grid gap-4 sm:grid-cols-2"><Field name="slug" label="Slug *" error={errors.slug}><input {...attrs("slug")} className={inputClass} value={form.slug} maxLength={200} onChange={e => { setSlugEdited(true); update("slug", e.target.value); }} /><p className="mt-1 text-xs text-neutral-500">Lowercase letters, numbers and hyphens.</p></Field><Field name="basePrice" label="Selling price (VND) *" error={errors.basePrice}><input {...attrs("basePrice")} className={inputClass} inputMode="numeric" placeholder="e.g. 590000" value={form.basePrice} onChange={e => update("basePrice", e.target.value)} /></Field></div>
          <Field name="description" label="Description" error={errors.description}><textarea {...attrs("description")} className={inputClass} rows={5} value={form.description} onChange={e => update("description", e.target.value)} /></Field>
        </div>
        <div className="rounded-xl border border-neutral-200 bg-white p-4 sm:p-6"><h2 className="mb-4 font-medium">Organization</h2><fieldset disabled={optionsLoading || !!optionsError} className="grid gap-4 sm:grid-cols-2">{relations("categories", "categoryIds", "Categories")}{relations("collections", "collectionIds", "Collections")}</fieldset></div>
        <div className="rounded-xl border border-neutral-200 bg-white p-4 sm:p-6"><h2 className="font-medium">Product images</h2><p className="mt-2 text-sm text-neutral-500">{editing ? <>Manage uploads, Alt Text and image order in <a href="#media-manager" className="underline">Media Manager below</a>. Saving product details preserves the gallery.</> : "Save this draft first, then open Media Manager to upload product images."}</p></div>
        <div className="space-y-4 rounded-xl border border-neutral-200 bg-white p-4 sm:p-6"><h2 className="font-medium">Variants</h2><p className="text-sm text-neutral-500">Add one row per SKU and color/size combination. A draft can have no variants. Stock is not tracked until actual inventory is entered separately.</p>
          {!optionsLoading && !optionsError && (["colors", "sizes"] as const).map(resource => !options[resource].length && <p key={resource} className="text-sm text-neutral-500">No {resource} available. <Link href={`/admin/products/${resource}`} className="underline">Create {resource} in Manage Attributes</Link> before assigning them to variants.</p>)}
          {form.variants.map((variant, index) => <div key={index} className="space-y-3 rounded-lg border border-neutral-200 p-3"><div className="flex items-center justify-between gap-3"><p className="text-sm font-medium">Variant {index + 1}</p>{(!initialProduct || index >= initialProduct.variants.length) && <button type="button" aria-label={`Remove variant ${index + 1}`} className="text-sm text-red-700" onClick={() => { update("variants", form.variants.filter((_, i) => i !== index)); setErrors({}); }}>Remove</button>}</div>{initialProduct?.variants[index] && <p className="text-xs text-neutral-500">{initialProduct.variants[index].isActive ? "Enabled" : "Disabled"} · {initialProduct.variants[index].inventory ? `${initialProduct.variants[index].inventory.quantity} in stock, ${initialProduct.variants[index].inventory.reserved} reserved` : "Inventory not tracked"}. Inventory and variant status are preserved.</p>}<div className="grid gap-3 sm:grid-cols-2">{(["sku", "colorId", "sizeId", "priceOverride"] as const).map(key => {
            const name = `variants.${index}.${key}`;
            const change = (value: string) => update("variants", form.variants.map((item, i) => i === index ? { ...item, [key]: value } : item));
            return <Field key={key} name={name} label={{ sku: "SKU *", colorId: "Color", sizeId: "Size", priceOverride: "Variant price (VND, optional)" }[key]} error={errors[name]}>{key === "colorId" || key === "sizeId" ? <select {...attrs(name)} className={inputClass} disabled={optionsLoading || !!optionsError} value={variant[key]} onChange={e => change(e.target.value)}><option value="">{options[key === "colorId" ? "colors" : "sizes"].length ? "Not specified" : "No options available"}</option>{options[key === "colorId" ? "colors" : "sizes"].map(option => <option key={option.id} value={option.id}>{option.name}</option>)}</select> : <input {...attrs(name)} className={inputClass} value={variant[key]} maxLength={key === "sku" ? 100 : undefined} inputMode={key === "priceOverride" ? "numeric" : undefined} placeholder={key === "priceOverride" ? "Use selling price" : "Unique SKU"} onChange={e => change(e.target.value)} />}</Field>;
          })}</div></div>)}
          {errors.variants && <p className="text-sm text-red-700">{errors.variants}</p>}<button type="button" className="rounded-lg border border-neutral-300 px-3 py-2 text-sm hover:bg-neutral-50" onClick={() => update("variants", [...form.variants, { sku: "", colorId: "", sizeId: "", priceOverride: "" }])}>Add variant</button>
        </div>
      </fieldset>
      {error && <div role="alert" className="rounded-lg bg-red-50 p-4 text-sm text-red-800">{error}</div>}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-neutral-200 bg-white p-4 sm:p-6">{initialProduct ? <div className="min-w-0"><Field name="status" label="Product status" error={errors.status}><select {...attrs("status")} disabled={saving} className={inputClass} value={status} onChange={event => { setStatus(event.target.value as EditableProduct["status"]); setError(""); setErrors({}); }}><option>DRAFT</option><option>ACTIVE</option><option>ARCHIVED</option></select></Field>{initialProduct.status !== "ACTIVE" && <p className="mt-1 max-w-lg text-xs text-neutral-500">Activation requires an active category, a valid image and an enabled variant with a valid price and available stock. The server checks these before saving.</p>}</div> : <p className="text-sm text-neutral-500">Status: <span className="font-medium text-amber-800">DRAFT</span></p>}<div className="flex flex-wrap items-center gap-3">{editing && !saving && <Link href="/admin/products" className="rounded-lg border border-neutral-300 px-4 py-3 text-sm">Cancel</Link>}<button type="submit" disabled={saving || optionsLoading || !!optionsError} className="rounded-lg bg-neutral-950 px-5 py-3 text-sm font-medium text-white hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-50">{saving ? "Saving…" : editing ? "Save Changes" : "Save as Draft"}</button></div></div>
    </form>}
  </section>;
}
