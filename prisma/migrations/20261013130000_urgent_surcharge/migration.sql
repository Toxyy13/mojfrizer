-- Urgent appointments cost extra; each salon sets its own surcharge (in para).
ALTER TABLE "salons" ADD COLUMN "urgentSurcharge" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "urgent_requests" ADD COLUMN "surcharge" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "appointments" ADD COLUMN "urgentSurcharge" INTEGER NOT NULL DEFAULT 0;

-- Kod Olgice: urgent appointments are 200 RSD more expensive.
UPDATE "salons" SET "urgentSurcharge" = 20000 WHERE "slug" = 'kod-olgice';
