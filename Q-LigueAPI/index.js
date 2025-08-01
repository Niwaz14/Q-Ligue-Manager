
// Installation de DotEnv pour aider à gérer les variables d'environnement

require('dotenv').config(); //Rendre les variables d'environnement disponibles.


const express = require('express');
const pool = require('./db.js'); //Connexion à la base de données PostgreSQL
const app = express(); // Importer le module express et créer une instance de l'application
app.use(express.json()); // Middleware pour analyser les requêtes JSON
const port = 3000; // Définir le port sur lequel le serveur écoutera

// |------------------------------------------------------------------------ GET API Endpoint ------------------------------------------------------------------------|

app.get('/', function(req, res) {
  res.send('Salut, Q-Ligue Manager! Le serveur fonctionne!'); // Définir une route pour la racine qui envoie une réponse simple
});



// On fait un point d'entrée pour récupérer les équipes
app.get('/api/teams', async function(req, res) {
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

// ... On fait un point d'entrée pour récupérer les joueurs
app.get('/api/players', async function(req, res) {
  try {
    
    const allPlayers = await pool.query('SELECT * FROM Player');
    res.json(allPlayers.rows);

  } catch (err) {
    console.error(err.message);
    res.status(500).send('Erreur du serveur lors de la récupération des joueurs');
  }
});

// Pour avoir l'horaire par semaine
app.get('/api/schedule', async function(req, res) {
  try {
    const schedule = await pool.query(`
      SELECT
        w.WeekDate,
        t1.TeamName AS Team1_Name, 
        t2.TeamName AS Team2_Name
      FROM Matchup m
      JOIN Week w ON m.WeekID = w.WeekID
      JOIN Team t1 ON m.Team1_ID = t1.TeamID
      JOIN Team t2 ON m.Team2_ID = t2.TeamID
      ORDER BY w.WeekDate;
    `);

    res.json(schedule.rows);

  } catch (err) {
    console.error(err.message);
    res.status(500).send("Erreur du serveur lors de la récupération de l'horaire");
  }
});

// Pour les classements des joueurs
app.get('/api/rankings', async function(req, res) {
  try {
    const rankings = await pool.query(`
      SELECT
        p.PlayerName,
        p.PlayerCode,
        t.TeamName,
        COUNT(g.GameID) AS GamesPlayed,
        SUM(g.GameScore) AS TotalScore,
        AVG(g.GameScore)::numeric(10,2) AS AverageScore
      FROM Player p
      JOIN Game g ON p.PlayerID = g.PlayerID
      JOIN Team t ON p.TeamID = t.TeamID
      GROUP BY p.PlayerID, t.TeamName
      ORDER BY AverageScore DESC;
    `);

    res.json(rankings.rows);

  } catch (err) {
    console.error(err.message);
    res.status(500).send("Erreur du serveur lors de la récupération des classements");
  }
});


// |------------------------------------------------------------------------  GET ENDPOINTS API FIN ------------------------------------------------------------------------|

// |------------------------------------------------------------------------ POST ENDPOINTS API ------------------------------------------------------------------------|

app.post('/api/games', async function(req, res) {
  try {
    
    const { playerid, matchupid, laneid, gamenumber, gamescore } = req.body;

    // On crée une nouvelle partie dans la base de données avec les paramètres fournis
    const newGame = await pool.query(
      "INSERT INTO Game (PlayerID, MatchupID, LaneID, GameNumber, GameScore, GameApprovalStatus) VALUES ($1, $2, $3, $4, $5, 'approved') RETURNING *",
      [playerid, matchupid, laneid, gamenumber, gamescore]
    );

    // On l'envoie en réponse
    res.json(newGame.rows[0]);

  } catch (err) {
    console.error(err.message);
    res.status(500).send("Erreur du serveur lors de l'envoi de la partie");
  }
});

// |------------------------------------------------------------------------ POST ENDPOINTS API FIN ------------------------------------------------------------------------|

app.listen(port, function() {
  console.log(`Le serveur écoute ici : http://localhost:${port}`); // Démarrer le serveur et afficher un message dans la console
});