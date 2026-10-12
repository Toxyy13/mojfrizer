-- DropIndex
DROP INDEX "chat_messages_salonId_createdAt_idx";

-- AlterTable
ALTER TABLE "chat_messages" ADD COLUMN     "clientId" TEXT NOT NULL,
ADD COLUMN     "fromSalon" BOOLEAN NOT NULL,
ADD COLUMN     "readAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "chat_messages_salonId_clientId_createdAt_idx" ON "chat_messages"("salonId", "clientId", "createdAt");

-- CreateIndex
CREATE INDEX "chat_messages_clientId_createdAt_idx" ON "chat_messages"("clientId", "createdAt");

-- AddForeignKey
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

