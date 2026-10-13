"use client";

import { useEffect, useRef, useState } from "react";

export default function DeleteConfirmation({ name, label, busy, error, onCancel, onConfirm }: { name: string; label: string; busy: boolean; error: string; onCancel: () => void; onConfirm: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [confirmed, setConfirmed] = useState(false);
  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    return () => element?.close();
  }, []);
  return <dialog ref={dialog} aria-labelledby="delete-title" aria-describedby="delete-description" onCancel={event => { event.preventDefault(); if (!busy) onCancel(); }} className="m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-md overflow-y-auto rounded-xl border border-neutral-200 bg-white p-5 shadow-xl backdrop:bg-black/40">
    <h2 id="delete-title" className="text-lg font-medium">Delete {label}</h2>
    <p id="delete-description" className="mt-3 break-words text-sm text-neutral-700">Permanently delete <strong>{name}</strong>? This cannot be undone. Attributes in use cannot be deleted.</p>
    <label className="mt-4 flex items-start gap-2 text-sm"><input type="checkbox" autoFocus disabled={busy} checked={confirmed} onChange={event => setConfirmed(event.target.checked)} className="mt-1 shrink-0 accent-red-700" /><span className="break-words">I confirm deletion of {name}.</span></label>
    {error && <p role="alert" className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</p>}
    <div className="mt-5 flex flex-wrap justify-end gap-2">
      <button type="button" disabled={busy} onClick={onCancel} className="rounded-lg border border-neutral-300 px-4 py-2 text-sm disabled:opacity-50">Cancel</button>
      <button type="button" disabled={busy || !confirmed} onClick={onConfirm} className="rounded-lg bg-red-700 px-4 py-2 text-sm text-white disabled:opacity-50">{busy ? "Deleting..." : "Confirm Delete"}</button>
    </div>
  </dialog>;
}
