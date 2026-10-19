-- Who a salon works with (men, women, kids; any combination). Existing salons start as men's.
CREATE TYPE "Audience" AS ENUM ('MEN', 'WOMEN', 'KIDS');
ALTER TABLE "salons" ADD COLUMN "audiences" "Audience"[] NOT NULL DEFAULT ARRAY['MEN']::"Audience"[];
