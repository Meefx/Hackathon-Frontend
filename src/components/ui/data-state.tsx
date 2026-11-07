import type { ReactNode } from "react";
export function DataState({
  loading,
  error,
  retry,
  empty,
  children,
}: {
  loading: boolean;
  error: string;
  retry: () => void;
  empty?: boolean;
  children: ReactNode;
}) {
  if (error)
    return (
      <div className="empty-state" role="alert">
        <h3>Unable to load</h3>
        <p>{error}</p>
        <button type="button" className="button" onClick={retry}>
          Try again
        </button>
      </div>
    );
  if (loading)
    return (
      <div className="empty-state" role="status">
        Loading…
      </div>
    );
  if (empty) return <div className="empty-state">No records yet.</div>;
  return <>{children}</>;
}
