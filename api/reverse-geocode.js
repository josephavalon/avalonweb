import { checkRateLimit, clientIp } from './_lib/rate-limit.js';

const STATE_ABBR = {
  Alabama: 'AL',
  Alaska: 'AK',
  Arizona: 'AZ',
  Arkansas: 'AR',
  California: 'CA',
  Colorado: 'CO',
  Connecticut: 'CT',
  Delaware: 'DE',
  Florida: 'FL',
  Georgia: 'GA',
  Hawaii: 'HI',
  Idaho: 'ID',
  Illinois: 'IL',
  Indiana: 'IN',
  Iowa: 'IA',
  Kansas: 'KS',
  Kentucky: 'KY',
  Louisiana: 'LA',
  Maine: 'ME',
  Maryland: 'MD',
  Massachusetts: 'MA',
  Michigan: 'MI',
  Minnesota: 'MN',
  Mississippi: 'MS',
  Missouri: 'MO',
  Montana: 'MT',
  Nebraska: 'NE',
  Nevada: 'NV',
  'New Hampshire': 'NH',
  'New Jersey': 'NJ',
  'New Mexico': 'NM',
  'New York': 'NY',
  'North Carolina': 'NC',
  'North Dakota': 'ND',
  Ohio: 'OH',
  Oklahoma: 'OK',
  Oregon: 'OR',
  Pennsylvania: 'PA',
  'Rhode Island': 'RI',
  'South Carolina': 'SC',
  'South Dakota': 'SD',
  Tennessee: 'TN',
  Texas: 'TX',
  Utah: 'UT',
  Vermont: 'VT',
  Virginia: 'VA',
  Washington: 'WA',
  'West Virginia': 'WV',
  Wisconsin: 'WI',
  Wyoming: 'WY',
  'District of Columbia': 'DC',
};

function parseCoordinate(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function cityFromAddress(address = {}) {
  return address.city || address.town || address.village || address.hamlet || address.county || '';
}

function streetFromAddress(address = {}) {
  const road = address.road || address.pedestrian || address.footway || address.path || address.residential || '';
  return [address.house_number, road].filter(Boolean).join(' ').trim();
}

function formatStreetAddress(address = {}, displayName = '') {
  const street = streetFromAddress(address);
  const city = cityFromAddress(address);
  const state = STATE_ABBR[address.state] || address.state_code?.toUpperCase() || address.state || '';
  const postal = String(address.postcode || '').split(';')[0].trim();
  const parts = [
    street,
    city,
    state,
  ].filter(Boolean);

  if (street && city && state) return parts.join(', ');
  return displayName || parts.join(', ');
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const rate = await checkRateLimit({
    key: `reverse-geocode:${clientIp(req)}`,
    windowMs: 60_000,
    max: 30,
  });
  if (!rate.ok) {
    res.setHeader?.('Retry-After', Math.ceil((rate.reset - Date.now()) / 1000));
    return res.status(429).json({ error: 'Too many location lookups' });
  }

  const lat = parseCoordinate(req.query.lat);
  const lng = parseCoordinate(req.query.lng ?? req.query.lon);
  if (lat == null || lng == null || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    return res.status(400).json({ error: 'Valid lat and lng are required' });
  }

  const params = new URLSearchParams({
    format: 'jsonv2',
    lat: String(lat),
    lon: String(lng),
    addressdetails: '1',
    zoom: '18',
  });

  try {
    const response = await fetch(`https://nominatim.openstreetmap.org/reverse?${params}`, {
      headers: {
        'User-Agent': 'AvalonVitalityBooking/1.0 (snooches.avalonvitality.co)',
        Referer: 'https://snooches.avalonvitality.co',
      },
    });
    const data = await response.json().catch(() => null);
    if (!response.ok || !data) {
      return res.status(response.status || 502).json({ error: data?.error || 'Address lookup failed' });
    }

    const address = data.address || {};
    const formattedAddress = formatStreetAddress(address, data.display_name || '');
    if (!formattedAddress) {
      return res.status(404).json({ error: 'Street address not found for current location' });
    }

    res.setHeader?.('Cache-Control', 'no-store');
    return res.status(200).json({
      ok: true,
      address: formattedAddress,
      zip: String(address.postcode || '').split(';')[0].trim(),
      city: cityFromAddress(address),
      state: STATE_ABBR[address.state] || address.state || '',
    });
  } catch (err) {
    console.error('[reverse-geocode]', err.message);
    return res.status(502).json({ error: 'Address lookup failed' });
  }
}
