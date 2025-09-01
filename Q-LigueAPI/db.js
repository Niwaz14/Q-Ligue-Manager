// Q-LigueAPI/db.js

const { Pool } = require('pg');
require('dotenv').config();

// This line checks if the app is running in the production environment on Render.
const isProduction = process.env.NODE_ENV === 'production';

const connectionString = process.env.DATABASE_URL;

const pool = new Pool({
    connectionString: connectionString,
    // This is the crucial part: enable SSL for production, disable it for local development.
    ssl: isProduction ? { rejectUnauthorized: false } : false,
});

module.exports = pool;