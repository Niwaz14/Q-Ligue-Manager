import React, { useState, useEffect } from 'react';
// Importer le CSS module pour la page d'administration
import styles from './AdminPage.module.css';

const AdminPage = () => {
    // Définir les états pour gérer la sélection, les données et les scores
    const [schedule, setSchedule] = useState([]);
    const [weeks, setWeeks] = useState([]);
    const [selectedWeek, setSelectedWeek] = useState('');
    const [matchupsForWeek, setMatchupsForWeek] = useState([]);
    const [selectedMatchupId, setSelectedMatchupId] = useState('');
    const [players, setPlayers] = useState([]);
    const [scores, setScores] = useState({});

    // Récupérer tout l'horaire de la saison au montage du composant
    useEffect(() => {
        const fetchSchedule = async () => {
            try {
                const response = await fetch(`${process.env.REACT_APP_API_URL}/api/schedule`);
                const data = await response.json();
                setSchedule(data);

                // Calculer les semaines uniques à partir de l'horaire
                const uniqueWeeks = [...new Set(data.map(item => {
                    const date = new Date(item.weekdate);
                    const start = new Date(date.getFullYear(), 0, 1);
                    const diff = (date - start) + ((start.getTimezoneOffset() - date.getTimezoneOffset()) * 60 * 1000);
                    const oneDay = 1000 * 60 * 60 * 24;
                    return Math.floor(diff / (oneDay * 7)) + 1;
                }))].sort((a, b) => a - b);
                
                setWeeks(uniqueWeeks);
            } catch (error) {
                console.error("Erreur lors de la récupération de l'horaire:", error);
            }
        };
        fetchSchedule();
    }, []);

    // Filtrer les matchs lorsque l'utilisateur sélectionne une semaine
    useEffect(() => {
        if (selectedWeek && schedule.length > 0) {
            const matchups = schedule.filter(item => {
                const date = new Date(item.weekdate);
                const start = new Date(date.getFullYear(), 0, 1);
                const diff = (date - start) + ((start.getTimezoneOffset() - date.getTimezoneOffset()) * 60 * 1000);
                const oneDay = 1000 * 60 * 60 * 24;
                const weekNum = Math.floor(diff / (oneDay * 7)) + 1;
                return weekNum === parseInt(selectedWeek);
            });
            setMatchupsForWeek(matchups);
            setSelectedMatchupId(''); // Réinitialiser la sélection de match
            setPlayers([]); // Vider la liste des joueurs
        }
    }, [selectedWeek, schedule]);

    // Récupérer les détails du match (joueurs) lorsqu'un match est sélectionné
    useEffect(() => {
        if (!selectedMatchupId) {
            setPlayers([]);
            return;
        }
        const fetchMatchupDetails = async () => {
            try {
                const response = await fetch(`http://localhost:3000/api/matchups/${selectedMatchupId}`);
                const data = await response.json();

                // Organiser les joueurs par équipe
                const teams = {};
                data.forEach(player => {
                    if (!teams[player.teamname]) {
                        teams[player.teamname] = [];
                    }
                    teams[player.teamname].push(player);
                });
                
                setPlayers(Object.values(teams).flat());
            } catch (error) {
                console.error("Erreur lors de la récupération des détails du match:", error);
            }
        };
        fetchMatchupDetails();
    }, [selectedMatchupId]);

    // Gérer les changements de score dans les champs de saisie
    const handleScoreChange = (playerId, gameNumber, value) => {
        const score = value === '' ? null : parseInt(value, 10);
        setScores(prev => ({
            ...prev,
            [`${playerId}-${gameNumber}`]: score,
        }));
    };

    // Gérer la soumission du formulaire
    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!selectedMatchupId) {
            alert("Veuillez sélectionner un match.");
            return;
        }

        // Préparer les données de pointage pour l'envoi
        const scoresToSubmit = players.map((player, index) => {
            const lineupPosition = (index % 5) + 1; // Position temporaire dans l'alignement
            return [1, 2, 3].map(gameNumber => ({
                playerId: player.playerid,
                gameNumber: gameNumber,
                score: scores[`${player.playerid}-${gameNumber}`] || 0,
                isAbsent: (scores[`${player.playerid}-${gameNumber}`] === null), // Marquer comme absent si le score est vide
                lineupPosition: lineupPosition
            }));
        }).flat();
        
       /* TO REPLACE WITH UPDATED FETCH METHOD try {
            const response = await fetch('http://localhost:3000/api/scores/batch', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    matchupId: selectedMatchupId,
                    scores: scoresToSubmit
                }),
            });

            if (response.ok) {
                alert('Pointages enregistrés avec succès!');
            } else {
                alert('Erreur lors de la sauvegarde des pointages.');
            }
        } catch (error) {
            console.error("Erreur lors de l'envoi des pointages:", error);
            alert("Une erreur de communication avec le serveur s'est produite.");
        }*/
    };

    return (
        // Conteneur principal pour la page d'administration
        <div className={styles.adminContainer}>
            <h1>Saisie des Pointages</h1>

            <div className={styles.selectionBar}>
                {/* Sélecteur de semaine */}
                <select onChange={(e) => setSelectedWeek(e.target.value)} value={selectedWeek}>
                    <option value="">-- Choisir une semaine --</option>
                    {weeks.map(week => <option key={week} value={week}>Semaine {week}</option>)}
                </select>

                {/* Sélecteur de match */}
                <select onChange={(e) => setSelectedMatchupId(e.target.value)} value={selectedMatchupId} disabled={!selectedWeek}>
                    <option value="">-- Choisir un match --</option>
                    {matchupsForWeek.map(match => (
                        <option key={match.matchupid} value={match.matchupid}>
                            {match.team1_name} vs {match.team2_name} (Allée {match.lanenumber})
                        </option>
                    ))}
                </select>
            </div>

            {/* Formulaire de saisie des scores, affiché uniquement si des joueurs sont chargés */}
            {players.length > 0 && (
                <form onSubmit={handleSubmit} className={styles.scoreForm}>
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
                            {players.map(player => (
                                <tr key={player.playerid}>
                                    <td>{player.playername}</td>
                                    <td>{player.teamname}</td>
                                    {[1, 2, 3].map(gameNumber => (
                                        <td key={gameNumber}>
                                            <input
                                                type="number"
                                                min="0"
                                                max="300"
                                                placeholder="A"
                                                value={scores[`${player.playerid}-${gameNumber}`] ?? ''}
                                                onChange={(e) => handleScoreChange(player.playerid, gameNumber, e.target.value)}
                                            />
                                        </td>
                                    ))}
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