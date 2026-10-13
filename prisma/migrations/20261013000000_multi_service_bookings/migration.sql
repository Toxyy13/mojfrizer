-- AlterTable
ALTER TABLE "urgent_requests" ADD COLUMN     "serviceIds" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "waitlist_entries" ADD COLUMN     "serviceIds" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- CreateTable
CREATE TABLE "appointment_services" (
    "id" TEXT NOT NULL,
    "appointmentId" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "price" INTEGER NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "appointment_services_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_combos" (
    "id" TEXT NOT NULL,
    "salonId" TEXT NOT NULL,
    "serviceIds" TEXT[],
    "durationMinutes" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "service_combos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "appointment_services_serviceId_idx" ON "appointment_services"("serviceId");

-- CreateIndex
CREATE UNIQUE INDEX "appointment_services_appointmentId_serviceId_key" ON "appointment_services"("appointmentId", "serviceId");

-- CreateIndex
CREATE INDEX "service_combos_salonId_idx" ON "service_combos"("salonId");

-- AddForeignKey
ALTER TABLE "appointment_services" ADD CONSTRAINT "appointment_services_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "appointments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointment_services" ADD CONSTRAINT "appointment_services_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "services"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_combos" ADD CONSTRAINT "service_combos_salonId_fkey" FOREIGN KEY ("salonId") REFERENCES "salons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill: every existing appointment gets its single service as its first item.
INSERT INTO "appointment_services" ("id", "appointmentId", "serviceId", "price", "sortOrder")
SELECT 'as_' || a."id", a."id", a."serviceId", a."price", 0 FROM "appointments" a;

-- Kod Olgice durations set by the owner: beard trim 15 min, and three combos.
-- Other combinations default to the sum of their services' durations.
UPDATE "services" SET "durationMinutes" = 15
WHERE "name" = 'Fazoniranje brade' AND "salonId" IN (SELECT "id" FROM "salons" WHERE "slug" = 'kod-olgice');

INSERT INTO "service_combos" ("id", "salonId", "serviceIds", "durationMinutes")
SELECT 'combo_' || md5(s."id" || array_to_string(x.names, '+')),
       s."id",
       ARRAY(SELECT sv."id" FROM "services" sv
             WHERE sv."salonId" = s."id" AND sv."name" = ANY(x.names)
             ORDER BY sv."id" COLLATE "C"),
       x.minutes
FROM "salons" s,
     (VALUES (ARRAY['Muško šišanje', 'Pranje kose'], 30),
             (ARRAY['Muško šišanje', 'Pranje kose', 'Fazoniranje brade'], 45),
             (ARRAY['Muško šišanje', 'Pranje kose', 'Brijanje'], 45)) AS x(names, minutes)
WHERE s."slug" = 'kod-olgice'
  AND (SELECT count(*) FROM "services" sv WHERE sv."salonId" = s."id" AND sv."name" = ANY(x.names))
      = array_length(x.names, 1);
