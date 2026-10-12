import { setFavoriteSalon } from "@/app/account/actions";

interface FavoriteButtonProps {
  salonId: string;
  isFavorite: boolean;
  /** Page to refresh after the change (and to come back to after login). */
  returnTo: string;
}

/** Works without JavaScript: a plain form posting to a server action. */
export function FavoriteButton({ salonId, isFavorite, returnTo }: FavoriteButtonProps) {
  return (
    <form action={setFavoriteSalon}>
      <input type="hidden" name="salonId" value={isFavorite ? "" : salonId} />
      <input type="hidden" name="returnTo" value={returnTo} />
      <button
        aria-pressed={isFavorite}
        title={isFavorite ? "Klikni da ukloniš iz omiljenih" : undefined}
        className={`border px-4 py-2 text-xs uppercase tracking-[0.2em] transition-all duration-300 ease-out hover:-translate-y-0.5 ${
          isFavorite
            ? "border-burgundy bg-burgundy text-white hover:bg-burgundy-dark"
            : "border-neutral-300 text-neutral-700 hover:border-burgundy hover:text-burgundy"
        }`}
      >
        {isFavorite ? "★ Omiljeni salon" : "☆ Označi kao omiljeni"}
      </button>
    </form>
  );
}
