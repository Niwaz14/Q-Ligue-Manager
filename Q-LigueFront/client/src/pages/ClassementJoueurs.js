import React, { useState, useEffect } from 'react';

function ClassementJoueurs() {
  const [rankings, setRankings] = useState([]);
  const [loading, setLoading] = useState(true); 
  useEffect(function() {
    async function fetchRankings() {
      try {
        const response = await fetch(`${process.env.REACT_APP_API_URL}/api/rankings`);
        const data = await response.json();
        setRankings(data);
      } catch (error) {
        console.error("Erreur lors de la récupération du classement des joueurs:", error);
      } finally {
        setLoading(false); 
      }
    }

    fetchRankings();
  }, []);

  
  if (loading) {
    return <p>Chargement du classement des joueurs...</p>;
  }

  // Affichage du classement des joueurs
  return (
    <div>
      <h3>Classement des Joueurs</h3>
      <table border="1" style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th>Joueur</th>
            <th>Équipe</th>
            <th>Parties Jouées</th>
            <th>Score Total</th>
            <th>Moyenne</th>
          </tr>
        </thead>
        <tbody>
          {rankings.map(function(player) {
            return (
              <tr key={player.playercode}>
                <td>{player.playername}</td>
                <td>{player.teamname}</td>
                <td>{player.gamesplayed}</td>
                <td>{player.totalscore}</td>
                <td>{player.averagescore}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default ClassementJoueurs;