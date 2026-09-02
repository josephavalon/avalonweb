import { useEffect, useMemo, useRef, useState } from 'react';
import { MapPinned } from 'lucide-react';
import 'mapbox-gl/dist/mapbox-gl.css';
import { decodeRoutePolyline } from '@/lib/routePolyline';

const PUBLIC_MAPBOX_TOKEN_RE = /^pk\.[A-Za-z0-9._-]+$/;
const configuredMapboxToken = String(import.meta.env.VITE_MAPBOX_ACCESS_TOKEN || '').trim();
const MAPBOX_TOKEN = PUBLIC_MAPBOX_TOKEN_RE.test(configuredMapboxToken)
  ? configuredMapboxToken
  : '';

function coordinate(value, min, max) {
  const number = Number(value);
  return Number.isFinite(number) && number >= min && number <= max ? number : null;
}

function markerCoordinates(routeDay) {
  const stops = Array.isArray(routeDay?.stops)
    ? routeDay.stops
    : Array.isArray(routeDay?.plan?.stops) ? routeDay.plan.stops : [];
  const markers = [];
  const originLongitude = coordinate(routeDay?.origin_longitude, -180, 180);
  const originLatitude = coordinate(routeDay?.origin_latitude, -90, 90);
  if (originLongitude != null && originLatitude != null) {
    markers.push({ id: 'origin', order: 0, kind: 'origin', coordinates: [originLongitude, originLatitude] });
  }
  stops.forEach((stop, index) => {
    const longitude = coordinate(stop?.longitude, -180, 180);
    const latitude = coordinate(stop?.latitude, -90, 90);
    if (longitude == null || latitude == null) return;
    markers.push({
      id: stop.id || `stop-${index + 1}`,
      order: index + 1,
      kind: stop.kind || stop.stop_type || 'appointment',
      current: stop.current === true || ['active', 'arrived'].includes(String(stop.status || '').toLowerCase()),
      coordinates: [longitude, latitude],
    });
  });
  return markers;
}

function markerElement(marker) {
  const element = document.createElement('div');
  element.className = 'flex h-8 min-w-8 items-center justify-center rounded-full border-2 border-white px-2 font-mono text-[11px] font-black shadow-lg';
  element.style.background = marker.current ? '#b97042' : marker.kind === 'origin' ? '#2b211b' : '#f4eee5';
  element.style.color = marker.kind === 'origin' || marker.current ? '#fffaf2' : '#2b211b';
  element.textContent = marker.kind === 'origin' ? 'S' : String(marker.order);
  element.setAttribute('aria-hidden', 'true');
  return element;
}

export default function NurseRouteMap({ routeDay }) {
  const containerRef = useRef(null);
  const [mapState, setMapState] = useState(MAPBOX_TOKEN ? 'loading' : 'unconfigured');
  const markers = useMemo(() => markerCoordinates(routeDay), [routeDay]);
  const encodedPolyline = String(routeDay?.plan?.overview_polyline || routeDay?.overview_polyline || '').trim();
  const roadCoordinates = useMemo(() => decodeRoutePolyline(encodedPolyline), [encodedPolyline]);
  const lineCoordinates = useMemo(() => (
    roadCoordinates.length >= 2
      ? roadCoordinates
      : markers.map((marker) => marker.coordinates)
  ), [markers, roadCoordinates]);

  useEffect(() => {
    if (!MAPBOX_TOKEN || !containerRef.current || !markers.length) return undefined;
    let disposed = false;
    let map;
    const markerInstances = [];

    import('mapbox-gl').then((module) => {
      if (disposed || !containerRef.current) return;
      const mapboxgl = module.default || module;
      mapboxgl.accessToken = MAPBOX_TOKEN;
      const center = lineCoordinates[0] || markers[0].coordinates;
      map = new mapboxgl.Map({
        container: containerRef.current,
        style: 'mapbox://styles/mapbox/light-v11',
        center,
        zoom: 9,
        attributionControl: true,
        cooperativeGestures: true,
        dragRotate: false,
        pitchWithRotate: false,
      });
      map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), 'top-right');
      map.on('load', () => {
        if (disposed) return;
        if (lineCoordinates.length >= 2) {
          map.addSource('nurse-route', {
            type: 'geojson',
            data: {
              type: 'Feature',
              properties: {},
              geometry: { type: 'LineString', coordinates: lineCoordinates },
            },
          });
          map.addLayer({
            id: 'nurse-route-shadow',
            type: 'line',
            source: 'nurse-route',
            paint: { 'line-color': '#fffaf2', 'line-width': 8, 'line-opacity': 0.9 },
          });
          map.addLayer({
            id: 'nurse-route-line',
            type: 'line',
            source: 'nurse-route',
            paint: {
              'line-color': '#2b211b',
              'line-width': 4,
              'line-opacity': 0.9,
              ...(roadCoordinates.length >= 2 ? {} : { 'line-dasharray': [1.5, 1.5] }),
            },
          });
        }
        for (const marker of markers) {
          markerInstances.push(new mapboxgl.Marker({ element: markerElement(marker), anchor: 'center' })
            .setLngLat(marker.coordinates)
            .addTo(map));
        }
        const bounds = new mapboxgl.LngLatBounds();
        (lineCoordinates.length ? lineCoordinates : markers.map((marker) => marker.coordinates))
          .forEach((point) => bounds.extend(point));
        if (!bounds.isEmpty()) map.fitBounds(bounds, { padding: 54, maxZoom: 13, duration: 0 });
        setMapState('ready');
      });
      map.on('error', () => { if (!disposed) setMapState('error'); });
    }).catch(() => { if (!disposed) setMapState('error'); });

    return () => {
      disposed = true;
      markerInstances.forEach((marker) => marker.remove());
      map?.remove();
    };
  }, [lineCoordinates, markers, roadCoordinates.length]);

  if (!markers.length) return null;
  if (mapState === 'unconfigured') {
    return (
      <section className="rounded-3xl border border-dashed border-foreground/15 bg-foreground/[0.02] p-5">
        <div className="flex items-start gap-3"><MapPinned className="mt-0.5 h-5 w-5 text-foreground/45" /><div><h2 className="text-sm font-semibold">Route map unavailable</h2><p className="mt-1 text-xs leading-relaxed text-foreground/50">The verified stop order remains below. The beta Mapbox display token has not been configured.</p></div></div>
      </section>
    );
  }
  return (
    <section className="overflow-hidden rounded-3xl border border-foreground/10 bg-foreground/[0.025]" aria-labelledby="route-map-heading">
      <div className="flex items-start justify-between gap-3 px-4 pb-3 pt-4 sm:px-5">
        <div><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-foreground/40">Mapbox preview</p><h2 id="route-map-heading" className="mt-1 text-lg font-semibold">Today at a glance</h2></div>
        <span className="rounded-full border border-foreground/10 px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.12em] text-foreground/45">S · Start</span>
      </div>
      <div ref={containerRef} role="img" aria-label={`Route map with ${markers.filter((marker) => marker.kind !== 'origin').length} ordered stops`} className="h-[22rem] w-full bg-[#e8e2d8] sm:h-[28rem]" />
      <div className="flex items-center justify-between gap-3 border-t border-foreground/10 px-4 py-3 text-[10px] leading-relaxed text-foreground/45 sm:px-5">
        <span>{roadCoordinates.length >= 2 ? 'Verified road geometry' : 'Dashed line shows stop order; road geometry pending'}</span>
        {mapState === 'loading' ? <span>Loading map…</span> : mapState === 'error' ? <span className="text-red-700">Map tiles unavailable</span> : <span>Use Navigate for driving guidance</span>}
      </div>
    </section>
  );
}
