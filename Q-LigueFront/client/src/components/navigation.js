import React, { useState } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import styles from './navigation.module.css';
import { useAuth } from '../context/AuthContext';

const Navigation = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [openSubMenu, setOpenSubMenu] = useState(null);
    const { isAuthenticated, logout } = useAuth();
    const navigate = useNavigate();
    const location = useLocation(); // Obtenir l'objet location

    const toggleMenu = () => {
        setIsOpen(!isOpen);
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
        setOpenSubMenu(openSubMenu === menuName ? null : menuName);
    };

    const closeAllMenus = () => {
        setIsOpen(false);
        setOpenSubMenu(null);
    };

    // Détermine si un lien de classement est actif
    const isClassementActive = location.pathname.startsWith('/classement');

    const getNavLinkClass = ({ isActive }) => {
        return isActive ? `${styles.navLink} ${styles.activeLink}` : styles.navLink;
    };

    return (
        <nav className={styles.navbar}>
            <div className={styles.navContainer}>
                <NavLink to="/" className={styles.navLogo} onClick={closeAllMenus}>Q-Ligue Manager</NavLink>
                
                <div className={styles.menuIcon} onClick={toggleMenu}>
                    &#9776; {/* Icône du menu hamburger */}
                </div>

                <ul className={isOpen ? `${styles.navMenu} ${styles.active}` : styles.navMenu}>
                    <li className={styles.navItem}>
                        <div 
                            className={`${styles.navLink} ${isClassementActive ? styles.activeLink : ''}`}
                            onClick={() => toggleSubMenu('classement')}
                        >
                            Classement
                            <span className={`${styles.arrow} ${openSubMenu === 'classement' ? styles.arrowUp : ''}`}>▼</span>
                        </div>
                        <ul className={`${styles.subMenu} ${openSubMenu === 'classement' ? styles.subMenuOpen : ''}`}>
                            <li><NavLink to="/classement-equipe" className={getNavLinkClass} onClick={closeAllMenus}>Équipe</NavLink></li>
                            <li><NavLink to="/classement-joueurs" className={getNavLinkClass} onClick={closeAllMenus}>Joueurs</NavLink></li>
                        </ul>
                    </li>

                    <li className={styles.navItem}>
                        <NavLink to="/horaire" className={getNavLinkClass} onClick={closeAllMenus}>Horaire</NavLink>
                    </li>
                    
                    {isAuthenticated ? (
                        <>
                            <li className={styles.navItem}>
                                <NavLink to="/admin/dashboard" className={getNavLinkClass} onClick={closeAllMenus}>Admin</NavLink>
                            </li>
                            <li className={styles.navItem}>
                                <div className={styles.navLink} onClick={handleLogout}>Déconnexion</div>
                            </li>
                        </>
                    ) : (
                        <li className={styles.navItem}>
                            <NavLink to="/admin" className={getNavLinkClass} onClick={closeAllMenus}>Admin</NavLink>
                        </li>
                    )}
                </ul>
            </div>
        </nav>
    );
};

export default Navigation;