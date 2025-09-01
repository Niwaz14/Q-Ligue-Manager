import React, { useState, useEffect } from 'react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd'; // Pour faire les alignements déplaçables.
import styles from './EntrerPointage.module.css';


const DraggableScoreTable = ({ team, setTeam, gameData, handleScoreChange, handleAbsenceChange, isLoading }) => (
    <div className={styles.roster}>
        <h3>{team.name}</h3>
        <div className={styles.tableContainer}>
        {/* Droppable définit une zone où les éléments Draggable peuvent être déposés. */}
        <Droppable droppableId={String(team.id)}>
            {(provided) => (
                <table className={styles.scoreTable} {...provided.droppableProps} ref={provided.innerRef}>
                    <thead>
                        <tr>
                            <th>#</th>
                            <th>Joueur</th>
                            <th>Partie 1</th>
                            <th>Partie 2</th>
                            <th>Partie 3</th>
                        </tr>
                    </thead>
                    <tbody>
                        {/* Itération sur l'alignement de l'équipe pour créer une ligne par joueur. */}
                        {team.lineup.map((player, index) => (
                            // Draggable rend chaque ligne de joueur déplaçable.
                            <Draggable key={player.playerId} draggableId={String(player.playerId)} index={index}>
                                {(provided, snapshot) => (
                                    <tr
                                        ref={provided.innerRef}
                                        {...provided.draggableProps}
                                        {...provided.dragHandleProps}
                                        // Applique un style visuel lorsque l'élément est en cours de déplacement.
                                        className={snapshot.isDragging ? styles.dragging : ''}
                                    >
                                        <td>{index + 1}</td>
                                        <td>
                                            <span className={styles.playerName}>{player.playerName} <br/> </span>
                                            <span className={styles.playerStats}>
                                                Moy: {player.previousWeekAvg ? player.previousWeekAvg.toFixed(2) : 'N/A'}, <br></br> 
                                                Hcp: {player.previousWeekHcp ? player.previousWeekHcp : 'N/A'}
                                            </span>
                                        </td>
                                        {/* Génération des 3 cellules de pointage pour chaque joueur. */}
                                        {[1, 2, 3].map(gameNumber => {
                                            const key = `${player.playerId}-${gameNumber}`;
                                            const data = gameData[key] || { score: '', isAbsent: false };
                                            return (
                                                <td key={gameNumber}>
                                                    <div className={styles.scoreCell}>
                                                        <input
                                                            type="number"
                                                            min="0"
                                                            max="300"
                                                            className={styles.scoreInput}
                                                            value={data.score}
                                                            onChange={(e) => handleScoreChange(player.playerId, gameNumber, e.target.value)}
                                                            disabled={data.isAbsent || isLoading}
                                                        />
                                                        <label className={styles.absentLabel}>
                                                            <input
                                                                type="checkbox"
                                                                className={styles.absentCheckbox}
                                                                checked={data.isAbsent}
                                                                onChange={(e) => handleAbsenceChange(player.playerId, gameNumber, e.target.checked)}
                                                                disabled={isLoading}
                                                            />
                                                            Absent
                                                        </label>
                                                    </div>
                                                </td>
                                            );
                                        })}
                                    </tr>
                                )}
                            </Draggable>
                        ))}
                        {provided.placeholder} 
                    </tbody>
                </table>
            )}
        </Droppable>
        </div>
    </div>
);

const AdminPage = () => {
    
    const [schedule, setSchedule] = useState([]);
    const [weeks, setWeeks] = useState([]);
    const [selectedWeek, setSelectedWeek] = useState('');
    const [matchupsForWeek, setMatchupsForWeek] = useState([]);
    const [selectedMatchupId, setSelectedMatchupId] = useState('');
    const [team1, setTeam1] = useState({ id: null, name: 'Équipe 1', lineup: [] });
    const [team2, setTeam2] = useState({ id: null, name: 'Équipe 2', lineup: [] });
    const [gameData, setGameData] = useState({});
    const [isLoading, setIsLoading] = useState(false);

 // Pour charger le calendrier et les semaines disponibles.
    useEffect(() => {
        const fetchSchedule = async () => {
            try {
                const response = await fetch(`${process.env.REACT_APP_API_URL}/api/schedule`);
                const data = await response.json();
                setSchedule(data);
                const uniqueDates = [...new Set(data.map(item => item.weekdate))].sort((a, b) => new Date(a) - new Date(b));
                const weekData = uniqueDates.map((date, i) => ({ number: i + 1, date: new Date(date).toLocaleDateString('fr-CA') }));
                setWeeks(weekData);
            } catch (error) { console.error("Error fetching schedule:", error); }
        };
        fetchSchedule();
    }, []);

    // Même recette que pour classement joueurs et équipes.
    useEffect(() => {
        if (selectedWeek) {
            const selectedWeekInfo = weeks.find(w => w.number === parseInt(selectedWeek, 10));
            if (selectedWeekInfo) {
                const targetDate = new Date(selectedWeekInfo.date).toISOString().split('T')[0];
                setMatchupsForWeek(schedule.filter(item => item.weekdate.startsWith(targetDate)));
            }
        } else {
            setMatchupsForWeek([]);
        }
        // Réinitialisation des états dépendants pour éviter d'afficher des données incohérentes.
        setSelectedMatchupId('');
        setTeam1({ id: null, name: 'Équipe 1', lineup: [] });
        setTeam2({ id: null, name: 'Équipe 2', lineup: [] });
        setGameData({});
    }, [selectedWeek, schedule, weeks]);

    //Idem semblable pour charger les détails du match sélectionné.
    useEffect(() => {
        if (!selectedMatchupId) {
            // Nettoyage si aucun match n'est sélectionné.
            setTeam1({ id: null, name: 'Équipe 1', lineup: [] });
            setTeam2({ id: null, name: 'Équipe 2', lineup: [] });
            return;
        }
        const fetchDetails = async () => {
            setIsLoading(true);
            try {
                const response = await fetch(`${process.env.REACT_APP_API_URL}/api/matchup-details/${selectedMatchupId}`);
                const data = await response.json();

                const initialGameData = {};
                let finalLineup1 = [...data.team1.roster];
                let finalLineup2 = [...data.team2.roster];

                // Si des scores existent déjà, on les charge et on réorganise l'alignement selon les positions enregistrées.
                // C'est crucial pour permettre la modification des scores.
                if (data.existingGames.length > 0) {
                    const lineup1Map = new Map(data.team1.roster.map(p => [p.playerId, p]));
                    const lineup2Map = new Map(data.team2.roster.map(p => [p.playerId, p]));
                    
                    const sortedLineup1 = new Array(data.team1.roster.length);
                    const sortedLineup2 = new Array(data.team2.roster.length);

                    data.existingGames.forEach(game => {
                        if (game.lineupposition) {
                            if (lineup1Map.has(game.playerid)) { sortedLineup1[game.lineupposition - 1] = lineup1Map.get(game.playerid); }
                            if (lineup2Map.has(game.playerid)) { sortedLineup2[game.lineupposition - 1] = lineup2Map.get(game.playerid); }
                        }
                        const key = `${game.playerid}-${game.gamenumber}`;
                        initialGameData[key] = { score: game.gamescore !== null ? game.gamescore : '', isAbsent: game.isabsent };
                    });

                    // Fusionne les joueurs triés avec les joueurs restants pour garantir un alignement complet.
                    finalLineup1 = sortedLineup1.filter(p => p).concat(finalLineup1.filter(p => !sortedLineup1.includes(p)));
                    finalLineup2 = sortedLineup2.filter(p => p).concat(finalLineup2.filter(p => !sortedLineup2.includes(p)));
                }
                
                setGameData(initialGameData);
                setTeam1({ ...data.team1, lineup: finalLineup1 });
                setTeam2({ ...data.team2, lineup: finalLineup2 });

            } catch (error) { 
                console.error("Error fetching matchup details:", error); 
            } finally {
                setIsLoading(false);
            }
        };
        fetchDetails();
    }, [selectedMatchupId]);

    // Appelé à la fin d'une opération de drag-and-drop.
    const onDragEnd = (result) => {
        const { source, destination } = result;
        if (!destination || source.droppableId !== destination.droppableId) return; // Annule si le drop est hors zone ou entre deux équipes.

        const isTeam1 = source.droppableId === String(team1.id);
        const team = isTeam1 ? team1 : team2;
        const setTeam = isTeam1 ? setTeam1 : setTeam2;

        // Logique pour réorganiser l'alignement.
        const reorderedLineup = Array.from(team.lineup);
        const [movedItem] = reorderedLineup.splice(source.index, 1);
        reorderedLineup.splice(destination.index, 0, movedItem);

        setTeam(t => ({ ...t, lineup: reorderedLineup }));
    };

    // Gère les changements de score dans les champs de saisie.
    const handleScoreChange = (playerId, gameNumber, score) => {
        const key = `${playerId}-${gameNumber}`;
        const parsedScore = score.replace(/[^0-9]/g, ''); 
        setGameData(prev => ({ ...prev, [key]: { ...prev[key], score: parsedScore, isAbsent: false } }));
    };

    // Gère le cochage/décochage de la case "Absent".
    const handleAbsenceChange = (playerId, gameNumber, isChecked) => {
        const key = `${playerId}-${gameNumber}`;
        setGameData(prev => ({ ...prev, [key]: { score: '', isAbsent: isChecked } }));
    };

    // Gère la soumission de tous les scores du match.
    const handleSubmitScores = async () => {
        setIsLoading(true);
        const scoresToSubmit = [];
        let validationError = null;

        
        const processLineup = (lineup, teamName) => {
            if (validationError) return;
            
            lineup.forEach((player, index) => {
                for (let gameNumber = 1; gameNumber <= 3; gameNumber++) {
                    const key = `${player.playerId}-${gameNumber}`;
                    const game = gameData[key] || { score: '', isAbsent: false };
                    const scoreValue = game.score === '' ? null : parseInt(game.score, 10);

                    if (game.score !== '' && !game.isAbsent && (isNaN(scoreValue) || scoreValue < 0 || scoreValue > 300)) {
                        validationError = `Score invalide pour ${player.playerName}, partie ${gameNumber}. Veuillez entrer un nombre entre 0 et 300.`;
                        return;
                    }

                    // Construction de l'objet à envoyer à l'API.
                    scoresToSubmit.push({
                        matchupId: selectedMatchupId, 
                        playerId: player.playerId, 
                        gameNumber,
                        score: game.isAbsent ? null : scoreValue, 
                        isAbsent: game.isAbsent, 
                        lineupPosition: index + 1 
                    });
                }
            });
        };

        processLineup(team1.lineup, team1.name);
        processLineup(team2.lineup, team2.name);

        if (validationError) {
            alert(validationError);
            setIsLoading(false);
            return;
        }

        // Envoi des données en une seule fois (batch) pour optimiser les appels réseau.
        try {
            const response = await fetch(`${process.env.REACT_APP_API_URL}/api/scores/batch`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(scoresToSubmit)
            });
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Erreur lors de la soumission des scores.');
            }
            alert('Scores soumis avec succès!');
        } catch (error) {
            console.error("Error submitting scores:", error);
            alert(`Erreur: ${error.message}`);
        } finally {
            setIsLoading(false);
        }
    };

    // Rendu de la page.
    return (
        <div className={styles.adminContainer}>
            <h1>Gestion de Match</h1>
            {/* Barre de sélection pour la semaine et le match. */}
            <div className={styles.selectionBar}>
                <select value={selectedWeek} onChange={e => setSelectedWeek(e.target.value)}>
                    <option value="">Sélectionner une semaine</option>
                    {weeks.map(weekInfo => (
                        <option key={weekInfo.number} value={weekInfo.number}>
                            Semaine {weekInfo.number} ({weekInfo.date})
                        </option>
                    ))}
                </select>
                {selectedWeek && (
                    <select value={selectedMatchupId} onChange={e => setSelectedMatchupId(e.target.value)} disabled={!selectedWeek}>
                        <option value="">Sélectionner un match</option>
                        {matchupsForWeek.map(m => <option key={m.matchupid} value={m.matchupid}>{m.team1_name} vs {m.team2_name}</option>)}
                    </select>
                )}
            </div>

            {isLoading && <div className={styles.loader}>Chargement...</div>}

            {/* Le formulaire de scores n'est affiché que si un match est sélectionné et que les données ne sont pas en cours de chargement. */}
            {selectedMatchupId && !isLoading && (
                <div className={styles.scoreForm}>
                    <h2>Alignements et Pointages</h2>
                     <p className={styles.instructionText}>Faites glisser les joueurs pour changer leur position dans l'alignement.</p>  
                    <DragDropContext onDragEnd={onDragEnd}>
                        <div className={styles.rosterColumns}>
                           <DraggableScoreTable 
                                team={team1} 
                                setTeam={setTeam1} 
                                gameData={gameData} 
                                handleScoreChange={handleScoreChange} 
                                handleAbsenceChange={handleAbsenceChange} 
                                isLoading={isLoading} 
                           />
                           <DraggableScoreTable 
                                team={team2} 
                                setTeam={setTeam2} 
                                gameData={gameData} 
                                handleScoreChange={handleScoreChange} 
                                handleAbsenceChange={handleAbsenceChange} 
                                isLoading={isLoading} 
                           />
                        </div>
                    </DragDropContext>
                    <button onClick={handleSubmitScores} className={styles.submitButton} disabled={isLoading || team1.lineup.length !== 5 || team2.lineup.length !== 5}>
                        {isLoading ? 'Soumission...' : 'Soumettre les Alignements et Pointages'}
                    </button>
                </div>
            )}
        </div>
    );
};

export default AdminPage;