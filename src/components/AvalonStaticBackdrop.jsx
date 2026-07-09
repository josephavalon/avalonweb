// User directive: every page renders on plain black — no photo backdrop.
// Component is preserved as a no-op so every existing consumer keeps
// importing it without a build break; if the photo ever returns, restore
// the JSX from git history.
export default function AvalonStaticBackdrop() {
  return null;
}
