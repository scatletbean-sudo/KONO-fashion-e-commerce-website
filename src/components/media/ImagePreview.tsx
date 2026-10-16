"use client";

import { useEffect, useRef, useState } from "react";
import { ImageOff } from "lucide-react";

export default function ImagePreview({ src, alt, onClose }: { src: string; alt: string; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [zoom, setZoom] = useState(1);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const trigger = document.activeElement as HTMLElement | null;
    dialog.current?.showModal();
    return () => trigger?.focus();
  }, []);
  return <dialog ref={dialog} onCancel={onClose} onClose={onClose} aria-label="Image preview and zoom" className="fixed inset-0 m-auto w-[95vw] max-w-6xl rounded-xl border border-neutral-300 bg-white p-4 text-neutral-950 backdrop:bg-black/70">
    <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
      <label className="flex items-center gap-3 text-sm">Zoom <input aria-label="Image zoom" type="range" min="1" max="4" step="0.25" value={zoom} onChange={event => setZoom(Number(event.target.value))} /><output>{Math.round(zoom * 100)}%</output></label>
      <button type="button" autoFocus onClick={onClose} className="rounded-lg border px-4 py-2">Close preview</button>
    </div>
    <div className="h-[70vh] overflow-auto rounded-lg bg-neutral-100">
      {/* Original images must retain their full aspect ratio, including size charts. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {failed ? <div role="status" className="flex h-full flex-col items-center justify-center gap-3 text-neutral-500"><ImageOff size={32} strokeWidth={1} /><p>Image unavailable</p><p className="text-sm">The original image details are preserved.</p></div> : <img src={src} alt={alt} onError={() => setFailed(true)} referrerPolicy="no-referrer" style={{ width: `${zoom * 100}%`, maxWidth: "none", ...(zoom === 1 ? { height: "100%", objectFit: "contain" } : { height: "auto" }) }} />}
    </div>
    <p className="mt-3 text-sm">{alt || "Product image"}</p>
  </dialog>;
}
