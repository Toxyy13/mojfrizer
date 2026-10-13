import type { Metadata } from "next";
import { DeveloperShell } from "@/components/DeveloperShell";
import { requireDeveloper } from "@/lib/developer";
import { NewSalonForm } from "./NewSalonForm";

export const metadata: Metadata = { title: "Novi salon · mojfrizer" };
export const dynamic = "force-dynamic";

export default async function NewSalonPage() {
  const user = await requireDeveloper();
  return (
    <DeveloperShell user={user} active="novi">
      <div className="max-w-xl">
        <h1 className="font-serif text-3xl sm:text-4xl">Novi salon</h1>
        <p className="mt-2 text-sm text-muted">
          Samo vi pravite naloge salona. Vlasnik dobija prijavu i sam unosi cenovnik i radno vreme u Podešavanjima.
        </p>
        <div className="mt-8"><NewSalonForm /></div>
      </div>
    </DeveloperShell>
  );
}
