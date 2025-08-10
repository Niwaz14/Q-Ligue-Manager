import React, { useState, useEffect } from 'react';

function Accueil() {
  
  const [teams, setTeams] = useState([]);

  
  useEffect(function() {
    
    async function fetchTeams() {
      try {
        
        const response = await fetch(`${process.env.REACT_APP_API_URL}/api/teams`); 
        const data = await response.json();
        setTeams(data); 
      } catch (error) {
        console.error("Erreur lors de la récupération des équipes:", error);
      }
    }

    fetchTeams(); 
  }, []); // Le tableau vide [] assure que cela ne se produit qu'une seule fois

  return (
    <div>
      <h1>Bienvenue au Q-Ligue Manager</h1>
      <p>Voici la liste des équipes inscrites pour la saison actuelle.</p>
      
      
      {teams.length > 0 ? (
        <ul>
          
          {teams.map(function(team) {
            return <li key={team.teamid}>{team.teamname}</li>; //Liste équipes
          })}
        </ul>
      ) : (
        <p>Chargement des équipes...</p>
      )}
    </div>
  );
}

export default Accueil;