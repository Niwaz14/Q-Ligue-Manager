import React, { useState, useEffect } from 'react';
import styles from './Accueil.module.css';

function Accueil() {
  const [teams, setTeams] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(function() {
    async function fetchTeams() {
      setIsLoading(true);
      setError(null);
      try {
        const response = await fetch(`${process.env.REACT_APP_API_URL}/api/teams`);
        if (!response.ok) {
          throw new Error(`La réponse du serveur est incorrect: (${response.status})`);
        }
        const data = await response.json();
        setTeams(data);
      } catch (error) {
        console.error("Erreur lors de la récupération des équipes:", error);
        setError(error.message);
      } finally {
        setIsLoading(false);
      }
    }

    fetchTeams();
  }, []);

  const renderContent = () => {
    if (isLoading) {
      return <p>Chargement des équipes...</p>;
    }
    if (error) {
      return <p style={{ color: 'red' }}>Erreur de chargement: {error}</p>;
    }
    if (teams.length === 0) {
      return <p>Aucune équipe n'a été trouvée pour la saison.</p>;
    }
    return (
      <ul className={styles.teamList}>
        {teams.map(function(team) {

          return <li key={team.TeamID}>{team.TeamName}</li>;
        })}
      </ul>
    );
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1>Bienvenue sur Q-Ligue Manager</h1>
        <p>Voici la liste des équipes inscrites pour la saison actuelle.</p>
      </div>
      
      {renderContent()}
    </div>
  );
}

export default Accueil;