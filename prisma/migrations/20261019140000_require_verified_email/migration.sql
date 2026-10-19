-- From now on a new email account can't log in before it confirms its address. Everyone who already has an
-- account (owners, workers, developer, older clients) stays able to log in.
UPDATE users SET "emailVerifiedAt" = now() WHERE "emailVerifiedAt" IS NULL;
