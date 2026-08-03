import { Link } from 'react-router-dom';
import { ArrowRight, ChevronDown } from 'lucide-react';
import ConsumerFooter from '@/components/landing/ConsumerFooter';
import { productsByCategory, slugify } from '@/data/products';
import { IM_SHOT_FAMILIES } from '@/data/catalog';
import { useSeo } from '@/lib/seo';

const CATEGORY_ORDER = ['iv-vitamins', 'nad', 'cbd'];

function price(product) {
  return product.oneTime || product.price || 'Price confirmed before booking';
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
                  <span className="nd-menu__item-price">{price(product)}</span>
                  <ArrowRight aria-hidden="true" />
                </Link>
              ))}
            </MenuSection>
          );
        })}

        <MenuSection
          id="menu-shots"
          heading="Shots"
          eyebrow="Added to any IV"
          note={'Shots are given during an IV visit. They aren’t available on their own.'}
        >
          {IM_SHOT_FAMILIES.map((family) => (
            <Link
              key={family.name}
              to={`/products/shots/${slugify(family.name)}`}
              className="nd-menu__shot"
            >
              <span className="nd-menu__shot-bag" aria-hidden="true">
                {family.img && <img src={family.img} alt="" loading="lazy" decoding="async" />}
              </span>
              <span className="nd-menu__shot-copy">
                <strong>{family.name}</strong>
                <small>{family.desc}</small>
              </span>
              <span className="nd-menu__shot-doses">
                {family.tiers.map((tier) => (
                  <span key={tier.label} className="nd-menu__shot-dose">
                    {tier.dose && <span className="nd-menu__shot-dose-label">{tier.dose}</span>}
                    <span className="nd-menu__shot-price av-price">${tier.price}</span>
                  </span>
                ))}
              </span>
              <ArrowRight aria-hidden="true" />
            </Link>
          ))}
        </MenuSection>

        <p className="nd-consumer__medical-note">
          General wellness services only. Treatment requires intake, consent, and clinical approval.
        </p>
      </main>

      <ConsumerFooter />
    </div>
  );
}
