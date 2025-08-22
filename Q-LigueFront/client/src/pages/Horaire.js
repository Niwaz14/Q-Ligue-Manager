import React, { useState, useEffect, useMemo } from 'react';
import styles from './Horaire.module.css';

const Horaire = () => {
    const [schedule, setSchedule] = useState([]);
    const [weeks, setWeeks] = useState([]);
    const [teams, setTeams] = useState([]);
    const [selectedWeek, setSelectedWeek] = useState('');
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchSchedule = async () => {
            try {
                const response = await fetch(`${process.env.REACT_APP_API_URL}/api/schedule`);
                const data = await response.json();
                setSchedule(data);

                const uniqueWeeks = [...new Map(data.map(item => [item.weekid, { weekid: item.weekid, weekdate: item.weekdate }])).values()]
                    .sort((a, b) => a.weekid - b.weekid);
                setWeeks(uniqueWeeks);

                const allTeams = data.reduce((acc, { team1_id, team1_name, team2_id, team2_name }) => {
                    if (!acc.has(team1_id)) acc.set(team1_id, team1_name);
                    if (!acc.has(team2_id)) acc.set(team2_id, team2_name);
                    return acc;
                }, new Map());
                
                const sortedTeams = Array.from(allTeams.entries()).map(([id, name]) => ({ id, name })).sort((a, b) => a.id - b.id);

                setTeams(sortedTeams);

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

    const filteredMatchups = useMemo(() => {
        return schedule.filter(match => match.weekid === parseInt(selectedWeek));
    }, [schedule, selectedWeek]);

    const upcomingMatchups = useMemo(() => {
        if (!selectedWeek) return [];
        const currentWeekNumber = parseInt(selectedWeek);
        const nextWeek1 = currentWeekNumber + 1;
        const nextWeek2 = currentWeekNumber + 2;

        return teams.map(team => {
            const findMatchup = (weekNum) => {
                const match = schedule.find(m => m.weekid === weekNum && (m.team1_id === team.id || m.team2_id === team.id));
                if (!match) return { opponent: 'N/A', lane: 'N/A' };
                const opponent = match.team1_id === team.id ? match.team2_name : match.team1_name;
                return { opponent, lane: match.lanenumber };
            };

            return {
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

            {filteredMatchups.length > 0 && (
                <div className={styles.weekBlock}>
                    <h2>Matchs de la semaine {selectedWeek}</h2>
                    <table className={styles.scheduleTable}>
                        <thead>
                            <tr>
                                <th>Équipe #1</th>
                                <th>Contre</th>
                                <th>Équipe #2</th>
                                <th>Allée</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredMatchups.map((match) => (
                                <tr key={match.matchupid}>
                                    <td className={styles.teamName}>{match.team1_name}</td>
                                    <td className={styles.vs}>vs</td>
                                    <td className={styles.teamName}>{match.team2_name}</td>
                                    <td>{match.lanenumber}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {upcomingMatchups.length > 0 && (
                <div className={styles.upcomingBlock}>
                    <h2>Prochains Matchs</h2>
                    <table className={styles.upcomingTable}>
                        <thead>
                            <tr>
                                <th>Équipe</th>
                                <th>Prochain adversaire (Semaine {parseInt(selectedWeek) + 1})</th>
                                <th>Allée</th>
                                <th>Adversaire suivant (Semaine {parseInt(selectedWeek) + 2})</th>
                                <th>Allée</th>
                            </tr>
                        </thead>
                        <tbody>
                            {upcomingMatchups.map((team) => (
                                <tr key={team.teamName}>
                                    <td>{team.teamName}</td>
                                    <td>{team.next1.opponent}</td>
                                    <td>{team.next1.lane}</td>
                                    <td>{team.next2.opponent}</td>
                                    <td>{team.next2.lane}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
};

export default Horaire;
