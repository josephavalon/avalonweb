import { useEffect, useRef } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';

const MONO_STYLE = {
  version: 8,
  sources: {
    carto: {
      type: 'raster',
      tiles: ['https://a.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png', 'https://b.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png'],
      tileSize: 256,
      attribution: '© OpenStreetMap © CARTO',
    },
  },
  layers: [
    { id: 'paper', type: 'background', paint: { 'background-color': '#e9e9e6' } },
    { id: 'carto', type: 'raster', source: 'carto', paint: { 'raster-saturation': -1, 'raster-contrast': 0.18, 'raster-brightness-min': 0.28, 'raster-brightness-max': 0.98 } },
  ],
};

function routeFeatures(plan) {
  return {
    type: 'FeatureCollection',
    features: (plan?.legs || []).filter((leg) => leg.geometry).map((leg) => ({ type: 'Feature', properties: {}, geometry: leg.geometry })),
  };
}

function pointFeatures(plan) {
  const features = [];
  if (Number.isFinite(plan?.origin?.longitude) && Number.isFinite(plan?.origin?.latitude)) {
    features.push({ type: 'Feature', properties: { order: 'S', kind: 'origin' }, geometry: { type: 'Point', coordinates: [plan.origin.longitude, plan.origin.latitude] } });
  }
  (plan?.stops || []).forEach((stop, index) => {
    if (Number.isFinite(stop.coordinate?.longitude) && Number.isFinite(stop.coordinate?.latitude)) features.push({ type: 'Feature', properties: { order: String(index + 1), kind: 'stop' }, geometry: { type: 'Point', coordinates: [stop.coordinate.longitude, stop.coordinate.latitude] } });
  });
  return { type: 'FeatureCollection', features };
}

export default function NurseRouteMap({ plan, className = '', ariaLabel = 'Route map' }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return undefined;
    const map = new mapboxgl.Map({ container: containerRef.current, style: MONO_STYLE, center: [-122.31, 37.68], zoom: 8.5, attributionControl: true });
    mapRef.current = map;
    map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), 'bottom-right');
    return () => { map.remove(); mapRef.current = null; };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !plan) return undefined;
    const update = () => {
      const routes = routeFeatures(plan);
      const points = pointFeatures(plan);
      if (map.getSource('route')) map.getSource('route').setData(routes);
      else {
        map.addSource('route', { type: 'geojson', data: routes });
        map.addLayer({ id: 'route-halo', type: 'line', source: 'route', paint: { 'line-color': '#fff', 'line-width': 9, 'line-opacity': 0.94 } });
        map.addLayer({ id: 'route-line', type: 'line', source: 'route', paint: { 'line-color': '#090909', 'line-width': 4, 'line-opacity': 1 } });
      }
      if (map.getSource('route-points')) map.getSource('route-points').setData(points);
      else {
        map.addSource('route-points', { type: 'geojson', data: points });
        map.addLayer({ id: 'route-point-ring', type: 'circle', source: 'route-points', paint: { 'circle-radius': ['match', ['get', 'kind'], 'origin', 8, 11], 'circle-color': ['match', ['get', 'kind'], 'origin', '#ffffff', '#090909'], 'circle-stroke-color': ['match', ['get', 'kind'], 'origin', '#090909', '#ffffff'], 'circle-stroke-width': 2.5 } });
      }
      if (points.features.length) {
        const bounds = new mapboxgl.LngLatBounds();
        points.features.forEach((feature) => bounds.extend(feature.geometry.coordinates));
        map.fitBounds(bounds, { padding: 48, maxZoom: 13, duration: 500 });
      }
    };
    if (map.isStyleLoaded()) update();
    else map.once('load', update);
    return () => map.off('load', update);
  }, [plan]);

  return <div ref={containerRef} className={className} role="img" aria-label={ariaLabel} style={{ backgroundColor: '#e9e9e6', backgroundImage: 'linear-gradient(#d7d7d2 1px, transparent 1px), linear-gradient(90deg, #d7d7d2 1px, transparent 1px)', backgroundSize: '28px 28px' }} />;
}
