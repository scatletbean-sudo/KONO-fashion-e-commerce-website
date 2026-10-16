"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, ChevronLeft, ChevronRight, ImageOff, Maximize2, Ruler, X } from "lucide-react";
import { productPhotos, type ProductPhoto } from "./product-detail";
import styles from "./product-detail.module.css";

function Photo({ image, name, eager = false, zoom = 1, onRatio }: { onRatio?: (ratio: number) => void; image: ProductPhoto; name: string; eager?: boolean; zoom?: number }) {
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const imageRef = useCallback((node: HTMLImageElement | null) => {
    // Cached/SSR images may finish before React attaches load listeners.
    if (node?.complete) { setStatus(node.naturalWidth > 0 ? "ready" : "error"); if (node.naturalWidth > 0) onRatio?.(node.naturalWidth / node.naturalHeight); }
  }, [onRatio]);
  const safe = /^https?:\/\//i.test(image.url) || (image.url.startsWith("/") && !image.url.startsWith("//"));
  if (!safe || status === "error") return <div className={styles.fallback} role="img" aria-label={`${image.alt || name} — ảnh chưa khả dụng`}><ImageOff size={28} strokeWidth={1} /><span>IMAGE UNAVAILABLE</span></div>;
  return <div className={styles.photoFrame} style={zoom > 1 ? { width: `${zoom * 100}%`, height: "auto", minHeight: "100%" } : undefined}>
    {status === "loading" && <span className={styles.skeleton} role="status" aria-label="Đang tải ảnh" />}
    {/* Cloudinary originals are delivered without cropping, including multi-view and charts. */}
    {/* eslint-disable-next-line @next/next/no-img-element */}
    <img ref={imageRef} src={image.url} alt={image.alt || name} onLoad={event => { setStatus("ready"); onRatio?.(event.currentTarget.naturalWidth / event.currentTarget.naturalHeight); }} onError={() => setStatus("error")} loading={eager ? "eager" : "lazy"} fetchPriority={eager ? "high" : "auto"} referrerPolicy="no-referrer" className={styles.photo} style={{ objectFit: "contain", ...(zoom > 1 ? { height: "auto", maxHeight: "none" } : {}) }} />
  </div>;
}

function Lightbox({ images, initial = 0, name, title = "Product images", close }: { images: ProductPhoto[]; initial?: number; name: string; title?: string; close: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [index, setIndex] = useState(initial);
  const [zoom, setZoom] = useState(1);
  const swipe = useRef<{ x: number; y: number } | null>(null);
  const move = (offset: number) => { setIndex(current => (current + offset + images.length) % images.length); setZoom(1); };
  useEffect(() => {
    const trigger = document.activeElement as HTMLElement | null;
    dialog.current?.showModal();
    const previous = document.body.style.overflow; document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previous; trigger?.focus(); };
  }, []);
  return <dialog ref={dialog} className={styles.lightbox} aria-label={title} onCancel={close} onKeyDown={event => { if (event.target instanceof HTMLInputElement) return; if (event.key === "ArrowRight" || event.key === "ArrowLeft") { event.preventDefault(); move(event.key === "ArrowRight" ? 1 : -1); } }}>
    <div className={styles.lightboxBar}><span>{title} / {index + 1}–{images.length}</span><button type="button" autoFocus onClick={close} aria-label="Close preview"><X size={22} /></button></div>
    <div className={styles.zoomViewport} onTouchStart={event => { swipe.current = { x: event.touches[0].clientX, y: event.touches[0].clientY }; }} onTouchEnd={event => { if (!swipe.current || zoom !== 1) return; const dx = event.changedTouches[0].clientX - swipe.current.x; const dy = event.changedTouches[0].clientY - swipe.current.y; if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) move(dx < 0 ? 1 : -1); swipe.current = null; }}>
      <Photo key={images[index].url} image={images[index]} name={name} eager zoom={zoom} />
    </div>
    <div className={styles.lightboxBar}><button type="button" disabled={images.length < 2} aria-label="Previous preview image" onClick={() => move(-1)}><ArrowLeft size={20} /></button><label className={styles.zoomLabel}>Zoom <input aria-label="Image zoom" type="range" min="1" max="4" step="0.25" value={zoom} onChange={event => setZoom(Number(event.target.value))} /><output>{Math.round(zoom * 100)}%</output></label><button type="button" disabled={images.length < 2} aria-label="Next preview image" onClick={() => move(1)}><ArrowRight size={20} /></button></div>
    <p className={styles.caption}>{images[index].alt || name}</p>
  </dialog>;
}

export function SizeGuide({ images, name }: { images: ProductPhoto[]; name: string }) {
  const [open, setOpen] = useState(false);
  const charts = images.filter(image => image.imageType === "SIZE_CHART").sort((a, b) => a.sortOrder - b.sortOrder);
  return <><button type="button" className={styles.sizeGuide} disabled={!charts.length} onClick={() => setOpen(true)} aria-label="Open Size Guide"><Ruler size={16} />Size Guide{!charts.length && <span> — chưa có bảng size</span>}</button>{open && <Lightbox images={charts} name={name} title="Size Guide" close={() => setOpen(false)} />}</>;
}

function GalleryControls({ count, previous, next, expand, suffix = "" }: { count: number; previous: () => void; next: () => void; expand: () => void; suffix?: string }) {
  return <>
    {count > 1 && <><button type="button" className={`${styles.galleryArrow} ${styles.galleryPrevious}`} aria-label={`Previous product image${suffix}`} onClick={previous}><ChevronLeft size={22} strokeWidth={1.25} /></button><button type="button" className={`${styles.galleryArrow} ${styles.galleryNext}`} aria-label={`Next product image${suffix}`} onClick={next}><ChevronRight size={22} strokeWidth={1.25} /></button></>}
    <button type="button" className={styles.zoomHint} aria-label={`Expand product image${suffix}`} onClick={expand}><Maximize2 size={15} strokeWidth={1.5} /><span>EXPAND</span></button>
  </>;
}

export default function ProductGallery({ images: source, name }: { images: ProductPhoto[]; name: string }) {
  const images = productPhotos(source);
  const grid = images.filter(image => image.imageType !== "MULTI_VIEW").length >= 2;
  const [index, setIndex] = useState(0);
  const [preview, setPreview] = useState(false);
  const swipe = useRef<{ x: number; y: number } | null>(null);
  const [ratios, setRatios] = useState<Record<string, number>>({});
  const track = useRef<HTMLDivElement>(null);
  const jump = (next: number) => {
    const selected = (next + images.length) % images.length;
    setIndex(selected);
    if (grid && matchMedia("(min-width: 1280px)").matches) {
      track.current?.children[selected]?.scrollIntoView({ block: "nearest", behavior: "instant" });
      return;
    }
    track.current?.scrollTo({ left: selected * track.current.clientWidth, behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" });
  };
  if (!images.length) return <div className={styles.emptyGallery}><ImageOff size={32} strokeWidth={1} /><p>Ảnh sản phẩm đang cập nhật.</p></div>;
  return <div className={styles.gallery} data-grid={grid}>
    <div className={styles.galleryHero} onTouchStart={event => { swipe.current = { x: event.touches[0].clientX, y: event.touches[0].clientY }; }} onTouchEnd={event => { const start = swipe.current; swipe.current = null; if (!start || (grid && matchMedia("(min-width: 1280px)").matches)) return; const dx = event.changedTouches[0].clientX - start.x; const dy = event.changedTouches[0].clientY - start.y; if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) jump(index + (dx < 0 ? 1 : -1)); }} onKeyDown={event => { if (event.target instanceof HTMLInputElement) return; if (event.key === "ArrowRight" || event.key === "ArrowLeft") { event.preventDefault(); jump(index + (event.key === "ArrowRight" ? 1 : -1)); } }}>
      <div ref={track} style={{ aspectRatio: ratios[images[index]?.id] ?? "4 / 5" }} className={styles.track} role="region" aria-label="Product image gallery" aria-roledescription="carousel" tabIndex={0} onScroll={() => { if (track.current) setIndex(Math.min(images.length - 1, Math.round(track.current.scrollLeft / track.current.clientWidth))); }}>
        {images.map((image, i) => <div key={image.id} className={styles.slide} style={{ aspectRatio: ratios[image.id] }} data-multi={image.imageType === "MULTI_VIEW"} role="group" aria-roledescription="slide" aria-label={`${i + 1} / ${images.length}`}><button type="button" aria-label={`Zoom image ${i + 1}`} onClick={() => { setIndex(i); setPreview(true); }}><Photo image={image} name={name} eager={i === 0} onRatio={ratio => setRatios(current => current[image.id] === ratio ? current : { ...current, [image.id]: ratio })} /></button><div className={styles.tileControls}><GalleryControls count={images.length} previous={() => jump(i - 1)} next={() => jump(i + 1)} expand={() => { setIndex(i); setPreview(true); }} suffix={` from image ${i + 1}`} /></div></div>)}
      </div>
      <span className={styles.imageCount} aria-live="polite">{String(index + 1).padStart(2, "0")} / {String(images.length).padStart(2, "0")}</span><div className={styles.carouselControls}><GalleryControls count={images.length} previous={() => jump(index - 1)} next={() => jump(index + 1)} expand={() => setPreview(true)} /></div>
    </div>
    {images.length > 1 && <div className={styles.thumbnails} aria-label="Product image thumbnails">{images.map((image, i) => <button type="button" key={image.id} aria-label={`View image ${i + 1}`} aria-pressed={index === i} onClick={() => jump(i)}><Photo image={image} name={name} /></button>)}</div>}
    {preview && <Lightbox images={images} initial={index} name={name} close={() => setPreview(false)} />}
  </div>;
}
