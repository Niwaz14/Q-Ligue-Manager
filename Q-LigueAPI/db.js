
// Q-LigueAPI/db.js

const { Pool } = require('pg');
require('dotenv').config();

// Use the single DATABASE_URL if it exists (for production), 
// otherwise fall back to individual variables (for local development).
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false
});

module.exports = pool;