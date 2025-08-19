import React, { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import styles from './navigation.module.css';
import logo from '../logo.svg';

const Navigation = () => {
    const [menuOpen, setMenuOpen] = useState(false);
    const location = useLocation();

    const handleLinkClick = () => {
        setMenuOpen(false);
    };

    return (
        <header className={styles.header}>
            <NavLink to="/" className={styles.logoContainer} onClick={handleLinkClick}>
                <img src={logo} alt="Q-Ligue Manager Logo" className={styles.logo} />
                <span className={styles.appName}>Q-Ligue Manager</span>
            </NavLink>

            <div className={styles.hamburger} onClick={() => setMenuOpen(!menuOpen)}>
                <span className={styles.bar}></span>
                <span className={styles.bar}></span>
                <span className={styles.bar}></span>
            </div>

            <nav className={`${styles.navMenu} ${menuOpen ? styles.open : ''}`}>
                <ul className={styles.navList}>
                    <li>
                        <NavLink to="/" className={({ isActive }) => isActive ? styles.active : ''} onClick={handleLinkClick} end>
                            Accueil
                        </NavLink>
                    </li>
                    <li className={styles.dropdown}>
                        <a className={location.pathname.startsWith('/saison') ? styles.active : ''}>
                            Saison
                        </a>
                        <ul className={styles.dropdownContent}>
                            <li><NavLink to="/classement-joueurs" onClick={handleLinkClick}>Classement Joueurs</NavLink></li>
                            <li><NavLink to="/classement-equipes" onClick={handleLinkClick}>Classement Équipes</NavLink></li>
                            <li><NavLink to="/horaire" onClick={handleLinkClick}>Horaire</NavLink></li>
                            <li><NavLink to="/bourses" onClick={handleLinkClick}>Bourses</NavLink></li>
                        </ul>
                    </li>
                </ul>
            </nav>
        </header>
    );
};

export default Navigation;