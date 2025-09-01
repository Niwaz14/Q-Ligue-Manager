// Chargement des variables d'environnement 
require('dotenv').config();

// Importations des modules nécessaires
const express = require('express'); // Le framework pour l'API
const cors = require('cors');       // "Middleware" pour gérer les problèmes de CORS
const pool = require('./db.js');    // Un module personnalisé pour gérer la connexion à la base de données PostgreSQL

// Déclaration de l'application Express
const app = express();


// On active CORS pour toutes les routes et origines.
app.use(cors({ origin: true, credentials: true }));

// On active le middleware pour permettre à Express de parser le JSON dans le corps des requêtes.
app.use(express.json());

// On définit le port d'écoute, en utilisant la variable d'environnement PORT si elle est définie, sinon on utilise le port 3000.
const PORT = process.env.PORT || 3000;


const getQualificationData = async (week, existingClient = null) => {
    const client = existingClient || await pool.connect();
    try {
        const weekNum = parseInt(week, 10);
        const handicapBase = 240;
        const handicapFactor = 0.40;
        const listSize = weekNum === 1 ? 20 : 15;

        // Calculer l'handicap de chaque joueur basé sur les semaines précédentes
        const handicapQuery = `
            SELECT g."PlayerID", FLOOR(GREATEST(0, ($1 - AVG(g."GameScore")) * $2)) AS handicap
            FROM "Game" g JOIN "Matchup" m ON g."MatchupID" = m."MatchupID"
            WHERE m."WeekID" < $3 AND g."IsAbsent" = FALSE
            GROUP BY g."PlayerID";
        `;
        const handicapRes = await client.query(handicapQuery, [handicapBase, handicapFactor, weekNum]);     
        const handicaps = new Map(handicapRes.rows.map(row => [row.PlayerID, parseInt(row.handicap, 10)])); // Map de PlayerID à handicap

        // Recevoir tous les scores de la semaine spécifiée
        const weeklyScoresQuery = `
            SELECT p."PlayerID", p."PlayerName", g."GameScore"
            FROM "Game" g JOIN "Player" p ON g."PlayerID" = p."PlayerID"
            JOIN "Matchup" m ON g."MatchupID" = m."MatchupID"
            WHERE m."WeekID" = $1 AND g."IsAbsent" = FALSE;
        `;
        const weeklyScoresRes = await client.query(weeklyScoresQuery, [weekNum]);

        // Faire une carte des totaux de chaque joueur pour la semaine
        const playerTotals = new Map();
        for (const row of weeklyScoresRes.rows) {
            if (!playerTotals.has(row.PlayerID)) { // Initialiser si le joueur n'est pas encore dans la carte
                playerTotals.set(row.PlayerID, { player_id: row.PlayerID, name: row.PlayerName, games: [] });
            }
            playerTotals.get(row.PlayerID).games.push(row.GameScore);
        }

        const allPlayersThisWeek = [];
        playerTotals.forEach(player => {
            if (player.games.length === 3) { // Seulement considérer les joueurs avec 3 parties
                const total_no_handicap = player.games.reduce((a, b) => a + b, 0); // Total sans handicap
                const handicap_per_game = handicaps.get(player.player_id) || Math.floor((handicapBase - 150) * handicapFactor); // Handicap par défaut 
                const total_with_handicap = total_no_handicap + (handicap_per_game * 3); // Total avec handicap
                allPlayersThisWeek.push({ ...player, total_no_handicap, total_with_handicap }); // Ajouter les totaux pour le joueur
            }
        });

        // Obtenir les meilleurs qualifiés basés sur le score sans handicap -- A REVOIR SEMBLE PAS PRENDRE EN COMPTE PLUS HAUT CLASSMENT--
        const sortedWithoutHandicap = [...allPlayersThisWeek]
            .sort((a, b) => b.total_no_handicap - a.total_no_handicap)
            .slice(0, listSize);
        
        // Créer un ensemble d'IDs de joueurs déjà qualifiés sans handicap pour éviter les doublons
        const withoutHandicapIds = new Set(sortedWithoutHandicap.map(p => p.player_id));

        // Ensuite, obtenir les meilleurs qualifiés basés sur le score avec handicap, en excluant ceux déjà qualifiés
        const sortedWithHandicap = [...allPlayersThisWeek]
            .filter(p => !withoutHandicapIds.has(p.player_id)) 
            .sort((a, b) => b.total_with_handicap - a.total_with_handicap)
            .slice(0, listSize);

        return {
            withHandicap: sortedWithHandicap,
            withoutHandicap: sortedWithoutHandicap,
        };

    } finally {
        if (!existingClient) {
            client.release();
        }
    }
};


// Démarrage du serveur et écoute sur le port spécifié
app.get('/', (req, res) => {
  res.send('Salut, Q-Ligue Manager! Le serveur fonctionne!');
});

// Route pour récupérer toutes les équipes
app.get('/api/teams', async (req, res) => {
  try {
    const allTeams = await pool.query('SELECT * FROM "Team"');
    res.json(allTeams.rows);
  } catch (err) {
    console.error("Error fetching teams:", err.message);
    res.status(500).send('Erreur du serveur lors de la récupération des équipes');
  }
});

// Route pour récupérer tous les joueurs
app.get('/api/players', async (req, res) => {
  try {
    const allPlayers = await pool.query('SELECT * FROM "Player"');
    res.json(allPlayers.rows);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Erreur du serveur lors de la récupération des joueurs');
  }
});

// Route pour récupérer l'horaire des matchs
app.get('/api/schedule', async function(req, res) {
  try {
    const scheduleQuery = `
      SELECT
        m."MatchupID" as matchupid,
        w."WeekDate" as weekdate,
        w."WeekID" as weekid,
        t1."TeamName" AS team1_name,
        t1."TeamID" as team1_id,
        t2."TeamName" AS team2_name,
        t2."TeamID" as team2_id,
        (SELECT l."LaneNumber" FROM "Lane" l JOIN "Game" g ON l."LaneID" = g."LaneID" WHERE g."MatchupID" = m."MatchupID" LIMIT 1) as lanenumber
      FROM "Matchup" m
      JOIN "Week" w ON m."WeekID" = w."WeekID"
      JOIN "Team" t1 ON m."Team1_ID" = t1."TeamID"
      JOIN "Team" t2 ON m."Team2_ID" = t2."TeamID"
      ORDER BY w."WeekDate";
    `;
    const schedule = await pool.query(scheduleQuery);
    res.json(schedule.rows);
  } catch (err) {
    console.error("Erreur du serveur lors de la récupération de l'horaire:", err.message);
    res.status(500).send("Erreur du serveur lors de la récupération de l'horaire");
  }
});

// Route pour récupérer les brackets de match-play pour une semaine spécifique
app.get('/api/matchup-details/:matchupId', async (req, res) => {
    const { matchupId } = req.params; // Récupérer l'ID du matchup depuis les paramètres de l'URL
    const client = await pool.connect(); // Obtenir une connexion client depuis la banque de connexions
    try {
        // On prend les informations de base du matchup pour déterminer les équipes impliquées et la semaine.
        const matchupInfoQuery = await client.query('SELECT "WeekID", "Team1_ID", "Team2_ID" FROM "Matchup" WHERE "MatchupID" = $1', [matchupId]);
        if (matchupInfoQuery.rows.length === 0) {
            return res.status(404).send('Match non trouvé.');
        }
        const { WeekID, Team1_ID, Team2_ID } = matchupInfoQuery.rows[0];
        const previousWeekId = WeekID - 1;

        // On récupère les noms des équipes.
        const teamsQuery = await client.query('SELECT "TeamID", "TeamName" FROM "Team" WHERE "TeamID" = ANY($1::int[])', [[Team1_ID, Team2_ID]]);
        const team1 = teamsQuery.rows.find(t => t.TeamID === Team1_ID);
        const team2 = teamsQuery.rows.find(t => t.TeamID === Team2_ID);

        // Récupérer les joueurs des deux équipes.
        const playersQuery = await client.query('SELECT "PlayerID", "PlayerName", "TeamID" FROM "Player" WHERE "TeamID" = ANY($1::int[])', [[Team1_ID, Team2_ID]]);
        
        // Les parties déja jouées et entrées pour ce matchup.
        const existingGamesQuery = await client.query('SELECT "PlayerID" as playerid, "GameNumber" as gamenumber, "GameScore" as gamescore, "IsAbsent" as isabsent, "LineupPosition" as lineupposition FROM "Game" WHERE "MatchupID" = $1', [matchupId]);

        // On calcule selon la semaine précise les statistiques nécessaires pour chaque joueur.
        const playerStats = [];
        for (const player of playersQuery.rows) {
            const gamesForStatsQuery = `
                SELECT "GameScore" FROM "Game" g JOIN "Matchup" m ON g."MatchupID" = m."MatchupID"
                WHERE g."PlayerID" = $1 AND m."WeekID" <= $2 AND g."IsAbsent" = false
            `;
            const statsResult = await client.query(gamesForStatsQuery, [player.PlayerID, previousWeekId]);
            const scores = statsResult.rows.map(r => r.GameScore);
            const average = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 150; // Moyenne par défaut si aucun score
            const handicap = Math.max(0, Math.floor((240 - average) * 0.40)); // Calcul de l'handicap -- A METTRE EN CONSTANTE --
            playerStats.push({ // On assemble les données pour chaque joueur
                playerId: player.PlayerID, 
                playerName: player.PlayerName, 
                teamId: player.TeamID,
                previousWeekAvg: average,
                previousWeekHcp: handicap
            });
        }

        // On fait le paquet de données à retourner.
        const responseData = {
            team1: { id: team1.TeamID, name: team1.TeamName, roster: playerStats.filter(p => p.teamId === team1.TeamID) },
            team2: { id: team2.TeamID, name: team2.TeamName, roster: playerStats.filter(p => p.teamId === team2.TeamID) },
            existingGames: existingGamesQuery.rows
        };

        res.json(responseData);
    } catch (err) {
        console.error("Erreur sur /api/matchup-details:", err.message);
        res.status(500).send("Erreur du serveur");
    } finally {
        
        client.release();
    }
});


// Route pour récupérer les données de classements pour une semaine spécifique
app.get('/api/rankings/:weekId', async (req, res) => {
    try {
        const { weekId } = req.params;
        const numericWeekId = parseInt(weekId, 10);
        const handicapBase = 240;
        const handicapFactor = 0.40;

        // Récupérer tous les joueurs et leurs équipes
        const allPlayersQuery = `SELECT p."PlayerID", p."PlayerName", p."TeamID", t."TeamName" FROM "Player" p LEFT JOIN "Team" t ON p."TeamID" = t."TeamID";`;
        const allPlayers = (await pool.query(allPlayersQuery)).rows;
        
        const gamesQuery = `
            SELECT g."PlayerID", p."TeamID", g."MatchupID", m."WeekID", m."Team1_ID", m."Team2_ID", g."LineupPosition", g."GameNumber", g."GameScore", g."IsAbsent"
            FROM "Game" g
            JOIN "Matchup" m ON g."MatchupID" = m."MatchupID"
            JOIN "Player" p ON g."PlayerID" = p."PlayerID"
            WHERE m."WeekID" <= $1;
        `;
        const allGames = (await pool.query(gamesQuery, [numericWeekId])).rows;
        
        // On regroupe par semaine pour faciliter le traitement.
        const gamesByWeek = allGames.reduce((acc, game) => {
            const week = game.WeekID;
            if (!acc[week]) acc[week] = [];
            acc[week].push(game);
            return acc;
        }, {});

        // Calculer les statistiques et points pour chaque joueur.
        const playerStatsHistory = new Map();
        const totalPointsByPlayer = new Map();
        const weeklyPointsByPlayer = {};
        allPlayers.forEach(p => totalPointsByPlayer.set(p.PlayerID, 0));
        const sortedWeeks = Object.keys(gamesByWeek).map(Number).sort((a, b) => a - b);

        for (const currentWeek of sortedWeeks) {
            // Calcul des handicaps et moyennes basées sur les semaines précédentes.
            const gamesForStats = allGames.filter(g => g.WeekID < currentWeek);
            allPlayers.forEach(player => {
                const playedGames = gamesForStats.filter(g => g.PlayerID === player.PlayerID && !g.IsAbsent);
                const totalScore = playedGames.reduce((sum, game) => sum + game.GameScore, 0);
                const average = playedGames.length > 0 ? totalScore / playedGames.length : 150; // moyenne par défaut
                const handicap = Math.max(0, Math.floor((handicapBase - average) * handicapFactor));
                playerStatsHistory.set(player.PlayerID, { average, handicap });
            });

            const weekGames = gamesByWeek[currentWeek];
            if (!weekGames) continue;

            // Calcul des points par confrontation entre joueurs.
            const matchupIdsThisWeek = [...new Set(weekGames.map(g => g.MatchupID))];
            weeklyPointsByPlayer[currentWeek] = new Map();

            for (const matchupId of matchupIdsThisWeek) {
                const matchupGames = weekGames.filter(g => g.MatchupID === matchupId);
                if (matchupGames.length === 0) continue;
                const team1Id = matchupGames[0].Team1_ID;

                // Comparaison des joueurs par position dans la confrontation
                for (let pos = 1; pos <= 5; pos++) {
                    const p1Games = matchupGames.filter(g => g.LineupPosition === pos && g.TeamID === team1Id);
                    const p2Games = matchupGames.filter(g => g.LineupPosition === pos && g.TeamID !== team1Id);

                    if (p1Games.length > 0 || p2Games.length > 0) {
                        const p1Id = p1Games[0]?.PlayerID;
                        const p2Id = p2Games[0]?.PlayerID;
                        // On utilise les statistiques calculées précédemment.
                        const p1Stats = playerStatsHistory.get(p1Id) || { average: 150, handicap: 36 };
                        const p2Stats = playerStatsHistory.get(p2Id) || { average: 150, handicap: 36 };
                        let p1Points = 0, p2Points = 0;
                        let p1TripleForPoints = 0, p2TripleForPoints = 0; 

                        // Calcul des points pour chaque partie individuelle
                        for (let i = 1; i <= 3; i++) {
                            const g1 = p1Games.find(g => g.GameNumber === i);
                            const g2 = p2Games.find(g => g.GameNumber === i);

                            const score1 = (g1 && !g1.IsAbsent) ? g1.GameScore : p1Stats.average;
                            const score2 = (g2 && !g2.IsAbsent) ? g2.GameScore : p2Stats.average;
                            
                            p1TripleForPoints += score1;
                            p2TripleForPoints += score2;

                            const s1_hcp = score1 + p1Stats.handicap;
                            const s2_hcp = score2 + p2Stats.handicap;

                            if (s1_hcp > s2_hcp) p1Points++;
                            else if (s1_hcp < s2_hcp) p2Points++;
                            else { p1Points += 0.5; p2Points += 0.5; } // Tie
                        }

                        // Calcul des points pour le triple
                        const p1TripleHdcp = p1TripleForPoints + (p1Stats.handicap * 3);
                        const p2TripleHdcp = p2TripleForPoints + (p2Stats.handicap * 3);
                        if (p1TripleHdcp > p2TripleHdcp) p1Points++;
                        else if (p1TripleHdcp < p2TripleHdcp) p2Points++;
                        else { p1Points += 0.5; p2Points += 0.5; }

                        // Total des points pour cette position
                        if(p1Id) {
                            totalPointsByPlayer.set(p1Id, (totalPointsByPlayer.get(p1Id) || 0) + p1Points);
                            weeklyPointsByPlayer[currentWeek].set(p1Id, p1Points);
                        }
                        if(p2Id) {
                            totalPointsByPlayer.set(p2Id, (totalPointsByPlayer.get(p2Id) || 0) + p2Points);
                            weeklyPointsByPlayer[currentWeek].set(p2Id, p2Points);
                        }
                    }
                }
            }
        }
        
        // Déterminer les statistiques finales pour chaque joueur
        const finalPlayerStats = new Map();
        allPlayers.forEach(player => {
            const gamesPlayed = allGames.filter(g => g.PlayerID === player.PlayerID && !g.IsAbsent);
            const totalScore = gamesPlayed.reduce((sum, game) => sum + game.GameScore, 0);
            const average = gamesPlayed.length > 0 ? totalScore / gamesPlayed.length : 150;
            const handicap = Math.max(0, Math.floor((handicapBase - average) * handicapFactor));
            
            // Determiner le plus haut score simple et le plus haut score triple
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

        // Assemblage des données finales pour chaque joueur
        const rankings = allPlayers.map(player => {
            const finalStats = finalPlayerStats.get(player.PlayerID);
            const playerAllGames = allGames.filter(g => g.PlayerID === player.PlayerID);
            const absentScoreForMatch = playerStatsHistory.get(player.PlayerID)?.average || 150;
            
            const createGameResult = (gameNumber) => {
                const game = playerAllGames.find(g => g.WeekID === numericWeekId && g.GameNumber === gameNumber);
                if (!game) return { score: null, isAbsent: false };
                return { score: game.IsAbsent ? Math.round(absentScoreForMatch) : game.GameScore, isAbsent: game.IsAbsent };
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
                WeekPoints: weeklyPointsByPlayer[numericWeekId]?.get(player.PlayerID) || 0,
                TotalPoints: totalPointsByPlayer.get(player.PlayerID) || 0,
            };
        });

        // Classer par moyenne décroissante pour le classement final
        rankings.sort((a, b) => b.Average - a.Average);
        res.json(rankings);

    } catch (err) {
        console.error("Erreur à la récupération du classement des joueurs", err.message);
        res.status(500).send('Server error');
    }
});

// Route pour récupérer les classements par équipe pour une semaine spécifique
app.get('/api/team-rankings/:weekId', async (req, res) => {
    try {
        const { weekId } = req.params;
        const numericWeekId = parseInt(weekId, 10);
        const handicapBase = 240;
        const handicapFactor = 0.40;

        const teams = (await pool.query('SELECT * FROM "Team"')).rows;
        const players = (await pool.query('SELECT * FROM "Player" p LEFT JOIN "Team" t ON p."TeamID" = t."TeamID"')).rows;
        
        const gamesQuery = `
            SELECT g."PlayerID", p."TeamID", g."MatchupID", m."WeekID", m."Team1_ID", m."Team2_ID", g."LineupPosition", g."GameNumber", g."GameScore", g."IsAbsent"
            FROM "Game" g
            JOIN "Matchup" m ON g."MatchupID" = m."MatchupID"
            JOIN "Player" p ON g."PlayerID" = p."PlayerID"
            WHERE m."WeekID" <= $1;
        `;
        const allGames = (await pool.query(gamesQuery, [numericWeekId])).rows;
        
        const gamesByWeek = allGames.reduce((acc, game) => {
            const week = game.WeekID;
            if (!acc[week]) acc[week] = [];
            acc[week].push(game);
            return acc;
        }, {});

        const weeklyTeamPoints = new Map();
        teams.forEach(t => weeklyTeamPoints.set(t.TeamID, {}));

        const playerStatsHistory = new Map();
        const sortedWeeks = Object.keys(gamesByWeek).map(Number).sort((a, b) => a - b);

        for (const currentWeek of sortedWeeks) {
            const gamesForStats = allGames.filter(g => g.WeekID < currentWeek && !g.IsAbsent);
            players.forEach(player => {
                const playedGames = gamesForStats.filter(g => g.PlayerID === player.PlayerID);
                const totalScore = playedGames.reduce((sum, game) => sum + game.GameScore, 0);
                const average = playedGames.length > 0 ? totalScore / playedGames.length : 150;
                const handicap = Math.max(0, Math.floor((handicapBase - average) * handicapFactor));
                playerStatsHistory.set(player.PlayerID, { average, handicap });
            });

            const weekGames = gamesByWeek[currentWeek];
            if (!weekGames) continue;

            const weeklyTeamScores = new Map();
            const weeklyPlayerPoints = new Map(teams.map(t => [t.TeamID, 0]));
            const matchupIdsThisWeek = [...new Set(weekGames.map(g => g.MatchupID))];

            for (const matchupId of matchupIdsThisWeek) {
                const matchupGames = weekGames.filter(g => g.MatchupID === matchupId);
                if (matchupGames.length === 0) continue;
                
                const team1Id = matchupGames[0].Team1_ID;
                const team2Id = matchupGames[0].Team2_ID;

                // Calcul des points de match des joueurs
                for (let pos = 1; pos <= 5; pos++) {
                    const p1Games = matchupGames.filter(g => g.LineupPosition === pos && g.TeamID === team1Id);
                    const p2Games = matchupGames.filter(g => g.LineupPosition === pos && g.TeamID === team2Id);

                    if (p1Games.length > 0 || p2Games.length > 0) {
                        const p1Id = p1Games[0]?.PlayerID;
                        const p2Id = p2Games[0]?.PlayerID;
                        const p1Stats = playerStatsHistory.get(p1Id) || { average: 150, handicap: 36 };
                        const p2Stats = playerStatsHistory.get(p2Id) || { average: 150, handicap: 36 };
                        let p1Points = 0, p2Points = 0;
                        let p1TripleForPoints = 0, p2TripleForPoints = 0;

                        for (let i = 1; i <= 3; i++) {
                            const g1 = p1Games.find(g => g.GameNumber === i);
                            const g2 = p2Games.find(g => g.GameNumber === i);
                            const score1 = (g1 && !g1.IsAbsent) ? g1.GameScore : p1Stats.average;
                            const score2 = (g2 && !g2.IsAbsent) ? g2.GameScore : p2Stats.average;
                            p1TripleForPoints += score1;
                            p2TripleForPoints += score2;
                            const s1_hcp = score1 + p1Stats.handicap;
                            const s2_hcp = score2 + p2Stats.handicap;

                            if (s1_hcp > s2_hcp) p1Points++;
                            else if (s1_hcp < s2_hcp) p2Points++;
                            else { p1Points += 0.5; p2Points += 0.5; }
                        }

                        const p1TripleHdcp = p1TripleForPoints + (p1Stats.handicap * 3);
                        const p2TripleHdcp = p2TripleForPoints + (p2Stats.handicap * 3);

                        if (p1TripleHdcp > p2TripleHdcp) p1Points++;
                        else if (p1TripleHdcp < p2TripleHdcp) p2Points++;
                        else { p1Points += 0.5; p2Points += 0.5; }
                        
                        if(p1Id) weeklyPlayerPoints.set(team1Id, weeklyPlayerPoints.get(team1Id) + p1Points);
                        if(p2Id) weeklyPlayerPoints.set(team2Id, weeklyPlayerPoints.get(team2Id) + p2Points);
                    }
                }

                // Calcul des scores d'équipe
                for (const teamId of [team1Id, team2Id]) {
                    if (!weeklyTeamScores.has(teamId)) weeklyTeamScores.set(teamId, { game1: 0, game2: 0, game3: 0, triple: 0, game1_hcp: 0, game2_hcp: 0, game3_hcp: 0, triple_hcp: 0 });
                    const teamPlayers = players.filter(p => p.TeamID === teamId);
                    let teamHandicap = 0;
                    for (const player of teamPlayers) {
                        const playerStats = playerStatsHistory.get(player.PlayerID) || { average: 150, handicap: 36 };
                        teamHandicap += playerStats.handicap;
                        for (let i = 1; i <= 3; i++) {
                            const game = matchupGames.find(g => g.PlayerID === player.PlayerID && g.GameNumber === i);
                            const score = (game && !game.IsAbsent) ? game.GameScore : playerStats.average;
                            weeklyTeamScores.get(teamId)[`game${i}`] += score;
                        }
                    }
                    for (let i = 1; i <= 3; i++) weeklyTeamScores.get(teamId)[`game${i}_hcp`] = weeklyTeamScores.get(teamId)[`game${i}`] + teamHandicap;
                    weeklyTeamScores.get(teamId).triple = weeklyTeamScores.get(teamId).game1 + weeklyTeamScores.get(teamId).game2 + weeklyTeamScores.get(teamId).game3;
                    weeklyTeamScores.get(teamId).triple_hcp = weeklyTeamScores.get(teamId).triple + (teamHandicap * 3);
                }
            }

            const weeklyResults = new Map();
            teams.forEach(t => weeklyResults.set(t.TeamID, { victories: 0, bestSinglePoints: 0, petersonPoints: 0, tripleBonusPoints: 0 }));

            const matchupPairs = [...new Set(weekGames.map(g => `${g.Team1_ID}-${g.Team2_ID}`))];
            matchupPairs.forEach(pair => {
                const [team1Id, team2Id] = pair.split('-').map(Number);
                for (let i = 1; i <= 3; i++) {
                    if (weeklyTeamScores.get(team1Id)[`game${i}_hcp`] > weeklyTeamScores.get(team2Id)[`game${i}_hcp`]) weeklyResults.get(team1Id).victories++;
                    else if (weeklyTeamScores.get(team1Id)[`game${i}_hcp`] < weeklyTeamScores.get(team2Id)[`game${i}_hcp`]) weeklyResults.get(team2Id).victories++;
                }
                if (weeklyTeamScores.get(team1Id).triple_hcp > weeklyTeamScores.get(team2Id).triple_hcp) weeklyResults.get(team1Id).tripleBonusPoints += 10;
                else if (weeklyTeamScores.get(team1Id).triple_hcp < weeklyTeamScores.get(team2Id).triple_hcp) weeklyResults.get(team2Id).tripleBonusPoints += 10;
            });

            const bestSingleScores = Array.from(weeklyTeamScores.entries()).flatMap(([teamId, scores]) => [{ teamId, score: scores.game1_hcp }, { teamId, score: scores.game2_hcp }, { teamId, score: scores.game3_hcp }]).sort((a, b) => b.score - a.score).slice(0, 3);
            bestSingleScores.forEach((entry, index) => {
                const points = [30, 25, 20][index];
                weeklyResults.get(entry.teamId).bestSinglePoints += points;
            });

            for (const type of ["game1", "game2", "game3", "triple"]) {
                const rankedTeams = Array.from(weeklyTeamScores.keys()).sort((a, b) => weeklyTeamScores.get(b)[`${type}_hcp`] - weeklyTeamScores.get(a)[`${type}_hcp`]);
                rankedTeams.forEach((teamId, index) => {
                    weeklyResults.get(teamId).petersonPoints += (24 - index);
                });
            }

            teams.forEach(t => {
                const results = weeklyResults.get(t.TeamID);
                const playerPoints = weeklyPlayerPoints.get(t.TeamID) || 0;
                const weeklyTotal = (results.victories * 5) + results.bestSinglePoints + results.petersonPoints + results.tripleBonusPoints + playerPoints;
                weeklyTeamPoints.get(t.TeamID)[currentWeek] = {
                    total: weeklyTotal,
                    victories: results.victories,
                    bestSinglePoints: results.bestSinglePoints,
                    petersonPoints: results.petersonPoints,
                    tripleBonusPoints: results.tripleBonusPoints,
                    playerMatchupPoints: playerPoints
                };
            });
        }

        const finalPlayerStats = new Map();
        players.forEach(player => {
            const gamesForStats = allGames.filter(g => g.PlayerID === player.PlayerID && !g.IsAbsent && g.WeekID <= numericWeekId);
            const totalScore = gamesForStats.reduce((sum, game) => sum + game.GameScore, 0);
            const average = gamesForStats.length > 0 ? totalScore / gamesForStats.length : 150;
            const handicap = Math.max(0, Math.floor((handicapBase - average) * handicapFactor));
            finalPlayerStats.set(player.PlayerID, { average, handicap });
        });

        const finalRankings = teams.map(team => {
            let totalPoints = 0, victories = 0, bestSinglePoints = 0, petersonPoints = 0, tripleBonusPoints = 0, playerMatchupPoints = 0, previousWeekPoints = 0;

            for (let i = 1; i <= numericWeekId; i++) {
                const weekData = weeklyTeamPoints.get(team.TeamID)?.[i];
                if (weekData) {
                    if (i < numericWeekId) {
                        previousWeekPoints += weekData.total;
                    }
                    totalPoints += weekData.total;
                    victories += weekData.victories;
                    bestSinglePoints += weekData.bestSinglePoints;
                    petersonPoints += weekData.petersonPoints;
                    tripleBonusPoints += weekData.tripleBonusPoints;
                    playerMatchupPoints += weekData.playerMatchupPoints || 0;
                }
            }
            
            const teamPlayers = players.filter(p => p.TeamID === team.TeamID);
            const totalAverage = teamPlayers.reduce((sum, p) => sum + (finalPlayerStats.get(p.PlayerID)?.average || 150), 0);
            const teamHandicap = teamPlayers.reduce((sum, p) => sum + (finalPlayerStats.get(p.PlayerID)?.handicap || 0), 0);
            const currentWeekData = weeklyTeamPoints.get(team.TeamID)?.[numericWeekId] || {};

            return {
                teamNumber: team.TeamID,
                teamName: team.TeamName,
                totalAverage: totalAverage.toFixed(2),
                teamHandicap,
                victories,
                bestSinglePoints,
                petersonPoints,
                playerMatchupPoints: playerMatchupPoints,
                tripleBonusPoints,
                previousWeekPoints: previousWeekPoints,
                currentWeekPoints: currentWeekData.total || 0,
                totalPoints,
            };
        }).sort((a, b) => b.totalPoints - a.totalPoints);

        const numTeams = teams.length;
        const prizeDecrement = numTeams > 1 ? (1600 - 200) / (numTeams - 1) : 0;
        const rankedWithPrizes = finalRankings.map((team, index) => ({
            ...team,
            prizeMoney: `${(1600 - (index * prizeDecrement)).toFixed(2)}`,
        }));

        res.json(rankedWithPrizes);

    } catch (err) {
        console.error("Erreur à la récupération du classement des équipes", err.message);
        res.status(500).send('Server error');
    }
});

app.get('/api/matchplay/:weekId', async (req, res) => {
    const { weekId } = req.params;
    try {
        const query = `
            SELECT 
                mb."BracketID" as "bracketId", mb."BracketName" as "bracketName", l."LaneNumber" as "laneNumber",
                p_champ."PlayerName" as "championName",
                mpg."MatchPlayGameID" as "matchId", mpg."MatchOrder" as "matchOrder",
                p1."PlayerID" as "p1_id", p1."PlayerName" as "p1_name", mpg."Player1_Score" as "p1_score", mpg."Player1_Prize" as "p1_prize",
                p2."PlayerID" as "p2_id", p2."PlayerName" as "p2_name", mpg."Player2_Score" as "p2_score", mpg."Player2_Prize" as "p2_prize",
                winner."PlayerID" as "winner_id", winner."PlayerName" as "winner_name"
            FROM "MatchPlayBracket" mb
            LEFT JOIN "Lane" l ON mb."LaneID" = l."LaneID"
            LEFT JOIN "MatchPlayGame" mpg ON mb."BracketID" = mpg."BracketID"
            LEFT JOIN "Player" p_champ ON mb."ChampionPlayerID" = p_champ."PlayerID"
            LEFT JOIN "Player" p1 ON mpg."Player1_ID" = p1."PlayerID"
            LEFT JOIN "Player" p2 ON mpg."Player2_ID" = p2."PlayerID"
            LEFT JOIN "Player" winner ON mpg."Winner_ID" = winner."PlayerID"
            WHERE mb."WeekID" = $1
            ORDER BY mb."BracketID", mpg."MatchOrder";
        `;
        const { rows } = await pool.query(query, [weekId]);
        
        const brackets = {};
        rows.forEach(row => {
            if (!brackets[row.bracketId]) {
                brackets[row.bracketId] = {
                    bracketId: row.bracketId,
                    bracketName: row.bracketName,
                    laneNumber: row.laneNumber,
                    championName: row.championName,
                    games: []
                };
            }
           
            if (row.matchId) {
                brackets[row.bracketId].games.push({
                    matchId: row.matchId,
                    matchOrder: row.matchOrder,
                    player1: { id: row.p1_id, name: row.p1_name, score: row.p1_score, prize: row.p1_prize },
                    player2: { id: row.p2_id, name: row.p2_name, score: row.p2_score, prize: row.p2_prize },
                    winner: { id: row.winner_id, name: row.winner_name }
                });
            }
        });

        res.json(Object.values(brackets));
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Erreur serveur');
    }
});


app.get('/api/matchplay/qualification/:week', async (req, res) => {
    const { week } = req.params;
    const client = await pool.connect();

    try {
        const weekNum = parseInt(week, 10);
        const handicapBase = 240;
        const handicapFactor = 0.40;
        const listSize = weekNum === 1 ? 20 : 15; 
        const fetchPoolSize = 60; 

      
        const handicapQuery = `
            SELECT
                g."PlayerID",
                FLOOR(GREATEST(0, ($1 - AVG(g."GameScore")) * $2)) AS handicap
            FROM "Game" g
            JOIN "Matchup" m ON g."MatchupID" = m."MatchupID"
            WHERE m."WeekID" < $3 AND g."IsAbsent" = FALSE
            GROUP BY g."PlayerID";
        `;
        const handicapRes = await client.query(handicapQuery, [handicapBase, handicapFactor, weekNum]);
        const handicaps = new Map(handicapRes.rows.map(row => [row.PlayerID, parseInt(row.handicap, 10)]));

    
        const weeklyScoresQuery = `
            SELECT
                p."PlayerID",
                p."PlayerName",
                g."GameScore"
            FROM "Game" g
            JOIN "Player" p ON g."PlayerID" = p."PlayerID"
            JOIN "Matchup" m ON g."MatchupID" = m."MatchupID"
            WHERE m."WeekID" = $1 AND g."IsAbsent" = FALSE;
        `;
        const weeklyScoresRes = await client.query(weeklyScoresQuery, [weekNum]);

       
        const playerTotals = new Map();
        for (const row of weeklyScoresRes.rows) {
            if (!playerTotals.has(row.PlayerID)) {
                playerTotals.set(row.PlayerID, { player_id: row.PlayerID, name: row.PlayerName, games: [] });
            }
            playerTotals.get(row.PlayerID).games.push(row.GameScore);
        }

        const allPlayersThisWeek = [];
        playerTotals.forEach(player => {
            if (player.games.length === 3) {
                const total_no_handicap = player.games.reduce((a, b) => a + b, 0);
                const high_game_no_handicap = Math.max(...player.games);
                const handicap_per_game = handicaps.get(player.player_id) || Math.floor((handicapBase - 150) * handicapFactor);
                const total_with_handicap = total_no_handicap + (handicap_per_game * 3);
                
                allPlayersThisWeek.push({
                    ...player,
                    total_no_handicap,
                    high_game_no_handicap, 
                    handicap_per_game,
                    total_with_handicap
                });
            }
        });

    
        const sortedWithHandicap = [...allPlayersThisWeek].sort((a, b) => {
            if (b.total_with_handicap === a.total_with_handicap) return b.high_game_no_handicap - a.high_game_no_handicap;
            return b.total_with_handicap - a.total_with_handicap;
        }).slice(0, fetchPoolSize);

        const sortedWithoutHandicap = [...allPlayersThisWeek].sort((a, b) => {
            if (b.total_no_handicap === a.total_no_handicap) return b.high_game_no_handicap - a.high_game_no_handicap;
            return b.total_no_handicap - a.total_no_handicap;
        }).slice(0, fetchPoolSize);
        
       
        const finalWithHandicap = [];
        const finalWithoutHandicap = [];
        const placedPlayerIds = new Set();

        sortedWithHandicap.forEach((p, i) => p.rank = i + 1);
        sortedWithoutHandicap.forEach((p, i) => p.rank = i + 1);

        const withoutHandicapMap = new Map(sortedWithoutHandicap.map(p => [p.player_id, p]));

       
        for (const playerH of sortedWithHandicap) {
            const playerNH = withoutHandicapMap.get(playerH.player_id);
            if (playerNH && playerNH.rank <= playerH.rank) {
                if (finalWithoutHandicap.length < listSize && !placedPlayerIds.has(playerNH.player_id)) {
                    finalWithoutHandicap.push(playerNH);
                    placedPlayerIds.add(playerNH.player_id);
                }
            } else {
                if (finalWithHandicap.length < listSize && !placedPlayerIds.has(playerH.player_id)) {
                    finalWithHandicap.push(playerH);
                    placedPlayerIds.add(playerH.player_id);
                }
            }
        }
        
        
        for (const playerNH of sortedWithoutHandicap) {
            if (finalWithoutHandicap.length < listSize && !placedPlayerIds.has(playerNH.player_id)) {
                finalWithoutHandicap.push(playerNH);
                placedPlayerIds.add(playerNH.player_id);
            }
        }
        for (const playerH of sortedWithHandicap) {
            if (finalWithHandicap.length < listSize && !placedPlayerIds.has(playerH.player_id)) {
                finalWithHandicap.push(playerH);
                placedPlayerIds.add(playerH.player_id);
            }
        }


        let champions = [];
        if (weekNum > 1) {
             const championsQuery = `
                SELECT p."PlayerName" as name, mb."BracketName" as category
                FROM "MatchPlayBracket" mb
                JOIN "Player" p ON mb."ChampionPlayerID" = p."PlayerID"
                WHERE mb."WeekID" = $1 AND mb."ChampionPlayerID" IS NOT NULL;
            `;
            const championsRes = await client.query(championsQuery, [weekNum - 1]);
            champions = championsRes.rows;
        }
        
     
        res.json({
            withHandicap: finalWithHandicap.map(p => ({
                player_id: p.player_id, 
                name: p.name, 
                score: p.total_with_handicap,
            })),
            withoutHandicap: finalWithoutHandicap.map(p => ({
                player_id: p.player_id, 
                name: p.name, 
                score: p.total_no_handicap,
            })),
            champions: champions 
        });

    } catch (err) {
        console.error("Erreur à la récupération des qualifications:", err.message);
        res.status(500).send('Erreur serveur');
    } finally {
        client.release();
    }
});



app.post('/api/games', async function(req, res) {
  try {
    const { playerid, matchupid, laneid, gamenumber, gamescore } = req.body;
    const newGame = await pool.query(
      "INSERT INTO Game (PlayerID, MatchupID, LaneID, GameNumber, GameScore, GameApprovalStatus) VALUES ($1, $2, $3, $4, $5, 'approved') RETURNING *",
      [playerid, matchupid, laneid, gamenumber, gamescore]
    );
    res.json(newGame.rows[0]);
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Erreur du serveur lors de l'envoi de la partie");
  }
});


app.post('/api/lineup', async (req, res) => {
    const { matchupId, team1PlayerIds, team2PlayerIds } = req.body;
    const client = await pool.connect();
    try {
       
        await client.query('BEGIN');

        
        await client.query('DELETE FROM "Game" WHERE "MatchupID" = $1', [matchupId]);

        const allPlayerIds = [
            ...team1PlayerIds.map((id, index) => ({ playerId: id, lineupPosition: index + 1 })),
            ...team2PlayerIds.map((id, index) => ({ playerId: id, lineupPosition: index + 1 }))
        ];

        const queryText = `
            INSERT INTO "Game" ("PlayerID", "MatchupID", "GameNumber", "GameScore", "IsAbsent", "LineupPosition", "LaneID")
            VALUES ($1, $2, $3, 0, false, $4, 1)
        `;

        for (const player of allPlayerIds) {
            
            for (let gameNumber = 1; gameNumber <= 3; gameNumber++) {
                await client.query(queryText, [player.playerId, matchupId, gameNumber, player.lineupPosition]);
            }
        }

        await client.query('COMMIT');
        res.status(201).json({ message: 'Alignement enregistré avec succès.' });
    } catch (err) {
       
        await client.query('ROLLBACK');
        console.error("Erreur lors de l'enregistrement de l'alignement:", err.message);
        res.status(500).send('Server error');
    } finally {
        client.release();
    }
});


app.post('/api/scores/batch', async (req, res) => {
    const scores = req.body;
    if (!Array.isArray(scores) || scores.length === 0) {
        return res.status(400).json({ message: "Le corps de la requête doit être un tableau de scores non vide." });
    }

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
                score.matchupId, 
                score.gameNumber,
                score.score,
                score.isAbsent,
                score.lineupPosition
            ];
            await client.query(queryText, params);
        }

        await client.query('COMMIT');
        res.status(201).json({ message: 'Pointage mis-à-jour avec succès' });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Erreur lors de la mis-à-jour des pointages', err.message);
        res.status(500).send('Server error');
    } finally {
        client.release();
    }
});

app.post('/api/verify', (req, res) => {
    const { accessCode } = req.body;
    
    if (accessCode && accessCode === process.env.ADMIN_CODE) {
        res.json({ success: true });
    } else {
        res.status(401).json({ success: false, message: 'Code incorrect' });
    }
});

app.post('/api/matchplay/champions', async (req, res) => {
    
    const { weekId, champions } = req.body;
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

       
        await client.query('DELETE FROM public."MatchplayChampions" WHERE "WeekID" = $1', [weekId]);

      
        const insertQuery = `
            INSERT INTO public."MatchplayChampions" ("PlayerID", "WeekID", "BracketType")
            VALUES ($1, $2, $3);
        `;

        for (const champion of champions) {
            await client.query(insertQuery, [champion.playerId, weekId, champion.bracketType]);
        }

        await client.query('COMMIT');
        res.status(201).json({ message: 'Champions saved successfully.' });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error("Erreur lors de l'enregistrement", err.message);
        res.status(500).send('Server error');
    } finally {
        client.release();
    }
});


app.post('/api/admin/matchplay/score', async (req, res) => {
    const { matchId, player1Score, player2Score } = req.body;
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        if (player1Score === player2Score) {
            throw new Error("Aucune égalité n'est permise en match play.");
        }

        
        const matchQuery = await client.query('SELECT * FROM "MatchPlayGame" WHERE "MatchPlayGameID" = $1', [matchId]);
        if (matchQuery.rows.length === 0) {
            throw new Error('Match non trouvé.');
        }
        const match = matchQuery.rows[0];
        const { "BracketID": bracketId, "MatchOrder": matchOrder, "Player1_ID": p1Id, "Player2_ID": p2Id } = match;

        const winnerId = player1Score > player2Score ? p1Id : p2Id;
        const winnerPrize = 20.00;
        const loserPrize = 10.00;

        
        const updateQuery = `
            UPDATE "MatchPlayGame" 
            SET "Player1_Score" = $1, "Player2_Score" = $2, "Winner_ID" = $3,
                "Player1_Prize" = $4, "Player2_Prize" = $5
            WHERE "MatchPlayGameID" = $6;
        `;
        await client.query(updateQuery, [
            player1Score,
            player2Score,
            winnerId,
            winnerId === p1Id ? winnerPrize : loserPrize,
            winnerId === p2Id ? winnerPrize : loserPrize,
            matchId
        ]);

        
        if (matchOrder < 3) {
            const updateNextMatchQuery = `
                UPDATE "MatchPlayGame" 
                SET "Player1_ID" = $1 
                WHERE "BracketID" = $2 AND "MatchOrder" = $3;
            `;
            await client.query(updateNextMatchQuery, [winnerId, bracketId, nextMatchOrder]);
        } else { 
            const updateBracketChampionQuery = `
                UPDATE "MatchPlayBracket" 
                SET "ChampionPlayerID" = $1 
                WHERE "BracketID" = $2;
            `;
            await client.query(updateBracketChampionQuery, [winnerId, bracketId]);
        }

        await client.query('COMMIT');
        res.status(200).json({ message: 'Score mis-à-jour avec succès' });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error("Erreur lors de la soumission des scores", error.message);
        res.status(500).json({ message: error.message || 'Erreur Serveur' });
    } finally {
        client.release();
    }
});


app.post('/api/admin/matchplay/setup', async (req, res) => {
    const { weekId, withHandicap, withoutHandicap } = req.body;
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        const checkResult = await client.query('SELECT 1 FROM "MatchPlayBracket" WHERE "WeekID" = $1', [weekId]);
        if (checkResult.rows.length > 0) throw new Error(`Les brackets pour cette semaine ${weekId} ont déjà été configurés.`);
        
        const lanesResult = await client.query('SELECT "LaneID", "LaneNumber" FROM "Lane"');
        const laneMap = new Map(lanesResult.rows.map(l => [l.LaneNumber, l.LaneID]));
        const numericWeekId = parseInt(weekId, 10);
        
        const hQualifiers = withHandicap; 
        const whQualifiers = withoutHandicap; 

        if (numericWeekId === 1) {
            if (!whQualifiers || whQualifiers.length < 20 || !hQualifiers || hQualifiers.length < 20) {
                throw new Error('Liste incomplète pour les qualifications.');
            }
            const bracketConfig = [
                { name: "Bracket #1 Handicap",    laneNumber: "5-6",   players: [hQualifiers[0], hQualifiers[9], hQualifiers[14], hQualifiers[19]] },
                { name: "Bracket #2 Handicap",    laneNumber: "7-8",   players: [hQualifiers[1], hQualifiers[8], hQualifiers[13], hQualifiers[18]] },
                { name: "Bracket #3 Handicap",    laneNumber: "9-10",  players: [hQualifiers[2], hQualifiers[7], hQualifiers[12], hQualifiers[17]] },
                { name: "Bracket #4 Handicap",    laneNumber: "11-12", players: [hQualifiers[3], hQualifiers[6], hQualifiers[11], hQualifiers[16]] },
                { name: "Bracket #5 Handicap",    laneNumber: "13-14", players: [hQualifiers[4], hQualifiers[5], hQualifiers[10], hQualifiers[15]] },
                { name: "Bracket #1 Sans Handicap", laneNumber: "15-16", players: [whQualifiers[0], whQualifiers[9], whQualifiers[14], whQualifiers[19]] },
                { name: "Bracket #2 Sans Handicap", laneNumber: "17-18", players: [whQualifiers[1], whQualifiers[8], whQualifiers[13], whQualifiers[18]] },
                { name: "Bracket #3 Sans Handicap", laneNumber: "19-20", players: [whQualifiers[2], whQualifiers[7], whQualifiers[12], whQualifiers[17]] },
                { name: "Bracket #4 Sans Handicap", laneNumber: "21-22", players: [whQualifiers[3], whQualifiers[6], whQualifiers[11], whQualifiers[16]] },
                { name: "Bracket #5 Sans Handicap", laneNumber: "23-24", players: [whQualifiers[4], whQualifiers[5], whQualifiers[10], whQualifiers[15]] },
            ];
            
            for (const config of bracketConfig) {
                if (!config.players.every(p => p && p.player_id)) continue;
                const laneId = laneMap.get(config.laneNumber);
                if (!laneId) throw new Error(`Lane ${config.laneNumber} not found.`);
                
                const bracketQuery = 'INSERT INTO "MatchPlayBracket"("WeekID", "BracketName", "LaneID") VALUES ($1, $2, $3) RETURNING "BracketID"';
                const bracketResult = await client.query(bracketQuery, [weekId, config.name, laneId]);
                const newBracketId = bracketResult.rows[0]["BracketID"];
                const [p1, p2, p3, p4] = config.players.map(p => p.player_id);

                await client.query('INSERT INTO "MatchPlayGame"("BracketID", "MatchOrder", "Player1_ID", "Player2_ID") VALUES ($1, 1, $2, $3)', [newBracketId, p1, p2]);
                await client.query('INSERT INTO "MatchPlayGame"("BracketID", "MatchOrder", "Player2_ID") VALUES ($1, 2, $2)', [newBracketId, p3]);
                await client.query('INSERT INTO "MatchPlayGame"("BracketID", "MatchOrder", "Player2_ID") VALUES ($1, 3, $2)', [newBracketId, p4]);
            }
        } else { 
            const previousWeekId = numericWeekId - 1;
            const championsQuery = await client.query('SELECT "ChampionPlayerID", "BracketName" FROM "MatchPlayBracket" WHERE "WeekID" = $1 AND "ChampionPlayerID" IS NOT NULL', [previousWeekId]);
            
            if (championsQuery.rows.length < 10) {
                throw new Error(`Pas assez de champions trouvés pour la semaine ${previousWeekId}. Il en faut 10 pour procéder.`);
            }
            const prevChampions = new Map(championsQuery.rows.map(c => [c.BracketName, c.ChampionPlayerID]));

            if (!whQualifiers || whQualifiers.length < 15 || !hQualifiers || hQualifiers.length < 15) throw new Error(`Liste incomplète pour la semaine ${numericWeekId}.`);
            
            const rotationOrder = ["5-6", "7-8", "9-10", "11-12", "13-14", "15-16", "17-18", "19-20", "21-22", "23-24"];
            
            const baseBracketConfig = [
                { name: "Bracket #1 Handicap",    seeds: [hQualifiers[0], hQualifiers[5], hQualifiers[10]] },
                { name: "Bracket #2 Handicap",    seeds: [hQualifiers[1], hQualifiers[6], hQualifiers[11]] },
                { name: "Bracket #3 Handicap",    seeds: [hQualifiers[2], hQualifiers[7], hQualifiers[12]] },
                { name: "Bracket #4 Handicap",    seeds: [hQualifiers[3], hQualifiers[8], hQualifiers[13]] },
                { name: "Bracket #5 Handicap",    seeds: [hQualifiers[4], hQualifiers[9], hQualifiers[14]] },
                { name: "Bracket #1 Sans Handicap", seeds: [whQualifiers[0], whQualifiers[5], whQualifiers[10]] },
                { name: "Bracket #2 Sans Handicap", seeds: [whQualifiers[1], whQualifiers[6], whQualifiers[11]] },
                { name: "Bracket #3 Sans Handicap", seeds: [whQualifiers[2], whQualifiers[7], whQualifiers[12]] },
                { name: "Bracket #4 Sans Handicap", seeds: [whQualifiers[3], whQualifiers[8], whQualifiers[13]] },
                { name: "Bracket #5 Sans Handicap", seeds: [whQualifiers[4], whQualifiers[9], whQualifiers[14]] },
            ];

            for (let i = 0; i < baseBracketConfig.length; i++) {
                const definition = baseBracketConfig[i];
                const rotationAmount = numericWeekId - 1;
                const newLaneIndex = (i + rotationAmount) % rotationOrder.length;
                const newLane = rotationOrder[newLaneIndex];

                const champion = prevChampions.get(definition.name);
                const seeds = definition.seeds;

                if (!champion || !seeds.every(s => s)) continue;
                
                const laneId = laneMap.get(newLane);
                if (!laneId) throw new Error("Allée ${newLane} non trouvée.");

                const bracketQuery = 'INSERT INTO "MatchPlayBracket"("WeekID", "BracketName", "LaneID") VALUES ($1, $2, $3) RETURNING "BracketID"';
                const bracketResult = await client.query(bracketQuery, [weekId, definition.name, laneId]);
                const newBracketId = bracketResult.rows[0]["BracketID"];

                const [seed1, seed2, seed3] = seeds.map(s => s.player_id);
                
                await client.query('INSERT INTO "MatchPlayGame"("BracketID", "MatchOrder", "Player1_ID", "Player2_ID") VALUES ($1, 1, $2, $3)', [newBracketId, champion, seed1]);
                await client.query('INSERT INTO "MatchPlayGame"("BracketID", "MatchOrder", "Player2_ID") VALUES ($1, 2, $2)', [newBracketId, seed2]);
                await client.query('INSERT INTO "MatchPlayGame"("BracketID", "MatchOrder", "Player2_ID") VALUES ($1, 3, $2)', [newBracketId, seed3]);
            }
        }

        await client.query('COMMIT');
        res.status(201).json({ message: `Brackets généré avec succès pour cette semaine: ${weekId}.` });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error("Erreur lors de la génération des brackets", error.message);
        res.status(500).json({ message: error.message || 'Erreur de serveur interne' });
    } finally {
        client.release();
    }
});


app.post('/api/admin/matchplay/bracket/update', async (req, res) => {
    const { bracketId, games } = req.body; 
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        for (const game of games.sort((a, b) => a.matchOrder - b.matchOrder)) {
            
            if (game.player1Score && game.player2Score) {
                const { matchId, player1Score, player2Score } = game;

                if (player1Score === player2Score) throw new Error('Les scores ne peuvent pas être à égalité en match play.');

                const matchQuery = await client.query('SELECT * FROM "MatchPlayGame" WHERE "MatchPlayGameID" = $1', [matchId]);
                const match = matchQuery.rows[0];
                if (!match) continue; 
                
                const { "MatchOrder": matchOrder, "Player1_ID": p1Id, "Player2_ID": p2Id } = match;
                const winnerId = player1Score > player2Score ? p1Id : p2Id;
                const winnerPrize = 20.00, loserPrize = 10.00;

                const updateQuery = `UPDATE "MatchPlayGame" SET "Player1_Score" = $1, "Player2_Score" = $2, "Winner_ID" = $3, "Player1_Prize" = $4, "Player2_Prize" = $5 WHERE "MatchPlayGameID" = $6;`;
                await client.query(updateQuery, [player1Score, player2Score, winnerId, winnerId === p1Id ? winnerPrize : loserPrize, winnerId === p2Id ? winnerPrize : loserPrize, matchId]);

                if (matchOrder < 3) {
                    await client.query('UPDATE "MatchPlayGame" SET "Player1_ID" = $1 WHERE "BracketID" = $2 AND "MatchOrder" = $3;', [winnerId, bracketId, matchOrder + 1]);
                } else { 
                    await client.query('UPDATE "MatchPlayBracket" SET "ChampionPlayerID" = $1 WHERE "BracketID" = $2;', [winnerId, bracketId]);
                }
            }
        }

        await client.query('COMMIT');
        res.status(200).json({ message: 'Bracket mis-à-jour avec succès' });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error("Erreur lors de la mise-à-jour", error.message);
        res.status(500).json({ message: error.message || 'Erreur serveur' });
    } finally {
        client.release();
    }
});


app.post('/api/admin/matchplay/save-all', async (req, res) => {
    const { brackets } = req.body;
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        for (const bracket of brackets) {
            
            const gamesToUpdate = bracket.games
                .filter(g => g.player1.score && g.player2.score && !g.winner.id)
                .sort((a, b) => a.matchOrder - b.matchOrder);

            for (const game of gamesToUpdate) {
                const { matchId, player1, player2 } = game;
                const p1Score = parseInt(player1.score, 10);
                const p2Score = parseInt(player2.score, 10);

                
                if (isNaN(p1Score) || isNaN(p2Score) || p1Score < 0 || p1Score > 300 || p2Score < 0 || p2Score > 300 || p1Score === p2Score) {
                    continue;
                }

                const matchQuery = await client.query('SELECT * FROM "MatchPlayGame" WHERE "MatchPlayGameID" = $1', [matchId]);
                if (matchQuery.rows.length === 0) continue;
                const dbMatch = matchQuery.rows[0];

                const p1Id = dbMatch["Player1_ID"];
                const p2Id = dbMatch["Player2_ID"];
                const winnerId = p1Score > p2Score ? p1Id : p2Id;
                const winnerPrize = 20.00;
                const loserPrize = 10.00;

                const updateQuery = `UPDATE "MatchPlayGame" SET "Player1_Score" = $1, "Player2_Score" = $2, "Winner_ID" = $3, "Player1_Prize" = $4, "Player2_Prize" = $5 WHERE "MatchPlayGameID" = $6;`;
                await client.query(updateQuery, [p1Score, p2Score, winnerId, winnerId === p1Id ? winnerPrize : loserPrize, winnerId === p2Id ? winnerPrize : loserPrize, matchId]);

                if (dbMatch["MatchOrder"] < 3) { 
                    await client.query('UPDATE "MatchPlayGame" SET "Player1_ID" = $1 WHERE "BracketID" = $2 AND "MatchOrder" = $3;', [winnerId, dbMatch["BracketID"], dbMatch["MatchOrder"] + 1]);
                } else { 
                    await client.query('UPDATE "MatchPlayBracket" SET "ChampionPlayerID" = $1 WHERE "BracketID" = $2;', [winnerId, dbMatch["BracketID"]]);
                    
                    
                    const bracketInfo = await client.query('SELECT "WeekID", "BracketName" FROM "MatchPlayBracket" WHERE "BracketID" = $1', [dbMatch["BracketID"]]);
                    if (bracketInfo.rows.length > 0) {
                        const { "WeekID": weekId, "BracketName": bracketName } = bracketInfo.rows[0];
                        const bracketType = bracketName.toLowerCase().includes('Sans handicap') ? 'WithoutHandicap' : 'WithHandicap';
                        
                        const insertChampionQuery = `
                            INSERT INTO "MatchplayChampions" ("PlayerID", "WeekID", "BracketType")
                            VALUES ($1, $2, $3)
                            ON CONFLICT ("PlayerID", "WeekID", "BracketType") DO NOTHING;
                        `;
                        await client.query(insertChampionQuery, [winnerId, weekId, bracketType]);
                    }
                }
            }
        }

        await client.query('COMMIT');
        res.status(200).json({ message: 'Tous les brackets ont été sauvegardés avec succès.' });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error("Erreur lors de la sauvegarde:", error.message);
        res.status(500).json({ message: error.message || 'Erreur du serveur lors de la sauvegarde.' });
    } finally {
        client.release();
    }
});

app.post('/api/admin/matchplay/erase', async (req, res) => {
    const { matchId } = req.body;
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        const matchQuery = await client.query('SELECT * FROM "MatchPlayGame" WHERE "MatchPlayGameID" = $1', [matchId]);
        if (matchQuery.rows.length === 0) {
            throw new Error('Match non trouvé.');
        }
        
        const { "BracketID": bracketId, "MatchOrder": matchOrder } = matchQuery.rows[0];

        
        const resetCurrentQuery = 'UPDATE "MatchPlayGame" SET "Player1_Score" = NULL, "Player2_Score" = NULL, "Winner_ID" = NULL, "Player1_Prize" = NULL, "Player2_Prize" = NULL WHERE "MatchPlayGameID" = $1;';
        await client.query(resetCurrentQuery, [matchId]);

       
        if (matchOrder < 3) {
            const resetNextQuery = 'UPDATE "MatchPlayGame" SET "Player1_ID" = NULL WHERE "BracketID" = $1 AND "MatchOrder" = $2;';
            await client.query(resetNextQuery, [bracketId, matchOrder + 1]);
        }
        
        
        const resetChampionQuery = 'UPDATE "MatchPlayBracket" SET "ChampionPlayerID" = NULL WHERE "BracketID" = $1;';
        await client.query(resetChampionQuery, [bracketId]);
        
        await client.query('COMMIT');
        res.status(200).json({ message: 'Le dernier pointage a été effacé.' });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error("Erreur lors de la suppression:", error.message);
        res.status(500).json({ message: error.message || "Erreur du serveur lors de l'effacement." });
    } finally {
        client.release();
    }
});



app.listen(PORT, function() {
  console.log(`Le serveur écoute ici : http://localhost:${PORT}`);
});