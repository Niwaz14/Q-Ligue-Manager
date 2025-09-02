import React, { useState, useEffect } from 'react';
import styles from './MatchPlay.module.css';


const MatchRowDisplay = ({ game }) => {
    const isFinished = !!game.winner.id; // Le match est considéré comme terminé si un gagnant a un ID.
    const p1 = game.player1;
    const p2 = game.player2;

    return (
        <div className={styles.matchRow}>
            {/* Applique une classe `winner` pour mettre en évidence le gagnant. */}
            <div className={`${styles.player} ${isFinished && game.winner.id === p1.id ? styles.winner : ''}`}>
                <span className={styles.playerName}>{p1.name || 'TBD'}</span>
                {isFinished && <span className={styles.playerScore}>{p1.score}</span>}
            </div>
            <div className={styles.vs}>vs</div>
            <div className={`${styles.player} ${isFinished && game.winner.id === p2.id ? styles.winner : ''}`}>
                {isFinished && <span className={styles.playerScore}>{p2.score}</span>}
                <span className={styles.playerName}>{p2.name || 'TBD'}</span>
            </div>
        </div>
    );
};

const MatchPlay = () => {
    // Gestion d'état standard et cohérente avec les autres pages de l'application.
    const [weeks, setWeeks] = useState([]);
    const [selectedWeek, setSelectedWeek] = useState('');
    const [bracketsData, setBracketsData] = useState([]); 
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Charger la liste des semaines disponibles pour le sélecteur.
    useEffect(() => {
        const fetchScheduleAndSetLatestWeek = async () => {
            try {
                const scheduleResponse = await fetch(`${process.env.REACT_APP_API_URL}/api/schedule`);
                const scheduleData = await scheduleResponse.json();
                
                const weekMap = new Map();
                scheduleData.forEach(item => {
                    if (!weekMap.has(item.weekid)) {
                        weekMap.set(item.weekid, {
                            id: item.weekid,
                            date: new Date(item.weekdate).toLocaleDateString('fr-CA', { timeZone: 'UTC' })
                        });
                    }
                });
                const uniqueWeeks = Array.from(weekMap.values()).sort((a, b) => a.id - b.id);
                setWeeks(uniqueWeeks);

                if (uniqueWeeks.length > 0) {
                    let latestWeekWithData = '';
                    for (let i = uniqueWeeks.length - 1; i >= 0; i--) {
                        const week = uniqueWeeks[i];
                        const matchPlayResponse = await fetch(`${process.env.REACT_APP_API_URL}/api/matchplay/${week.id}`);
                        const matchPlayData = await matchPlayResponse.json();
                        if (matchPlayData.length > 0) {
                            latestWeekWithData = String(week.id);
                            break;
                        }
                    }
                    setSelectedWeek(latestWeekWithData || (uniqueWeeks.length > 0 ? String(uniqueWeeks[0].id) : ''));
                }
            } catch (err) {
                setError("Impossible de charger les données.");
            } finally {
                setLoading(false);
            }
        };
        fetchScheduleAndSetLatestWeek();
    }, []);

    // Changer les données des brackets chaque fois que la semaine sélectionnée change.
    useEffect(() => {
        if (!selectedWeek) return;

        const fetchBrackets = async () => {
            setLoading(true);
            setError(null);
            try {
                const response = await fetch(`${process.env.REACT_APP_API_URL}/api/matchplay/${selectedWeek}`);
                if (!response.ok) throw new Error(`Erreur HTTP: ${response.status}`);
                const data = await response.json();
                setBracketsData(data);
            } catch (err) {
                setError('Impossible de charger les brackets.');
                setBracketsData([]);
            } finally {
                setLoading(false);
            }
        };
        fetchBrackets();
    }, [selectedWeek]);

    // Rendu de chargement
    const renderContent = () => {
        if (loading) return <p className={styles.message}>Chargement...</p>;
        if (error) return <p className={`${styles.message} ${styles.error}`}>Erreur: {error}</p>;
        if (bracketsData.length === 0) return <p className={styles.message}>Aucun bracket de match play trouvé pour la semaine {selectedWeek}.</p>;
        
        return (
            <div className={styles.bracketsGrid}>
                {bracketsData.map(bracket => (
                    <div key={bracket.bracketId} className={styles.bracket}>
                        <h3>{bracket.bracketName} - Allées {bracket.laneNumber}</h3>
                        <div className={styles.matchesContainer}>
                            {/* Tri des matchs pour assurer un affichage correct dans le bracket. */}
                            {bracket.games.sort((a,b) => a.matchOrder - b.matchOrder).map(game => (
                                <MatchRowDisplay key={game.matchId} game={game} />
                            ))}
                        </div>
                        <div className={styles.champion}>
                            Champion: <span>{bracket.championName || 'TBD'}</span>
                        </div>
                    </div>
                ))}
            </div>
        );
    };
    // Affichage de page.
    return (
        <div className={styles.container}>
            <div className={styles.header}>
                <h1>Résultats Match Play</h1>
                <div className={styles.weekSelectorContainer}>
                    <label htmlFor="week-selector">Semaine: </label>
                    <select id="week-selector" className={styles.weekSelector} value={selectedWeek} onChange={e => setSelectedWeek(e.target.value)}>
                        {weeks.map(weekInfo => (
                            <option key={weekInfo.id} value={weekInfo.id}>
                                Semaine {weekInfo.id} ({weekInfo.date})
                            </option>
                        ))}
                    </select>
                </div>
            </div>
            {renderContent()}
        </div>
    );
};

export default MatchPlay;