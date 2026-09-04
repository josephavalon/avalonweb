import { Link } from 'react-router-dom';
import { ArrowRight, ChevronDown } from 'lucide-react';
import ConsumerFooter from '@/components/landing/ConsumerFooter';
import { productsByCategory, slugify } from '@/data/products';
import { formatPrice, founderPricingFor } from '@/data/catalog/founder-pricing';
import { useSeo } from '@/lib/seo';
import { CBD_HIDDEN } from '@/lib/cbdVisibility';

// NOTE: this is the component behind /protocols — src/App.jsx imports it as
// `const Menu = lazyRoute(() => import('./pages/ConsumerMenu'))`. The similarly
// named app-modules/pages/Menu.jsx is NOT routed and does not ship.
const CATEGORY_ORDER = ['iv-vitamins', 'nad', 'cbd', 'iv-addons', 'shots']
  .filter((slug) => !(CBD_HIDDEN && slug === 'cbd'));

const SECTION_EYEBROWS = {
  'iv-addons': 'Added to any IV',
  shots: 'Added to any IV',
};
const SECTION_NOTES = {
  'iv-addons': 'Add-ons are given during an IV visit. They aren’t available on their own.',
  shots: 'Shots are given during an IV visit. They aren’t available on their own.',
};

function price(product) {
  return product.oneTime || product.price || 'Price confirmed before booking';
}

function MenuPrice({ product, categorySlug }) {
  const founderPricing = founderPricingFor(product, categorySlug);

  if (!founderPricing) {
    return <span className="nd-menu__item-price">{price(product)}</span>;
  }

  return (
    <span
      className="nd-menu__item-price nd-menu__item-price--founder"
      aria-label={`Founder price ${formatPrice(founderPricing.founder)}, regularly ${formatPrice(founderPricing.standard)}`}
    >
      <small>Founder</small>
      <strong>{formatPrice(founderPricing.founder)}</strong>
      <s aria-hidden="true">{formatPrice(founderPricing.standard)}</s>
    </span>
  );
}

// Native <details> rather than a JS accordion: keyboard and screen-reader
// behaviour comes for free, and the section still opens with JS disabled.
function MenuSection({ id, heading, eyebrow, note, defaultOpen, children }) {
  return (
    <details className="nd-menu__section" open={defaultOpen}>
      <summary className="nd-menu__section-title">
        <span className="nd-menu__section-heading">
          <h2 id={id}>{heading}</h2>
          {eyebrow && <p>{eyebrow}</p>}
          {note && <p className="nd-menu__shots-note">{note}</p>}
        </span>
        <ChevronDown className="nd-menu__section-chevron" aria-hidden="true" />
      </summary>
      <div className="nd-menu__section-body">
        <div className="nd-menu__list">{children}</div>
      </div>
    </details>
  );
}

export default function ConsumerMenu() {
  useSeo({
    title: 'Therapies — Avalon Vitality',
    description: 'Explore Avalon Vitality mobile IV therapy options and transparent per-visit pricing.',
    path: '/protocols',
  });

  return (
    <div className="nd-consumer">
      <main className="nd-menu">
        <div className="nd-menu__intro">
          <p>Therapies</p>
          <h1>Physician-formulated.<br />Nurse-delivered.</h1>
          <span>Every visit is reviewed before care and delivered by a registered nurse.</span>
        </div>

        {CATEGORY_ORDER.map((categorySlug, index) => {
          const category = productsByCategory[categorySlug];
          return (
            <MenuSection
              key={categorySlug}
              id={`menu-${categorySlug}`}
              heading={category.categoryLabel || category.title}
              eyebrow={SECTION_EYEBROWS[categorySlug]}
              note={SECTION_NOTES[categorySlug]}
              defaultOpen={index === 0}
            >
              {category.treatments.map((product) => (
                <Link
                  key={product.name}
                  to={`/products/${categorySlug}/${slugify(product.name)}`}
                  className="nd-menu__item"
                >
                  <span className="nd-menu__bag" aria-hidden="true">
                    {product.image && (
                      <img src={product.image} alt="" loading="lazy" decoding="async" />
                    )}
                  </span>
                  <span className="nd-menu__item-copy">
                    <strong>{product.name}</strong>
                    <small>{product.benefitStatement || product.desc}</small>
                  </span>
                  <MenuPrice product={product} categorySlug={categorySlug} />
                  <ArrowRight aria-hidden="true" />
                </Link>
              ))}
            </MenuSection>
          );
        })}

        <p className="nd-consumer__medical-note">
          General wellness services only. Treatment requires intake, consent, and clinical approval.
        </p>
      </main>

      <ConsumerFooter />
    </div>
  );
}
