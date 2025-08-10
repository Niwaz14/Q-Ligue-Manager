import React, { useState, useEffect } from 'react';
import styles from './Horaire.module.css'; // Importer notre nouveau fichier de style

function Horaire() {
    const [schedule, setSchedule] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(function() {
        async function fetchSchedule() {
            try {
                const response = await fetch(`${process.env.REACT_APP_API_URL}/api/schedule`);
                const data = await response.json();
                setSchedule(data);
            } catch (error) {
                console.error("Erreur lors de la récupération de l'horaire:", error);
            } finally {
                setLoading(false);
            }
        }
        fetchSchedule();
    }, []);

    if (loading) {
        return <p>Chargement de l'horaire...</p>;
    }

    return (
        <div>
            <h3>Horaire de la ligue</h3>
            <table className={styles.scheduleTable}>
                <thead>
                    <tr>
                        <th>Date</th>
                        <th>Match</th>
                        <th>Allée</th>
                    </tr>
                </thead>
                <tbody>
                    {schedule.map(function(match, index) {
                        const matchDate = new Date(match.weekdate).toLocaleDateString('fr-CA'); // Format de la date en français
                        return (
                            <tr key={index}>
                                <td>{matchDate}</td>
                                <td>
                                    {match.team1_name} 
                                    <span className={styles.vsSeparator}> vs </span> 
                                    {match.team2_name}
                                </td>
                                <td>{match.lanenumber}</td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
}

export default Horaire;