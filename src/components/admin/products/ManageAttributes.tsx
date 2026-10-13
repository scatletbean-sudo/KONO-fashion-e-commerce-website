"use client";

import { useRef, useState, type FormEvent } from "react";
import { CatalogApiError, attributeListSchema, attributeResources, catalogRequest, makeSlug, type AttributeCatalog, type AttributeResource, type CatalogAttribute } from "@/features/products/admin/product-management";
import { attributeConflict, attributeFormValues, parseAttributeForm, type AttributeFormValues } from "@/features/products/admin/attribute-management";

import DeleteConfirmation from "./DeleteConfirmation";

export const attributeLabels: Record<AttributeResource, string> = {
  categories: "Categories", collections: "Collections", colors: "Colors", sizes: "Sizes",
};

function AttributeGroup({ resource, items, onSaved, onDeleted, loading, loadError, onReload }: { resource: AttributeResource; items: CatalogAttribute[]; onSaved: (resource: AttributeResource, item: CatalogAttribute) => void; onDeleted: (resource: AttributeResource, id: string) => void; loading?: boolean; loadError?: string; onReload: () => void }) {
  const [editing, setEditing] = useState<CatalogAttribute | null>(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<AttributeFormValues>(attributeFormValues());
  const [slugEdited, setSlugEdited] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const busy = useRef(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const label = ({ categories: "Category", collections: "Collection", colors: "Color", sizes: "Size" } as const)[resource];
  const supportsStatus = resource === "categories" || resource === "collections";
  function start(item?: CatalogAttribute) {
    setEditing(item ?? null); setForm(attributeFormValues(item)); setSlugEdited(!!item);
    setErrors({}); setError(""); setMessage(""); setOpen(true);
  }
  function change<K extends keyof AttributeFormValues>(key: K, value: AttributeFormValues[K]) {
    setForm(current => ({ ...current, [key]: value }));
    setErrors(current => { const next = { ...current }; delete next[key]; return next; }); setError("");
  }
  function showErrors(next: Record<string, string>) {
    setErrors(next);
    requestAnimationFrame(() => document.getElementById(`${resource}-${Object.keys(next)[0]}`)?.focus());
  }
  async function save(event: FormEvent) {
    event.preventDefault();
    if (busy.current) return;
    const parsed = parseAttributeForm(resource, form);
    if (!parsed.success) {
      showErrors(Object.fromEntries(parsed.error.issues.map(issue => [issue.path.join("."), issue.message])));
      setError("Check the highlighted fields."); return;
    }
    const conflict = attributeConflict(items, form.name, form.slug, editing?.id);
    if (conflict) { showErrors({ [conflict.field]: conflict.message }); setError(conflict.message); return; }
    busy.current = true; setSaving(true); setError(""); setMessage("");
    try {
      const item = await catalogRequest(`/api/admin/${resource}${editing ? `/${encodeURIComponent(editing.id)}` : ""}`, attributeListSchema.element, {
        method: editing ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(parsed.data),
      });
      onSaved(resource, item); setOpen(false); setMessage(`${label} ${editing ? "updated" : "created"} successfully.`);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Could not save this attribute.");
      if (error instanceof CatalogApiError) showErrors(Object.fromEntries(Object.entries(error.fieldErrors).map(([key, messages]) => [key, messages.join(" ")])));
    } finally { busy.current = false; setSaving(false); }
  }
  async function toggle(item: CatalogAttribute) {
    if (busy.current) return;
    busy.current = true; setSaving(true); setError(""); setMessage("");
    try {
      const updated = await catalogRequest(`/api/admin/${resource}/${encodeURIComponent(item.id)}`, attributeListSchema.element, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ isActive: !item.isActive }),
      });
      onSaved(resource, updated); setMessage(`${label} ${updated.isActive ? "activated" : "deactivated"}. Existing product links are preserved.`);
    } catch (error) { setError(error instanceof Error ? error.message : "Could not change this attribute's status."); }
    finally { busy.current = false; setSaving(false); }
  }
  async function remove() {
    if (!editing || busy.current) return;
    busy.current = true; setSaving(true); setDeleteError("");
    try {
      await catalogRequest("/api/admin/" + resource + "/" + encodeURIComponent(editing.id), attributeListSchema.element, { method: "DELETE" });
      onDeleted(resource, editing.id); setConfirmDelete(false); setOpen(false); setEditing(null); setError("");
      setMessage(label + " deleted successfully.");
    } catch (error) { setDeleteError(error instanceof Error ? error.message : "Could not delete this attribute."); }
    finally { busy.current = false; setSaving(false); }
  }
  const fields = ["name", "slug", ...(supportsStatus ? ["description"] : resource === "colors" ? ["hexCode"] : ["sortOrder"])] as (Exclude<keyof AttributeFormValues, "isActive">)[];
  return <section aria-labelledby={`attributes-${resource}`} className="min-w-0 rounded-xl border border-neutral-200 bg-white">
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-200 px-4 py-4 sm:px-5">
      <h2 id={`attributes-${resource}`} className="font-medium">{attributeLabels[resource]} <span className="ml-1 rounded-full bg-neutral-100 px-2.5 py-1 text-xs font-normal text-neutral-600">{items.length}</span></h2>
      <button type="button" disabled={saving || loading || !!loadError} aria-label={`Add New ${label}`} onClick={() => start()} className="rounded-lg bg-neutral-950 px-3 py-2 text-xs font-medium text-white disabled:opacity-50">Add New</button>
    </div>
    {!supportsStatus && <p className="px-4 pt-3 text-xs text-neutral-500 sm:px-5">{label} does not support Active/Inactive yet. All existing entries are available for selection.</p>}
    {message && <p role="status" className="m-4 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">{message}</p>}
    {error && <p role="alert" className="m-4 rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</p>}
    {confirmDelete && editing && <DeleteConfirmation name={editing.name} label={label} busy={saving} error={deleteError} onCancel={() => { setConfirmDelete(false); setDeleteError(""); }} onConfirm={remove} />}
    {open && !loading && !loadError && <form onSubmit={save} noValidate className="m-4 space-y-3 rounded-lg border border-neutral-200 bg-neutral-50 p-4">
      <h3 className="text-sm font-medium">{editing ? "Edit" : "New"} {label}</h3>
      <fieldset disabled={saving} className="space-y-3">
        {fields.map(key => <div key={key}><label htmlFor={`${resource}-${key}`} className="text-sm text-neutral-700">{{ name: "Name *", slug: "Slug *", description: "Description", hexCode: "HEX color", sortOrder: "Display order *" }[key]}</label>
          {key === "description" ? <textarea id={`${resource}-${key}`} value={form[key]} rows={3} onChange={event => change(key, event.target.value)} aria-invalid={!!errors[key]} aria-describedby={errors[key] ? `${resource}-${key}-error` : undefined} className="mt-1 block w-full min-w-0 rounded-lg border border-neutral-200 bg-white p-3 text-sm" /> : <input id={`${resource}-${key}`} value={form[key]} inputMode={key === "sortOrder" ? "numeric" : undefined} placeholder={key === "hexCode" ? "#000000" : undefined} onChange={event => {
            change(key, event.target.value);
            if (key === "slug") setSlugEdited(true);
            if (key === "name" && !slugEdited) change("slug", makeSlug(event.target.value));
          }} aria-invalid={!!errors[key]} aria-describedby={errors[key] ? `${resource}-${key}-error` : undefined} className="mt-1 block w-full min-w-0 rounded-lg border border-neutral-200 bg-white p-3 text-sm" />}
          {errors[key] && <p id={`${resource}-${key}-error`} className="mt-1 text-xs text-red-700">{errors[key]}</p>}
        </div>)}
        {supportsStatus && <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.isActive} onChange={event => change("isActive", event.target.checked)} className="accent-neutral-950" />Active</label>}
      </fieldset>
      <div className="flex flex-wrap gap-2">{editing && <button type="button" disabled={saving} onClick={() => { setDeleteError(""); setConfirmDelete(true); }} className="rounded-lg border border-red-300 bg-white px-4 py-2 text-sm text-red-700 disabled:opacity-50">Delete {label}</button>}<button type="submit" disabled={saving} className="rounded-lg bg-neutral-950 px-4 py-2 text-sm text-white disabled:opacity-50">{saving ? "Saving…" : `Save ${label}`}</button><button type="button" disabled={saving} onClick={() => { setOpen(false); setError(""); }} className="rounded-lg border border-neutral-300 bg-white px-4 py-2 text-sm disabled:opacity-50">Cancel</button></div>
    </form>}
    {loading ? <p role="status" className="p-5 text-sm text-neutral-500">Loading {resource}…</p> : loadError ? <div role="alert" className="p-5 text-sm text-red-800"><p>{loadError}</p><button type="button" aria-label={`Reload ${attributeLabels[resource]}`} onClick={onReload} className="mt-2 underline">Reload attributes</button></div> : !items.length ? <p className="p-5 text-sm text-neutral-500">No {resource} yet. Use Add New to create one.</p> : <ul className="divide-y divide-neutral-100">
      {items.map(attribute => <li key={attribute.id} className="space-y-2 p-4 sm:px-5">
        <div className="flex flex-wrap items-start justify-between gap-2"><div className="min-w-0 flex-1"><p className="break-words text-sm font-medium">{attribute.name}</p><p className="mt-1 break-all text-xs text-neutral-500">{attribute.slug}</p></div>{attribute.isActive !== undefined && <span className={`rounded-full px-2 py-1 text-xs ${attribute.isActive ? "bg-emerald-50 text-emerald-700" : "bg-neutral-100 text-neutral-600"}`}>{attribute.isActive ? "Active" : "Inactive"}</span>}</div>
        {attribute.description && <p className="break-words text-sm text-neutral-500">{attribute.description}</p>}
        {resource === "colors" && attribute.hexCode && <p className="flex items-center gap-2 text-xs text-neutral-500">{/^#[\da-f]{3}(?:[\da-f]{3})?$/i.test(attribute.hexCode) && <span aria-hidden="true" className="h-4 w-4 rounded-full border border-neutral-200" style={{ backgroundColor: attribute.hexCode }} />}{attribute.hexCode}</p>}
        {resource === "sizes" && attribute.sortOrder !== undefined && <p className="text-xs text-neutral-500">Sort order: {attribute.sortOrder}</p>}
        <div className="flex flex-wrap gap-3"><button type="button" disabled={saving} onClick={() => start(attribute)} aria-label={`Edit ${label} ${attribute.name}`} className="text-sm text-neutral-700 underline disabled:opacity-50">Edit</button>{supportsStatus && <button type="button" disabled={saving || open} onClick={() => toggle(attribute)} aria-label={`${attribute.isActive ? "Deactivate" : "Activate"} ${label} ${attribute.name}`} className="text-sm text-neutral-700 underline disabled:opacity-50">{attribute.isActive ? "Set Inactive" : "Set Active"}</button>}</div>
      </li>)}
    </ul>}
  </section>;
}

export default function ManageAttributes({ catalog, initialGroup, onSaved, onDeleted, loading, errors, onReload }: { catalog: AttributeCatalog; initialGroup?: AttributeResource; onSaved: (resource: AttributeResource, item: CatalogAttribute) => void; onDeleted: (resource: AttributeResource, id: string) => void; loading: Record<AttributeResource, boolean>; errors: Partial<Record<AttributeResource, string>>; onReload: () => void }) {
  const groups = initialGroup ? [initialGroup, ...attributeResources.filter(resource => resource !== initialGroup)] : attributeResources;
  return <div className="space-y-5">
    <p className="text-sm text-neutral-500">Create and edit attributes here, then select them in Create Product. Deactivating a category or collection preserves existing product links.</p>
    <div className="grid items-start gap-5 xl:grid-cols-2">
      {groups.map(resource => <AttributeGroup key={resource} resource={resource} items={catalog[resource]} onSaved={onSaved} onDeleted={onDeleted} loading={loading[resource]} loadError={errors[resource]} onReload={onReload} />)}
    </div>
  </div>;
}
