"use client";

import { useRef, useState } from "react";
import { z } from "zod";
import ImagePreview from "@/components/media/ImagePreview";
import { imageTypes, MAX_PRODUCT_IMAGES, mediaImageSchema, validateImageFile, type MediaImage } from "@/features/products/images/media-policy";
import { mediaRequest, signedUploadSchema, uploadImageDirect, type SignedUpload } from "@/features/products/images/media-client";

const json = (method: string, body: unknown) => ({ method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
const control = "rounded-lg border border-neutral-300 px-3 py-2 text-sm disabled:opacity-40";

function ImageMetadata({ image, disabled, save }: { image: MediaImage; disabled: boolean; save: (metadata: { alt: string; imageType: MediaImage["imageType"] }) => Promise<void> }) {
  const [alt, setAlt] = useState(image.alt ?? "");
  const [imageType, setImageType] = useState(image.imageType);
  const changed = alt !== (image.alt ?? "") || imageType !== image.imageType;
  return <div className="space-y-3">
    <label className="block text-sm">Image category<select aria-label={`Category for image ${image.sortOrder + 1}`} value={imageType} disabled={disabled} onChange={event => setImageType(event.target.value as MediaImage["imageType"])} className="mt-1 w-full rounded-lg border p-2">{imageTypes.map(type => <option key={type}>{type}</option>)}</select></label>
    <label className="block text-sm">Alt Text<input aria-label={`Alt Text for image ${image.sortOrder + 1}`} value={alt} disabled={disabled} maxLength={255} onChange={event => setAlt(event.target.value)} className="mt-1 w-full rounded-lg border p-2" /></label>
    <button type="button" disabled={disabled || !changed} className={control} onClick={() => void save({ alt, imageType })}>Save image details</button>
  </div>;
}

export default function MediaManager({ productId, productName, initialImages }: { productId: string; productName: string; initialImages: MediaImage[] }) {
  const [images, setImages] = useState(initialImages);
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [category, setCategory] = useState<MediaImage["imageType"]>("FRONT_VIEW");
  const [preview, setPreview] = useState<MediaImage | null>(null);
  const [deleting, setDeleting] = useState<MediaImage | null>(null);
  const [unattached, setUnattached] = useState<{ signed: SignedUpload; imageType: MediaImage["imageType"]; name: string } | null>(null);
  const deleteDialog = useRef<HTMLDialogElement>(null);
  const ordered = [...images].sort((a, b) => a.sortOrder - b.sortOrder);

  async function run(action: () => Promise<void>) {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError(""); setMessage("");
    try { await action(); }
    catch (error) { setMessage(""); setError(error instanceof Error ? error.message : "Could not save media. Try again."); }
    finally { lock.current = false; setBusy(false); }
  }
  async function attach(signed: SignedUpload, imageType: MediaImage["imageType"]) {
    const image = await mediaRequest("/api/admin/products/images", mediaImageSchema, json("POST", { productId, publicId: signed.publicId, uploadToken: signed.uploadToken, imageType, alt: "" }));
    setImages(current => [...current.filter(item => item.id !== image.id).map(item => image.isPrimary ? { ...item, isPrimary: false } : item), image]);
    setUnattached(null);
  }
  async function upload(files: File[]) {
    await run(async () => {
      if (unattached) throw new Error("Retry saving the uploaded image or reload the gallery before uploading more.");
      if (files.length + images.length > MAX_PRODUCT_IMAGES) throw new Error("A product can have at most 24 images.");
      files.forEach(validateImageFile);
      for (const [index, file] of files.entries()) {
        setMessage(`Uploading ${index + 1}/${files.length}: ${file.name}`);
        const signed = await mediaRequest("/api/admin/media/sign", signedUploadSchema, json("POST", { productId, size: file.size, type: file.type }));
        await uploadImageDirect(file, signed);
        setUnattached({ signed, imageType: category, name: file.name });
        await attach(signed, category);
      }
      setMessage("Images uploaded and verified. Add Alt Text to describe each image.");
    });
  }
  async function update(image: MediaImage, metadata: { alt?: string; imageType?: MediaImage["imageType"]; isPrimary?: boolean }) {
    await run(async () => {
      const saved = await mediaRequest(`/api/admin/products/images/${encodeURIComponent(image.id)}`, mediaImageSchema, json("PATCH", metadata));
      setImages(current => current.map(item => item.id === saved.id ? saved : saved.isPrimary ? { ...item, isPrimary: false } : item));
      setMessage("Image details saved.");
    });
  }
  async function move(index: number, offset: number) {
    await run(async () => {
      const ids = ordered.map(image => image.id);
      [ids[index], ids[index + offset]] = [ids[index + offset], ids[index]];
      setImages(await mediaRequest(`/api/admin/products/${encodeURIComponent(productId)}/media/reorder`, z.array(mediaImageSchema), json("PATCH", { ids })));
      setMessage("Image order saved.");
    });
  }
  function closeDelete() { deleteDialog.current?.close(); setDeleting(null); }

  return <section id="media-manager" aria-labelledby="media-manager-title" className="space-y-4 rounded-xl border border-neutral-200 bg-white p-4 sm:p-6" aria-busy={busy}>
    <div className="flex flex-wrap items-center justify-between gap-3"><h2 id="media-manager-title" className="text-lg font-medium">Media Manager</h2><span className="text-sm text-neutral-500">{images.length}/{MAX_PRODUCT_IMAGES} images</span></div>
    <p className="text-sm text-neutral-600">JPG, PNG or WebP, up to 10 MB each. Gallery changes save separately from product details.</p>
    <div className="flex flex-wrap items-end gap-4">
      <label className="text-sm">Category for new uploads<select disabled={busy} className="mt-1 block rounded-lg border p-2" value={category} onChange={event => setCategory(event.target.value as MediaImage["imageType"])}>{imageTypes.map(type => <option key={type}>{type}</option>)}</select></label>
      <label className="block text-sm">Upload images<input aria-label="Upload product images" type="file" multiple accept="image/jpeg,image/png,image/webp" disabled={busy || !!unattached || images.length >= MAX_PRODUCT_IMAGES} className="mt-1 block max-w-full text-sm" onChange={event => { const files = Array.from(event.target.files ?? []); event.target.value = ""; if (files.length) void upload(files); }} /></label>
      <button type="button" className={control} disabled={busy || !!unattached} onClick={() => void run(async () => { setImages(await mediaRequest(`/api/admin/products/images?productId=${encodeURIComponent(productId)}`, z.array(mediaImageSchema))); setMessage("Gallery reloaded."); })}>Reload gallery</button>
    </div>
    {unattached && <div className="rounded-lg bg-amber-50 p-3 text-sm"><p>{unattached.name} was uploaded but still needs to be saved to this product.</p><button type="button" disabled={busy} className={`${control} mt-2`} onClick={() => void run(async () => { await attach(unattached.signed, unattached.imageType); setMessage("Uploaded image verified and saved."); })}>Retry verification and save</button></div>}
    {message && <p role="status" className="text-sm text-emerald-800">{message}</p>}{error && <p role="alert" className="text-sm text-red-700">{error}</p>}
    {!images.length && <p className="text-sm text-neutral-500">No images yet. Upload the first image to set the Primary Image.</p>}
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{ordered.map((image, index) => <article key={image.id} className="min-w-0 space-y-3 rounded-xl border border-neutral-200 p-3">
      <button type="button" onClick={() => setPreview(image)} className="block h-48 w-full rounded-lg bg-neutral-100" aria-label={`Preview image ${index + 1}`}>
        {/* Keep original external images and every MULTI_VIEW panel visible. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={image.url} alt={image.alt || productName} referrerPolicy="no-referrer" loading="lazy" className="h-full w-full rounded-lg object-contain" />
      </button>
      <p className="text-sm font-medium">Image {index + 1}{image.isPrimary ? " · Primary Image" : ""}</p>
      <ImageMetadata key={`${image.id}:${image.alt}:${image.imageType}`} image={image} disabled={busy} save={metadata => update(image, metadata)} />
      <div className="flex flex-wrap gap-2"><button type="button" className={control} disabled={busy || image.isPrimary} onClick={() => void update(image, { isPrimary: true })}>Set Primary</button><button type="button" className={control} aria-label={`Move image ${index + 1} earlier`} disabled={busy || index === 0} onClick={() => void move(index, -1)}>Move up</button><button type="button" className={control} aria-label={`Move image ${index + 1} later`} disabled={busy || index === ordered.length - 1} onClick={() => void move(index, 1)}>Move down</button><button type="button" className={`${control} text-red-700`} disabled={busy} onClick={() => { setDeleting(image); deleteDialog.current?.showModal(); }}>Remove image</button></div>
    </article>)}</div>
    {preview && <ImagePreview src={preview.url} alt={preview.alt || productName} onClose={() => setPreview(null)} />}
    <dialog ref={deleteDialog} onCancel={() => setDeleting(null)} aria-labelledby="remove-image-title" className="m-auto max-w-md rounded-xl border bg-white p-6 backdrop:bg-black/60">
      <h3 id="remove-image-title" className="font-medium">Remove this image?</h3><p className="mt-2 text-sm text-neutral-600">This removes the image from {productName}. Its original file is retained. Removing the Primary Image selects the next image.</p><div className="mt-4 flex gap-3"><button type="button" autoFocus className={control} disabled={busy} onClick={closeDelete}>Cancel</button><button type="button" className={`${control} text-red-700`} disabled={busy || !deleting} onClick={() => { if (deleting) void run(async () => { await mediaRequest(`/api/admin/products/images/${encodeURIComponent(deleting.id)}`, mediaImageSchema, { method: "DELETE" }); setImages(await mediaRequest(`/api/admin/products/images?productId=${encodeURIComponent(productId)}`, z.array(mediaImageSchema))); closeDelete(); setMessage("Image removed from the product."); }); }}>Confirm removal</button></div>
    </dialog>
  </section>;
}
