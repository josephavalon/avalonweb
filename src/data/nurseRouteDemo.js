const todayAt = (hour, minute = 0) => {
  const date = new Date();
  date.setHours(hour, minute, 0, 0);
  return date.toISOString();
};

export const DEMO_ROUTE_ORIGINS = [
  { id: 'home', kind: 'home', label: 'Home', address: 'Inner Sunset, San Francisco', latitude: 37.7562, longitude: -122.4768, persisted: true },
  { id: 'office', kind: 'office', label: 'Avalon Office', address: 'SoMa, San Francisco', latitude: 37.7811, longitude: -122.4006, persisted: true },
];

export const DEMO_ASSIGNED_APPOINTMENTS = [
  {
    appointmentId: 'route-demo-1', clientDisplayName: 'Maya', service: 'Myers Cocktail', neighborhood: 'Pacific Heights',
    address: 'Pacific Heights, San Francisco, CA', scheduledAt: todayAt(9), durationMinutes: 60, durationAssumed: false,
    status: 'assigned', eligible: true, selected: true, coordinate: { latitude: 37.7925, longitude: -122.4382 },
  },
  {
    appointmentId: 'route-demo-2', clientDisplayName: 'Alex', service: 'Hydration IV', neighborhood: 'Oakland',
    address: 'Uptown Oakland, Oakland, CA', scheduledAt: todayAt(11), durationMinutes: 45, durationAssumed: false,
    status: 'assigned', eligible: true, selected: true, coordinate: { latitude: 37.8124, longitude: -122.2683 },
  },
  {
    appointmentId: 'route-demo-3', clientDisplayName: 'Jordan', service: 'Performance Drip', neighborhood: 'San Mateo',
    address: 'Downtown San Mateo, San Mateo, CA', scheduledAt: todayAt(13), durationMinutes: 60, durationAssumed: false,
    status: 'assigned', eligible: true, selected: true, coordinate: { latitude: 37.563, longitude: -122.3255 },
  },
  {
    appointmentId: 'route-demo-4', clientDisplayName: 'Taylor', service: 'NAD+ Infusion', neighborhood: 'Palo Alto',
    address: 'University Avenue, Palo Alto, CA', scheduledAt: todayAt(15, 30), durationMinutes: 90, durationAssumed: false,
    status: 'assigned', eligible: true, selected: true, coordinate: { latitude: 37.4443, longitude: -122.1608 },
  },
];
