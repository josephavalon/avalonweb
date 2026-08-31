export type RouteOriginKind = 'home' | 'office' | 'current' | 'manual';
export type RouteFeasibility = 'on_schedule' | 'tight' | 'late' | 'unavailable';
export type RouteStopStatus = 'assigned' | 'en_route' | 'arrived' | 'started' | 'in_treatment' | 'completed' | 'blocked';

export interface RouteCoordinate {
  latitude: number;
  longitude: number;
}

export interface RouteOrigin extends RouteCoordinate {
  id?: string;
  kind: RouteOriginKind;
  label: string;
  address?: string;
  persisted: boolean;
}

export interface RouteStop {
  appointmentId: string;
  order: number;
  clientDisplayName: string;
  service: string;
  neighborhood: string;
  address: string;
  scheduledAt: string;
  durationMinutes: number;
  durationAssumed: boolean;
  status: RouteStopStatus;
  eligible: boolean;
  blocker?: string;
  selected: boolean;
  omissionReason?: string;
  coordinate?: RouteCoordinate;
}

export interface RouteManeuver {
  instruction: string;
  distanceMeters: number;
  durationSeconds: number;
  streetName?: string;
  maneuverType: string;
  maneuverModifier?: string;
  coordinate?: RouteCoordinate;
}

export interface RouteLeg {
  fromId: string;
  toAppointmentId: string;
  distanceMeters: number;
  trafficDurationSeconds: number;
  typicalDurationSeconds: number;
  trafficDelaySeconds: number;
  trafficLevel: 'light' | 'moderate' | 'heavy' | 'unavailable';
  requiredDepartureAt: string;
  projectedArrivalAt: string;
  bufferMinutes: number;
  feasibility: RouteFeasibility;
  geometry: GeoJSON.LineString | null;
  steps: RouteManeuver[];
  provider: 'mapbox' | 'osrm' | 'estimate';
}

export interface AssignmentChange {
  needsAcknowledgement: boolean;
  revision: string;
  addedAppointmentIds: string[];
  removedAppointmentIds: string[];
  activeStopRemoved: boolean;
  addedAppointments?: Array<Pick<RouteStop, 'appointmentId' | 'clientDisplayName' | 'scheduledAt'>>;
  removedAppointments?: Array<Pick<RouteStop, 'appointmentId' | 'clientDisplayName' | 'scheduledAt'>>;
}

export interface RoutePlan {
  id?: string;
  routeDate: string;
  timezone: 'America/Los_Angeles';
  generatedAt: string;
  trafficAsOf: string;
  trafficState: 'live' | 'estimated' | 'stale';
  origin: RouteOrigin;
  activeStopId?: string;
  stops: RouteStop[];
  legs: RouteLeg[];
  assignmentChange?: AssignmentChange;
}
