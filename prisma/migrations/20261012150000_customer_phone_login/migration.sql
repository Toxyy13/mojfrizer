-- Customers log in with phone + password, so email becomes optional.
ALTER TABLE "users" ALTER COLUMN "email" DROP NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "users_phone_key" ON "users"("phone");

-- Every account needs a login: email, phone or both.
ALTER TABLE "users" ADD CONSTRAINT "users_email_or_phone" CHECK ("email" IS NOT NULL OR "phone" IS NOT NULL);
