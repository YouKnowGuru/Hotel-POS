const dns = require('dns');
if (dns.setDefaultResultOrder) {
  dns.setDefaultResultOrder('ipv4first');
}

const path = require('path');
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
const useSSL = process.env.DB_SSL === 'true' || isProd;

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

module.exports = sequelize;
