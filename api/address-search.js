import { checkRateLimit, clientIp } from './_lib/rate-limit.js';
import { safeLogContext } from './_lib/safe-error.js';

// Forward address autocomplete. Mirrors reverse-geocode.js: uses the free
// Nominatim (OpenStreetMap) geocoder — no API key, US-only — and returns
// structured components so the booking form can fill Street / City / State /
// ZIP separately. The composed `address` string is what flows to Acuity.

const STATE_ABBR = {
  Alabama: 'AL', Alaska: 'AK', Arizona: 'AZ', Arkansas: 'AR', California: 'CA',
  Colorado: 'CO', Connecticut: 'CT', Delaware: 'DE', Florida: 'FL', Georgia: 'GA',
  Hawaii: 'HI', Idaho: 'ID', Illinois: 'IL', Indiana: 'IN', Iowa: 'IA',
  Kansas: 'KS', Kentucky: 'KY', Louisiana: 'LA', Maine: 'ME', Maryland: 'MD',
  Massachusetts: 'MA', Michigan: 'MI', Minnesota: 'MN', Mississippi: 'MS',
  Missouri: 'MO', Montana: 'MT', Nebraska: 'NE', Nevada: 'NV',
  'New Hampshire': 'NH', 'New Jersey': 'NJ', 'New Mexico': 'NM', 'New York': 'NY',
  'North Carolina': 'NC', 'North Dakota': 'ND', Ohio: 'OH', Oklahoma: 'OK',
  Oregon: 'OR', Pennsylvania: 'PA', 'Rhode Island': 'RI', 'South Carolina': 'SC',
  'South Dakota': 'SD', Tennessee: 'TN', Texas: 'TX', Utah: 'UT', Vermont: 'VT',
  Virginia: 'VA', Washington: 'WA', 'West Virginia': 'WV', Wisconsin: 'WI',
  Wyoming: 'WY', 'District of Columbia': 'DC',
};

function cityFromAddress(address = {}) {
  return address.city || address.town || address.village || address.hamlet || address.county || '';
}

function streetFromAddress(address = {}) {
  const road = address.road || address.pedestrian || address.footway || address.path || address.residential || '';
  // Nominatim can return a house-number range like "560;562" — use the first.
  const houseNumber = String(address.house_number || '').split(';')[0].trim();
  return [houseNumber, road].filter(Boolean).join(' ').trim();
}

function stateFromAddress(address = {}) {
  return STATE_ABBR[address.state] || address.state_code?.toUpperCase() || address.state || '';
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const rate = await checkRateLimit({
    key: `address-search:${clientIp(req)}`,
    windowMs: 60_000,
    max: 40,
  });
  if (!rate.ok) {
    res.setHeader?.('Retry-After', Math.ceil((rate.reset - Date.now()) / 1000));
    return res.status(429).json({ error: 'Too many address lookups' });
  }

  const query = String(req.query.q || '').trim().slice(0, 120);
  if (query.length < 3) {
    return res.status(200).json({ ok: true, results: [] });
  }

  const params = new URLSearchParams({
    format: 'jsonv2',
    q: query,
    addressdetails: '1',
    countrycodes: 'us',
    limit: '6',
  });

  try {
    const response = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
      headers: {
        'User-Agent': 'AvalonVitalityBooking/1.0 (snooches.avalonvitality.co)',
        Referer: 'https://snooches.avalonvitality.co',
      },
    });
    const data = await response.json().catch(() => null);
    if (!response.ok || !Array.isArray(data)) {
      return res.status(response.status || 502).json({ error: 'Address lookup failed' });
    }

    const seen = new Set();
    const results = [];
    for (const item of data) {
      const address = item.address || {};
      const street = streetFromAddress(address);
      const city = cityFromAddress(address);
      const stateCode = stateFromAddress(address);
      const zip = String(address.postcode || '').split(';')[0].trim().slice(0, 5);
      // Only surface results precise enough to use (need a street + city).
      if (!street || !city) continue;
      const label = [street, city, [stateCode, zip].filter(Boolean).join(' ')].filter(Boolean).join(', ');
      if (seen.has(label)) continue;
      seen.add(label);
      results.push({ street, city, state: stateCode, zip, label });
      if (results.length >= 5) break;
    }

    res.setHeader?.('Cache-Control', 'no-store');
    return res.status(200).json({ ok: true, results });
  } catch (err) {
    console.error('[address-search]', safeLogContext(err, 'address_search_failed'));
    return res.status(502).json({ error: 'Address lookup failed' });
  }
}
