-- Public/private salons and the QR-code link that connects a customer to a salon.
CREATE TYPE "SalonVisibility" AS ENUM ('PUBLIC', 'PRIVATE');

ALTER TABLE "salons" ADD COLUMN "visibility" "SalonVisibility" NOT NULL DEFAULT 'PUBLIC';
-- Existing salons get a random 64-character token for their QR link.
ALTER TABLE "salons" ADD COLUMN "qrToken" TEXT NOT NULL DEFAULT replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');
CREATE UNIQUE INDEX "salons_qrToken_key" ON "salons"("qrToken");

CREATE TABLE "salon_memberships" (
    "userId" TEXT NOT NULL,
    "salonId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "salon_memberships_pkey" PRIMARY KEY ("userId","salonId")
);
CREATE INDEX "salon_memberships_salonId_idx" ON "salon_memberships"("salonId");
ALTER TABLE "salon_memberships" ADD CONSTRAINT "salon_memberships_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "salon_memberships" ADD CONSTRAINT "salon_memberships_salonId_fkey" FOREIGN KEY ("salonId") REFERENCES "salons"("id") ON DELETE CASCADE ON UPDATE CASCADE;
