-- Salon's notes about a customer and the online booking block.
CREATE TABLE "salon_client_notes" (
    "id" TEXT NOT NULL,
    "salonId" TEXT NOT NULL,
    "clientKey" TEXT NOT NULL,
    "note" TEXT,
    "blockedOnline" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "salon_client_notes_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "salon_client_notes_salonId_clientKey_key" ON "salon_client_notes"("salonId", "clientKey");

ALTER TABLE "salon_client_notes" ADD CONSTRAINT "salon_client_notes_salonId_fkey" FOREIGN KEY ("salonId") REFERENCES "salons"("id") ON DELETE CASCADE ON UPDATE CASCADE;
