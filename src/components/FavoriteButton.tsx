import { setFavoriteSalon } from "@/app/nalog/actions";

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
        className={`btn btn-sm border ${
          isFavorite
            ? "border-burgundy bg-burgundy-soft text-burgundy hover:border-burgundy-dark"
            : "border-line bg-white text-charcoal hover:border-burgundy hover:text-burgundy"
        }`}
      >
        <span aria-hidden className="text-base leading-none">{isFavorite ? "♥" : "♡"}</span>
        {isFavorite ? "Omiljeni salon" : "Dodaj u omiljene"}
      </button>
    </form>
  );
}
