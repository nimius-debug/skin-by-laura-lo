-- Failed admin logins per network address, for a short lockout after repeated wrong passwords.
-- Times are unix milliseconds. A row is removed after a successful login.
CREATE TABLE IF NOT EXISTS admin_login_attempts (
  client_key TEXT PRIMARY KEY,
  failures INTEGER NOT NULL,
  first_failed_at INTEGER NOT NULL,
  locked_until INTEGER NOT NULL DEFAULT 0
);
