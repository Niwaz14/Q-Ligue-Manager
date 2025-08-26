import React from 'react';
import { Link } from 'react-router-dom';
import styles from './AdminPage.module.css';

function AdminPage() {
  return (
    <div className={styles.adminPageContainer}>
      <h1>Admin Dashboard</h1>
      <nav>
        <ul className={styles.adminNavList}>
          <li>
            <Link to="/admin/dashboard/entrer-pointage" className={styles.adminNavLink}>
              Entrer/Modifier les Pointages
            </Link>
          </li>
          <li>
            <Link to="/admin/dashboard/match-play" className={styles.adminNavLink}>
              Entrer/Modifier les  Match-Plays
            </Link>
          </li>
        </ul>
      </nav>
    </div>
  );
}

export default AdminPage;
