import React from 'react';
import { Link } from 'react-router-dom';

function Navigation() {
  return (
    <nav style={{ padding: '1rem', background: '#f0f0f0', marginBottom: '1rem', borderBottom: '1px solid #ccc' }}>
      <Link to="/" style={{ marginRight: '15px' }}>Accueil</Link>
      <Link to="/saison" style={{ marginRight: '15px' }}>Saison</Link>
      <Link to="/semaine" style={{ marginRight: '15px' }}>Semaine</Link>
      <Link to="/equipe" style={{ marginRight: '15px' }}>Équipe</Link>
      <Link to="/joueur">Joueur</Link>
    </nav>
  );
}

export default Navigation;