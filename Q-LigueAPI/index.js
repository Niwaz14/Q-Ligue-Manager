
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
  try {    const allTeams = await pool.query('SELECT * FROM "Team"'); 
    res.json(allTeams.rows);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Erreur du serveur lors de la récupération des équipes');
  }
});

// On fait un point d'entrée pour récupérer les joueurs
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

// Point d'entrée pour le classement des joueurs
app.get('/api/rankings/:weekId', async (req, res) => {
    try {
        const { weekId } = req.params;
        const handicapBase = 240;
        const handicapFactor = 0.40;

        
        const allPlayersQuery = `SELECT p."PlayerID", p."PlayerName", p."TeamID", t."TeamName" FROM "Player" p LEFT JOIN "Team" t ON p."TeamID" = t."TeamID";`;
        const allPlayers = (await pool.query(allPlayersQuery)).rows;
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
        const gamesByWeek = allGames.reduce((acc, game) => {
            const week = game.WeekID;
            if (!acc[week]) acc[week] = [];
            acc[week].push(game);
            return acc;
        }, {});

        
        const playerStatsHistory = new Map();
        const totalPointsByPlayer = new Map();
        const weeklyPointsByPlayer = {};
        allPlayers.forEach(p => totalPointsByPlayer.set(p.PlayerID, 0));
        const sortedWeeks = Object.keys(gamesByWeek).map(Number).sort((a, b) => a - b);

        for (const currentWeek of sortedWeeks) {
            const gamesForStats = allGames.filter(g => g.WeekID < currentWeek);
            allPlayers.forEach(player => {
                const playedGames = gamesForStats.filter(g => g.PlayerID === player.PlayerID && !g.IsAbsent);
                const totalScore = playedGames.reduce((sum, game) => sum + game.GameScore, 0);
                const average = playedGames.length > 0 ? totalScore / playedGames.length : 150;
                const handicap = Math.max(0, Math.floor((handicapBase - average) * handicapFactor));
                playerStatsHistory.set(player.PlayerID, { average, handicap });
            });

            const weekGames = gamesByWeek[currentWeek];
            const matchupIdsThisWeek = [...new Set(weekGames.map(g => g.MatchupID))];
            weeklyPointsByPlayer[currentWeek] = new Map();
            for (const matchupId of matchupIdsThisWeek) {
                const matchupGames = weekGames.filter(g => g.MatchupID === matchupId);
                if (matchupGames.length === 0) continue;
                const team1Id = matchupGames[0].Team1_ID;
                for (let pos = 1; pos <= 5; pos++) {
                    const p1Games = matchupGames.filter(g => g.LineupPosition === pos && g.TeamID === team1Id);
                    const p2Games = matchupGames.filter(g => g.LineupPosition === pos && g.TeamID !== team1Id);
                    if (p1Games.length === 3 && p2Games.length === 3) {
                        const p1Id = p1Games[0].PlayerID;
                        const p2Id = p2Games[0].PlayerID;
                        const p1Stats = playerStatsHistory.get(p1Id);
                        const p2Stats = playerStatsHistory.get(p2Id);
                        let p1Points = 0, p2Points = 0;
                        let p1TripleHdcp = 0, p2TripleHdcp = 0;
                        for (let i = 1; i <= 3; i++) {
                            const g1 = p1Games.find(g => g.GameNumber === i);
                            const g2 = p2Games.find(g => g.GameNumber === i);
                            const score1 = g1.IsAbsent ? p1Stats.average : g1.GameScore;
                            const score2 = g2.IsAbsent ? p2Stats.average : g2.GameScore;
                            const s1 = score1 + p1Stats.handicap;
                            const s2 = score2 + p2Stats.handicap;
                            if (s1 > s2) p1Points++; else if (s1 < s2) p2Points++; else { p1Points += 0.5; p2Points += 0.5; }
                            p1TripleHdcp += s1;
                        }
                        if (p1TripleHdcp > p2TripleHdcp) p1Points++; else if (p1TripleHdcp < p2TripleHdcp) p2Points++; else { p1Points += 0.5; p2Points += 0.5; }
                        totalPointsByPlayer.set(p1Id, (totalPointsByPlayer.get(p1Id) || 0) + p1Points);
                        totalPointsByPlayer.set(p2Id, (totalPointsByPlayer.get(p2Id) || 0) + p2Points);
                        weeklyPointsByPlayer[currentWeek].set(p1Id, p1Points);
                        weeklyPointsByPlayer[currentWeek].set(p2Id, p2Points);
                    }
                }
            }
        }
        
        
        const finalPlayerStats = new Map();
        allPlayers.forEach(player => {
            const gamesPlayed = allGames.filter(g => g.PlayerID === player.PlayerID && !g.IsAbsent);
            const totalScore = gamesPlayed.reduce((sum, game) => sum + game.GameScore, 0);
            const average = gamesPlayed.length > 0 ? totalScore / gamesPlayed.length : 150;
            const handicap = Math.max(0, Math.floor((handicapBase - average) * handicapFactor));
            const gamesByMatchup = gamesPlayed.reduce((acc, game) => {
                const matchupId = game.MatchupID;
                if (!acc[matchupId]) acc[matchupId] = [];
                acc[matchupId].push(game.GameScore);
                return acc;
            }, {});
            let highestTriple = null;
            for (const matchupId in gamesByMatchup) {
                if (gamesByMatchup[matchupId].length === 3) {
                    const tripleScore = gamesByMatchup[matchupId].reduce((sum, score) => sum + score, 0);
                    if (highestTriple === null || tripleScore > highestTriple) {
                        highestTriple = tripleScore;
                    }
                }
            }
            finalPlayerStats.set(player.PlayerID, { average, handicap, totalGamesPlayed: gamesPlayed.length, totalSeasonScore: totalScore, highestSingle: gamesPlayed.length > 0 ? Math.max(...gamesPlayed.map(g => g.GameScore)) : null, highestTriple });
        });

        
        const rankings = allPlayers.map(player => {
            const finalStats = finalPlayerStats.get(player.PlayerID);
            const playerAllGames = allGames.filter(g => g.PlayerID === player.PlayerID);
            const lastWeekPlayed = playerAllGames.length > 0 ? Math.max(...playerAllGames.map(g => g.WeekID)) : 0;
            const absentScoreForLastMatch = playerStatsHistory.get(player.PlayerID)?.average || 150;
            const createGameResult = (gameNumber) => {
                const game = playerAllGames.find(g => g.WeekID === lastWeekPlayed && g.GameNumber === gameNumber);
                if (!game) return { score: null, isAbsent: false };
                return { score: game.IsAbsent ? Math.round(absentScoreForLastMatch) : game.GameScore, isAbsent: game.IsAbsent };
            };
            const lastGame1Result = createGameResult(1);
            const lastGame2Result = createGameResult(2);
            const lastGame3Result = createGameResult(3);
            const triple = (lastGame1Result.score !== null && lastGame2Result.score !== null && lastGame3Result.score !== null) ? lastGame1Result.score + lastGame2Result.score + lastGame3Result.score : null;
            return {
                PlayerName: player.PlayerName, TeamName: player.TeamName, Average: finalStats.average, Handicap: finalStats.handicap,
                TotalGamesPlayed: finalStats.totalGamesPlayed, TotalSeasonScore: finalStats.totalSeasonScore,
                HighestSingle: finalStats.highestSingle, HighestTriple: finalStats.highestTriple,
                LastGame1: lastGame1Result, LastGame2: lastGame2Result, LastGame3: lastGame3Result,
                Triple: triple, TripleWithHandicap: triple !== null ? triple + (finalStats.handicap * 3) : null,
                WeekPoints: weeklyPointsByPlayer[lastWeekPlayed]?.get(player.PlayerID) || 0,
                TotalPoints: totalPointsByPlayer.get(player.PlayerID) || 0,
            };
        });

        rankings.sort((a, b) => b.Average - a.Average);
        res.json(rankings);

    } catch (err) {
        console.error("Erreur à la récupération du classement des joueurs", err.message);
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
        res.status(201).json({ message: 'Pointage mis-à-jour avec succès' });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Erreur lors de la MAJ des pointages', err.message);
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
        res.status(401).json({ success: false, message: 'Code incorrect' });
    }
});


// |------------------------------------------------------------------------ POST ENDPOINTS API FIN ------------------------------------------------------------------------|

app.listen(port, function() {
  console.log(`Le serveur écoute ici : http://localhost:${port}`); // Démarrer le serveur et afficher un message dans la console
});