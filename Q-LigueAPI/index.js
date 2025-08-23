require('dotenv').config();
const express = require('express');
const pool = require('./db.js');
const app = express();
const cors = require('cors');
app.use(cors());
app.use(express.json());
const port = 3000;

app.use(cors({
  origin: process.env.CORS_ORIGIN
}));

// --- GET API Endpoints ---

app.get('/', (req, res) => {
  res.send('Salut, Q-Ligue Manager! Le serveur fonctionne!');
});

app.get('/api/teams', async (req, res) => {
  try {
    const allTeams = await pool.query('SELECT * FROM "Team"');
    res.json(allTeams.rows);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Erreur du serveur lors de la récupération des équipes');
  }
});

app.get('/api/players', async (req, res) => {
  try {
    const allPlayers = await pool.query('SELECT * FROM "Player"');
    res.json(allPlayers.rows);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Erreur du serveur lors de la récupération des joueurs');
  }
});

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

// Route pour obtenir toutes les informations nécessaires pour la page admin
app.get('/api/matchup-details/:matchupId', async (req, res) => {
    const { matchupId } = req.params;
    const client = await pool.connect();
    try {
        const matchupInfoQuery = await client.query('SELECT "WeekID", "Team1_ID", "Team2_ID" FROM "Matchup" WHERE "MatchupID" = $1', [matchupId]);
        if (matchupInfoQuery.rows.length === 0) {
            return res.status(404).send('Match non trouvé.');
        }
        const { WeekID, Team1_ID, Team2_ID } = matchupInfoQuery.rows[0];
        const previousWeekId = WeekID - 1;

        const teamsQuery = await client.query('SELECT "TeamID", "TeamName" FROM "Team" WHERE "TeamID" = ANY($1::int[])', [[Team1_ID, Team2_ID]]);
        const team1 = teamsQuery.rows.find(t => t.TeamID === Team1_ID);
        const team2 = teamsQuery.rows.find(t => t.TeamID === Team2_ID);

        const playersQuery = await client.query('SELECT "PlayerID", "PlayerName", "TeamID" FROM "Player" WHERE "TeamID" = ANY($1::int[])', [[Team1_ID, Team2_ID]]);
        
        const existingGamesQuery = await client.query('SELECT "PlayerID" as playerid, "GameNumber" as gamenumber, "GameScore" as gamescore, "IsAbsent" as isabsent, "LineupPosition" as lineupposition FROM "Game" WHERE "MatchupID" = $1', [matchupId]);

        const playerStats = [];
        for (const player of playersQuery.rows) {
            const gamesForStatsQuery = `
                SELECT "GameScore" FROM "Game" g JOIN "Matchup" m ON g."MatchupID" = m."MatchupID"
                WHERE g."PlayerID" = $1 AND m."WeekID" <= $2 AND g."IsAbsent" = false
            `;
            const statsResult = await client.query(gamesForStatsQuery, [player.PlayerID, previousWeekId]);
            const scores = statsResult.rows.map(r => r.GameScore);
            const average = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 150;
            const handicap = Math.max(0, Math.floor((240 - average) * 0.40));
            playerStats.push({ 
                playerId: player.PlayerID, 
                playerName: player.PlayerName, 
                teamId: player.TeamID,
                previousWeekAvg: average,
                previousWeekHcp: handicap
            });
        }

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


// Point d'entrée pour le classement des joueurs
app.get('/api/rankings/:weekId', async (req, res) => {
    try {
        const { weekId } = req.params;
        const numericWeekId = parseInt(weekId, 10);
        const handicapBase = 240;
        const handicapFactor = 0.40;

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
            if (!weekGames) continue;

            const matchupIdsThisWeek = [...new Set(weekGames.map(g => g.MatchupID))];
            weeklyPointsByPlayer[currentWeek] = new Map();

            for (const matchupId of matchupIdsThisWeek) {
                const matchupGames = weekGames.filter(g => g.MatchupID === matchupId);
                if (matchupGames.length === 0) continue;
                const team1Id = matchupGames[0].Team1_ID;
                for (let pos = 1; pos <= 5; pos++) {
                    const p1Games = matchupGames.filter(g => g.LineupPosition === pos && g.TeamID === team1Id);
                    const p2Games = matchupGames.filter(g => g.LineupPosition === pos && g.TeamID !== team1Id);

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

        rankings.sort((a, b) => b.Average - a.Average);
        res.json(rankings);

    } catch (err) {
        console.error("Erreur à la récupération du classement des joueurs", err.message);
        res.status(500).send('Server error');
    }
});

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

// Route pour enregistrer ou mettre à jour un alignement pour un match
app.post('/api/lineup', async (req, res) => {
    const { matchupId, team1PlayerIds, team2PlayerIds } = req.body;
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        // D'abord, supprimer les anciens enregistrements de parties pour ce match pour éviter les doublons
        await client.query('DELETE FROM "Game" WHERE "MatchupID" = $1', [matchupId]);

        // Ensuite, insérer les nouveaux enregistrements pour l'alignement
        const allPlayerIds = [
            ...team1PlayerIds.map((id, index) => ({ playerId: id, lineupPosition: index + 1 })),
            ...team2PlayerIds.map((id, index) => ({ playerId: id, lineupPosition: index + 1 }))
        ];

        const queryText = `
            INSERT INTO "Game" ("PlayerID", "MatchupID", "GameNumber", "GameScore", "IsAbsent", "LineupPosition", "LaneID")
            VALUES ($1, $2, $3, 0, false, $4, 1)
        `;

        for (const player of allPlayerIds) {
            // Créer 3 enregistrements de partie pour chaque joueur dans l'alignement
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

// Route pour enregistrer les pointages en batch
app.post('/api/scores/batch', async (req, res) => {
    const scores = req.body; // Le corps de la requête est directement le tableau des scores
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
                score.matchupId, // matchupId est maintenant dans chaque objet score
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
