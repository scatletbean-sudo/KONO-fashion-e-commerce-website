"use client";

import Image from "next/image";
import { useState } from "react";
import styles from "./storefront.module.css";

export default function EditorialImage({ src, alt, sizes, eager = false, position = "50% 50%" }: { src: string; alt: string; sizes: string; eager?: boolean; position?: string }) {
  const [failedSource, setFailedSource] = useState<string | null>(null);
  const safeSource = (src.startsWith("/") && !src.startsWith("//")) || /^https?:\/\//i.test(src);
  if (!safeSource || failedSource === src) return <div className={styles.imageFallback} role="img" aria-label={`${alt} — ảnh chưa khả dụng`}><span>KONO®</span><small>IMAGE UNAVAILABLE</small></div>;
  const isLocal = src.startsWith("/");
  return <Image src={src} alt={alt} fill sizes={sizes} unoptimized={!isLocal} loading={eager ? "eager" : "lazy"} fetchPriority={eager ? "high" : "auto"} onError={() => setFailedSource(src)} className={styles.image} style={{ objectPosition: position }} />;
}
