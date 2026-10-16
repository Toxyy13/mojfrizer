-- Login cookies issued before this moment are refused (set when the password is reset or changed).
ALTER TABLE "users" ADD COLUMN "sessionsValidAfter" TIMESTAMP(3);
