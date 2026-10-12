-- DropForeignKey
ALTER TABLE "appointments" DROP CONSTRAINT "appointments_createdById_fkey";

-- AlterTable
ALTER TABLE "appointments" ALTER COLUMN "createdById" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Double booking guard at DB level: a worker can never have two overlapping
-- active appointments, even when two requests arrive at the same moment.
CREATE EXTENSION IF NOT EXISTS btree_gist;
ALTER TABLE "appointments"
  ADD CONSTRAINT "appointments_no_overlap"
  EXCLUDE USING gist ("workerId" WITH =, tstzrange("startTime", "endTime") WITH &&)
  WHERE ("status" IN ('BOOKED', 'COMPLETED'));
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_time_order" CHECK ("endTime" > "startTime");
