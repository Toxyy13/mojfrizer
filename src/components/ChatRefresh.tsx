"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

const POLL_MS = 5000;

/** Re-fetches the server-rendered conversation every few seconds while the tab is visible. */
export function ChatRefresh() {
  const router = useRouter();
  useEffect(() => {
    const id = setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, POLL_MS);
    return () => clearInterval(id);
  }, [router]);
  return null;
}
