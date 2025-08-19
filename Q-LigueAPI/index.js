
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

app.get('/api/rankings/:weekId', async (req, res) => {
    try {
        const { weekId } = req.params;
        const handicapBase = 240;
        const handicapFactor = 0.40;

       
        const gamesQuery = `
            SELECT
                g."PlayerID", p."TeamID", g."MatchupID", m."WeekID",
                m."Team1_ID", m."Team2_ID", g."LineupPosition",
                g."GameNumber", g."GameScore", g."IsAbsent"
            FROM "Game" g
            JOIN "Matchup" m ON g."MatchupID" = m."MatchupID"
            JOIN "Player" p ON g."PlayerID" = p."PlayerID"
            WHERE m."WeekID" <= $1;
        `;
        const allGames = (await pool.query(gamesQuery, [weekId])).rows;
        const allPlayersQuery = `SELECT p."PlayerID", p."PlayerName", p."TeamID", t."TeamName" FROM "Player" p LEFT JOIN "Team" t ON p."TeamID" = t."TeamID";`;
        const allPlayers = (await pool.query(allPlayersQuery)).rows;

        
        const playerStats = new Map();
        for (const player of allPlayers) {
            const gamesPlayed = allGames.filter(g => g.PlayerID === player.PlayerID && !g.IsAbsent);
            const totalScore = gamesPlayed.reduce((sum, game) => sum + game.GameScore, 0);
            const average = gamesPlayed.length > 0 ? totalScore / gamesPlayed.length : 150;
            const handicap = Math.max(0, Math.floor((handicapBase - average) * handicapFactor));
            playerStats.set(player.PlayerID, { average, handicap });
        }

        
        const pointsByMatchup = {};
        const matchupIds = [...new Set(allGames.map(g => g.MatchupID))];
        for (const matchupId of matchupIds) {
            pointsByMatchup[matchupId] = {};
            const matchupGames = allGames.filter(g => g.MatchupID === matchupId);
            if (matchupGames.length < 10) continue;
            const team1Id = matchupGames[0].Team1_ID;

            for (let pos = 1; pos <= 5; pos++) {
                const p1Games = matchupGames.filter(g => g.LineupPosition === pos && g.TeamID === team1Id);
                const p2Games = matchupGames.filter(g => g.LineupPosition === pos && g.TeamID !== team1Id);

                if (p1Games.length === 3 && p2Games.length === 3) {
                    const p1Id = p1Games[0].PlayerID;
                    const p2Id = p2Games[0].PlayerID;
                    const p1Stats = playerStats.get(p1Id);
                    const p2Stats = playerStats.get(p2Id);
                    let p1Points = 0, p2Points = 0;
                    let p1TripleHdcp = 0, p2TripleHdcp = 0;

                    for (let i = 1; i <= 3; i++) {
                        const g1 = p1Games.find(g => g.GameNumber === i);
                        const g2 = p2Games.find(g => g.GameNumber === i);
                        const s1 = (g1.IsAbsent ? p1Stats.average : g1.GameScore) + p1Stats.handicap;
                        const s2 = (g2.IsAbsent ? p2Stats.average : g2.GameScore) + p2Stats.handicap;
                        if (s1 > s2) p1Points += 1; else if (s1 < s2) p2Points += 1; else { p1Points += 0.5; p2Points += 0.5; }
                        p1TripleHdcp += s1;
                        p2TripleHdcp += s2;
                    }
                    if (p1TripleHdcp > p2TripleHdcp) p1Points += 1; else if (p1TripleHdcp < p2TripleHdcp) p2Points += 1; else { p1Points += 0.5; p2Points += 0.5; }
                    pointsByMatchup[matchupId][p1Id] = p1Points;
                    pointsByMatchup[matchupId][p2Id] = p2Points;
                }
            }
        }

        
        const rankings = allPlayers.map(player => {
            const stats = playerStats.get(player.PlayerID);
            const playerAllGames = allGames.filter(g => g.PlayerID === player.PlayerID);
            const playerRealGames = playerAllGames.filter(g => !g.IsAbsent);
            
            const lastWeekPlayed = Math.max(0, ...playerAllGames.map(g => g.WeekID));
            const lastMatchupId = playerAllGames.find(g => g.WeekID === lastWeekPlayed)?.MatchupID;
            const weekPoints = lastMatchupId ? (pointsByMatchup[lastMatchupId]?.[player.PlayerID] || 0) : 0;
            
            
            let totalPoints = 0;
            const playedMatchupIds = [...new Set(playerAllGames.map(g => g.MatchupID))];
            for (const mid of playedMatchupIds) {
                if (pointsByMatchup[mid] && pointsByMatchup[mid][player.PlayerID]) {
                    totalPoints += pointsByMatchup[mid][player.PlayerID];
                }
            }
            
            const lastThreeGames = playerAllGames.filter(g => g.WeekID === lastWeekPlayed);
            const triple = lastThreeGames.length === 3 ? lastThreeGames.reduce((sum, g) => sum + g.GameScore, 0) : null;
            
            return {
                PlayerName: player.PlayerName, TeamName: player.TeamName, Average: stats.average, Handicap: stats.handicap,
                TotalGamesPlayed: playerRealGames.length,
                TotalSeasonScore: playerRealGames.reduce((sum, game) => sum + game.GameScore, 0),
                HighestSingle: playerRealGames.length > 0 ? Math.max(...playerRealGames.map(g => g.GameScore)) : null,
                LastGame1: lastThreeGames.find(g => g.GameNumber === 1)?.GameScore ?? null,
                LastGame2: lastThreeGames.find(g => g.GameNumber === 2)?.GameScore ?? null,
                LastGame3: lastThreeGames.find(g => g.GameNumber === 3)?.GameScore ?? null,
                Triple: triple,
                TripleWithHandicap: triple !== null ? triple + (stats.handicap * 3) : null,
                WeekPoints: weekPoints,
                TotalPoints: totalPoints,
            };
        });

        rankings.sort((a, b) => b.Average - a.Average);
        res.json(rankings);

    } catch (err) {
        console.error("Error fetching rankings:", err.message);
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
            INSERT INTO "Game" ("PlayerID", "MatchupID", "LaneID", "GameNumber", "GameScore", "IsAbsent", "LineupPosition")
            VALUES ($1, $2, 1, $3, $4, $5, $6)
            ON CONFLICT ("PlayerID", "MatchupID", "GameNumber")
            DO UPDATE SET 
                "GameScore" = EXCLUDED."GameScore", 
                "IsAbsent" = EXCLUDED."IsAbsent",
                "LineupPosition" = EXCLUDED."LineupPosition";
        `;

        for (const score of scores) {
            const params = [
                score.playerId,
                matchupId,
                score.gameNumber,
                score.score,
                score.isAbsent,
                score.lineupPosition // The new data point
            ];
            await client.query(queryText, params);
        }

        await client.query('COMMIT');
        res.status(201).json({ message: 'Scores updated successfully' });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Error in batch score update:', err.message);
        res.status(500).send('Server error');
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