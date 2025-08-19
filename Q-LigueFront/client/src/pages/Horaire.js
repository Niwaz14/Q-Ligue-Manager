import React, { useState, useEffect } from 'react';
import styles from './Horaire.module.css';

const Horaire = () => {
    const [scheduleByWeek, setScheduleByWeek] = useState({});
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchSchedule = async () => {
            try {
                const response = await fetch(`${process.env.REACT_APP_API_URL}/api/schedule`);
                const data = await response.json();

                
                const groupedSchedule = data.reduce((acc, matchup) => {
                    const weekDate = new Date(matchup.weekdate).toLocaleDateString('fr-CA', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                    });
                    if (!acc[weekDate]) {
                        acc[weekDate] = [];
                    }
                    acc[weekDate].push(matchup);
                    return acc;
                }, {});

                setScheduleByWeek(groupedSchedule);
            } catch (error) {
                console.error("Erreur lors de la récupération de l'horaire:", error);
            } finally {
                setIsLoading(false); 
            }
        };

        fetchSchedule();
    }, []); 

    if (isLoading) {
        return <div>Chargement de l'horaire...</div>;
    }

    return (
        <div className={styles.scheduleContainer}>
            <h1>Horaire de la saison</h1>
            {Object.entries(scheduleByWeek).map(([date, matchups]) => (
                <div key={date} className={styles.weekBlock}>
                    <h2>Semaine du {date}</h2>
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
                            {matchups.map((match) => (
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
            ))}
        </div>
    );
};

export default Horaire;