import React from 'react';

import { Link } from 'react-router-dom';
import styles from './navigation.module.css'; 

function Navigation() {
  
  return (
    <nav className={styles.navbar}>
      <Link to="/" className={styles.navLink}>Accueil</Link>
      <Link to="/saison" className={styles.navLink}>Saison</Link>
      <Link to="/semaine" className={styles.navLink}>Semaine</Link>
      <Link to="/equipe" className={styles.navLink}>Équipe</Link>
      <Link to="/joueur" className={styles.navLink}>Joueur</Link>
    </nav>
  );
}

export default Navigation;