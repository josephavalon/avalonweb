import { useEffect } from 'react';

// Lightweight SEO utility for SPA routes.
// Updates document.title + meta description + canonical when a route mounts.
// Also injects JSON-LD structured data scoped to the route.

export function useSeo({ title, description, path, jsonLd }) {
  useEffect(() => {
    if (typeof document === 'undefined') return;

    if (title) document.title = title;

    const setMeta = (name, content) => {
      if (!content) return;
      let el = document.querySelector(`meta[name="${name}"]`);
      if (!el) {
        el = document.createElement('meta');
        el.setAttribute('name', name);
        document.head.appendChild(el);
      }
      el.setAttribute('content', content);
    };
    const setProp = (prop, content) => {
      if (!content) return;
      let el = document.querySelector(`meta[property="${prop}"]`);
      if (!el) {
        el = document.createElement('meta');
        el.setAttribute('property', prop);
        document.head.appendChild(el);
      }
      el.setAttribute('content', content);
    };
    const setCanonical = (href) => {
      if (!href) return;
      let el = document.querySelector('link[rel="canonical"]');
      if (!el) {
        el = document.createElement('link');
        el.setAttribute('rel', 'canonical');
        document.head.appendChild(el);
      }
      el.setAttribute('href', href);
    };

    if (description) setMeta('description', description);
    if (description) setProp('og:description', description);
    if (title) setProp('og:title', title);
    if (path) {
      const url = `https://avalonvitality.co${path.startsWith('/') ? path : '/' + path}`;
      setCanonical(url);
      setProp('og:url', url);
    }

    let scriptEl = null;
    if (jsonLd) {
      scriptEl = document.createElement('script');
      scriptEl.type = 'application/ld+json';
      scriptEl.id = 'route-jsonld';
      scriptEl.text = JSON.stringify(jsonLd);
      // Replace any prior route JSON-LD before injecting new
      const prior = document.getElementById('route-jsonld');
      if (prior) prior.remove();
      document.head.appendChild(scriptEl);
    }

    return () => {
      if (scriptEl && scriptEl.parentNode) scriptEl.remove();
    };
  }, [title, description, path, JSON.stringify(jsonLd)]);
}
