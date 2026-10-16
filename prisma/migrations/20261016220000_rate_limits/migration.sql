-- Abuse protection: counters for src/lib/rateLimit.ts (login attempts, registrations, bookings, AI questions, ...).
-- One row per key ("login:ip:1.2.3.4") holding a fixed-window counter. System code only: no user session may read it.
CREATE TABLE "rate_limits" (
    "key" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "windowStart" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rate_limits_pkey" PRIMARY KEY ("key")
);

CREATE INDEX "rate_limits_windowStart_idx" ON "rate_limits"("windowStart");

ALTER TABLE rate_limits ENABLE ROW LEVEL SECURITY;
CREATE POLICY rate_limits_all ON rate_limits FOR ALL USING (app_sys()) WITH CHECK (app_sys());
