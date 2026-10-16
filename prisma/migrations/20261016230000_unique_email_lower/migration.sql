-- One account per email address, whatever the capitalisation. Emails are stored lowercase already; this makes the
-- database refuse a differently-cased duplicate even if some code path forgets to normalise.
CREATE UNIQUE INDEX "users_email_lower_key" ON users (lower(email));
