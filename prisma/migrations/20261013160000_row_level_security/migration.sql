-- Row Level Security: the database itself refuses to show or change another salon's rows, even if application code
-- forgets a `where salonId = ...`. Defense in depth on top of the checks in src/lib/access.ts.
--
-- How it is used (see docs/ARCHITECTURE.md, "Row Level Security"):
--   * The app role `mojfrizer_app` has no BYPASSRLS. With RLS_ENFORCE=1 every query runs in a transaction that does
--     set_config('role','mojfrizer_app') and sets app.uid (logged-in user) / app.sys ('on' for trusted internal code).
--   * Without RLS_ENFORCE the app connects as the table owner, which bypasses RLS: this migration changes nothing
--     visible until the switch is turned on. Migrations, seed and the owner connection are never restricted.
--
-- Adding a table later: enable RLS and add policies in the same migration, or src/lib/__tests__/rls.test.ts fails.

-- 1. Role --------------------------------------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'mojfrizer_app') THEN
    CREATE ROLE mojfrizer_app NOLOGIN NOBYPASSRLS;
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'mojfrizer_app role not created (%). RLS policies are installed but cannot be enforced until it exists.', SQLERRM;
END $$;

-- 2. Helper functions (SECURITY DEFINER: they read the tables without being filtered by the policies they serve) ----
CREATE OR REPLACE FUNCTION app_uid() RETURNS text LANGUAGE sql STABLE AS
  $$ SELECT nullif(current_setting('app.uid', true), '') $$;

CREATE OR REPLACE FUNCTION app_is_dev() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS
  $$ SELECT EXISTS (SELECT 1 FROM users WHERE id = app_uid() AND role = 'DEVELOPER') $$;

-- Full access: trusted internal code (app.sys), or the platform owner. A login cookie that claims the developer role
-- (app.devclaim) only counts while the database still says the user is a developer, so a demoted account loses it at once.
CREATE OR REPLACE FUNCTION app_sys() RETURNS boolean LANGUAGE sql STABLE AS
  $$ SELECT coalesce(current_setting('app.sys', true), '') = 'on'
         OR (coalesce(current_setting('app.devclaim', true), '') = 'on' AND app_is_dev()) $$;

CREATE OR REPLACE FUNCTION app_is_owner(sid text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS
  $$ SELECT EXISTS (SELECT 1 FROM salons WHERE id = sid AND "ownerId" = app_uid()) $$;

-- Owner or an active hairdresser login of the salon.
CREATE OR REPLACE FUNCTION app_is_staff(sid text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS
  $$ SELECT app_is_owner(sid) OR EXISTS (
       SELECT 1 FROM worker_profiles w WHERE w."salonId" = sid AND w."userId" = app_uid() AND w."isActive") $$;

-- Public salons are open to everyone; private ones to staff, the developer and customers who scanned the QR code.
CREATE OR REPLACE FUNCTION app_can_view(sid text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS
  $$ SELECT EXISTS (SELECT 1 FROM salons s WHERE s.id = sid AND s.visibility = 'PUBLIC')
       OR app_is_staff(sid) OR app_is_dev()
       OR EXISTS (SELECT 1 FROM salon_memberships m WHERE m."salonId" = sid AND m."userId" = app_uid()) $$;

-- A user row may be read by the user, by salon staff for people connected to their salon, and by a customer for the
-- staff who write to them in chat.
CREATE OR REPLACE FUNCTION app_user_visible(target text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS
  $$ SELECT target = app_uid()
       OR EXISTS (SELECT 1 FROM appointments a WHERE a."clientId" = target AND app_is_staff(a."salonId"))
       OR EXISTS (SELECT 1 FROM salon_memberships m WHERE m."userId" = target AND app_is_staff(m."salonId"))
       OR EXISTS (SELECT 1 FROM waitlist_entries w WHERE w."clientId" = target AND app_is_staff(w."salonId"))
       OR EXISTS (SELECT 1 FROM urgent_requests u WHERE u."clientId" = target AND app_is_staff(u."salonId"))
       OR EXISTS (SELECT 1 FROM worker_profiles p WHERE p."userId" = target AND app_is_staff(p."salonId"))
       OR EXISTS (SELECT 1 FROM chat_messages c WHERE (c."clientId" = target OR c."senderId" = target)
                    AND (app_is_owner(c."salonId") OR c."clientId" = app_uid())) $$;

-- 3. Enable RLS on every table (owner bypasses; the app role does not) ---------------------------------------------
ALTER TABLE users                ENABLE ROW LEVEL SECURITY;
ALTER TABLE salons               ENABLE ROW LEVEL SECURITY;
ALTER TABLE working_hours        ENABLE ROW LEVEL SECURITY;
ALTER TABLE salon_days_off       ENABLE ROW LEVEL SECURITY;
ALTER TABLE worker_profiles      ENABLE ROW LEVEL SECURITY;
ALTER TABLE services             ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_combos       ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments         ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointment_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE urgent_requests      ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages        ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_avatars         ENABLE ROW LEVEL SECURITY;
ALTER TABLE salon_client_notes   ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_tokens         ENABLE ROW LEVEL SECURITY;
ALTER TABLE worker_time_off      ENABLE ROW LEVEL SECURITY;
ALTER TABLE waitlist_entries     ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews              ENABLE ROW LEVEL SECURITY;
ALTER TABLE assistant_uses       ENABLE ROW LEVEL SECURITY;
ALTER TABLE salon_memberships    ENABLE ROW LEVEL SECURITY;

-- 4. Policies. `app_sys()` is the explicit bypass for trusted internal code (booking on behalf of a visitor, cron,
-- login, the developer panel); it is only ever set by runAsSystem() in src/lib/rls.ts. ---------------------------------

-- users: own row, or people connected to the salon the viewer works in. Creating accounts is system-only.
CREATE POLICY users_select ON users FOR SELECT USING (app_sys() OR app_user_visible(id));
CREATE POLICY users_insert ON users FOR INSERT WITH CHECK (app_sys());
CREATE POLICY users_update ON users FOR UPDATE USING (app_sys() OR id = app_uid()) WITH CHECK (app_sys() OR id = app_uid());
CREATE POLICY users_delete ON users FOR DELETE USING (app_sys() OR id = app_uid());

-- salons
CREATE POLICY salons_select ON salons FOR SELECT USING (app_sys() OR app_can_view(id));
CREATE POLICY salons_insert ON salons FOR INSERT WITH CHECK (app_sys());
CREATE POLICY salons_update ON salons FOR UPDATE USING (app_sys() OR app_is_owner(id)) WITH CHECK (app_sys() OR app_is_owner(id));
CREATE POLICY salons_delete ON salons FOR DELETE USING (app_sys());

-- Salon configuration: readable wherever the salon is viewable, changed only by its owner.
CREATE POLICY working_hours_select ON working_hours FOR SELECT USING (app_sys() OR app_can_view("salonId"));
CREATE POLICY working_hours_write  ON working_hours FOR ALL USING (app_sys() OR app_is_owner("salonId")) WITH CHECK (app_sys() OR app_is_owner("salonId"));

CREATE POLICY salon_days_off_select ON salon_days_off FOR SELECT USING (app_sys() OR app_can_view("salonId"));
CREATE POLICY salon_days_off_write  ON salon_days_off FOR ALL USING (app_sys() OR app_is_owner("salonId")) WITH CHECK (app_sys() OR app_is_owner("salonId"));

CREATE POLICY worker_profiles_select ON worker_profiles FOR SELECT USING (app_sys() OR app_can_view("salonId"));
CREATE POLICY worker_profiles_write  ON worker_profiles FOR ALL USING (app_sys() OR app_is_owner("salonId")) WITH CHECK (app_sys() OR app_is_owner("salonId"));

CREATE POLICY services_select ON services FOR SELECT USING (app_sys() OR app_can_view("salonId"));
CREATE POLICY services_write  ON services FOR ALL USING (app_sys() OR app_is_owner("salonId")) WITH CHECK (app_sys() OR app_is_owner("salonId"));

CREATE POLICY service_combos_select ON service_combos FOR SELECT USING (app_sys() OR app_can_view("salonId"));
CREATE POLICY service_combos_write  ON service_combos FOR ALL USING (app_sys() OR app_is_owner("salonId")) WITH CHECK (app_sys() OR app_is_owner("salonId"));

-- Bookings: the salon's staff and the customer who made them. Guest bookings are created by system code.
CREATE POLICY appointments_all ON appointments FOR ALL
  USING (app_sys() OR app_is_staff("salonId") OR "clientId" = app_uid())
  WITH CHECK (app_sys() OR app_is_staff("salonId") OR "clientId" = app_uid());

CREATE POLICY appointment_services_all ON appointment_services FOR ALL
  USING (app_sys() OR EXISTS (SELECT 1 FROM appointments a WHERE a.id = "appointmentId"))
  WITH CHECK (app_sys() OR EXISTS (SELECT 1 FROM appointments a WHERE a.id = "appointmentId"));

CREATE POLICY urgent_requests_all ON urgent_requests FOR ALL
  USING (app_sys() OR app_is_staff("salonId") OR "clientId" = app_uid())
  WITH CHECK (app_sys() OR app_is_staff("salonId") OR "clientId" = app_uid());

-- Chat: the salon owner and the customer in that conversation. A new message must be written as the sender itself,
-- on the right side of the conversation (the salon cannot post as the customer or the other way round).
CREATE POLICY chat_messages_select ON chat_messages FOR SELECT USING (app_sys() OR app_is_owner("salonId") OR "clientId" = app_uid());
CREATE POLICY chat_messages_insert ON chat_messages FOR INSERT WITH CHECK (
  app_sys()
  OR (app_is_owner("salonId") AND "senderId" = app_uid() AND "fromSalon")
  OR ("clientId" = app_uid() AND "senderId" = app_uid() AND NOT "fromSalon"));
-- Marking messages as read updates rows written by the other side, so updates only need to be allowed on the conversation.
CREATE POLICY chat_messages_update ON chat_messages FOR UPDATE USING (app_sys() OR app_is_owner("salonId") OR "clientId" = app_uid());
CREATE POLICY chat_messages_delete ON chat_messages FOR DELETE USING (app_sys() OR app_is_owner("salonId") OR "clientId" = app_uid());

-- Profile photo: the person and the staff of salons they are connected to; only the person changes it.
CREATE POLICY user_avatars_select ON user_avatars FOR SELECT USING (app_sys() OR app_user_visible("userId"));
CREATE POLICY user_avatars_write  ON user_avatars FOR ALL USING (app_sys() OR "userId" = app_uid()) WITH CHECK (app_sys() OR "userId" = app_uid());

-- The salon owner's private notes about customers.
CREATE POLICY salon_client_notes_all ON salon_client_notes FOR ALL
  USING (app_sys() OR app_is_owner("salonId")) WITH CHECK (app_sys() OR app_is_owner("salonId"));

-- Password-reset and verification tokens: never readable through a user session.
CREATE POLICY email_tokens_all ON email_tokens FOR ALL USING (app_sys()) WITH CHECK (app_sys());

CREATE POLICY worker_time_off_all ON worker_time_off FOR ALL
  USING (app_sys() OR app_is_staff("salonId")) WITH CHECK (app_sys() OR app_is_staff("salonId"));

CREATE POLICY waitlist_entries_all ON waitlist_entries FOR ALL
  USING (app_sys() OR app_is_staff("salonId") OR "clientId" = app_uid())
  WITH CHECK (app_sys() OR app_is_staff("salonId") OR "clientId" = app_uid());

-- Ratings are public with the salon; written by the customer (or system code on the booking link).
CREATE POLICY reviews_select ON reviews FOR SELECT USING (app_sys() OR app_can_view("salonId"));
CREATE POLICY reviews_write  ON reviews FOR ALL USING (app_sys() OR "clientId" = app_uid()) WITH CHECK (app_sys() OR "clientId" = app_uid());

-- Platform usage log: system only.
CREATE POLICY assistant_uses_all ON assistant_uses FOR ALL USING (app_sys()) WITH CHECK (app_sys());

-- QR memberships: visible to the customer and the salon's staff; created by system code after the QR token is checked.
CREATE POLICY salon_memberships_select ON salon_memberships FOR SELECT USING (app_sys() OR "userId" = app_uid() OR app_is_staff("salonId"));
CREATE POLICY salon_memberships_write  ON salon_memberships FOR ALL USING (app_sys()) WITH CHECK (app_sys());

-- 5. Privileges of the app role: data only, never migrations or the Prisma bookkeeping table -------------------------
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'mojfrizer_app') THEN
    -- Lets the connecting (owner) role switch to it with set_config('role', ...) inside a transaction.
    EXECUTE format('GRANT mojfrizer_app TO %I', current_user);
    GRANT USAGE ON SCHEMA public TO mojfrizer_app;
    GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO mojfrizer_app;
    REVOKE ALL ON TABLE _prisma_migrations FROM mojfrizer_app;
    GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO mojfrizer_app;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO mojfrizer_app;
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'could not grant privileges to mojfrizer_app (%). Enforcement (RLS_ENFORCE=1) will not work until fixed.', SQLERRM;
END $$;
