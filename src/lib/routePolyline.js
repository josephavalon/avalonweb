// Google Route Optimization returns encoded polylines with 1e5 precision.
// Decoding stays in the browser so route identifiers and care metadata never
// need to be included in Mapbox requests.
export function decodeRoutePolyline(encoded = '') {
  const points = [];
  let index = 0;
  let latitude = 0;
  let longitude = 0;
  const decodeValue = () => {
    let result = 0;
    let shift = 0;
    let byte;
    do {
      if (index >= encoded.length) throw new Error('invalid_polyline');
      byte = encoded.charCodeAt(index) - 63;
      index += 1;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20 && shift < 32);
    return result & 1 ? ~(result >> 1) : result >> 1;
  };
  try {
    while (index < encoded.length) {
      latitude += decodeValue();
      longitude += decodeValue();
      points.push([longitude / 1e5, latitude / 1e5]);
    }
  } catch {
    return [];
  }
  return points;
}
