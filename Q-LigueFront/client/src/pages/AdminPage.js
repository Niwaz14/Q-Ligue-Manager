import React, { useState, useEffect, useCallback } from 'react';
import styles from './AdminPage.module.css';

function AdminPage() {
    // States pour gérer les sélections et les données
    const [schedule, setSchedule] = useState([]);
    const [selectedWeek, setSelectedWeek] = useState('');
    const [selectedMatchup, setSelectedMatchup] = useState('');
    const [matchupDetails, setMatchupDetails] = useState(null);
    const [scores, setScores] = useState({});
    const [error, setError] = useState('');
    const [successMessage, setSuccessMessage] = useState('');

    // Fonction pour récupérer le calendrier au chargement
    const fetchData = useCallback(async () => {
        try {
            const response = await fetch(`${process.env.REACT_APP_API_URL}/api/schedule`);
            if (!response.ok) throw new Error('Network response was not ok');
            const data = await response.json();
            setSchedule(data);
        } catch (err) {
            setError(`Erreur: Impossible de charger le calendrier - ${err.message}`);
        }
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    // Gère le changement de la semaine sélectionnée
    const handleWeekChange = (e) => {
        setSelectedWeek(e.target.value);
        setSelectedMatchup('');
        setMatchupDetails(null);
        setScores({});
    };

    // Gère le changement du match sélectionné et récupère les détails
    const handleMatchupChange = async (e) => {
        const matchupId = e.target.value;
        setSelectedMatchup(matchupId);
        if (matchupId) {
            try {
                const response = await fetch(`${process.env.REACT_APP_API_URL}/api/matchups/${matchupId}`);
                if (!response.ok) throw new Error('Network response was not ok');
                const data = await response.json();
                setMatchupDetails(data);
                // Initialise l'état des scores pour les joueurs du match
                const initialScores = {};
                [...data.team1Players, ...data.team2Players].forEach(player => {
                    initialScores[player.PlayerID] = {
                        game1: '', game2: '', game3: '',
                        isAbsent1: false, isAbsent2: false, isAbsent3: false
                    };
                });
                setScores(initialScores);
            } catch (err) {
                setError(`Erreur: Impossible de charger les détails du match - ${err.message}`);
            }
        } else {
            setMatchupDetails(null);
        }
    };

    // Gère la modification d'un score
    const handleScoreChange = (playerId, game, value) => {
        setScores(prev => ({
            ...prev,
            [playerId]: { ...prev[playerId], [game]: value }
        }));
    };

    // Gère le changement de la checkbox "absent"
    const handleAbsentChange = (playerId, gameKey, isChecked) => {
        setScores(prev => ({
            ...prev,
            [playerId]: { ...prev[playerId], [gameKey]: isChecked }
        }));
    };

    // Soumet les scores au backend
    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setSuccessMessage('');

        const scoreData = Object.entries(scores).flatMap(([playerId, games]) => [
            { playerId: parseInt(playerId), gameNumber: 1, score: parseInt(games.game1, 10) || 0, isAbsent: games.isAbsent1 },
            { playerId: parseInt(playerId), gameNumber: 2, score: parseInt(games.game2, 10) || 0, isAbsent: games.isAbsent2 },
            { playerId: parseInt(playerId), gameNumber: 3, score: parseInt(games.game3, 10) || 0, isAbsent: games.isAbsent3 }
        ]);

        try {
            const response = await fetch(`${process.env.REACT_APP_API_URL}/api/scores/batch`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    matchupId: parseInt(selectedMatchup),
                    scores: scoreData
                }),
            });
            if (!response.ok) throw new Error('La soumission des pointages a échoué.');
            setSuccessMessage('Pointages enregistrés avec succès!');
        } catch (err) {
            setError(err.message);
        }
    };
    
    // Génère les options pour le sélecteur de semaine
    const weekOptions = schedule.map(week => (
        <option key={week.WeekID} value={week.WeekID}>
            Semaine {new Date(week.WeekDate).toLocaleDateString()}
        </option>
    ));

    // Génère les options pour le sélecteur de match en fonction de la semaine
    const matchupOptions = selectedWeek ? schedule
        .find(w => w.WeekID === parseInt(selectedWeek))?.matchups
        .map(m => (
            <option key={m.MatchupID} value={m.MatchupID}>
                {m.Team1Name} vs {m.Team2Name}
            </option>
        )) : [];

    // Fonction pour rendre les inputs de score pour un joueur
    const renderPlayerInputs = (player) => (
        <tr key={player.PlayerID}>
            <td>{player.PlayerName}</td>
            {[1, 2, 3].map(gameNum => (
                <td key={gameNum}>
                    <input
                        type="number"
                        className={styles.scoreInput}
                        value={scores[player.PlayerID]?.[`game${gameNum}`] || ''}
                        onChange={(e) => handleScoreChange(player.PlayerID, `game${gameNum}`, e.target.value)}
                    />
                    <label className={styles.absentLabel}>
                        <input
                            type="checkbox"
                            checked={scores[player.PlayerID]?.[`isAbsent${gameNum}`] || false}
                            onChange={(e) => handleAbsentChange(player.PlayerID, `isAbsent${gameNum}`, e.target.checked)}
                        />
                        Abs
                    </label>
                </td>
            ))}
        </tr>
    );

    return (
        <div className={styles.adminContainer}>
            <h2>Entrée des Pointages</h2>
            {error && <p className={styles.errorMessage}>{error}</p>}
            {successMessage && <p className={styles.successMessage}>{successMessage}</p>}

            <form onSubmit={handleSubmit}>
                <div className={styles.selectors}>
                    <select value={selectedWeek} onChange={handleWeekChange}>
                        <option value="">Sélectionner une semaine</option>
                        {weekOptions}
                    </select>
                    {selectedWeek && (
                        <select value={selectedMatchup} onChange={handleMatchupChange}>
                            <option value="">Sélectionner un match</option>
                            {matchupOptions}
                        </select>
                    )}
                </div>

                {matchupDetails && (
                    <div className={styles.matchupContainer}>
                        <h3>{matchupDetails.team1Name}</h3>
                        <table className={styles.scoreTable}>
                            <thead><tr><th>Joueur</th><th>Partie 1</th><th>Partie 2</th><th>Partie 3</th></tr></thead>
                            <tbody>{matchupDetails.team1Players.map(renderPlayerInputs)}</tbody>
                        </table>

                        <h3>{matchupDetails.team2Name}</h3>
                        <table className={styles.scoreTable}>
                            <thead><tr><th>Joueur</th><th>Partie 1</th><th>Partie 2</th><th>Partie 3</th></tr></thead>
                            <tbody>{matchupDetails.team2Players.map(renderPlayerInputs)}</tbody>
                        </table>
                        
                        <button type="submit" className={styles.submitButton}>Enregistrer les pointages</button>
                    </div>
                )}
            </form>
        </div>
    );
}

export default AdminPage;