import NurseOperations from './NurseOperations.jsx';

// Dispatch is a persisted, fail-closed production surface. NurseOperations
// renders OperationalSourceUnavailable when its authenticated source is absent;
// no preview records or locally simulated actions are available on this route.
export default function DispatchControl() {
  return <NurseOperations view="dispatch" />;
}
