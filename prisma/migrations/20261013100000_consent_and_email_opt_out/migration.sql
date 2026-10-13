-- Record of accepted terms and the customer's choice about optional emails.
ALTER TABLE "users" ADD COLUMN "termsAcceptedAt" TIMESTAMP(3),
ADD COLUMN "termsVersion" TEXT,
ADD COLUMN "emailOptOut" BOOLEAN NOT NULL DEFAULT false;
