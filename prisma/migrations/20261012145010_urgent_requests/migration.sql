-- CreateEnum
CREATE TYPE "UrgentRequestStatus" AS ENUM ('PENDING', 'RESOLVED', 'DECLINED');

-- CreateTable
CREATE TABLE "urgent_requests" (
    "id" TEXT NOT NULL,
    "salonId" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "clientId" TEXT,
    "guestName" TEXT NOT NULL,
    "guestPhone" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "UrgentRequestStatus" NOT NULL DEFAULT 'PENDING',
    "appointmentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "urgent_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "urgent_requests_appointmentId_key" ON "urgent_requests"("appointmentId");

-- CreateIndex
CREATE INDEX "urgent_requests_salonId_status_date_idx" ON "urgent_requests"("salonId", "status", "date");

-- AddForeignKey
ALTER TABLE "urgent_requests" ADD CONSTRAINT "urgent_requests_salonId_fkey" FOREIGN KEY ("salonId") REFERENCES "salons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "urgent_requests" ADD CONSTRAINT "urgent_requests_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "services"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "urgent_requests" ADD CONSTRAINT "urgent_requests_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "urgent_requests" ADD CONSTRAINT "urgent_requests_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "appointments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
