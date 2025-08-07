import React from 'react';
import { Link, Outlet } from 'react-router-dom';

function SaisonMenu() {
  return (
    <div>
      <h1>Section : Saison</h1>
      <nav style={{ border: '1px solid gray', padding: '0.5rem', marginBottom: '1rem' }}>
        <Link to="classement-joueurs" style={{ marginRight: '15px' }}>Classement Joueurs</Link>
        <Link to="horaire">Horaire</Link>
      </nav>

      <Outlet />
    </div>
  );
}

export default SaisonMenu;