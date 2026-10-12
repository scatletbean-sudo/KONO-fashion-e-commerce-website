import EditorialImage from "./EditorialImage";
import styles from "./storefront.module.css";

const studies = [
  { src: "/images/editorial/denim-rooftop.jpg", alt: "Người mẫu mặc denim trên sân thượng bê tông", label: "01 / OFF DUTY", position: "50% 58%" },
  { src: "/images/editorial/street-uniform.jpg", alt: "Người mẫu mặc hoodie và denim bước trên tường bê tông", label: "02 / IN MOTION", position: "50% 70%" },
  { src: "/images/editorial/concrete-study.jpg", alt: "Nhịp điệu hình học của kiến trúc bê tông", label: "03 / STRUCTURE", position: "50% 50%" },
  { src: "/images/editorial/cargo-silhouette.jpg", alt: "Phong cách streetwear với quần cargo", label: "04 / UTILITY", position: "50% 62%" },
];

export default function CollectionPreview() {
  return <div className={styles.preview}>
    <div className={styles.previewHeading}><h3>COLLECTION PREVIEW</h3><p>Nghiên cứu phom dáng và nhịp sống đô thị.<br />Moodboard tham khảo, không phải sản phẩm KONO.</p></div>
    <div className={styles.productGrid}>{studies.map((study) => <figure key={study.src} className={styles.previewCard}>
      <div className={styles.previewImage}><EditorialImage src={study.src} alt={study.alt} sizes="(max-width: 760px) 46vw, 23vw" position={study.position} /></div>
      <figcaption>{study.label}</figcaption>
    </figure>)}</div>
  </div>;
}
