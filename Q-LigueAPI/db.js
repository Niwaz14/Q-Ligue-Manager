
// Q-LigueAPI/db.js

const { Pool } = require('pg');
require('dotenv').config();

const isProduction = process.env.NODE_ENV === 'production';

const connectionConfig = isProduction
  ? { // For production, use the DATABASE_URL
      connectionString: process.env.DATABASE_URL,
      ssl: {
        rejectUnauthorized: false,
      },
    }
  : { // For local development, use individual variables
      user: process.env.DB_USER,
      host: process.env.DB_HOST,
      database: process.env.DB_DATABASE,
      password: process.env.DB_PASSWORD || '',
      port: process.env.DB_PORT,
    };

const pool = new Pool(connectionConfig);

module.exports = pool;