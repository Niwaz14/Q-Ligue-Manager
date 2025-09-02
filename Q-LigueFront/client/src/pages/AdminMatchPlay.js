import React, { useState, useEffect } from 'react';
import styles from './AdminMatchPlay.module.css';


const MatchRow = ({ game, onScoreChange, isLastScored, onErase, bracketId }) => {
    const isMatchReady = game.player1.id && game.player2.id; // Le match est prêt si les deux joueurs sont définis.
    const isMatchFinished = !!game.winner.id; // Le match est terminé si un gagnant est enregistré.
    
    // Validation de base des scores pour le style visuel.
    const p1ScoreRaw = game.player1.score;
    const p2ScoreRaw = game.player2.score;
    const p1ScoreNum = parseInt(p1ScoreRaw, 10);
    const p2ScoreNum = parseInt(p2ScoreRaw, 10);
    const isP1Invalid = (p1ScoreRaw && (p1ScoreNum < 0 || p1ScoreNum > 300)) || (!isNaN(p1ScoreNum) && p1ScoreNum === p2ScoreNum); // Pour valider les entrées
    const isP2Invalid = (p2ScoreRaw && (p2ScoreNum < 0 || p2ScoreNum > 300)) || (!isNaN(p2ScoreNum) && p1ScoreNum === p2ScoreNum);
// Rendu d'une rangée de match avec les entrées de score.
    return (
        <div className={`${styles.matchCard} ${!isMatchReady ? styles.disabled : ''}`}>  
            <div className={`${styles.playerInfo} ${isMatchFinished && game.winner.id === game.player1.id ? styles.winner : ''}`}>
                <span className={styles.playerName}>{game.player1.name || 'TBD'}</span>
                <input
                    type="number"
                    className={`${styles.scoreInput} ${isP1Invalid ? styles.scoreInputInvalid : ''}`}
                    value={p1ScoreRaw || ''}
                    onChange={(e) => onScoreChange(bracketId, game.matchOrder, 'p1', e.target.value)}
                    disabled={!isMatchReady || isMatchFinished}
                />
            </div>
            <div className={styles.vs}>vs</div>
            <div className={`${styles.playerInfo} ${isMatchFinished && game.winner.id === game.player2.id ? styles.winner : ''}`}>
                <input
                    type="number"
                    className={`${styles.scoreInput} ${isP2Invalid ? styles.scoreInputInvalid : ''}`}
                    value={p2ScoreRaw || ''}
                    onChange={(e) => onScoreChange(bracketId, game.matchOrder, 'p2', e.target.value)}
                    disabled={!isMatchReady || isMatchFinished}
                />
                <span className={styles.playerName}>{game.player2.name || 'TBD'}</span>
            </div>
            {/* Le bouton pour effacer n'apparaît que pour le dernier match ayant un score. */}
            {isLastScored && (
                <button type="button" onClick={() => onErase(game.matchId)} className={styles.eraseButton}>Effacer</button>
            )}
        </div>
    );
};


const BracketCard = ({ bracket, onScoreChange, onEraseLastMatch }) => {
    // Détermine le dernier match joué pour afficher le bouton "Effacer".
    const lastScoredGame = [...bracket.games].filter(g => g.winner.id).sort((a, b) => b.matchOrder - a.matchOrder)[0];
// Rendu d'un bracket complet avec tous ses matchs.
    return (
        <div className={styles.bracket}>
            <h3>{bracket.bracketName} - Allées {bracket.laneNumber}</h3>
            {bracket.games.sort((a, b) => a.matchOrder - b.matchOrder).map(game => (
                <MatchRow key={game.matchId} game={game} bracketId={bracket.bracketId}
                    onScoreChange={onScoreChange}
                    isLastScored={lastScoredGame && game.matchId === lastScoredGame.matchId}
                    onErase={onEraseLastMatch} />
            ))}
            <div className={styles.bracketFooter}>
                <div className={styles.champion}>Champion: {bracket.championName || 'TBD'}</div>
            </div>
        </div>
    );
};

// --- Composant principal de la page ---
const AdminMatchPlay = () => {
    const [weeks, setWeeks] = useState([]);
    const [selectedWeek, setSelectedWeek] = useState('');
    const [bracketsData, setBracketsData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Effet pour charger la liste des semaines au montage.
    useEffect(() => {
        const fetchScheduleForWeeks = async () => {
            try {
                const response = await fetch(`${process.env.REACT_APP_API_URL}/api/schedule`);
                const data = await response.json();
                if (Array.isArray(data)) {
                    const weekMap = new Map();
                    data.forEach(item => {
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
                        setSelectedWeek(String(uniqueWeeks[uniqueWeeks.length - 1].id));
                    }
                }
            } catch (err) {
                setError("Impossible de charger les semaines.");
            }
        };
        fetchScheduleForWeeks();
    }, []); 

    // Effet pour charger les données des brackets quand la semaine change.
    useEffect(() => {
        if (!selectedWeek) return;
        const fetchBrackets = async () => {
            setLoading(true);
            setError(null);
            try {
                const response = await fetch(`${process.env.REACT_APP_API_URL}/api/matchplay/${selectedWeek}`);
                if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
                const data = await response.json();
                setBracketsData(data);
            } catch (err) {
                setError('Impossible de charger les données de Matchplay.');
                setBracketsData([]);
            } finally { setLoading(false); }
        };
        fetchBrackets();
    }, [selectedWeek]); 

    // Gère chaque changement de score dans les inputs.
    const handleScoreChange = (bracketId, matchOrder, playerKey, value) => {
        setBracketsData(currentBrackets => {
            const newBrackets = JSON.parse(JSON.stringify(currentBrackets));
            const bracket = newBrackets.find(b => b.bracketId === bracketId);
            if (!bracket) return currentBrackets;
            const game = bracket.games.find(g => g.matchOrder === matchOrder);
            if (!game) return currentBrackets;

            // Mise à jour du score pour le bon joueur.
            const playerToUpdate = playerKey === 'p1' ? 'player1' : 'player2';
            game[playerToUpdate].score = value;

            // Déterminer le gagnant
            for (let i = 1; i < 3; i++) { // Boucle sur les matchs pour faire avancer les gagnants
                const currentMatch = bracket.games.find(g => g.matchOrder === i);
                const nextMatch = bracket.games.find(g => g.matchOrder === i + 1);
                if (!currentMatch || !nextMatch) continue;

                const p1s = parseInt(currentMatch.player1.score, 10);
                const p2s = parseInt(currentMatch.player2.score, 10);
                let winner = null;
                // Un gagnant est déterminé seulement si les deux joueurs ont un score valide et différent.
                if (currentMatch.player1.id && currentMatch.player2.id && !isNaN(p1s) && !isNaN(p2s) && p1s !== p2s) {
                    winner = p1s > p2s ? currentMatch.player1 : currentMatch.player2;
                }

                // Met à jour le joueur 1 du match suivant avec le gagnant, ou le réinitialise si le résultat est incertain.
                if (nextMatch.player1.id !== (winner ? winner.id : null)) {
                    nextMatch.player1 = winner ? { ...winner, score: '' } : { id: null, name: 'TBD', score: '' };
                }
            }
            return newBrackets;
        });
    };
    
    // Sauvegarde l'état de tous les brackets en une seule fois.
    const handleSaveAll = async () => {
        setLoading(true);
        try {
            const response = await fetch(`${process.env.REACT_APP_API_URL}/api/admin/matchplay/save-all`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ brackets: bracketsData })
            });
            if (!response.ok) throw new Error((await response.json()).message);
            alert((await response.json()).message);
            // On revalide les données depuis le serveur pour s'assurer que tout est à jour.
            const res = await fetch(`${process.env.REACT_APP_API_URL}/api/matchplay/${selectedWeek}`);
            setBracketsData(await res.json());
        } catch (err) {
            setError(err.message);
        } finally { setLoading(false); }
    };

    // Gère la génération initiale des brackets pour la semaine.
    const handleGenerateBrackets = async () => {
        setLoading(true);
        try {
            // Récupéeration des listes de qualification depuis l'API.
            const qualifResponse = await fetch(`${process.env.REACT_APP_API_URL}/api/matchplay/qualification/${selectedWeek}`);
            if (!qualifResponse.ok) throw new Error('Impossible de récupérer les données de qualification.');
            const qualificationData = await qualifResponse.json();

            // Envoyer les données de qualification pour générer les brackets.
            const response = await fetch(`${process.env.REACT_APP_API_URL}/api/admin/matchplay/setup`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ weekId: selectedWeek, ...qualificationData })
            });
            if (!response.ok) throw new Error((await response.json()).message || 'Impossible de générer le bracket.');
            
            alert((await response.json()).message);
            
            // Recupéeration des brackets générés de nouveau depuis le serveur.
            const res = await fetch(`${process.env.REACT_APP_API_URL}/api/matchplay/${selectedWeek}`);
            setBracketsData(await res.json());
        } catch (err) {
            setError(err.message);
        } finally { setLoading(false); }
    };

    // Permet à l'admin d'effacer le dernier score entré pour corriger une erreur.
    const handleEraseLastMatch = async (matchId) => {
        if (!window.confirm("Êtes-vous sûr de vouloir effacer le dernier pointage entré?")) return;
        setLoading(true);
        try {
            const response = await fetch(`${process.env.REACT_APP_API_URL}/api/admin/matchplay/erase`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ matchId })
            });
            if (!response.ok) throw new Error((await response.json()).message);
            const res = await fetch(`${process.env.REACT_APP_API_URL}/api/matchplay/${selectedWeek}`);
            setBracketsData(await res.json());
        } catch (err) {
            setError(err.message);
        } finally { setLoading(false); }
    };

    // Fonction pour afficher le contenu principal selon l'état de chargement et les données disponibles.
    const renderContent = () => {
        if (loading) return <p>Chargement...</p>;
        if (error) return <p className={styles.error}>Erreur: {error}</p>;

        if (bracketsData && bracketsData.length > 0) {
            return (
                <div className={styles.bracketsGrid}>
                    {bracketsData.map(bracket => (
                        <BracketCard key={bracket.bracketId} bracket={bracket} 
                            onScoreChange={handleScoreChange} onEraseLastMatch={handleEraseLastMatch} />
                    ))}
                </div>
            );
        } else {
            // Si aucun bracket n'existe, on propose de les générer.
            return (
                <div className={styles.generatorContainer}>
                    <p>Aucun bracket de match play trouvé pour la semaine {selectedWeek}.</p>
                    <button onClick={handleGenerateBrackets} className={styles.generateButton}>
                        Générer les brackets pour la semaine {selectedWeek}
                    </button>
                </div>
            );
        }
    };
// Rendu principal de page
    return (
        <div className={styles.container}>
            <div className={styles.header}>
                <h1>Admin Match Play</h1>
                <div className={styles.headerControls}>
                    {weeks.length > 0 && (
                        <>
                            <label htmlFor="week-selector">Semaine: </label>
                            <select id="week-selector" className={styles.weekSelector} value={selectedWeek} onChange={e => setSelectedWeek(e.target.value)}>
                                {weeks.map(week => <option key={week.id} value={week.id}>Semaine {week.id} - {week.date}</option>)}
                            </select>
                        </>
                    )}
                    {bracketsData.length > 0 && !loading && (
                        <button onClick={handleSaveAll} className={styles.saveAllButton}>Tout Sauvegarder</button>
                    )}
                </div>
            </div>
            {renderContent()}
        </div>
    );
};

export default AdminMatchPlay;