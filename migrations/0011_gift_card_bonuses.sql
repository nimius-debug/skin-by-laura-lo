-- One row per gift card purchase that earned a Black Friday bonus, so every
-- bonus can be accounted for and none is ever added twice. src/gift-bonus.js
-- also creates this table on first use, so a missed migration can't lose a bonus.
CREATE TABLE IF NOT EXISTS gift_card_bonuses (
  source_activity_id TEXT PRIMARY KEY,   -- Square's id for the purchase (activate or load)
  gift_card_id TEXT NOT NULL,
  card_last4 TEXT,
  kind TEXT NOT NULL,                    -- ACTIVATE (new card) or LOAD (top-up)
  paid_cents INTEGER NOT NULL,
  bonus_cents INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', -- pending, added, failed
  bonus_activity_id TEXT,                -- Square's id for the bonus itself
  balance_cents INTEGER,                 -- card balance right after the bonus
  error TEXT,
  purchased_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
