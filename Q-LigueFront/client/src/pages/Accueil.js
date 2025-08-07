import React, { useState, useEffect } from 'react';

function Accueil() {
  
  const [teams, setTeams] = useState([]); // État pour stocker les équipes


  useEffect(function() {
    
    async function fetchTeams() {
      try {
        // On fait une requête pour récupérer les équipes depuis l'API
        const response = await fetch('http://localhost:3001/api/teams'); 
        const data = await response.json();
        setTeams(data); // On met à jour l'état avec les équipes reçues
      } catch (error) {
        console.error("Erreur lors de la récupération des équipes:", error);
      }
    }

    fetchTeams(); // On appelle la fonction
  }, []); // Pour le faire que cette fonction ne s'exécute qu'une seule fois au chargement du composant

  return (
    <div>
      <h1>Bienvenue sur Q-Ligue Manager ! </h1>
      <p>Voici la liste des équipes inscrites pour la saison actuelle.</p>
      
      {teams.length > 0 ? (
        <ul>
          {/* On parcourt le tableau des équipes et on crée un élément de liste pour chacune */}
          {teams.map(function(team) {
            return <li key={team.teamid}>{team.teamname}</li>;
          })}
        </ul>
      ) : (
        <p>Chargement des équipes...</p>
      )}
    </div>
  );
}

export default Accueil;