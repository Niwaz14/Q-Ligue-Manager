import React, { useState, useEffect } from 'react';
import styles from './AdminPage.module.css';

function AdminPage() {
  
  const [allMatchups, setAllMatchups] = useState([]);
  const [weeks, setWeeks] = useState([]);
  const [selectedWeek, setSelectedWeek] = useState('');
  const [filteredMatchups, setFilteredMatchups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedMatchupId, setSelectedMatchupId] = useState('');
  const [scores, setScores] = useState({}); 
  const [players, setPlayers] = useState([]); 
  const [isScoresLoading, setIsScoresLoading] = useState(false);
  const [team1, setTeam1] = useState({ name: '', players: [] });
  const [team2, setTeam2] = useState({ name: '', players: [] });


  useEffect(function() { 
    async function fetchData() {
      try {
        const response = await fetch(`${process.env.REACT_APP_API_URL}/api/schedule`);
        const data = await response.json();
        const uniqueWeeks = [...new Set(data.map(match => match.weekdate))];
        setWeeks(uniqueWeeks);
        setAllMatchups(data);
      } catch (error) {
        console.error("Erreur: Impossible de charger le calendrier", error);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  function handleWeekChange(event) { // Fonction pour gérer le changement de semaine
    const week = event.target.value;
    setSelectedWeek(week);
    const matchupsForWeek = allMatchups.filter(match => match.weekdate === week);
    setFilteredMatchups(matchupsForWeek);
    setSelectedMatchupId(''); // Réinitialiser la sélection de match
    
    setTeam1({ name: '', players: [] }); 
    setTeam2({ name: '', players: [] });
  }

  
  async function handleMatchupChange(event) {
    const matchupId = event.target.value;
    setSelectedMatchupId(matchupId);

    if (!matchupId) {
      
      setTeam1({ name: '', players: [] });
      setTeam2({ name: '', players: [] });
      return;
    }

    setIsScoresLoading(true);
    try {
      const response = await fetch(`${process.env.REACT_APP_API_URL}/api/matchups/${matchupId}`);
      const data = await response.json();
      
      
      // On retrouve les noms des équipes depuis la liste des matchs qu'on a déjà
      const currentMatchup = filteredMatchups.find(m => m.matchupid == matchupId);
      const team1Name = currentMatchup.team1_name;
      const team2Name = currentMatchup.team2_name;

      // On filtre la liste complète des joueurs pour créer nos deux équipes
      const team1Players = data.filter(p => p.teamname === team1Name && data.findIndex(i => i.playerid === p.playerid) === data.indexOf(p));
      const team2Players = data.filter(p => p.teamname === team2Name && data.findIndex(i => i.playerid === p.playerid) === data.indexOf(p));
      
      setTeam1({ name: team1Name, players: team1Players });
      setTeam2({ name: team2Name, players: team2Players });
      
      // On transforme les données pour avoir le bon format pour les scores
      const initialScores = {};
      data.forEach(player => {
        if (!initialScores[player.playerid]) {
          initialScores[player.playerid] = {};
        }
        initialScores[player.playerid][`game${player.gamenumber}`] = player.gamescore || '';
      });
      setScores(initialScores);

    } catch (error) {
      console.error("Erreur lors de la récupération des scores:", error);
    } finally {
      setIsScoresLoading(false);
    }
  }

  // fonction pour gérer la modification d'un score
  function handleScoreChange(playerId, gameNumber, value) {
   
    if (value.length > 3) return;

    setScores(prevScores => ({
      ...prevScores,
      [playerId]: {
        ...prevScores[playerId],
        [`game${gameNumber}`]: value === '' ? '' : parseInt(value, 10),
      },
    }));
  }

  // fonction pour gérer la soumission du formulaire
  async function handleSubmit(event) {
    event.preventDefault();
    if (!selectedMatchupId) {
      alert("Veuillez sélectionner un match.");
      return;
    }
    try {
      const response = await fetch(`${process.env.REACT_APP_API_URL}/api/scores/batch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scores, matchupId: selectedMatchupId }),
      });
      if (response.ok) {
        alert('Scores enregistrés avec succès !');
      } else {
        alert("Erreur lors de l'enregistrement des scores.");
      }
    } catch (error) {
      console.error("Erreur lors de la soumission des scores:", error);
      alert("Une erreur s'est produite.");
    }
  }
  
  // fonction réutilisable pour afficher les champs de score d'une équipe
  const renderScoreInputsForTeam = (team) => {
    // S'il n'y a pas de joueurs, on n'affiche rien.
    if (!team || !team.players || team.players.length === 0) return null;
    
    return (
      <div className={styles.teamSection}>
        <h4>{team.name}</h4>
        {team.players.map(player => {
            // On s'assure d'avoir un objet de score pour ce joueur, même s'il est vide
            const playerScores = scores[player.playerid] || {};
            return (
              <div key={player.playerid} className={styles.scoreInput}>
                <label>{player.playername}</label>
                <div>
                  {[1, 2, 3].map(gameNum => {
                    const scoreValue = playerScores[`game${gameNum}`] || '';
                    // Valider si le score est > 300 pour le style
                    const isInvalidScore = scoreValue > 300;
                    return (
                      <input
                        key={gameNum}
                        type="number"
                        inputMode="numeric"
                        className={`${styles.scoreInputField} ${isInvalidScore ? styles.invalidScore : ''}`}
                        placeholder={`Partie ${gameNum}`}
                        value={scoreValue}
                        onChange={(e) => handleScoreChange(player.playerid, gameNum, e.target.value)}
                      />
                    );
                  })}
                </div>
              </div>
            );
        })}
      </div>
    );
  };


  if (loading) { return <p>Chargement...</p>; }

  return (
    <div className={styles.formContainer}>
      <h1>Admin - Entrée des pointages</h1>
      <form onSubmit={handleSubmit}>
        {/* Sélection de la semaine */}
        <div className={styles.formGroup}>
          <label htmlFor="week-select">1. Choisir une semaine :</label>
          <select id="week-select" value={selectedWeek} onChange={handleWeekChange}>
            <option value="">-- Sélectionnez une semaine --</option>
            {weeks.map((weekDate, index) => {
              const displayDate = new Date(weekDate).toLocaleDateString('fr-CA');
              return <option key={index} value={weekDate}>{displayDate}</option>;
            })}
          </select>
        </div>

        {selectedWeek && (
          <div className={styles.formGroup}>
            <label htmlFor="matchup-select">2. Choisir un match :</label> {/* Sélection du match */}
            <select id="matchup-select" value={selectedMatchupId} onChange={handleMatchupChange}>
              <option value="">-- Sélectionnez un match --</option>
              {filteredMatchups.map((match) => (
                <option key={match.matchupid} value={match.matchupid}>
                  {match.team1_name} vs {match.team2_name} (Allée {match.lanenumber})
                </option>
              ))}
            </select>
          </div>
        )}

        
        {isScoresLoading && <p>Chargement des joueurs...</p>} 
        {/* Affichage des scores si un match est sélectionné */}
        {team1.players.length > 0 && (
          <div className={styles.scoresSection}>
            <h3>3. Entrer les scores</h3>
            {renderScoreInputsForTeam(team1)}
            {renderScoreInputsForTeam(team2)}
            <button type="submit" className={styles.submitButton}>Enregistrer les scores</button>
          </div>
        )}
      </form>
    </div>
  );
}

export default AdminPage;