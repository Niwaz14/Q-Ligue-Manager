import React, { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import styles from './navigation.module.css';
import { useAuth } from '../context/AuthContext';

const Navigation = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [openSubMenu, setOpenSubMenu] = useState(null);
    const { isAuthenticated, logout } = useAuth();
    const navigate = useNavigate();

    const toggleMenu = () => {
        setIsOpen(!isOpen);
        // Si le menu principal est en cours de fermeture, fermer également tous les sous-menus ouverts
        if (isOpen) {
            setOpenSubMenu(null);
        }
    };

    const handleLogout = () => {
        logout();
        closeAllMenus();
        navigate('/');
    };
    
    const toggleSubMenu = (menuName) => {
        // Si le sous-menu cliqué est déjà ouvert, le fermer. Sinon, l'ouvrir.
        setOpenSubMenu(openSubMenu === menuName ? null : menuName);
    };

    const closeAllMenus = () => {
        setIsOpen(false);
        setOpenSubMenu(null);
    };

    return (
        <nav className={styles.navbar}>
            <div className={styles.navContainer}>
                <NavLink to="/" className={styles.navLogo} onClick={closeAllMenus}>Q-Ligue Manager</NavLink>
                
                <div className={styles.menuIcon} onClick={toggleMenu}>
                    &#9776; {/* Icône du menu hamburger */}
                </div>

                {/* Cette seule liste UL est utilisée pour le bureau et le mobile */}
                <ul className={isOpen ? `${styles.navMenu} ${styles.active}` : styles.navMenu}>
                    <li className={styles.navItem}>
                        <div className={styles.navLink} onClick={() => toggleSubMenu('classement')}>
                            Classement
                            <span className={`${styles.arrow} ${openSubMenu === 'classement' ? styles.arrowUp : ''}`}>▼</span>
                        </div>
                        <ul className={`${styles.subMenu} ${openSubMenu === 'classement' ? styles.subMenuOpen : ''}`}>
                            <li><NavLink to="/classement-equipe" className={styles.subNavLink} onClick={closeAllMenus}>Équipe</NavLink></li>
                            <li><NavLink to="/classement-joueurs" className={styles.subNavLink} onClick={closeAllMenus}>Joueurs</NavLink></li>
                        </ul>
                    </li>

                    <li className={styles.navItem}>
                        <NavLink to="/horaire" className={styles.navLink} onClick={closeAllMenus}>Horaire</NavLink>
                    </li>
                    
                    {isAuthenticated ? (
                        <>
                            <li className={styles.navItem}>
                                <NavLink to="/admin/dashboard" className={styles.navLink} onClick={closeAllMenus}>Admin</NavLink>
                            </li>
                            <li className={styles.navItem}>
                                <div className={styles.navLink} onClick={handleLogout}>Déconnexion</div>
                            </li>
                        </>
                    ) : (
                        <li className={styles.navItem}>
                            <NavLink to="/admin" className={styles.navLink} onClick={closeAllMenus}>Admin</NavLink>
                        </li>
                    )}
                </ul>
            </div>
        </nav>
    );
};

export default Navigation;