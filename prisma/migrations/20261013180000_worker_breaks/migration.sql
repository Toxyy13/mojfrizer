-- Per-hairdresser breaks inside the working day: recurring on chosen weekdays, or for one date.
CREATE TABLE "worker_breaks" (
    "id" TEXT NOT NULL,
    "salonId" TEXT NOT NULL,
    "workerId" TEXT NOT NULL,
    "label" TEXT,
    "startMinute" INTEGER NOT NULL,
    "endMinute" INTEGER NOT NULL,
    "weekdays" INTEGER[],
    "date" DATE,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "worker_breaks_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "worker_breaks_range" CHECK ("startMinute" >= 0 AND "endMinute" <= 1440 AND "endMinute" > "startMinute"),
    CONSTRAINT "worker_breaks_when" CHECK (
      ("date" IS NOT NULL AND cardinality("weekdays") = 0)
      OR ("date" IS NULL AND cardinality("weekdays") > 0 AND "weekdays" <@ ARRAY[1,2,3,4,5,6,7])
    )
);

CREATE INDEX "worker_breaks_salonId_workerId_idx" ON "worker_breaks"("salonId", "workerId");

ALTER TABLE "worker_breaks" ADD CONSTRAINT "worker_breaks_salonId_fkey" FOREIGN KEY ("salonId") REFERENCES "salons"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "worker_breaks" ADD CONSTRAINT "worker_breaks_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "worker_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Row Level Security: salon staff read, only the owner changes breaks, system code (booking) reads for slots.
ALTER TABLE worker_breaks ENABLE ROW LEVEL SECURITY;

CREATE POLICY worker_breaks_read ON worker_breaks FOR SELECT USING (app_sys() OR app_is_staff("salonId"));
CREATE POLICY worker_breaks_insert ON worker_breaks FOR INSERT WITH CHECK (app_sys() OR app_is_owner("salonId"));
CREATE POLICY worker_breaks_update ON worker_breaks FOR UPDATE USING (app_sys() OR app_is_owner("salonId")) WITH CHECK (app_sys() OR app_is_owner("salonId"));
CREATE POLICY worker_breaks_delete ON worker_breaks FOR DELETE USING (app_sys() OR app_is_owner("salonId"));
