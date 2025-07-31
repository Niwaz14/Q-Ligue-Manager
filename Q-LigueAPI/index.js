
// Installation de DotEnv pour aider à gérer les variables d'environnement

require('dotenv').config(); //Rendre les variables d'environnement disponibles.


const express = require('express');
const pool = require('./db.js'); //Connexion à la base de données PostgreSQL
const app = express(); // Importer le module express et créer une instance de l'application
const port = 3000; // Définir le port sur lequel le serveur écoutera



app.get('/', function(req, res) {
  res.send('Salut, Q-Ligue Manager! Le serveur fonctionne!'); // Définir une route pour la racine qui envoie une réponse simple
});



// On fait un point d'entrée pour récupérer les équipes
app.get('/api/team', async function(req, res) {
  try {
    // On importe la connection à la base de données et on ajoute la constante avec toutes les équipes.
    const allTeams = await pool.query('SELECT * FROM Team');

    // Si la requête réussit, on envoie les données des équipes en réponse
    res.json(allTeams.rows);

  } catch (err) {
    // Si il y a une erreur, on affiche l'erreur dans la console et on envoie un message d'erreur. (500 = Internal Server Error)
    console.error(err.message);
    res.status(500).send('Erreur du serveur lors de la récupération des équipes');
  }
});


app.listen(port, function() {
  console.log(`Le serveur écoute ici : http://localhost:${port}`); // Démarrer le serveur et afficher un message dans la console
});