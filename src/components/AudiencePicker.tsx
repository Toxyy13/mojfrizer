import type { Audience } from "@prisma/client";
import { AUDIENCES, AUDIENCE_LABELS, AUDIENCE_PICKED } from "@/lib/audience";

// Three checkboxes shaped like chips, any combination. Used for the salon settings and the search filter.
export function AudiencePicker({ name, selected, legend }: { name: string; selected: readonly Audience[]; legend: string }) {
  return (
    <fieldset>
      <legend className="field-label">{legend}</legend>
      <div className="mt-2 flex flex-wrap gap-2">
        {AUDIENCES.map((a) => (
          <label key={a} className={`chip group cursor-pointer gap-2 has-[:focus-visible]:ring-4 has-[:focus-visible]:ring-burgundy/20 ${AUDIENCE_PICKED[a]}`}>
            <input type="checkbox" name={name} value={a} defaultChecked={selected.includes(a)} className="sr-only" />
            <span aria-hidden className="grid size-5 place-items-center rounded-md border border-current/40 bg-paper text-xs leading-none">
              <span className="invisible group-has-[:checked]:visible">✓</span>
            </span>
            {AUDIENCE_LABELS[a]}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
