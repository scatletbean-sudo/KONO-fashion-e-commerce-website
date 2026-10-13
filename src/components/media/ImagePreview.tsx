"use client";

import { useEffect, useRef, useState } from "react";

export default function ImagePreview({ src, alt, onClose }: { src: string; alt: string; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [zoom, setZoom] = useState(1);
  useEffect(() => { dialog.current?.showModal(); }, []);
  return <dialog ref={dialog} onCancel={onClose} onClose={onClose} aria-label="Image preview and zoom" className="fixed inset-0 m-auto w-[95vw] max-w-6xl rounded-xl border border-neutral-300 bg-white p-4 text-neutral-950 backdrop:bg-black/70">
    <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
      <label className="flex items-center gap-3 text-sm">Zoom <input aria-label="Image zoom" type="range" min="1" max="4" step="0.25" value={zoom} onChange={event => setZoom(Number(event.target.value))} /><output>{Math.round(zoom * 100)}%</output></label>
      <button type="button" autoFocus onClick={onClose} className="rounded-lg border px-4 py-2">Close preview</button>
    </div>
    <div className="h-[70vh] overflow-auto rounded-lg bg-neutral-100">
      {/* Original images must retain their full aspect ratio, including size charts. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={alt} referrerPolicy="no-referrer" style={{ width: `${zoom * 100}%`, maxWidth: "none", ...(zoom === 1 ? { height: "100%", objectFit: "contain" } : { height: "auto" }) }} />
    </div>
    <p className="mt-3 text-sm">{alt || "Product image"}</p>
  </dialog>;
}
