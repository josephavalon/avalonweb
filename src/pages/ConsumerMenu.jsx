import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import ConsumerFooter from '@/components/landing/ConsumerFooter';
import { productsByCategory, slugify } from '@/data/products';
import { useSeo } from '@/lib/seo';

const CATEGORY_ORDER = ['iv-vitamins', 'nad', 'cbd'];

function price(product) {
  return product.oneTime || product.price || 'Price confirmed before booking';
}

export default function ConsumerMenu() {
  useSeo({
    title: 'IV Menu — Avalon Vitality',
    description: 'Explore Avalon Vitality mobile IV therapy options and transparent per-visit pricing.',
    path: '/protocols',
  });

  return (
    <div className="nd-consumer">
      <main className="nd-menu">
        <div className="nd-menu__intro">
          <p>IV Menu</p>
          <h1>Physician-formulated.<br />Nurse-delivered.</h1>
          <span>Every visit is reviewed before care and delivered by a registered nurse.</span>
        </div>

        {CATEGORY_ORDER.map((categorySlug) => {
          const category = productsByCategory[categorySlug];
          return (
            <section key={categorySlug} className="nd-menu__section" aria-labelledby={`menu-${categorySlug}`}>
              <div className="nd-menu__section-title">
                <h2 id={`menu-${categorySlug}`}>{category.categoryLabel || category.title}</h2>
                {categorySlug !== 'iv-vitamins' && <p>Clinician reviewed</p>}
              </div>

              <div className="nd-menu__list">
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
              </div>
            </section>
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
