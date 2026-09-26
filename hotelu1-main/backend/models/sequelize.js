const { Sequelize } = require('sequelize');

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
    dialectOptions: { ssl: sslOptions },
    pool: { max: 10, min: 0, acquire: 30000, idle: 10000 },
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
      dialectOptions: { ssl: sslOptions },
      pool: { max: 10, min: 0, acquire: 30000, idle: 10000 },
    }
  );
}

module.exports = sequelize;
