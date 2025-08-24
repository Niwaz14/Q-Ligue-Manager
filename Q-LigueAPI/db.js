// Q-LigueAPI/db.js

const { Pool } = require('pg');
require('dotenv').config();

// Configuration pour la connexion à la base de données
const config = {};

// Si une DATABASE_URL est fournie (par exemple, dans un environnement de production), utilisez-la.
if (process.env.DATABASE_URL) {
  config.connectionString = process.env.DATABASE_URL;
  config.ssl = {
    rejectUnauthorized: false
  };
} else {
  // Sinon, utilisez les variables individuelles du fichier .env pour le développement local.
  config.user = process.env.DB_USER;
  config.host = process.env.DB_HOST;
  config.database = process.env.DB_DATABASE;
  config.port = process.env.DB_PORT;

  config.password = process.env.DB_PASSWORD || '';
}

// Crée le pool de connexions avec la configuration appropriée
const pool = new Pool(config);

module.exports = pool;