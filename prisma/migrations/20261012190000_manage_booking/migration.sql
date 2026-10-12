-- Online cancel / move window per salon.
ALTER TABLE "salons" ADD COLUMN "cancelCutoffHours" INTEGER NOT NULL DEFAULT 2;

-- Secret token for the customer's "manage booking" link; existing rows get one too.
ALTER TABLE "appointments" ADD COLUMN "manageToken" TEXT NOT NULL DEFAULT replace((gen_random_uuid())::text, '-'::text, ''::text);
CREATE UNIQUE INDEX "appointments_manageToken_key" ON "appointments"("manageToken");
