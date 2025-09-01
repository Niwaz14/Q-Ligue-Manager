import React, { useState, useEffect, useMemo } from 'react';
import styles from './Horaire.module.css';

const Horaire = () => {
    // Gestion d'état pour le calendrier, les listes de semaines et d'équipes, la sélection et le chargement.
    const [schedule, setSchedule] = useState([]);
    const [weeks, setWeeks] = useState([]);
    const [teams, setTeams] = useState([]);
    const [selectedWeek, setSelectedWeek] = useState('');
    const [isLoading, setIsLoading] = useState(true);

    // Pour charger les données du calendrier.
    useEffect(() => {
        const fetchSchedule = async () => {
            try {
                const response = await fetch(`${process.env.REACT_APP_API_URL}/api/schedule`);
                const data = await response.json();
                setSchedule(data);

                // Traitement des données brutes pour créer des listes uniques et triées.
                const uniqueWeeks = [...new Map(data.map(item => [item.weekid, { weekid: item.weekid, weekdate: item.weekdate }])).values()]
                    .sort((a, b) => a.weekid - b.weekid);
                setWeeks(uniqueWeeks);
                
                // Extraction de la liste de toutes les équipes à partir des matchs.
                const allTeams = data.reduce((acc, { team1_id, team1_name, team2_id, team2_name }) => {
                    if (!acc.has(team1_id)) acc.set(team1_id, team1_name);
                    if (!acc.has(team2_id)) acc.set(team2_id, team2_name);
                    return acc;
                }, new Map());
                
                const sortedTeams = Array.from(allTeams.entries()).map(([id, name]) => ({ id, name })).sort((a, b) => a.id - b.id);
                setTeams(sortedTeams);

                // Sélectionne la première semaine par défaut.
                if (uniqueWeeks.length > 0) {
                    setSelectedWeek(uniqueWeeks[0].weekid);
                }
            } catch (error) {
                console.error("Erreur lors de la récupération de l'horaire:", error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchSchedule();
    }, []);

    // On filtre les matchs pour n'afficher que ceux de la semaine sélectionnée.
    const filteredMatchups = useMemo(() => {
        if (!selectedWeek) return [];
        return schedule.filter(match => match.weekid === parseInt(selectedWeek));
    }, [schedule, selectedWeek]);

    // On détermine les prochains adversaires pour chaque équipe pour les deux semaines suivantes.
    const upcomingMatchups = useMemo(() => {
        if (!selectedWeek || teams.length === 0) return [];
        const currentWeekNumber = parseInt(selectedWeek);
        const nextWeek1 = currentWeekNumber + 1;
        const nextWeek2 = currentWeekNumber + 2;

        return teams.map(team => {
            const findMatchup = (weekNum) => {
                const match = schedule.find(m => m.weekid === weekNum && (m.team1_id === team.id || m.team2_id === team.id));
                if (!match) return { opponentName: 'N/A', opponentId: null, lane: 'N/A' };
                
                const isTeam1 = match.team1_id === team.id;
                const opponentName = isTeam1 ? match.team2_name : match.team1_name;
                const opponentId = isTeam1 ? match.team2_id : match.team1_id;

                return { opponentName, opponentId, lane: match.lanenumber };
            };

            return {
                teamId: team.id,
                teamName: team.name,
                next1: findMatchup(nextWeek1),
                next2: findMatchup(nextWeek2),
            };
        });
    }, [schedule, selectedWeek, teams]);

    if (isLoading) {
        return <div>Chargement de l'horaire...</div>;
    }

    return (
        <div className={styles.container}>
            <div className={styles.header}>
                <h1>Horaire de la saison</h1>
                <div className={styles.weekSelectorContainer}>
                    <label htmlFor="week-selector">Semaine: </label>
                    <select id="week-selector" value={selectedWeek} onChange={e => setSelectedWeek(e.target.value)} className={styles.weekSelector}>
                        {weeks.map(week => (
                            <option key={week.weekid} value={week.weekid}>
                                Semaine {week.weekid} ({new Date(week.weekdate).toLocaleDateString('fr-CA')})
                            </option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Affichage des matchs de la semaine sélectionnée */}
            {filteredMatchups.length > 0 && (
                <div className={styles.weekBlock}>
                    <h2>Matchs de la semaine {selectedWeek}</h2>
                    <div className={styles.tableContainer}>
                        <table className={styles.scheduleTable}>
                            <thead>
                                <tr>
                                    <th>Équipe #1</th>
                                    <th></th>
                                    <th>Équipe #2</th>
                                    <th>Allée</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredMatchups.map((match) => (
                                    <tr key={match.matchupid}>
                                        <td className={styles.teamName}>#{match.team1_id}<span className={styles.desktopOnly}> - {match.team1_name}</span></td>
                                        <td className={styles.vs}>vs</td>
                                        <td className={styles.teamName}>#{match.team2_id}<span className={styles.desktopOnly}> - {match.team2_name}</span></td>
                                        <td>{match.lanenumber}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Section pour les matchs à venir, avec une gestion d'affichage responsive. */}
            {upcomingMatchups.length > 0 && (
                <div className={styles.upcomingBlock}>
                    <h2>Prochaines Semaines</h2>
                    
                    {/* Tableau optimisé pour les grands écrans. */}
                    <div className={`${styles.tableContainer} ${styles.desktopOnlyTable}`}>
                        <table className={styles.upcomingTable}>
                            <thead>
                                <tr>
                                    <th>Équipe</th>
                                    <th className={styles.separatorLeft}>Prochain adversaire<span className={styles.desktopOnly}> (Semaine {parseInt(selectedWeek) + 1})</span></th>
                                    <th>Allée</th>
                                    <th className={styles.separatorLeft}>Adversaire suivant<span className={styles.desktopOnly}> (Semaine {parseInt(selectedWeek) + 2})</span></th>
                                    <th>Allée</th>
                                </tr>
                            </thead>
                            <tbody>
                                {upcomingMatchups.map((team) => (
                                    <tr key={team.teamId}>
                                        <td className={styles.teamName}>#{team.teamId}<span className={styles.desktopOnly}> - {team.teamName}</span></td>
                                        <td className={styles.separatorLeft}>{team.next1.opponentId ? `#${team.next1.opponentId}` : ''}<span className={styles.desktopOnly}>{team.next1.opponentId ? ` - ${team.next1.opponentName}` : 'N/A'}</span></td>
                                        <td>{team.next1.lane}</td>
                                        <td className={styles.separatorLeft}>{team.next2.opponentId ? `#${team.next2.opponentId}` : ''}<span className={styles.desktopOnly}>{team.next2.opponentId ? ` - ${team.next2.opponentName}` : 'N/A'}</span></td>
                                        <td>{team.next2.lane}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Pour les petits écrans, on divise l'information en deux tableaux distincts pour une meilleure lisibilité. */}
                    <div className={styles.mobileOnlyTables}>
                        <h3 className={styles.mobileTableHeader}>Prochain adversaire (Semaine {parseInt(selectedWeek) + 1})</h3>
                        <div className={styles.tableContainer}>
                            <table className={styles.upcomingTable}>
                                <thead><tr><th>Équipe</th><th>Adversaire</th><th>Allée</th></tr></thead>
                                <tbody>
                                    {upcomingMatchups.map((team) => (
                                        <tr key={`${team.teamId}-next1`}>
                                            <td className={styles.teamName}>#{team.teamId}</td>
                                            <td>{team.next1.opponentId ? `#${team.next1.opponentId}` : 'N/A'}</td>
                                            <td>{team.next1.lane}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        <h3 className={styles.mobileTableHeader}>Adversaire suivant (Semaine {parseInt(selectedWeek) + 2})</h3>
                        <div className={styles.tableContainer}>
                            <table className={styles.upcomingTable}>
                                <thead><tr><th>Équipe</th><th>Adversaire</th><th>Allée</th></tr></thead>
                                <tbody>
                                    {upcomingMatchups.map((team) => (
                                        <tr key={`${team.teamId}-next2`}>
                                            <td className={styles.teamName}>#{team.teamId}</td>
                                            <td>{team.next2.opponentId ? `#${team.next2.opponentId}` : 'N/A'}</td>
                                            <td>{team.next2.lane}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}
            
            {/* La légende des équipes. */}
            {teams.length > 0 && (
                <div className={styles.legendContainer}>
                    <h3>Légende des équipes</h3>
                    <ul className={styles.legendList}>
                        {teams.map(team => (
                            <li key={team.id}><b>#{team.id}:</b> {team.name}</li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    );
};

export default Horaire;