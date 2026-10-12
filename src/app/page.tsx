import type { Metadata } from "next";
import { ArrowDown, ArrowUpRight } from "lucide-react";
import { StorefrontHeader, StorefrontFooter } from "@/components/storefront/StorefrontShell";
import EditorialImage from "@/components/storefront/EditorialImage";
import NewArrivals from "@/components/storefront/NewArrivals";
import styles from "@/components/storefront/storefront.module.css";

export const metadata: Metadata = {
  title: "KONO® — Recode the ordinary.",
  description: "KONO: một góc nhìn độc lập về denim, utility và bản sắc. Khám phá phong cách streetwear qua phom dáng, chuyển động và kiến trúc đô thị.",
  openGraph: { title: "KONO® — Recode the ordinary.", description: "DENIM / FORM / IDENTITY. Một góc nhìn của riêng bạn.", type: "website", locale: "vi_VN" },
};

export default function Home() {
  return <div className={styles.storefront} lang="vi">
    <a className={styles.skipLink} href="#main-content">Bỏ qua điều hướng</a>
    <StorefrontHeader />
    <main id="main-content">
      <section className={styles.hero} aria-labelledby="hero-title">
        <div className={styles.heroCopy}>
          <p className={styles.eyebrow}>KONO WORLD / INDEPENDENT BY DESIGN</p>
          <h1 id="hero-title" lang="en">RECODE<br /><span>THE</span><br />ORDINARY.</h1>
          <div className={styles.heroBottom}><p>DENIM / FORM / IDENTITY<br /><span>Định nghĩa lại những điều quen thuộc.</span></p><a className={styles.cta} href="#collections">EXPLORE THE EDIT <ArrowUpRight size={17} aria-hidden="true" /></a></div>
        </div>
        <div className={styles.heroPhoto}><EditorialImage src="/images/editorial/denim-rooftop.jpg" alt="Người mẫu mặc denim bước trên sân thượng, phía sau là kiến trúc bê tông" sizes="(max-width: 760px) 100vw, 55vw" position="50% 60%" eager /><span className={styles.heroImageLabel}>01 / THE EVERYDAY, REWRITTEN</span></div>
        <div className={styles.heroRail}><span>AN OPEN INTERPRETATION OF STREETWEAR.</span><a href="#new-arrivals" aria-label="Khám phá sản phẩm và collection preview">SCROLL TO DISCOVER <ArrowDown size={14} aria-hidden="true" /></a></div>
      </section>
      <NewArrivals />
      <section id="about" className={`${styles.statement} ${styles.reveal}`} aria-labelledby="statement-title">
        <div className={styles.statementTop}><p className={styles.eyebrow}>THE KONO PERSPECTIVE</p><span>FORM FOLLOWS IDENTITY.</span></div>
        <h2 id="statement-title" lang="en">NOT ANOTHER<br />UNIFORM<span>—</span></h2>
        <div className={styles.statementBottom}><span className={styles.statementSymbol} aria-hidden="true">[ K ]</span><p>Không cần vừa vặn với mọi khuôn mẫu. Chúng tôi tin vào phom dáng có khoảng thở, chất liệu có chiều sâu, và những điều khiến bạn là chính mình.</p><p className={styles.statementAside}>A DIFFERENT WAY<br />TO BE EVERYDAY.</p></div>
      </section>
      <section id="collections" className={`${styles.collection} ${styles.reveal}`} aria-labelledby="collection-title">
        <div className={styles.collectionIntro}><p className={styles.eyebrow}>THE EDIT / 001</p><span>DENIM &amp; THE CITY</span></div>
        <div className={styles.collectionComposition}>
          <div className={styles.collectionArchitecture}><EditorialImage src="/images/editorial/concrete-study.jpg" alt="Góc nhìn từ dưới lên của tòa nhà bê tông với các đường nét hình học" sizes="(max-width: 760px) 65vw, 35vw" /></div>
          <div className={styles.collectionPhoto}><EditorialImage src="/images/editorial/street-uniform.jpg" alt="Người mẫu mặc hoodie và denim chuyển động giữa hai khối bê tông" sizes="(max-width: 760px) 76vw, 43vw" position="50% 62%" /></div>
          <div className={styles.collectionCopy}><p className={styles.eyebrow}>MATERIAL. MOVEMENT. ATTITUDE.</p><h2 id="collection-title" lang="en">BUILT FOR<br />YOUR OWN<br /><em>RHYTHM.</em></h2><p>Đường nét của thành phố.<br />Chuyển động của riêng bạn.</p><a className={styles.cta} href="#lookbook">VIEW THE VISUAL STORY <ArrowUpRight size={17} aria-hidden="true" /></a></div>
          <span className={styles.collectionIndex}>K—001</span>
        </div>
      </section>
      <section id="lookbook" className={`${styles.lookbook} ${styles.reveal}`} aria-labelledby="lookbook-title">
        <div className={styles.sectionHeading}><div><p className={styles.eyebrow}>A STUDY IN EVERYDAY EXPRESSION</p><h2 id="lookbook-title">OUTSIDE THE LINES.</h2></div><span className={styles.eyebrow}>VISUAL JOURNAL / 01—03</span></div>
        <div className={styles.lookbookGrid}>
          <figure className={styles.lookLarge}><EditorialImage src="/images/editorial/street-uniform.jpg" alt="Denim và phom dáng tự do trong chuyển động đô thị" sizes="(max-width: 760px) 88vw, 49vw" position="50% 65%" /><figcaption><span>01 / FREEDOM IN MOTION</span><span>DENIM STUDY</span></figcaption></figure>
          <div className={styles.lookAside}><figure className={styles.lookWide}><EditorialImage src="/images/editorial/concrete-study.jpg" alt="Cấu trúc bê tông và nhịp điệu lặp lại của ban công" sizes="(max-width: 760px) 80vw, 36vw" position="50% 75%" /><figcaption>02 / CITY AS A CANVAS</figcaption></figure><p lang="en">NO RULES.<br />JUST <em>INTENT.</em></p><figure className={styles.lookPortrait}><EditorialImage src="/images/editorial/cargo-silhouette.jpg" alt="Góc nhìn streetwear với áo rộng và quần cargo" sizes="(max-width: 760px) 64vw, 25vw" position="50% 60%" /><figcaption>03 / THE UTILITY OF SELF</figcaption></figure></div>
        </div>
      </section>
      <div className={styles.imageCredits}>Editorial moodboard — không phải ảnh sản phẩm KONO. <a href="#image-sources">Xem nguồn ảnh <ArrowUpRight size={11} aria-hidden="true" /></a></div>
    </main>
    <StorefrontFooter />
  </div>;
}
