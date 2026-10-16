"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { ArrowDown, ArrowUp, Check, ImageOff, ImagePlus, Loader2, Pencil, RefreshCw, Star, Trash2, Upload, X, ZoomIn } from "lucide-react";
import { z } from "zod";
import ImagePreview from "@/components/media/ImagePreview";
import { imageTypes, MAX_PRODUCT_IMAGES, mediaImageSchema, validateImageFile, type MediaImage } from "@/features/products/images/media-policy";
import { mediaRequest, signedUploadSchema, uploadImageWithProgress, type SignedUpload } from "@/features/products/images/media-client";

const json = (method: string, body: unknown) => ({ method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
const control = "inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-neutral-200 bg-white px-4 py-2 text-sm font-medium transition hover:bg-neutral-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-40";
const primary = `${control.replace("border-neutral-200", "border-black").replace("bg-white", "bg-neutral-950").replace("hover:bg-neutral-100", "hover:bg-neutral-800")} text-white`;
const field = "mt-2 block w-full rounded-lg border border-neutral-200 bg-white p-3 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900 disabled:opacity-40";
const label = (value: string) => value.toLowerCase().replaceAll("_", " ").replace(/\b\w/g, char => char.toUpperCase());
type QueueItem = { id: string; file: File; imageType: MediaImage["imageType"]; status: "queued" | "uploading" | "verifying" | "success" | "error"; progress: number; signed?: SignedUpload; error?: string };

function IconButton({ title, children, ...props }: { title: string; children: ReactNode } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button type="button" title={title} aria-label={title} className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-neutral-600 transition hover:bg-neutral-100 hover:text-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black disabled:cursor-not-allowed disabled:opacity-30" {...props}>{children}</button>;
}

function Thumbnail({ image, productName }: { image: MediaImage; productName: string }) {
  const [failed, setFailed] = useState(false);
  return failed ? <span className="flex h-full flex-col items-center justify-center gap-2 text-neutral-400"><ImageOff size={28} strokeWidth={1} /><span className="text-xs">Image unavailable</span><span className="text-xs">Original details preserved</span></span> :
    // eslint-disable-next-line @next/next/no-img-element
    <img src={image.url} alt={image.alt || productName} referrerPolicy="no-referrer" loading="lazy" onError={() => setFailed(true)} className="h-full w-full object-contain transition duration-300" />;
}

function DetailsDialog({ image, disabled, error, save, close }: { image: MediaImage; disabled: boolean; error: string; save: (metadata: { alt: string; imageType: MediaImage["imageType"] }) => void; close: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [alt, setAlt] = useState(image.alt ?? "");
  const [imageType, setImageType] = useState(image.imageType);
  useEffect(() => {
    const trigger = document.activeElement as HTMLElement | null;
    dialog.current?.showModal();
    return () => trigger?.focus();
  }, []);
  return <dialog ref={dialog} onCancel={event => { if (disabled) event.preventDefault(); else close(); }} aria-labelledby="image-details-title" className="m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-lg overflow-auto rounded-2xl border border-neutral-200 bg-white p-6 text-neutral-950 shadow-2xl backdrop:bg-black/50">
    <div className="flex items-start justify-between gap-4"><div><p className="text-xs uppercase tracking-[0.18em] text-neutral-500">Image {image.sortOrder + 1}</p><h3 id="image-details-title" className="mt-2 text-xl font-medium">Image details</h3></div><IconButton title="Close image details" disabled={disabled} onClick={close}><X size={18} /></IconButton></div>
    <p className="mt-3 text-sm leading-6 text-neutral-500">Describe this image for your customers. Changes save separately from product details.</p>
    <label className="mt-6 block text-sm font-medium">Image Type<select autoFocus value={imageType} disabled={disabled} onChange={event => setImageType(event.target.value as MediaImage["imageType"])} className={field}>{imageTypes.map(type => <option key={type} value={type}>{label(type)}</option>)}</select></label>
    <label className="mt-5 block text-sm font-medium">Alt Text<textarea value={alt} disabled={disabled} maxLength={255} rows={3} onChange={event => setAlt(event.target.value)} className={field} placeholder="Describe the view, garment and visible details" /></label>
    <p className="mt-2 text-right text-xs text-neutral-400">{alt.length}/255</p>
    {error && <p role="alert" className="mt-3 text-sm text-neutral-700">{error}</p>}
    <div className="mt-6 flex justify-end gap-2"><button type="button" disabled={disabled} className={control} onClick={close}>Cancel</button><button type="button" disabled={disabled || (alt === (image.alt ?? "") && imageType === image.imageType)} className={primary} onClick={() => save({ alt, imageType })}>{disabled && <Loader2 size={16} className="animate-spin" />}Save image details</button></div>
  </dialog>;
}

export default function MediaManager({ productId, productName, initialImages }: { productId: string; productName: string; initialImages: MediaImage[] }) {
  const [images, setImages] = useState(initialImages);
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const input = useRef<HTMLInputElement>(null);
  const dragDepth = useRef(0);
  const [dragging, setDragging] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [category, setCategory] = useState<MediaImage["imageType"]>("FRONT_VIEW");
  const [preview, setPreview] = useState<MediaImage | null>(null);
  const [editing, setEditing] = useState<MediaImage | null>(null);
  const [deleting, setDeleting] = useState<MediaImage | null>(null);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const deleteDialog = useRef<HTMLDialogElement>(null);
  const ordered = [...images].sort((a, b) => a.sortOrder - b.sortOrder);
  const pending = queue.filter(item => item.status !== "success");
  const uploadDisabled = busy || images.length + pending.length >= MAX_PRODUCT_IMAGES;
  const patchQueue = (id: string, patch: Partial<QueueItem>) => setQueue(current => current.map(item => item.id === id ? { ...item, ...patch } : item));

  async function run(action: () => Promise<void>) {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError(""); setMessage("");
    try { await action(); }
    catch (error) { setMessage(""); setError(error instanceof Error ? error.message : "Could not save media. Try again."); }
    finally { lock.current = false; setBusy(false); }
  }
  function selectFiles(files: File[]) {
    if (lock.current || !files.length) return;
    setError("");
    try {
      files.forEach(validateImageFile);
      const unique = files.filter((file, index) => !queue.some(item => item.file.name === file.name && item.file.size === file.size && item.file.lastModified === file.lastModified) && files.findIndex(other => other.name === file.name && other.size === file.size && other.lastModified === file.lastModified) === index);
      if (images.length + pending.length + unique.length > MAX_PRODUCT_IMAGES) throw new Error("A product can have at most 24 images. Select fewer files.");
      setQueue(current => [...current, ...unique.map(file => ({ id: crypto.randomUUID(), file, imageType: category, status: "queued" as const, progress: 0 }))]);
      setMessage(unique.length ? `${unique.length} image(s) ready. Review the queue, then choose Upload selected.` : "These files are already in the upload queue.");
    } catch (error) { setError(error instanceof Error ? error.message : "Could not select images."); }
  }
  async function upload(items: QueueItem[]) {
    await run(async () => {
      for (const item of items) {
        let signed = item.signed;
        try {
          if (!signed) {
            patchQueue(item.id, { status: "uploading", progress: 0, error: undefined });
            signed = await mediaRequest("/api/admin/media/sign", signedUploadSchema, json("POST", { productId, size: item.file.size, type: item.file.type }));
            // Preserve the ticket before transfer. An uncertain transfer is verified on retry, never uploaded twice.
            patchQueue(item.id, { signed });
            await uploadImageWithProgress(item.file, signed, progress => patchQueue(item.id, { progress }));
          }
          patchQueue(item.id, { status: "verifying", progress: 100, error: undefined });
          const image = await mediaRequest("/api/admin/products/images", mediaImageSchema, json("POST", { productId, publicId: signed.publicId, uploadToken: signed.uploadToken, imageType: item.imageType, alt: "" }));
          setImages(current => [...current.filter(other => other.id !== image.id).map(other => image.isPrimary ? { ...other, isPrimary: false } : other), image]);
          patchQueue(item.id, { status: "success", progress: 100 });
        } catch (error) {
          patchQueue(item.id, { status: "error", signed, error: error instanceof Error ? error.message : "Could not save this image." });
          // Stop the batch on failure; unstarted files stay queued for explicit retry.
          throw new Error("Upload paused. Review the failed image before continuing.");
        }
      }
      setMessage("Images uploaded and verified. Use Edit details to add Alt Text.");
    });
  }
  async function update(image: MediaImage, metadata: { alt?: string; imageType?: MediaImage["imageType"]; isPrimary?: boolean }) {
    await run(async () => {
      const saved = await mediaRequest(`/api/admin/products/images/${encodeURIComponent(image.id)}`, mediaImageSchema, json("PATCH", metadata));
      setImages(current => current.map(item => item.id === saved.id ? saved : saved.isPrimary ? { ...item, isPrimary: false } : item));
      setEditing(null); setMessage("Image details saved.");
    });
  }
  async function move(index: number, offset: number) {
    await run(async () => {
      if (index + offset < 0 || index + offset >= ordered.length) return;
      const ids = ordered.map(image => image.id);
      [ids[index], ids[index + offset]] = [ids[index + offset], ids[index]];
      setImages(await mediaRequest(`/api/admin/products/${encodeURIComponent(productId)}/media/reorder`, z.array(mediaImageSchema), json("PATCH", { ids })));
      setMessage("Image order saved.");
    });
  }
  function closeDelete() { deleteDialog.current?.close(); setDeleting(null); }

  return <section id="media-manager" aria-labelledby="media-manager-title" className="overflow-hidden rounded-2xl border border-neutral-200 bg-white text-neutral-950" aria-busy={busy}>
    <header className="flex flex-wrap items-center justify-between gap-4 border-b border-neutral-100 px-5 py-6 sm:px-8"><div><p className="text-[10px] font-medium uppercase tracking-[0.24em] text-neutral-400">KONO / Product imagery</p><h2 id="media-manager-title" className="mt-2 text-xl font-medium tracking-tight">Media Manager</h2><p className="mt-2 text-sm text-neutral-500">Build the visual story. Gallery changes save separately from product details.</p></div><span className="rounded-full border border-neutral-200 px-4 py-2 text-xs tabular-nums">{images.length} / {MAX_PRODUCT_IMAGES} images</span></header>
    <div className="space-y-6 p-5 sm:p-8">
      <div className="flex flex-wrap items-end justify-between gap-4"><label className="w-full text-xs font-medium sm:w-60">Image Type for new uploads<select disabled={busy} className={field} value={category} onChange={event => setCategory(event.target.value as MediaImage["imageType"])}>{imageTypes.map(type => <option key={type} value={type}>{label(type)}</option>)}</select></label><p className="max-w-sm text-xs leading-5 text-neutral-500">Choose a view before selecting files. You can edit each image later.</p></div>
      <div onDragEnter={event => { event.preventDefault(); if (event.dataTransfer.types.includes("Files")) { dragDepth.current++; setDragging(true); } }} onDragOver={event => { event.preventDefault(); event.dataTransfer.dropEffect = uploadDisabled ? "none" : "copy"; }} onDragLeave={event => { event.preventDefault(); dragDepth.current = Math.max(0, dragDepth.current - 1); if (!dragDepth.current) setDragging(false); }} onDrop={event => { event.preventDefault(); dragDepth.current = 0; setDragging(false); if (!uploadDisabled) selectFiles(Array.from(event.dataTransfer.files)); }} className={`flex flex-col items-center rounded-xl border border-dashed px-5 py-9 text-center transition ${dragging && !uploadDisabled ? "border-black bg-neutral-100" : "border-neutral-300 bg-neutral-50/60"}`}>
        <span className="mb-4 flex h-12 w-12 items-center justify-center rounded-full border border-neutral-200 bg-white"><Upload size={21} strokeWidth={1.3} /></span>
        <h3 className="text-base font-medium">{images.length >= MAX_PRODUCT_IMAGES ? "Your gallery is full" : "Drop your product images here"}</h3><p id="upload-help" className="mt-2 text-xs leading-5 text-neutral-500">JPG, PNG or WebP · up to 10 MB each · {Math.max(0, MAX_PRODUCT_IMAGES - images.length - pending.length)} slots available</p>
        <input ref={input} aria-label="Upload product images" aria-describedby="upload-help" type="file" multiple accept="image/jpeg,image/png,image/webp" disabled={uploadDisabled} className="sr-only" tabIndex={-1} onChange={event => { selectFiles(Array.from(event.target.files ?? [])); event.target.value = ""; }} />
        <button type="button" disabled={uploadDisabled} onClick={() => input.current?.click()} className={`${primary} mt-5`}><ImagePlus size={16} />Browse Files</button><p className="mt-3 text-[11px] text-neutral-400">Files are queued first. Upload starts only when you confirm.</p>
      </div>
      {!!queue.length && <div className="rounded-xl border border-neutral-200"><div className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-100 p-4"><h3 className="text-sm font-medium">Upload queue <span className="ml-2 text-neutral-400">{pending.length} remaining</span></h3><div className="flex gap-2"><button type="button" className={control} disabled={busy || !queue.some(item => item.status === "success")} onClick={() => setQueue(current => current.filter(item => item.status !== "success"))}>Clear completed</button><button type="button" className={primary} disabled={busy || !queue.some(item => item.status === "queued")} onClick={() => void upload(queue.filter(item => item.status === "queued"))}>{busy ? <Loader2 size={15} className="animate-spin" /> : <Upload size={15} />}Upload selected</button></div></div>
        <ul className="divide-y divide-neutral-100">{queue.map(item => <li key={item.id} className="p-4"><div className="flex items-center gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-neutral-100">{item.status === "success" ? <Check size={18} /> : item.status === "uploading" || item.status === "verifying" ? <Loader2 size={18} className="animate-spin" /> : <ImagePlus size={18} />}</span><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium" title={item.file.name}>{item.file.name}</p><p className="mt-1 text-xs text-neutral-500">{label(item.imageType)} · {(item.file.size / 1024 / 1024).toFixed(1)} MB · {item.status === "success" ? "Saved" : item.status === "verifying" ? "Verifying and saving…" : item.status === "uploading" ? `Uploading ${item.progress}%` : label(item.status)}</p></div>{item.status === "error" && <button type="button" className={control} disabled={busy} onClick={() => void upload([item])}><RefreshCw size={14} />{item.signed ? "Retry verification" : "Retry"}</button>}{item.status !== "success" && <IconButton title={`Remove ${item.file.name} from queue`} disabled={busy} onClick={() => setQueue(current => current.filter(other => other.id !== item.id))}><X size={16} /></IconButton>}</div>{(item.status === "uploading" || item.status === "verifying") && <progress aria-label={`Upload progress for ${item.file.name}`} value={item.progress} max={100} className="mt-3 h-1 w-full accent-black" />}{item.error && <p role="alert" className="mt-3 text-xs leading-5 text-neutral-700">{item.error}{item.signed && " Retry verifies the same asset without uploading again. If it cannot be found, remove this queue entry and select the file again."}</p>}</li>)}</ul>
      </div>}
      <div aria-live="polite" aria-atomic="true">{message && <p role="status" className="rounded-lg bg-neutral-100 px-4 py-3 text-sm">{message}</p>}</div>{error && <p role="alert" className="rounded-lg border border-neutral-300 px-4 py-3 text-sm">{error}</p>}
      <div className="flex items-center justify-between gap-3"><div><h3 className="text-sm font-medium">Product gallery</h3><p className="mt-1 text-xs text-neutral-500">The primary image leads your storefront.</p></div><button type="button" className={control} disabled={busy} onClick={() => void run(async () => { setImages(await mediaRequest(`/api/admin/products/images?productId=${encodeURIComponent(productId)}`, z.array(mediaImageSchema))); setMessage("Gallery reloaded."); })}><RefreshCw size={14} />Reload gallery</button></div>
      {!images.length && <div className="rounded-xl border border-neutral-200 py-12 text-center"><ImagePlus className="mx-auto text-neutral-300" size={30} strokeWidth={1} /><p className="mt-4 text-sm font-medium">A fresh canvas for your product</p><p className="mt-2 text-xs text-neutral-500">Upload the first image to set the Primary Image.</p></div>}
      <div className="grid grid-cols-1 gap-4 min-[420px]:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">{ordered.map((image, index) => <article key={image.id} className={`group min-w-0 overflow-hidden rounded-xl border ${image.isPrimary ? "border-neutral-900" : "border-neutral-200"}`}>
        <div className="relative bg-neutral-50"><button type="button" onClick={() => setPreview(image)} className="block aspect-[4/5] w-full p-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-black" aria-label={`Preview image ${index + 1}`}><Thumbnail key={image.url} image={image} productName={productName} /></button><span className="pointer-events-none absolute left-3 top-3 rounded bg-white/95 px-2 py-1 text-[10px] font-medium tabular-nums">{String(index + 1).padStart(2, "0")}</span>{image.isPrimary && <span aria-label="Primary Image" className="pointer-events-none absolute right-3 top-3 rounded bg-black px-2 py-1 text-[9px] font-medium tracking-widest text-white">PRIMARY</span>}<span className="pointer-events-none absolute bottom-3 left-3 max-w-[calc(100%-1.5rem)] truncate rounded bg-white/95 px-2 py-1 text-[9px] font-medium uppercase tracking-wider">{label(image.imageType)}</span></div>
        <div className="p-3"><p className="truncate text-xs text-neutral-500" title={image.alt || "No Alt Text yet"}>{image.alt || "Add a description with Edit details"}</p><div className="mt-3 flex flex-wrap items-center justify-between gap-1 border-t border-neutral-100 pt-2"><div className="flex"><IconButton title={`Preview image ${index + 1}`} onClick={() => setPreview(image)}><ZoomIn size={16} /></IconButton><IconButton title={`Edit details for image ${index + 1}`} disabled={busy} onClick={() => { setError(""); setEditing(image); }}><Pencil size={16} /></IconButton><IconButton title={image.isPrimary ? `Image ${index + 1} is primary` : `Set image ${index + 1} as primary`} disabled={busy || image.isPrimary} onClick={() => void update(image, { isPrimary: true })}><Star size={16} fill={image.isPrimary ? "currentColor" : "none"} /></IconButton></div><div className="flex"><IconButton title={`Move image ${index + 1} earlier`} disabled={busy || index === 0} onClick={() => void move(index, -1)}><ArrowUp size={16} /></IconButton><IconButton title={`Move image ${index + 1} later`} disabled={busy || index === ordered.length - 1} onClick={() => void move(index, 1)}><ArrowDown size={16} /></IconButton><IconButton title={`Remove image ${index + 1}`} disabled={busy} onClick={() => { setError(""); setDeleting(image); deleteDialog.current?.showModal(); }}><Trash2 size={16} /></IconButton></div></div></div>
      </article>)}</div>
    </div>
    {editing && <DetailsDialog key={editing.id} image={editing} disabled={busy} error={error} close={() => setEditing(null)} save={metadata => void update(editing, metadata)} />}
    {preview && <ImagePreview src={preview.url} alt={preview.alt || productName} onClose={() => setPreview(null)} />}
    <dialog ref={deleteDialog} onCancel={event => { if (busy) event.preventDefault(); else setDeleting(null); }} aria-labelledby="remove-image-title" className="m-auto w-[calc(100%-2rem)] max-w-md rounded-2xl border border-neutral-200 bg-white p-6 text-neutral-950 shadow-2xl backdrop:bg-black/50">
      {error && <p role="alert" className="mb-3 text-sm">{error}</p>}<h3 id="remove-image-title" className="text-xl font-medium">Remove this image?</h3><p className="mt-3 text-sm leading-6 text-neutral-500">This removes the image from {productName}. Its original file is retained. Removing the Primary Image selects the next image.</p><div className="mt-6 flex justify-end gap-2"><button type="button" autoFocus className={control} disabled={busy} onClick={closeDelete}>Cancel</button><button type="button" className={primary} disabled={busy || !deleting} onClick={() => { if (deleting) void run(async () => { await mediaRequest(`/api/admin/products/images/${encodeURIComponent(deleting.id)}`, mediaImageSchema, { method: "DELETE" }); setImages(await mediaRequest(`/api/admin/products/images?productId=${encodeURIComponent(productId)}`, z.array(mediaImageSchema))); closeDelete(); setMessage("Image removed from the product."); }); }}>Confirm removal</button></div>
    </dialog>
  </section>;
}
