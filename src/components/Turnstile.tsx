"use client";

import Script from "next/script";
import { useCallback, useEffect, useRef, useState } from "react";

interface TurnstileApi {
  render: (el: HTMLElement, options: Record<string, unknown>) => string;
  remove: (id: string) => void;
}
declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

/** Cloudflare captcha inside a form: puts the `cf-turnstile-response` field in it. Shows Cloudflare's error code on failure. */
export function Turnstile({ siteKey }: { siteKey: string }) {
  const box = useRef<HTMLDivElement>(null);
  const widget = useRef<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);

  const render = useCallback(() => {
    if (!box.current || !window.turnstile || widget.current) return;
    widget.current = window.turnstile.render(box.current, {
      sitekey: siteKey,
      "error-callback": (code: string) => {
        console.error("Turnstile error", code);
        setErrorCode(String(code));
      },
    });
  }, [siteKey]);

  useEffect(() => {
    render();
    return () => {
      if (widget.current) window.turnstile?.remove(widget.current);
      widget.current = null;
    };
  }, [render]);

  return (
    <>
      <Script src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit" strategy="afterInteractive" onReady={render} />
      <div ref={box} />
      {errorCode && <p className="field-hint">Captcha greška (kod {errorCode}). Osvežite stranicu ili javite podršci ovaj kod.</p>}
    </>
  );
}
