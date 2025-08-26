require('dotenv').config();
const express = require('express');
const cors = require('cors');
const pool = require('./db.js');
const app = express();


app.use(cors({ origin: true, credentials: true }));
app.use(express.json());

const PORT = process.env.PORT || 3000; 

// --- GET API Endpoints ---

app.get('/', (req, res) => {
  res.send('Salut, Q-Ligue Manager! Le serveur fonctionne!');
});

app.get('/api/teams', async (req, res) => {
  try {
    const allTeams = await pool.query('SELECT * FROM "Team"');
    res.json(allTeams.rows);
  } catch (err) {
    console.error("Error fetching teams:", err.message);
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
            const average = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 300;
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

// |------------------------------------------------------------------------ Corrected Matchplay Endpoint v5 (Final) ------------------------------------------------------------------------|

// |------------------------------------------------------------------------ Corrected Matchplay Endpoint v6 (Final) ------------------------------------------------------------------------|

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

        // --- Fetch champions and add them to the final lists ---
        let champions = [];
        if (weekNum > 1) {
             const championsQuery = `
                SELECT p."PlayerName" as name
                FROM public."MatchplayChampions" mc
                JOIN public."Player" p ON mc."PlayerID" = p."PlayerID"
                WHERE mc."WeekID" = $1;
            `;
            const championsRes = await client.query(championsQuery, [weekNum - 1]);
            champions = championsRes.rows.map(c => c.name);
        }
        
        // --- FINAL RESPONSE: Ensure 'champions' key is included ---
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
            champions: champions // <-- ADDED THIS KEY BACK
        });

    } catch (err) {
        console.error("Error fetching matchplay qualification:", err.message);
        res.status(500).send('Server Error');
    } finally {
        client.release();
    }
});
// |------------------------------------------------------------------------ End of Matchplay Endpoint ------------------------------------------------------------------------|

// |------------------------------------------------------------------------ End of Matchplay Endpoint ------------------------------------------------------------------------|

function generateSingleStepladderBracket(bracketIndex, category, startPlayerId, startLane) {
    const bracketId = `${category.toLowerCase().replace(/\s/g, '-')}-bracket-${bracketIndex}`;
    const matches = [];
    let currentPlayerId = startPlayerId;
    let currentLane = startLane;

    // Simulate a 3-match stepladder for simplicity in placeholder
    // Match 1: Seed 5 vs Seed 4
    matches.push({
        matchId: `${bracketId}-match-1`,
        lane: `${currentLane}-${currentLane + 1}`,
        players: [
            { playerId: currentPlayerId++, playerName: `${category.charAt(0)}-Player ${5 + bracketIndex}`, seed: 5 },
            { playerId: currentPlayerId++, playerName: `${category.charAt(0)}-Player ${4 + bracketIndex}`, seed: 4 }
        ],
        scores: { player1Score: null, player2Score: null },
        winnerPlayerId: null,
        nextMatchId: `${bracketId}-match-2`
    });
    currentLane += 2;

    // Match 2: Winner of Match 1 vs Seed 3
    matches.push({
        matchId: `${bracketId}-match-2`,
        lane: `${currentLane}-${currentLane + 1}`,
        players: [
            { playerId: currentPlayerId++, playerName: `${category.charAt(0)}-Player ${3 + bracketIndex}`, seed: 3 },
            { playerId: null, playerName: `Winner of ${bracketId}-match-1`, seed: "dynamic" }
        ],
        scores: { player1Score: null, player2Score: null },
        winnerPlayerId: null,
        nextMatchId: `${bracketId}-match-3`
    });
    currentLane += 2;

    // Match 3: Winner of Match 2 vs Seed 2
    matches.push({
        matchId: `${bracketId}-match-3`,
        lane: `${currentLane}-${currentLane + 1}`,
        players: [
            { playerId: currentPlayerId++, playerName: `${category.charAt(0)}-Player ${2 + bracketIndex}`, seed: 2 },
            { playerId: null, playerName: `Winner of ${bracketId}-match-2`, seed: "dynamic" }
        ],
        scores: { player1Score: null, player2Score: null },
        winnerPlayerId: null,
        nextMatchId: `${bracketId}-match-4`
    });
    currentLane += 2;

    // Match 4: Winner of Match 3 vs Seed 1 (Championship Match)
    matches.push({
        matchId: `${bracketId}-match-4`,
        lane: `${currentLane}-${currentLane + 1}`,
        players: [
            { playerId: currentPlayerId++, playerName: `${category.charAt(0)}-Player ${1 + bracketIndex}`, seed: 1 },
            { playerId: null, playerName: `Winner of ${bracketId}-match-3`, seed: "dynamic" }
        ],
        scores: { player1Score: null, player2Score: null },
        winnerPlayerId: null,
        nextMatchId: `${bracketId}-match-champion`
    });
    currentLane += 2;

    // Match 5: Winner of Match 4 vs Previous Week's Champion
    matches.push({
        matchId: `${bracketId}-match-champion`,
        lane: `${currentLane}-${currentLane + 1}`,
        players: [
            { playerId: currentPlayerId++, playerName: `${category.charAt(0)}-Champion Prev`, seed: "champion" },
            { playerId: null, playerName: `Winner of ${bracketId}-match-4`, seed: "dynamic" }
        ],
        scores: { player1Score: null, player2Score: null },
        winnerPlayerId: null,
        nextMatchId: null // Final match of this bracket
    });

    return {
        bracketId,
        category,
        laneStart: `${startLane}-${startLane + 1}`, // Represents the starting lane pair for the bracket
        matches
    };
}

function generateSingleStepladderBracket(bracketIndex, category, startPlayerIdOffset, startLaneOffset) {
    const bracketId = `${category.toLowerCase().replace(/\s/g, '-')}-bracket-${bracketIndex}`;
    const matches = [];
    let currentPlayerId = startPlayerIdOffset;
    let currentLane = startLaneOffset;

    // Simulate a 3-match stepladder for simplicity in placeholder
    // Match 1: Seed 5 vs Seed 4
    matches.push({
        matchId: `${bracketId}-match-1`,
        lane: `${currentLane}-${currentLane + 1}`,
        players: [
            { playerId: currentPlayerId++, playerName: `${category.charAt(0)}-P${bracketIndex}-S5`, seed: 5 },
            { playerId: currentPlayerId++, playerName: `${category.charAt(0)}-P${bracketIndex}-S4`, seed: 4 }
        ],
        scores: { player1Score: null, player2Score: null },
        winnerPlayerId: null,
        nextMatchId: `${bracketId}-match-2`
    });
    currentLane += 2;

    // Match 2: Winner of Match 1 vs Seed 3
    matches.push({
        matchId: `${bracketId}-match-2`,
        lane: `${currentLane}-${currentLane + 1}`,
        players: [
            { playerId: currentPlayerId++, playerName: `${category.charAt(0)}-P${bracketIndex}-S3`, seed: 3 },
            { playerId: null, playerName: `Winner of M1`, seed: "dynamic" }
        ],
        scores: { player1Score: null, player2Score: null },
        winnerPlayerId: null,
        nextMatchId: `${bracketId}-match-3`
    });
    currentLane += 2;

    // Match 3: Winner of Match 2 vs Seed 2
    matches.push({
        matchId: `${bracketId}-match-3`,
        lane: `${currentLane}-${currentLane + 1}`,
        players: [
            { playerId: currentPlayerId++, playerName: `${category.charAt(0)}-P${bracketIndex}-S2`, seed: 2 },
            { playerId: null, playerName: `Winner of M2`, seed: "dynamic" }
        ],
        scores: { player1Score: null, player2Score: null },
        winnerPlayerId: null,
        nextMatchId: `${bracketId}-match-4`
    });
    currentLane += 2;

    // Match 4: Winner of Match 3 vs Seed 1 (Championship Match)
    matches.push({
        matchId: `${bracketId}-match-4`,
        lane: `${currentLane}-${currentLane + 1}`,
        players: [
            { playerId: currentPlayerId++, playerName: `${category.charAt(0)}-P${bracketIndex}-S1`, seed: 1 },
            { playerId: null, playerName: `Winner of M3`, seed: "dynamic" }
        ],
        scores: { player1Score: null, player2Score: null },
        winnerPlayerId: null,
        nextMatchId: `${bracketId}-match-champion`
    });
    currentLane += 2;

    // Match 5: Winner of Match 4 vs Previous Week's Champion
    matches.push({
        matchId: `${bracketId}-match-champion`,
        lane: `${currentLane}-${currentLane + 1}`,
        players: [
            { playerId: currentPlayerId++, playerName: `${category.charAt(0)}-P${bracketIndex}-Champ`, seed: "champion" },
            { playerId: null, playerName: `Winner of M4`, seed: "dynamic" }
        ],
        scores: { player1Score: null, player2Score: null },
        winnerPlayerId: null,
        nextMatchId: null // Final match of this bracket
    });

    return {
        bracketId,
        category,
        laneStart: `${startLaneOffset}-${startLaneOffset + 1}`, // Represents the starting lane pair for the bracket
        matches
    };
}

app.get('/api/admin/matchplay/brackets/:weekId', async (req, res) => {
    const { weekId } = req.params;
    // This is a placeholder. Real implementation will fetch from DB and apply logic.
    res.json({
        weekId: parseInt(weekId, 10),
        handicapBracket: {
            category: "Handicap",
            matches: [
                {
                    matchId: "h-match-1",
                    lane: "5-6",
                    players: [
                        { playerId: 101, playerName: "H-Player 5", seed: 5 },
                        { playerId: 102, playerName: "H-Player 4", seed: 4 }
                    ],
                    scores: { player1Score: null, player2Score: null },
                    winnerPlayerId: null,
                    nextMatchId: "h-match-2"
                },
                {
                    matchId: "h-match-2",
                    lane: "7-8",
                    players: [
                        { playerId: 103, playerName: "H-Player 3", seed: 3 },
                        { playerId: null, playerName: "Winner of h-match-1", seed: "dynamic" }
                    ],
                    scores: { player1Score: null, player2Score: null },
                    winnerPlayerId: null,
                    nextMatchId: "h-match-3"
                },
                {
                    matchId: "h-match-3",
                    lane: "9-10",
                    players: [
                        { playerId: 104, playerName: "H-Player 2", seed: 2 },
                        { playerId: null, playerName: "Winner of h-match-2", seed: "dynamic" }
                    ],
                    scores: { player1Score: null, player2Score: null },
                    winnerPlayerId: null,
                    nextMatchId: "h-match-4"
                },
                {
                    matchId: "h-match-4",
                    lane: "11-12",
                    players: [
                        { playerId: 105, playerName: "H-Player 1", seed: 1 },
                        { playerId: null, playerName: "Winner of h-match-3", seed: "dynamic" }
                    ],
                    scores: { player1Score: null, player2Score: null },
                    winnerPlayerId: null,
                    nextMatchId: null // Final match
                },
                {
                    matchId: "h-match-champion",
                    lane: "13-14", // Example lane for champion match
                    players: [
                        { playerId: 106, playerName: "H-Champion Prev", seed: "champion" },
                        { playerId: null, playerName: "Winner of h-match-4", seed: "dynamic" }
                    ],
                    scores: { player1Score: null, player2Score: null },
                    winnerPlayerId: null,
                    nextMatchId: null // Final match
                }
            ]
        },
        withoutHandicapBracket: {
            category: "Without Handicap",
            matches: [
                {
                    matchId: "nh-match-1",
                    lane: "15-16",
                    players: [
                        { playerId: 201, playerName: "NH-Player 5", seed: 5 },
                        { playerId: 202, playerName: "NH-Player 4", seed: 4 }
                    ],
                    scores: { player1Score: null, player2Score: null },
                    winnerPlayerId: null,
                    nextMatchId: "nh-match-2"
                },
                {
                    matchId: "nh-match-2",
                    lane: "17-18",
                    players: [
                        { playerId: 203, playerName: "NH-Player 3", seed: 3 },
                        { playerId: null, playerName: "Winner of nh-match-1", seed: "dynamic" }
                    ],
                    scores: { player1Score: null, player2Score: null },
                    winnerPlayerId: null,
                    nextMatchId: "nh-match-3"
                },
                {
                    matchId: "nh-match-3",
                    lane: "19-20",
                    players: [
                        { playerId: 204, playerName: "NH-Player 2", seed: 2 },
                        { playerId: null, playerName: "Winner of nh-match-2", seed: "dynamic" }
                    ],
                    scores: { player1Score: null, player2Score: null },
                    winnerPlayerId: null,
                    nextMatchId: "nh-match-4"
                },
                {
                    matchId: "nh-match-4",
                    lane: "21-22",
                    players: [
                        { playerId: 205, playerName: "NH-Player 1", seed: 1 },
                        { playerId: null, playerName: "Winner of nh-match-3", seed: "dynamic" }
                    ],
                    scores: { player1Score: null, player2Score: null },
                    winnerPlayerId: null,
                    nextMatchId: null // Final match
                },
                {
                    matchId: "nh-match-champion",
                    lane: "23-24", // Example lane for champion match
                    players: [
                        { playerId: 206, playerName: "NH-Champion Prev", seed: "champion" },
                        { playerId: null, playerName: "Winner of nh-match-4", seed: "dynamic" }
                    ],
                    scores: { player1Score: null, player2Score: null },
                    winnerPlayerId: null,
                    nextMatchId: null // Final match
                }
            ]
        }
    });
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

app.post('/api/matchplay/champions', async (req, res) => {
    // Expects a body like: { weekId: 1, champions: [ { playerId: 10, bracketType: 'NoHandicap' }, { playerId: 7, bracketType: 'Handicap' } ] }
    const { weekId, champions } = req.body;
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        // First, delete any existing champions for this week to prevent duplicates
        await client.query('DELETE FROM public."MatchplayChampions" WHERE "WeekID" = $1', [weekId]);

        // Then, insert the new champions
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
        console.error("Error saving matchplay champions:", err.message);
        res.status(500).send('Server error');
    } finally {
        client.release();
    }
});

app.post('/api/admin/matchplay/score', async (req, res) => {
    const { weekId, bracketId, matchId, player1Score, player2Score } = req.body;
    console.log(`Received score for match ${matchId} in bracket ${bracketId} (Week ${weekId}): Player1 Score = ${player1Score}, Player2 Score = ${player2Score}`);
    // Placeholder: In a real scenario, you would update the database here
    // and potentially determine the winner and next match.
    res.status(200).json({ message: 'Score received and processed (placeholder).' });
});


// |------------------------------------------------------------------------ POST ENDPOINTS API FIN ------------------------------------------------------------------------|


app.listen(PORT, function() {
  console.log(`Le serveur écoute ici : http://localhost:${PORT}`); // Démarrer le serveur et afficher un message dans la console
});

