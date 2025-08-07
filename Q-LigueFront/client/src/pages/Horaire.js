import React, { useState, useEffect } from 'react';

function Horaire() {
    const [schedule, setSchedule] = useState([]);

    useEffect(function() {
        async function fetchSchedule() {
            const response = await fetch('http://localhost:3001/api/schedule');
            const data = await response.json();
            setSchedule(data);
        }
        fetchSchedule();
    }, []);

    return (
        <div>
            <h3>Horaire de la ligue</h3>
            <pre>{JSON.stringify(schedule, null, 2)}</pre>
        </div>
    );
}

export default Horaire;