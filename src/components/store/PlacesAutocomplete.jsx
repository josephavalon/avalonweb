import React, { useEffect, useRef, useState } from 'react';
import AddressAutocomplete from './AddressAutocomplete';

// Google Places-backed street-address autocomplete. Loads Maps JS SDK on
// mount with the Places library. On pick, fires onSelect with the same
// { street, city, state, zip, label } shape the existing keyless
// AddressAutocomplete uses, so callers can swap components without touching
// their handlers.
//
// If VITE_GOOGLE_MAPS_API_KEY is missing, or the SDK fails to load, this
// silently degrades to the OSM/Nominatim-backed AddressAutocomplete so the
// checkout never loses its autocomplete affordance.

const API_KEY = typeof import.meta !== 'undefined'
  ? (import.meta.env?.VITE_GOOGLE_MAPS_API_KEY || import.meta.env?.VITE_GOOGLE_PLACES_API_KEY || '')
  : '';

const SCRIPT_ID = 'gmaps-places-sdk';
let loaderPromise = null;

function loadGooglePlaces() {
  if (typeof window === 'undefined') return Promise.reject(new Error('no window'));
  if (window.google?.maps?.places?.Autocomplete) return Promise.resolve(window.google);
  if (!API_KEY) return Promise.reject(new Error('missing_key'));
  if (loaderPromise) return loaderPromise;
  loaderPromise = new Promise((resolve, reject) => {
    const existing = document.getElementById(SCRIPT_ID);
    if (existing) {
      existing.addEventListener('load', () => resolve(window.google));
      existing.addEventListener('error', () => reject(new Error('script_error')));
      return;
    }
    const script = document.createElement('script');
    script.id = SCRIPT_ID;
    script.async = true;
    script.defer = true;
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(API_KEY)}&libraries=places&loading=async&v=weekly`;
    script.onload = () => resolve(window.google);
    script.onerror = () => {
      loaderPromise = null;
      reject(new Error('script_error'));
    };
    document.head.appendChild(script);
  });
  return loaderPromise;
}

function parseGooglePlace(place) {
  const components = place?.address_components || [];
  const findLong = (type) => components.find((c) => c.types?.includes(type))?.long_name || '';
  const findShort = (type) => components.find((c) => c.types?.includes(type))?.short_name || '';
  const streetNumber = findLong('street_number');
  const route = findLong('route');
  const street = [streetNumber, route].filter(Boolean).join(' ') || place?.name || '';
  const city = findLong('locality') || findLong('sublocality') || findLong('postal_town') || '';
  const state = findShort('administrative_area_level_1') || '';
  const zip = findShort('postal_code') || '';
  const label = place?.formatted_address || [street, city, [state, zip].filter(Boolean).join(' ')].filter(Boolean).join(', ');
  return { street, city, state, zip, label };
}

export default function PlacesAutocomplete({
  value = '',
  onChange,
  onSelect,
  className,
  ...rest
}) {
  const inputRef = useRef(null);
  const autocompleteRef = useRef(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(!API_KEY);

  useEffect(() => {
    if (failed) return undefined;
    let cancelled = false;
    loadGooglePlaces()
      .then((google) => {
        if (cancelled || !inputRef.current) return;
        const ac = new google.maps.places.Autocomplete(inputRef.current, {
          types: ['address'],
          componentRestrictions: { country: 'us' },
          fields: ['address_components', 'formatted_address', 'name'],
        });
        autocompleteRef.current = ac;
        ac.addListener('place_changed', () => {
          const place = ac.getPlace();
          if (!place) return;
          const parsed = parseGooglePlace(place);
          if (parsed.street) onChange?.(parsed.street);
          onSelect?.(parsed);
        });
        setReady(true);
      })
      .catch(() => {
        if (cancelled) return;
        setFailed(true);
      });
    return () => {
      cancelled = true;
      if (autocompleteRef.current && window.google?.maps?.event) {
        window.google.maps.event.clearInstanceListeners(autocompleteRef.current);
      }
    };
  }, [failed, onChange, onSelect]);

  if (failed) {
    return (
      <AddressAutocomplete
        value={value}
        onChange={onChange}
        onSelect={onSelect}
        className={className}
        {...rest}
      />
    );
  }

  return (
    <input
      {...rest}
      ref={inputRef}
      className={className}
      value={value}
      onChange={(e) => onChange?.(e.target.value)}
      autoComplete={rest.autoComplete || 'address-line1'}
      data-places-ready={ready ? '1' : '0'}
    />
  );
}
