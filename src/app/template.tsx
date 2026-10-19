import type { ReactNode } from "react";

/** Re-mounts on every navigation, so each page slides in briefly instead of snapping. */
export default function Template({ children }: { children: ReactNode }) {
  return <div className="animate-page">{children}</div>;
}
