# DESIGN.md - Smernice za dizajn

Vizuelni identitet i pravila za izradu stranica. Cilj su jedinstveni, moderni ekrani bez generičkih šablona.

---

## 1. Visual & Architectural Principles

### Avoid generic templates
* **No Generic Grid Sections:** Do not output standard three-card feature blocks with generic icons. Use asymmetrical layouts, varying card widths, or clean list structures.
* **No Default Purple Gradients:** Avoid standard neon gradients (purple/blue/pink) unless explicitly requested. Use editorial, organic, or raw high-contrast color palettes instead.
* **Typography First:** Treat text as the primary design element. Use extreme contrast in font scales (e.g., massive headers with small, high-density metadata).

### Spacing & Layout
* **Generous White Space:** Leave room for elements to breathe. Use strong padding (`py-24` or `py-32` in Tailwind) to separate core narrative sections.
* **Bento Grid & Asymmetry:** Utilize mixed-span grids (`col-span-2` next to `col-span-1`) with subtle borders instead of heavy box shadows.
* **Borders over Shadows:** Prefer thin, clean borders (`border-neutral-200` or `border-neutral-800`) over soft, fuzzy container shadows.

---

## 2. Design Directions (Choose One)

### A. Editorial / Premium Minimalism (Luxury, Swiss, Agency)
* **Vibe:** High-end, structured, intellectual, quiet luxury.
* **Palette:** Pure White backgrounds, Cream accents, Deep Charcoal text, Accent Color: Burgundy (`#6b1d2f`) or Forest Green (`#1b3a2b`).
* **Typography:** Elegant Serif for headers (e.g., *Playfair Display*, *Cormorant Garamond*) paired with a tight, geometric Sans-Serif for body text (*Inter*, *SF Pro*).

### B. Dark Neo-Brutalisim (SaaS, Developer, Creative Studio)
* **Vibe:** Raw, high-tech, intentional, bold.
* **Palette:** Pitch Black (`#0a0a0a`), Dark Gray (`#171717`), Accent Color: Cyber Lime (`#ccff00`), Electric Blue (`#0055ff`), or Pure Orange (`#ff5500`).
* **Typography:** Monospace (`JetBrains Mono`, `SF Mono`) for system badges/labels, and heavy, ultra-bold Sans-Serif (`Plus Jakarta Sans`, `Clash Display`) for headers.

---

## 3. Tailwind CSS & Code Implementation Rules

* **Semantic HTML:** Use strictly semantic elements: `<main>`, `<section>`, `<article>`, `<header>`, `<footer>`, `<aside>`.
* **Micro-interactions:** Add smooth, intentional interactive transitions. Example: `transition-all duration-300 ease-out hover:-translate-y-0.5 hover:border-neutral-400`.
* **Pure Tailwind:** Do not write custom inline CSS. Rely on vanilla Tailwind utility classes.
* **Component Clones:** Keep layouts production-ready, accessible (ARIA attributes where applicable), and fully responsive.

---

## 4. mojfrizer design system (in code)

Chosen direction: **A. Editorial**, made warm and touch-friendly. All tokens and shared classes live in `src/app/globals.css`.

* **Look:** modern barbershop. Clean white surfaces with soft shadows and 12px-rounded buttons, the shop shows up only in a few real objects: barber pole (`pole`), striped band under the header (`awning`), booking tickets with a tear line (`ticket`, `ticket-stub`), dark price board (`board`, `board-row`, `board-dots`), scissors on a cut line (`ScissorsLine`). Do not add more themed decoration, no heavy outlines or hard offset shadows, no gradient washes.
* **Colors:** `cream` page background (`#f6f2ea`), `paper` (white) surfaces, `line` borders, `charcoal` ink-blue text and dark panels, `muted` secondary text, `burgundy` barber-red accent (`burgundy-soft` for tinted backgrounds), `navy` for the pole, `forest` for success.
* **Classes to reuse on new pages:** `page` (container), `eyebrow` (small label), `card` and `card-ink` (raised), `ticket`, `board`, `btn-primary`, `btn-secondary`, `btn-ghost`, `btn-sm`, `field` + `field-label` + `field-hint`, `chip` (pill, selected via `aria-pressed`), `badge`, `alert-error`, `link`.
* **Shells:** `AdminShell` and `DeveloperShell` use a dark header with folder-style tabs; `AuthShell` pairs the form card with a pole.
* **Shared layout:** `SiteHeader` (sticky) and `SiteFooter` on customer pages.
* **Mobile first:** tap targets at least 44px (`min-h-11`), 16px side gutter (`page`), primary action reachable with the thumb.
