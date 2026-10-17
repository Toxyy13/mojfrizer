-- Optional public social profiles of a salon, stored as canonical https URLs.
ALTER TABLE "salons" ADD COLUMN "instagramUrl" TEXT, ADD COLUMN "facebookUrl" TEXT, ADD COLUMN "tiktokUrl" TEXT;
