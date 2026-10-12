import { isGoogleConfigured } from "@/lib/google";

interface GoogleButtonProps {
  next: string | null;
}

/** "Continue with Google"; hidden until the Google credentials are configured. */
export function GoogleButton({ next }: GoogleButtonProps) {
  if (!isGoogleConfigured()) return null;
  const href = next ? `/api/auth/google?next=${encodeURIComponent(next)}` : "/api/auth/google";
  return (
    <div className="mb-6">
      {/* A full page navigation to the OAuth start route, not client-side routing. */}
      <a
        href={href}
        className="btn-secondary w-full"
      >
        <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
          <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.1C12.4 13.6 17.7 9.5 24 9.5z" />
          <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v8.5h12.7c-.6 3-2.3 5.5-4.8 7.2l7.5 5.8c4.4-4.1 7.1-10.1 7.1-17z" />
          <path fill="#FBBC05" d="M10.5 28.7c-.5-1.5-.8-3-.8-4.7s.3-3.2.8-4.7l-7.9-6.1C.9 16.5 0 20.1 0 24s.9 7.5 2.6 10.8l7.9-6.1z" />
          <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.5-5.8c-2.1 1.4-4.8 2.3-8.4 2.3-6.3 0-11.6-4.1-13.5-9.8l-7.9 6.1C6.5 42.6 14.6 48 24 48z" />
        </svg>
        Nastavi sa Google nalogom
      </a>
      <p className="mt-6 flex items-center gap-3 text-xs text-muted before:h-px before:flex-1 before:bg-line after:h-px after:flex-1 after:bg-line">ili emailom</p>
    </div>
  );
}
