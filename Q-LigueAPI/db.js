
require('dotenv').config(); //Rendre les variables d'environnement disponibles.


const pg = require('pg'); // On va chercher  le module pg pour interagir avec PostgreSQL.
const Pool = pg.Pool; // On met en constante la classe Pool de pg, qui nous permet de gérer les connexions à la base de données.



const pool = new Pool({ // On initialise une nouvelle instance de Pool.
  user: process.env.DB_USER, // On load les variables d'environnement pour la connexion à la base de données.
  host: process.env.DB_HOST,
  database: process.env.DB_DATABASE,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
}); // Le processus permettra de garder les informations de connexion à la base de données dans un pool de connexions pour sécurisé le processus.


module.exports = pool; // On exporte le pool pour pouvoir l'utiliser dans d'autres fichiers de l'application.