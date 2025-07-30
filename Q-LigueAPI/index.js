
const express = require('express');
const app = express(); // Importer le module express et créer une instance de l'application
const port = 3000; // Définir le port sur lequel le serveur écoutera


app.get('/', function(req, res) {
  res.send('Salut, Q-Ligue Manager! Le serveur fonctionne!'); // Définir une route pour la racine qui envoie une réponse simple
});


app.listen(port, function() {
  console.log('Le serveur écoute ici : http://localhost:${port}'); // Démarrer le serveur et afficher un message dans la console
});