/**
 * Shown by loading.tsx while a server-rendered page is being prepared, so a click answers at once (the shell appears
 * from the CDN/prefetch while the database work finishes). Same colours and page width as the real pages.
 */
export function PageSkeleton({ variant = "page" }: { variant?: "page" | "admin" }) {
  const block = "animate-pulse rounded-xl bg-sand";
  return (
    <div role="status" aria-busy="true" aria-live="polite">
      <span className="sr-only">Učitavanje…</span>
      <div className="h-16 border-b border-line/70 bg-cream/85" aria-hidden />
      <div className="page pt-10 pb-10 sm:pt-16" aria-hidden>
        <div className={`${block} h-4 w-40`} />
        <div className={`${block} mt-5 h-16 w-3/4 max-w-xl sm:h-24`} />
        <div className={`${block} mt-5 h-5 w-2/3 max-w-md`} />
        {variant === "admin" ? (
          <div className="mt-8 grid grid-cols-2 gap-3 md:grid-cols-4">
            <div className={`${block} col-span-2 h-32`} />
            <div className={`${block} h-32`} />
            <div className={`${block} h-32`} />
            <div className={`${block} col-span-2 h-24 md:col-span-4`} />
            <div className={`${block} col-span-2 h-24 md:col-span-4`} />
          </div>
        ) : (
          <div className="mt-8 grid gap-3 sm:grid-cols-2">
            <div className={`${block} h-40`} />
            <div className={`${block} h-40`} />
            <div className={`${block} h-40 sm:col-span-2`} />
          </div>
        )}
      </div>
    </div>
  );
}
