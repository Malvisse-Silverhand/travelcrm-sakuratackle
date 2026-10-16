import type { ReactNode } from "react";
import Link from "next/link";
import FloatingWhatsApp from "@/components/public/FloatingWhatsApp";
import MobileTabBar from "@/components/public/MobileTabBar";
import { FOOTER } from "@/lib/content/site";
import pub from "@/app/public.module.css";
import blocks from "@/lib/builder/blocks.module.css";

/** The public site's frame for pages built in the page builder: the same
 *  header, footer, floating WhatsApp and phone tab bar as the rest of the
 *  site, so a campaign page feels like part of it. */
export default function PageShell({
  children,
  waHref,
  businessName,
}: {
  children: ReactNode;
  waHref: string;
  businessName: string;
}) {
  return (
    <div className={pub.shell}>
      <header className={pub.header}>
        <div className={pub.headerInner}>
          <Link href="/" className={pub.brand}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/logo.webp" alt="Sakura Tackle" width={46} height={46} className={pub.logoMark} />
            <span className={pub.brandText}>
              <span className={pub.brandName}>SAKURA TACKLE</span>
              <span className={pub.brandSub}>Trip Candat Sotong</span>
            </span>
          </Link>
          <div className={pub.headerRight}>
            <Link href="/#tempah" className={pub.headerCta}>
              Book a Boat
            </Link>
          </div>
        </div>
      </header>

      <main>{children}</main>

      <footer className={pub.footer}>
        <div className={`${pub.container} ${pub.footerGrid}`}>
          <div>
            <div className={pub.footerBrand}>{businessName}</div>
            <p className={pub.footerBlurb}>{FOOTER.blurb}</p>
          </div>
          <div>
            <div className={pub.footerHeading}>Menu</div>
            <div className={pub.footerLinks}>
              <Link href="/" className={pub.footerLink}>
                Home
              </Link>
              <Link href="/#tempah" className={pub.footerLink}>
                Book a Boat
              </Link>
              <Link href="/reviews" className={pub.footerLink}>
                Reviews
              </Link>
              <Link href="/polisi" className={pub.footerLink}>
                Terms &amp; Privacy
              </Link>
            </div>
          </div>
        </div>
        <div className={`${pub.container} ${pub.footerBase}`}>
          © {new Date().getFullYear()} {businessName}. Hak Cipta Terpelihara.
        </div>
      </footer>

      <FloatingWhatsApp href={waHref} label={`WhatsApp ${businessName}`} className={blocks.waFloat} />
      <MobileTabBar waHref={waHref} onHome={false} />
    </div>
  );
}
