import React, { useState, useEffect } from 'react';
// Importer le CSS module pour la page d'administration
import styles from './AdminPage.module.css';

const AdminPage = () => {
    // Définir les états pour gérer la sélection et les données
    const [schedule, setSchedule] = useState([]);
    const [weeks, setWeeks] = useState([]);
    const [sortedUniqueDates, setSortedUniqueDates] = useState([]);
    const [selectedWeek, setSelectedWeek] = useState('');
    const [matchupsForWeek, setMatchupsForWeek] = useState([]);
    const [selectedMatchupId, setSelectedMatchupId] = useState('');
    const [rosters, setRosters] = useState({ team1: [], team2: [] });
    
    // États pour l'alignement
    const [lineup, setLineup] = useState({ team1: [], team2: [] });
    const [lineupIsSet, setLineupIsSet] = useState(false);
    
   
    const [gameData, setGameData] = useState({});

    // Récupérer tout l'horaire de la saison
    useEffect(() => {
        const fetchSchedule = async () => {
            try {
                const response = await fetch(`${process.env.REACT_APP_API_URL}/api/schedule`);
                if (!response.ok) throw new Error(`Erreur HTTP: ${response.status}`);
                const data = await response.json();
                setSchedule(data);

                // **RELIABLE WEEK CALCULATION**
                const uniqueDates = [...new Set(data.map(item => item.weekdate))].sort();
                setSortedUniqueDates(uniqueDates);
                const seasonWeeks = Array.from({ length: uniqueDates.length }, (_, i) => i + 1);
                setWeeks(seasonWeeks);

            } catch (error) {
                console.error("Erreur lors de la récupération de l'horaire:", error);
            }
        };
        fetchSchedule();
    }, []);

    // Filtrer les matchs lorsque l'utilisateur sélectionne une semaine
    useEffect(() => {
        if (selectedWeek && sortedUniqueDates.length > 0) {
            const targetDate = sortedUniqueDates[parseInt(selectedWeek) - 1];
            const matchups = schedule.filter(item => item.weekdate === targetDate);
            setMatchupsForWeek(matchups);
            setSelectedMatchupId(''); // Reset subsequent selections
        }
    }, [selectedWeek, schedule, sortedUniqueDates]);

    // Récupérer les détails du match et initialiser l'état des parties
    useEffect(() => {
        if (!selectedMatchupId) {
            setRosters({ team1: [], team2: [] });
            setLineup({ team1: [], team2: [] });
            setLineupIsSet(false);
            setGameData({});
            return;
        }
        const fetchMatchupDetails = async () => {
            try {
                const response = await fetch(`${process.env.REACT_APP_API_URL}/api/matchups/${selectedMatchupId}`);
                const data = await response.json();
                
                const currentMatchup = schedule.find(m => m.matchupid === parseInt(selectedMatchupId));
                if (currentMatchup) {
                    const team1Name = currentMatchup.team1_name;
                    const team2Name = currentMatchup.team2_name;
                    const uniquePlayers = [...new Map(data.map(p => [p.playerid, p])).values()];
                    
                    setRosters({
                        team1: uniquePlayers.filter(p => p.teamname === team1Name),
                        team2: uniquePlayers.filter(p => p.teamname === team2Name),
                    });
                }
                setLineup({ team1: [], team2: [] }); 
                setLineupIsSet(false);
                setGameData({});
            } catch (error) {
                console.error("Erreur lors de la récupération des détails du match:", error);
            }
        };
        fetchMatchupDetails();
    }, [selectedMatchupId, schedule]);
    
    // **NEW ROBUST HANDLERS**
    const handleScoreChange = (playerId, gameNumber, value) => {
        const key = `${playerId}-${gameNumber}`;
        setGameData(prev => ({
            ...prev,
            [key]: { ...prev[key], score: value, isAbsent: false }
        }));
    };
    
    const handleAbsenceChange = (playerId, gameNumber, isChecked) => {
        const key = `${playerId}-${gameNumber}`;
        setGameData(prev => ({
            ...prev,
            [key]: { ...prev[key], score: isChecked ? '' : (prev[key]?.score || ''), isAbsent: isChecked }
        }));
    };

    const handleSaveLineup = () => {
        if (lineup.team1.length !== 5 || lineup.team2.length !== 5) {
            alert('Veuillez sélectionner 5 joueurs pour chaque équipe.');
            return;
        }
        
        const initialGameData = {};
        const lineupPlayers = [...lineup.team1, ...lineup.team2];
        lineupPlayers.forEach(playerId => {
            [1, 2, 3].forEach(gameNumber => {
                const key = `${playerId}-${gameNumber}`;
                initialGameData[key] = { score: '', isAbsent: false };
            });
        });
        setGameData(initialGameData);
        setLineupIsSet(true);
    };

    const handleSubmitScores = async (e) => {
        e.preventDefault();
        const scoresToSubmit = Object.entries(gameData).map(([key, data]) => {
            const [playerId, gameNumber] = key.split('-');
            const player = [...rosters.team1, ...rosters.team2].find(p => p.playerid === parseInt(playerId));
            if (!player) return null;
            
            const isTeam1 = rosters.team1.some(p => p.playerid === player.playerid);
            const lineupPosition = isTeam1
                ? lineup.team1.indexOf(player.playerid) + 1
                : lineup.team2.indexOf(player.playerid) + 1;

            return {
                playerId: parseInt(playerId),
                gameNumber: parseInt(gameNumber),
                score: data.isAbsent ? 0 : (parseInt(data.score, 10) || 0),
                isAbsent: data.isAbsent,
                lineupPosition: lineupPosition,
            };
        }).filter(Boolean);

        try {
            const response = await fetch(`${process.env.REACT_APP_API_URL}/api/scores/batch`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ matchupId: selectedMatchupId, scores: scoresToSubmit }),
            });
            if (response.ok) alert('Pointages enregistrés avec succès!');
            else alert('Erreur lors de la sauvegarde des pointages.');
        } catch (error) {
            console.error("Erreur:", error);
            alert("Une erreur de communication est survenue.");
        }
    };
    
    const handleLineupChange = (team, playerId) => {
        const currentLineup = lineup[team];
        const playerIsSelected = currentLineup.includes(playerId);
        let newLineup = [...currentLineup];

        if (playerIsSelected) {
            newLineup = newLineup.filter(id => id !== playerId);
        } else if (currentLineup.length < 5) {
            newLineup.push(playerId);
        }
        setLineup(prev => ({ ...prev, [team]: newLineup }));
    };

    return (
        <div className={styles.adminContainer}>
            <h1>Gestion de Match</h1>
            <div className={styles.selectionBar}>
                <select onChange={(e) => setSelectedWeek(e.target.value)} value={selectedWeek}>
                    <option value="">-- Choisir une semaine --</option>
                    {weeks.map(week => <option key={week} value={week}>Semaine {week}</option>)}
                </select>
                <select onChange={(e) => setSelectedMatchupId(e.target.value)} value={selectedMatchupId} disabled={!selectedWeek}>
                    <option value="">-- Choisir un match --</option>
                    {matchupsForWeek.map(match => (
                        <option key={match.matchupid} value={match.matchupid}>{match.team1_name} vs {match.team2_name}</option>
                    ))}
                </select>
            </div>

            {selectedMatchupId && !lineupIsSet && (
                <div className={styles.lineupContainer}>
                    <h2>Définir l'alignement</h2>
                    <div className={styles.rosterColumns}>
                        <div className={styles.roster}>
                            <h3>{rosters.team1[0]?.teamname || 'Équipe 1'} ({lineup.team1.length}/5)</h3>
                            {rosters.team1.map(p => (
                                <div key={p.playerid}>
                                    <input type="checkbox" id={`p-${p.playerid}`} checked={lineup.team1.includes(p.playerid)} onChange={() => handleLineupChange('team1', p.playerid)} />
                                    <label htmlFor={`p-${p.playerid}`}>{p.playername}</label>
                                </div>
                            ))}
                        </div>
                        <div className={styles.roster}>
                            <h3>{rosters.team2[0]?.teamname || 'Équipe 2'} ({lineup.team2.length}/5)</h3>
                            {rosters.team2.map(p => (
                                <div key={p.playerid}>
                                    <input type="checkbox" id={`p-${p.playerid}`} checked={lineup.team2.includes(p.playerid)} onChange={() => handleLineupChange('team2', p.playerid)} />
                                    <label htmlFor={`p-${p.playerid}`}>{p.playername}</label>
                                </div>
                            ))}
                        </div>
                    </div>
                    <button onClick={handleSaveLineup} className={styles.submitButton}>Saisir les scores</button>
                </div>
            )}
            
            {lineupIsSet && (
                 <form onSubmit={handleSubmitScores} className={styles.scoreForm}>
                    <h2>Saisie des Pointages</h2>
                     <table className={styles.scoreTable}>
                         <thead>
                             <tr>
                                 <th>Joueur</th>
                                 <th>Équipe</th>
                                 <th>Partie 1</th>
                                 <th>Partie 2</th>
                                 <th>Partie 3</th>
                             </tr>
                         </thead>
                         <tbody>
                            {[...rosters.team1, ...rosters.team2]
                                .filter(p => lineup.team1.includes(p.playerid) || lineup.team2.includes(p.playerid))
                                .map(player => (
                                 <tr key={player.playerid}>
                                     <td>{player.playername}</td>
                                     <td>{player.teamname}</td>
                                     {[1, 2, 3].map(gameNumber => {
                                        const key = `${player.playerid}-${gameNumber}`;
                                        const currentGame = gameData[key] || { score: '', isAbsent: false };
                                        return (
                                            <td key={key} className={styles.scoreCell}>
                                                <input
                                                    type="number"
                                                    min="0" max="300"
                                                    className={styles.scoreInput}
                                                    value={currentGame.score ?? ''} 
                                                    onChange={(e) => handleScoreChange(player.playerid, gameNumber, e.target.value)}
                                                    disabled={currentGame.isAbsent}
                                                />
                                                <label className={styles.absentLabel}>
                                                    <input
                                                        type="checkbox"
                                                        className={styles.absentCheckbox}
                                                        checked={currentGame.isAbsent}
                                                        onChange={(e) => handleAbsenceChange(player.playerid, gameNumber, e.target.checked)}
                                                    />
                                                    Abs
                                                </label>
                                            </td>
                                        );
                                     })}
                                 </tr>
                             ))}
                         </tbody>
                     </table>
                     <button type="submit" className={styles.submitButton}>Enregistrer les pointages</button>
                 </form>
            )}
        </div>
    );
};

export default AdminPage;