import React, { useState, useEffect } from 'react';

function ClassementJoueurs() {
  const [rankings, setRankings] = useState([]);

  useEffect(function() {
    async function fetchRankings() {
      const response = await fetch('http://localhost:3001/api/rankings');
      const data = await response.json();
      setRankings(data);
    }
    fetchRankings();
  }, []);

  return (
    <div>
      <h3>Classement des Joueurs</h3>
      {/* Affichage des données de classement */}
      <pre>{JSON.stringify(rankings, null, 2)}</pre>
    </div>
  );
}

export default ClassementJoueurs;