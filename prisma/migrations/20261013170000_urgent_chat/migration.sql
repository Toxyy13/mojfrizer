-- Urgent booking through chat: the request remembers the preferred hairdresser and the customer's time wish.
ALTER TABLE "urgent_requests" ADD COLUMN "workerId" TEXT, ADD COLUMN "timeWish" TEXT;
ALTER TABLE "urgent_requests" ADD CONSTRAINT "urgent_requests_workerId_fkey"
  FOREIGN KEY ("workerId") REFERENCES "worker_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "urgent_requests_workerId_idx" ON "urgent_requests"("workerId");

-- Staff logins may read and answer a customer's chat only while that customer has an open urgent request addressed to
-- them or to anyone ("Bilo ko"). The owner keeps access to every conversation of the salon.
CREATE OR REPLACE FUNCTION app_chat_salon_side(sid text, cid text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS
  $$ SELECT app_is_owner(sid) OR EXISTS (
       SELECT 1 FROM urgent_requests u
        WHERE u."salonId" = sid AND u."clientId" = cid AND u.status = 'PENDING'
          AND app_is_staff(sid)
          AND (u."workerId" IS NULL OR EXISTS (
                SELECT 1 FROM worker_profiles w
                 WHERE w.id = u."workerId" AND w."userId" = app_uid() AND w."isActive"))) $$;

DROP POLICY chat_messages_select ON chat_messages;
DROP POLICY chat_messages_insert ON chat_messages;
DROP POLICY chat_messages_update ON chat_messages;
DROP POLICY chat_messages_delete ON chat_messages;

CREATE POLICY chat_messages_select ON chat_messages FOR SELECT
  USING (app_sys() OR app_chat_salon_side("salonId", "clientId") OR "clientId" = app_uid());
CREATE POLICY chat_messages_insert ON chat_messages FOR INSERT WITH CHECK (
  app_sys()
  OR (app_chat_salon_side("salonId", "clientId") AND "senderId" = app_uid() AND "fromSalon")
  OR ("clientId" = app_uid() AND "senderId" = app_uid() AND NOT "fromSalon"));
CREATE POLICY chat_messages_update ON chat_messages FOR UPDATE
  USING (app_sys() OR app_chat_salon_side("salonId", "clientId") OR "clientId" = app_uid());
CREATE POLICY chat_messages_delete ON chat_messages FOR DELETE
  USING (app_sys() OR app_chat_salon_side("salonId", "clientId") OR "clientId" = app_uid());
