
// Installation de DotEnv pour aider à gérer les variables d'environnement

require('dotenv').config(); //Rendre les variables d'environnement disponibles.


const express = require('express');
const pool = require('./db.js'); //Connexion à la base de données PostgreSQL
const app = express(); // Importer le module express et créer une instance de l'application
const cors = require('cors'); // Importer le module CORS pour gérer les requêtes cross-origin
app.use(cors()); // Utiliser CORS pour permettre les requêtes depuis d'autres origines
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
        m.MatchupID,  -- LA LIGNE MANQUANTE À AJOUTER
        w.WeekDate,
        t1.TeamName AS Team1_Name, 
        t2.TeamName AS Team2_Name,
        l.LaneNumber
      FROM Matchup m
      JOIN Week w ON m.WeekID = w.WeekID
      JOIN Team t1 ON m.Team1_ID = t1.TeamID
      JOIN Team t2 ON m.Team2_ID = t2.TeamID
      JOIN Lane l ON m.LaneID = l.LaneID
      ORDER BY w.WeekDate;
    `);

    res.json(schedule.rows);

  } catch (err) {
    console.error(err.message);
    res.status(500).send("Erreur du serveur lors de la récupération de l'horaire");
  }
});

// Pour les classements des joueurs
app.get('/api/rankings/:weekId', async (req, res) => {
    try {
        const { weekId } = req.params;
        const handicapBase = 240;
        const handicapFactor = 0.40;

        const rankingsQuery = `
            WITH PlayerAverages AS (
                SELECT
                    p."PlayerID",
                    COALESCE(AVG(g."GameScore"), 0) AS "Average"
                FROM "Player" p
                LEFT JOIN "Game" g ON p."PlayerID" = g."PlayerID"
                LEFT JOIN "Matchup" m ON g."MatchupID" = m."MatchupID"
                WHERE g."IsAbsent" = FALSE AND m."WeekID" <= $1
                GROUP BY p."PlayerID"
            ),
            Handicaps AS (
                SELECT
                    "PlayerID",
                    GREATEST(0, FLOOR((${handicapBase} - "Average") * ${handicapFactor})) AS "Handicap"
                FROM PlayerAverages
            ),
            GamesWithHandicap AS (
                SELECT
                    g."GameID", g."PlayerID", g."MatchupID", g."GameNumber", g."GameScore",
                    m."WeekID", p."TeamID", h."Handicap",
                    (g."GameScore" + h."Handicap") AS "ScoreWithHandicap"
                FROM "Game" g
                JOIN "Matchup" m ON g."MatchupID" = m."MatchupID"
                JOIN "Player" p ON g."PlayerID" = p."PlayerID"
                JOIN Handicaps h ON g."PlayerID" = h."PlayerID"
                WHERE m."WeekID" <= $1
            ),
            PlayerMatchupPoints AS (
                SELECT
                    g1."PlayerID", g1."MatchupID",
                    SUM(CASE WHEN g1."ScoreWithHandicap" > g2."ScoreWithHandicap" THEN 1 WHEN g1."ScoreWithHandicap" = g2."ScoreWithHandicap" THEN 0.5 ELSE 0 END) AS "GamePoints"
                FROM GamesWithHandicap g1
                JOIN "Matchup" m ON g1."MatchupID" = m."MatchupID"
                JOIN GamesWithHandicap g2 ON g1."MatchupID" = g2."MatchupID" AND g1."GameNumber" = g2."GameNumber"
                WHERE ((SELECT "TeamID" FROM "Player" WHERE "PlayerID" = g1."PlayerID") = m."Team1_ID" AND (SELECT "TeamID" FROM "Player" WHERE "PlayerID" = g2."PlayerID") = m."Team2_ID")
                   OR ((SELECT "TeamID" FROM "Player" WHERE "PlayerID" = g1."PlayerID") = m."Team2_ID" AND (SELECT "TeamID" FROM "Player" WHERE "PlayerID" = g2."PlayerID") = m."Team1_ID")
                GROUP BY g1."PlayerID", g1."MatchupID"
            ),
            PlayerLastWeek AS (
                SELECT "PlayerID", MAX("WeekID") AS "LastWeekID"
                FROM GamesWithHandicap WHERE "GameScore" IS NOT NULL GROUP BY "PlayerID"
            ),
            LastThreeGames AS (
                SELECT
                    g."PlayerID",
                    MAX(CASE WHEN g."GameNumber" = 1 THEN g."GameScore" END) AS "LastGame1",
                    MAX(CASE WHEN g."GameNumber" = 2 THEN g."GameScore" END) AS "LastGame2",
                    MAX(CASE WHEN g."GameNumber" = 3 THEN g."GameScore" END) AS "LastGame3"
                FROM "Game" g
                JOIN "Matchup" m ON g."MatchupID" = m."MatchupID"
                JOIN PlayerLastWeek plw ON g."PlayerID" = plw."PlayerID" AND m."WeekID" = plw."LastWeekID"
                GROUP BY g."PlayerID"
            )
            SELECT
                p."PlayerName",
                t."TeamName",
                pa."Average",
                h."Handicap",
                ltg."LastGame1", ltg."LastGame2", ltg."LastGame3",
                (ltg."LastGame1" + ltg."LastGame2" + ltg."LastGame3") AS "Triple",
                (ltg."LastGame1" + ltg."LastGame2" + ltg."LastGame3" + (h."Handicap" * 3)) AS "TripleWithHandicap",
                (SELECT SUM("GameScore") FROM "Game" g JOIN "Matchup" m ON g."MatchupID" = m."MatchupID" WHERE g."PlayerID" = p."PlayerID" AND g."IsAbsent" = FALSE AND m."WeekID" <= $1) AS "TotalSeasonScore",
                (SELECT COUNT("GameID") FROM "Game" g JOIN "Matchup" m ON g."MatchupID" = m."MatchupID" WHERE g."PlayerID" = p."PlayerID" AND g."IsAbsent" = FALSE AND m."WeekID" <= $1) AS "TotalGamesPlayed",
                (SELECT MAX("GameScore") FROM "Game" g JOIN "Matchup" m ON g."MatchupID" = m."MatchupID" WHERE g."PlayerID" = p."PlayerID" AND g."IsAbsent" = FALSE AND m."WeekID" <= $1) AS "HighestSingle",
                COALESCE((SELECT "GamePoints" FROM PlayerMatchupPoints pmp JOIN "Matchup" m ON pmp."MatchupID" = m."MatchupID" WHERE pmp."PlayerID" = p."PlayerID" AND m."WeekID" = plw."LastWeekID"), 0) AS "WeekPoints",
                COALESCE((SELECT SUM("GamePoints") FROM PlayerMatchupPoints WHERE "PlayerID" = p."PlayerID"), 0) AS "TotalPoints"
            FROM "Player" p
            LEFT JOIN "Team" t ON p."TeamID" = t."TeamID"
            LEFT JOIN PlayerAverages pa ON p."PlayerID" = pa."PlayerID"
            LEFT JOIN Handicaps h ON p."PlayerID" = h."PlayerID"
            LEFT JOIN LastThreeGames ltg ON p."PlayerID" = ltg."PlayerID"
            LEFT JOIN PlayerLastWeek plw ON p."PlayerID" = plw."PlayerID"
            ORDER BY pa."Average" DESC;
        `;

        const { rows } = await pool.query(rankingsQuery, [weekId]);
        res.json(rows);

    } catch (err) {
        console.error("Erreur pour les classements:", err.message);
        res.status(500).send('Server error');
    }
});

// Pour récupérer les détails d'un seul match, y compris les joueurs et les scores existants
app.get('/api/matchups/:id', async function(req, res) {
  try {
    const { id } = req.params; // Récupère l'ID du match depuis l'URL

    const query = `
      SELECT
        p.PlayerID,
        p.PlayerName,
        t.TeamName, 
        g.GameScore,
        g.GameNumber
      FROM Player p
      JOIN Team t ON p.TeamID = t.TeamID 
      LEFT JOIN Game g ON p.PlayerID = g.PlayerID AND g.MatchupID = $1
      WHERE p.TeamID IN (
        (SELECT Team1_ID FROM Matchup WHERE MatchupID = $1),
        (SELECT Team2_ID FROM Matchup WHERE MatchupID = $1)
      );
    `;

    const playersAndScores = await pool.query(query, [id]);
    res.json(playersAndScores.rows);

  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server Error");
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

// Route pour enregistrer les pointages en batch
app.post('/api/scores/batch', async (req, res) => {
    const { matchupId, scores } = req.body;
    const client = await pool.connect();

    try {
        await client.query('BEGIN');
        const queryText = `
            INSERT INTO "Game" ("PlayerID", "MatchupID", "LaneID", "GameNumber", "GameScore", "IsAbsent")
            VALUES ($1, $2, 1, $3, $4, $5)
            ON CONFLICT ("PlayerID", "MatchupID", "GameNumber")
            DO UPDATE SET "GameScore" = EXCLUDED."GameScore", "IsAbsent" = EXCLUDED."IsAbsent";
        `;

        for (const score of scores) {
            
            const params = [score.playerId, matchupId, score.gameNumber, score.score, score.isAbsent];
            await client.query(queryText, params);
        }

        await client.query('COMMIT');
        res.status(201).json({ message: 'Changement aux pointages effectué avec succès' });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Erreur lors de la mise à jours des pointages', err.message);
        res.status(500).send('Erreur du serveur lors de la mise à jour des pointages');
    } finally {
        client.release();
    }
});


app.post('/api/verify', (req, res) => { // Solution temporaire pour vérifier le code d'accès administrateur
    const { accessCode } = req.body;
    
    
    if (accessCode && accessCode === process.env.ADMIN_CODE) {
        
        res.json({ success: true });
    } else {
        res.status(401).json({ success: false, message: 'Invalid code' });
    }
});


// |------------------------------------------------------------------------ POST ENDPOINTS API FIN ------------------------------------------------------------------------|

app.listen(port, function() {
  console.log(`Le serveur écoute ici : http://localhost:${port}`); // Démarrer le serveur et afficher un message dans la console
});