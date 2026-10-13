-- Platform operator role and the assistant usage log.
ALTER TYPE "Role" ADD VALUE 'DEVELOPER';

CREATE TABLE "assistant_uses" (
    "id" TEXT NOT NULL,
    "salonId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "assistant_uses_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "assistant_uses_salonId_createdAt_idx" ON "assistant_uses"("salonId", "createdAt");
CREATE INDEX "assistant_uses_createdAt_idx" ON "assistant_uses"("createdAt");

ALTER TABLE "assistant_uses" ADD CONSTRAINT "assistant_uses_salonId_fkey" FOREIGN KEY ("salonId") REFERENCES "salons"("id") ON DELETE SET NULL ON UPDATE CASCADE;
