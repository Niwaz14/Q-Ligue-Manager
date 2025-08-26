import React, { useState, useEffect } from 'react';
import styles from './AdminMatchPlay.module.css';

const AdminMatchPlay = () => {
    const [weeks, setWeeks] =useState([]);
    const [selectedWeek, setSelectedWeek] = useState('');
    const [bracketsData, setBracketsData] = useState(null); // Stockera la structure complète du bracket
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null); // Ajouter un état d'erreur

    useEffect(() => {
        // Récupérer les semaines pour peupler le menu déroulant
        const fetchScheduleForWeeks = async () => {
            try {
                const response = await fetch(`${process.env.REACT_APP_API_URL}/api/schedule`);
                const data = await response.json();
                const uniqueWeeks = [...new Set(data.map(item => item.weekid))].sort((a, b) => a - b);
                setWeeks(uniqueWeeks);
                if (uniqueWeeks.length > 0) {
                    setSelectedWeek(String(uniqueWeeks.length));
                }
            } catch (error) {
                console.error("Error fetching schedule for weeks:", error);
            }
        };
        fetchScheduleForWeeks();
    }, []);

    useEffect(() => {
        if (!selectedWeek) return;

        const fetchBrackets = async () => {
            setLoading(true);
            setError(null); // Réinitialiser l'erreur
            console.log(`Fetching brackets for week: ${selectedWeek}`);
            const apiUrl = `${process.env.REACT_APP_API_URL}/api/admin/matchplay/brackets/${selectedWeek}`;
            console.log(`API URL: ${apiUrl}`);
            try {
                const response = await fetch(apiUrl);
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                const data = await response.json();
                console.log('Fetched brackets data:', data);
                setBracketsData(data);
            } catch (error) {
                console.error('Error fetching brackets:', error);
                setError('Failed to load matchplay brackets.');
            } finally {
                setLoading(false);
            }
        };
        fetchBrackets();
    }, [selectedWeek]);

    // Logique de soumission de score de remplacement
    const handleScoreSubmit = async (bracketId, matchId, player1Score, player2Score) => {
        console.log(`Submitting scores for match ${matchId} in bracket ${bracketId}: ${player1Score} - ${player2Score}`);
        // Dans une application réelle, vous enverriez cela au backend
        try {
            const response = await fetch(`${process.env.REACT_APP_API_URL}/api/admin/matchplay/score`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ bracketId, matchId, player1Score, player2Score })
            });
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const result = await response.json();
            console.log('Score submission successful:', result);
            // Après une soumission réussie, vous voudrez peut-être récupérer à nouveau les brackets pour mettre à jour l'interface utilisateur
            // ou mettre à jour l'état local en fonction de la réponse. Pour l'instant, nous allons simplement enregistrer.
            // fetchBrackets(); // Décommentez ceci si vous voulez récupérer à nouveau après chaque score
        } catch (error) {
            console.error('Error submitting scores:', error);
            alert('Failed to submit scores.');
        }
    };

    // Composant MatchCard de base pour le débogage
    const MatchCard = ({ match, bracketCategory, handleScoreSubmit, weekId }) => {
        return (
            <div className={styles.matchCard}>
                <h3>Match ID: {match.matchId}</h3>
                <p>Category: {bracketCategory}</p>
                {/* Vous pouvez ajouter plus de détails de l'objet match ici */}
                {/* Exemple : <p>Joueur 1 : {match.player1.name}</p> */}
                {/* Exemple : <p>Joueur 2 : {match.player2.name}</p> */}
            </div>
        );
    };

    return (
        <div className={styles.container}>
            <div className={styles.header}>
                <h1>Admin Match Play</h1>
                {weeks.length > 0 && (
                     <div className={styles.weekSelectorContainer}>
                        <label htmlFor="week-selector">Semaine: </label>
                        <select id="week-selector" value={selectedWeek} onChange={e => setSelectedWeek(e.target.value)}>
                            {weeks.map(weekNum => <option key={weekNum} value={weekNum}>Semaine {weekNum}</option>)}
                        </select>
                    </div>
                )}
            </div>

            {loading && <p>Chargement des brackets...</p>}
            {error && <p className={styles.error}>Erreur: {error}</p>}

            {bracketsData && !loading && !error && (
                <div className={styles.bracketsWrapper}>
                    <div className={styles.bracketColumn}>
                        <h2>{bracketsData.handicapBracket.category} Bracket</h2>
                        <div className={styles.matchList}>
                            {bracketsData.handicapBracket.matches.map(match => <MatchCard key={match.matchId} match={match} bracketCategory='handicap' handleScoreSubmit={handleScoreSubmit} weekId={bracketsData.weekId} />)}
                        </div>
                    </div>
                    <div className={styles.bracketColumn}>
                        <h2>{bracketsData.withoutHandicapBracket.category} Bracket</h2>
                        <div className={styles.matchList}>
                            {bracketsData.withoutHandicapBracket.matches.map(match => <MatchCard key={match.matchId} match={match} bracketCategory='noHandicap' handleScoreSubmit={handleScoreSubmit} weekId={bracketsData.weekId} />)}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminMatchPlay;