import { useEffect, useRef, useState } from 'react';
import { useAuthStore } from './useAuthStore';
import { apiGet } from './apiClient';

// Hydrates the checkout contact + address + emergency-contact fields from the
// signed-in user's `/api/me/profile` payload so returning clients don't retype
// what we already have on file. Splits the jsonb `emergency_contact`
// { name, phone } into the two separate form inputs.
//
// Shape returned:
//   { ready: boolean, prefill: null | { name, firstName, lastName, email, phone,
//     dob, address, city, state, zip, emergencyContactName, emergencyContactPhone } }
//
// - `ready` flips true once the fetch settles (success OR failure), so a form
//   can gate its "prefilled tile vs empty input" render until we know the answer.
// - `prefill` is null when the user isn't signed in or the profile has nothing
//   useful. Otherwise every field is a string (empty string when unset) so a
//   consumer can `state.name || prefill.name` without branching on null.

function splitName(fullName) {
  const parts = String(fullName || '').trim().split(/\s+/);
  if (!parts.length || !parts[0]) return { firstName: '', lastName: '' };
  const [firstName, ...rest] = parts;
  return { firstName, lastName: rest.join(' ') };
}

function pickAddress(profileRow) {
  const saved = profileRow?.savedAddress || null;
  const address = profileRow?.address || null;
  const src = saved || address || null;
  if (!src) return { street: '', city: '', state: '', zip: '' };
  if (typeof src === 'string') return { street: src, city: '', state: '', zip: '' };
  return {
    street: src.street || src.line1 || src.address1 || '',
    city: src.city || '',
    state: src.state || src.region || '',
    zip: String(src.zip || src.postalCode || src.postal_code || '').replace(/\D/g, '').slice(0, 5),
  };
}

function shapeProfile(payload) {
  const profile = payload?.profile || null;
  if (!profile) return null;
  const { firstName, lastName } = splitName(profile.fullName);
  const address = pickAddress(profile);
  const ec = profile.emergencyContact || {};
  const dobRaw = profile.dateOfBirth || '';
  // dateOfBirth from the API is ISO date (YYYY-MM-DD). BookNow uses MM/DD/YYYY.
  const dob = dobRaw && /^\d{4}-\d{2}-\d{2}/.test(dobRaw)
    ? `${dobRaw.slice(5, 7)}/${dobRaw.slice(8, 10)}/${dobRaw.slice(0, 4)}`
    : String(dobRaw || '');
  return {
    name: profile.fullName || '',
    firstName,
    lastName,
    email: profile.email || '',
    phone: profile.phone || '',
    dob,
    address: address.street,
    city: address.city,
    state: address.state,
    zip: address.zip,
    emergencyContactName: ec?.name || '',
    emergencyContactPhone: ec?.phone || '',
  };
}

export function useProfilePrefill() {
  const { user } = useAuthStore();
  const [state, setState] = useState({ ready: false, prefill: null });
  const fetchedForRef = useRef(null);

  useEffect(() => {
    if (!user) {
      setState({ ready: true, prefill: null });
      fetchedForRef.current = null;
      return;
    }
    const key = user.id || user.username || user.email;
    if (fetchedForRef.current === key) return;
    fetchedForRef.current = key;
    let cancelled = false;
    setState((prev) => ({ ready: prev.ready && prev.prefill != null, prefill: prev.prefill }));
    apiGet('/api/me/profile')
      .then((payload) => {
        if (cancelled) return;
        setState({ ready: true, prefill: shapeProfile(payload) });
      })
      .catch(() => {
        if (cancelled) return;
        setState({ ready: true, prefill: null });
      });
    return () => { cancelled = true; };
  }, [user]);

  return state;
}

export default useProfilePrefill;
