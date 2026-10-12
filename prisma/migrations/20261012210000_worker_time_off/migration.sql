-- Per-hairdresser absences and blocked time.
CREATE TABLE "worker_time_off" (
    "id" TEXT NOT NULL,
    "salonId" TEXT NOT NULL,
    "workerId" TEXT NOT NULL,
    "startTime" TIMESTAMPTZ(3) NOT NULL,
    "endTime" TIMESTAMPTZ(3) NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "worker_time_off_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "worker_time_off_range" CHECK ("endTime" > "startTime")
);

CREATE INDEX "worker_time_off_salonId_workerId_startTime_idx" ON "worker_time_off"("salonId", "workerId", "startTime");

ALTER TABLE "worker_time_off" ADD CONSTRAINT "worker_time_off_salonId_fkey" FOREIGN KEY ("salonId") REFERENCES "salons"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "worker_time_off" ADD CONSTRAINT "worker_time_off_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "worker_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
