const dns = require('dns');
if (dns.setDefaultResultOrder) {
  dns.setDefaultResultOrder('ipv4first');
}

const path = require('path');
const fs = require('fs');
const { Sequelize } = require('sequelize');

require('dotenv').config({ path: path.join(__dirname, '../.env') });
require('dotenv').config();

/**
 * Backend supports two ways to connect:
 * 1. DATABASE_URL  e.g. postgres://user:pass@host:5432/dbname
 *                       mysql://user:pass@host:3306/dbname
 * 2. Discrete vars: DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD, DB_DIALECT
 *
 * Render PostgreSQL  -> use DATABASE_URL (Internal Database URL)
 * Aiven / Clever MySQL / local -> use DB_* vars or DATABASE_URL
 */

const isProd = process.env.NODE_ENV === 'production';

/* ── TLS decision ───────────────────────────────────────────────────
   DB_SSL wins when set explicitly (true or false). Otherwise TLS is
   enabled automatically for REMOTE hosts in production (Render
   Postgres, Aiven MySQL…), but never forced on localhost / VPS-local
   servers: many shared hosts ship MySQL with TLS disabled, and forcing
   it made the handshake fail on every boot — "database connection
   fails" with no obvious cause. */
function hostFromUrl(url) {
  try { return new URL(url).hostname; } catch (_) { return null; }
}
const configUrl = process.env.DATABASE_URL || null;
const dbHost = configUrl
  ? (hostFromUrl(configUrl) || 'localhost')
  : (process.env.DB_HOST || 'localhost');
const isLocalDb = ['localhost', '127.0.0.1', '::1'].includes(String(dbHost).toLowerCase());
const useSSL =
  process.env.DB_SSL === 'true' ? true
  : process.env.DB_SSL === 'false' ? false
  : isProd && !isLocalDb;

const sslOptions = useSSL
  ? { require: true, rejectUnauthorized: false }
  : false;

let sequelize;

if (process.env.DATABASE_URL) {
  // Strip query string from URL to avoid mysql2 "ssl-mode" warnings
  let rawUrl = process.env.DATABASE_URL;
  const qsIdx = rawUrl.indexOf('?');
  const cleanUrl = qsIdx !== -1 ? rawUrl.substring(0, qsIdx) : rawUrl;
  const dialect =
    process.env.DB_DIALECT ||
    (cleanUrl.startsWith('postgres') ? 'postgres' : 'mysql');

  sequelize = new Sequelize(cleanUrl, {
    dialect,
    logging: process.env.NODE_ENV === 'development' ? console.log : false,
    dialectOptions: {
      ssl: sslOptions,
      // PERF: the DB is commonly hosted on a remote managed service where
      // establishing a connection (TCP + TLS handshake + auth) costs 1–2s.
      // With the previous pool (min:0, idle:10s) every poll after a 10s
      // gap paid that full cost again — most dashboard latency was
      // re-connection, not query time. mysql2's keep-alive keeps pooled
      // sockets alive through NAT/firewall idle timeouts (common on
      // managed MySQL/TiDB providers) instead of dropping them.
      ...(dialect === 'mysql'
        ? { enableKeepAlive: true, keepAliveInitialDelay: 10000 }
        : {}),
      // Safety: never let a hung connection block a request forever.
      connectTimeout: 15000,
    },
    // Warm pool: keep one connection always established so the first
    // dashboard/auth request after an idle gap is query-time only. Keep
    // idle slightly below typical provider TCP idle-cut (60s is safe).
    pool: { max: 10, min: 1, acquire: 30000, idle: 60000, evict: 10000 },
  });
} else {
  const dialect = process.env.DB_DIALECT || 'mysql';
  sequelize = new Sequelize(
    process.env.DB_NAME || 'mrbeast_db',
    process.env.DB_USER || 'root',
    process.env.DB_PASSWORD || '',
    {
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || (dialect === 'postgres' ? 5432 : 3306),
      dialect,
      logging: process.env.NODE_ENV === 'development' ? console.log : false,
      dialectOptions: {
        ssl: sslOptions,
        // PERF: same rationale as the DATABASE_URL branch above — remote
        // MySQL connections cost 1–2s to establish; dropping them after
        // 10s of idle made almost every dashboard poll a full reconnect.
        ...(dialect === 'mysql'
          ? { enableKeepAlive: true, keepAliveInitialDelay: 10000 }
          : {}),
        // Safety: never let a hung connection block a request forever.
        connectTimeout: 15000,
      },
      // Warm pool: keep one connection always established so the first
      // dashboard/auth request after an idle gap is query-time only. Keep
      // idle slightly below typical provider TCP idle-cut (60s is safe).
      pool: { max: 10, min: 1, acquire: 30000, idle: 60000, evict: 10000 },
    }
  );
}

/* Password-free description of where we're actually pointing. Printed
   on boot and on connection failure so a wrong/missing .env entry
   (wrong host, default db name, missing user…) is immediately visible
   in the hosting provider's runtime logs. */
sequelize.connectionSummary = () => {
  const envFiles = [
    path.join(__dirname, '../.env'),
    path.join(process.cwd(), '.env'),
  ].map((p) => `${p}=${fs.existsSync(p) ? 'present' : 'missing'}`).join(' | ');
  const cfg = sequelize.config || {};
  const source = configUrl
    ? 'DATABASE_URL env var'
    : 'DB_* env vars (defaults apply for any that are unset)';
  return (
    `dialect=${sequelize.getDialect()} host=${cfg.host || dbHost} ` +
    `port=${cfg.port || '?'} db=${cfg.database || '?'} user=${cfg.username || '?'} ` +
    `ssl=${useSSL ? 'on' : 'off'} source=${source} | env files: ${envFiles}`
  );
};

module.exports = sequelize;
