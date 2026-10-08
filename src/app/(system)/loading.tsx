export default function Loading() {
  return <div className="route-loading" role="status" aria-live="polite">
    <span className="route-loading-dot" aria-hidden="true" />
    <span>Loading…</span>
  </div>;
}
