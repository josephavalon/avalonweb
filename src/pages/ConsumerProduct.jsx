import { Link, Navigate, useParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Check, Clock, House, ShieldCheck } from 'lucide-react';
import ConsumerFooter from '@/components/landing/ConsumerFooter';
import { getProduct } from '@/data/products';
import { useSeo } from '@/lib/seo';
import { CBD_HIDDEN, isCbdProtocolKey } from '@/lib/cbdVisibility';

function productPrice(product) {
  return product.oneTime || product.price || 'Price confirmed before booking';
}

function bookingPath(product, category, slug) {
  const params = new URLSearchParams({
    path: 'book',
    therapy: product.name,
    category,
    product: slug,
  });
  if (product.protocolKey) params.set('protocol', product.protocolKey);
  if (product.doseKey) params.set('dose', product.doseKey);
  return `/nurse-delivery?${params.toString()}`;
}

const SERVICE_DETAIL_PATTERN = /clinici|registered nurse|appointment|administration|visit|review|window/i;

function productIngredients(product) {
  const source = product.ingredients || product.included || product.benefits || [];
  return [...new Set(source.filter((item) => item && !SERVICE_DETAIL_PATTERN.test(item)))].slice(0, 10);
}

export default function ConsumerProduct() {
  const { category, slug } = useParams();
  // CBD is held from the public apex pending clinical + legal review. Nulling the
  // match sends every /products/cbd/* slug (canonical AND the PRODUCT_SLUG_ALIASES
  // variants) down the redirect path below. The vercel.json 301 is the primary
  // defense for crawlers; this is the in-app half.
  const matchedProduct = getProduct(category, slug);
  const match = CBD_HIDDEN && isCbdProtocolKey(category) ? undefined : matchedProduct;

  useSeo({
    title: match ? `${match.treatment.name} — Avalon Vitality` : 'Treatment Not Found — Avalon Vitality',
    description: match?.treatment.seoDescription || match?.treatment.desc || 'Avalon Vitality mobile IV therapy.',
    path: match ? `/products/${category}/${slug}` : undefined,
    // Without this the miss branch answers HTTP 200 under useSeo's default
    // "index, follow" — a soft 404 Google keeps indexed for weeks. The client
    // <Navigate> below is invisible to a crawler that does not run JS.
    robots: match ? 'index, follow, max-image-preview:large' : 'noindex, nofollow',
  });

  if (!match) return <Navigate to="/protocols" replace />;

  const { treatment } = match;
  const ingredients = productIngredients(treatment);
  const duration = treatment.duration || treatment.timeline?.at(-1)?.value || 'Timing confirmed before care';

  return (
    <div className="nd-consumer">
      <main className="nd-product-page">
        <Link to="/protocols" className="nd-product-page__back">
          <ArrowLeft aria-hidden="true" />
          Menu
        </Link>

        <section className="nd-product-page__hero">
          <div className="nd-product-page__hero-copy">
            <h1>{treatment.name}</h1>
            <span>{treatment.benefitStatement || treatment.desc}</span>
          </div>

          <figure className="nd-product-page__visual">
            <img
              src={treatment.image}
              alt={`${treatment.name} product bag`}
              loading="eager"
              decoding="async"
            />
          </figure>

          {treatment.addOnOnly ? (
            <aside className="nd-product-page__booking" aria-label="Booking">
              <p>Per shot</p>
              <strong>{productPrice(treatment)}</strong>
              <Link to="/protocols">
                Choose an IV
                <ArrowRight aria-hidden="true" />
              </Link>
              <small>
                Shots are added to an IV visit and aren&apos;t available on their own.
                Pick your IV first, then add this at booking.
              </small>
            </aside>
          ) : (
            <aside className="nd-product-page__booking" aria-label="Booking">
              <p>Per visit</p>
              <strong>{productPrice(treatment)}</strong>
              <Link to={bookingPath(treatment, category, slug)}>
                Book
                <ArrowRight aria-hidden="true" />
              </Link>
              <small>
                A $50 deposit is requested after acceptance, applies to your visit,
                and is refunded if you&apos;re not clinically eligible.
              </small>
            </aside>
          )}
        </section>

        <section className="nd-product-page__facts" aria-label="Visit details">
          <p><ShieldCheck aria-hidden="true" /><span>Registered nurse</span></p>
          <p><Clock aria-hidden="true" /><span>{duration}</span></p>
          <p><House aria-hidden="true" /><span>Home · Hotel · Office</span></p>
        </section>

        {ingredients.length > 0 && (
          <section className="nd-product-page__included" aria-labelledby="product-ingredients">
            <h2 id="product-ingredients">Ingredients</h2>
            <ul>
              {ingredients.map((item) => (
                <li key={item}>
                  <Check aria-hidden="true" />
                  {item}
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="nd-product-page__delivery" aria-labelledby="product-delivery">
          <div>
            <h2 id="product-delivery">Delivery details</h2>
            <p>A registered nurse brings your therapy and supplies to you.</p>
          </div>
          <dl>
            <div>
              <dt>Where</dt>
              <dd>Home, hotel, or office</dd>
            </div>
            <div>
              <dt>Coverage</dt>
              <dd>SF Bay Area</dd>
            </div>
            <div>
              <dt>Before care</dt>
              <dd>Intake and clinical approval</dd>
            </div>
          </dl>
        </section>

        <aside className="nd-product-page__notice">
          <strong>Wellness notice</strong>
          <p>
            Educational information only. Services are not emergency care and are not intended
            to diagnose, treat, cure, or prevent disease. Final treatment is subject to clinical approval.
          </p>
        </aside>
      </main>

      <ConsumerFooter />
    </div>
  );
}
