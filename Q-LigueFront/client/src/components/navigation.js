import React, { useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import logo from '../logo.png';
import { 
    AppBar, Box, Toolbar, IconButton, Typography, Button, Drawer, 
    List, ListItem, ListItemButton, ListItemText, Menu, MenuItem, Collapse
} from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import ExpandLess from '@mui/icons-material/ExpandLess';
import ExpandMore from '@mui/icons-material/ExpandMore';
import styles from './navigation.module.css';

function Navigation() {
    // Récupération de l'état d'authentification et de la fonction déconnexion.
    const { isAuthenticated, logout } = useAuth();
    const location = useLocation();
    const navigate = useNavigate();
    const [mobileOpen, setMobileOpen] = useState(false); // Gère l'ouverture du menu latéral sur mobile.
    const [anchorEl, setAnchorEl] = useState(null); // Point d'ancrage pour les menus déroulants sur desktop.
    const [openMenu, setOpenMenu] = useState(null); // Indique quel menu déroulant est ouvert.
    const [mobileSubMenuOpen, setMobileSubMenuOpen] = useState(null); // Gère les sous-menus dans le menu mobile.

    // Ouvre ou ferme le menu latéral sur mobile.
    const handleDrawerToggle = () => setMobileOpen(!mobileOpen);
    
    // Gère l'ouverture des menus déroulants sur bureau.
    const handleMenuClick = (event, menuName) => {
        setAnchorEl(event.currentTarget);
        setOpenMenu(menuName);
    };

    // Gère la fermeture des menus déroulants.
    const handleMenuClose = () => {
        setAnchorEl(null);
        setOpenMenu(null);
    };

    // Gère l'ouverture/fermeture des sous-menus dans le menu mobile.
    const handleMobileSubMenuToggle = (menuName) => {
        setMobileSubMenuOpen(prev => (prev === menuName ? null : menuName));
    };

    // Fonction utilitaire pour fermer tous les menus, utile lors d'une navigation.
    const closeAllMenusAndDrawers = () => {
        handleMenuClose();
        if (mobileOpen) handleDrawerToggle();
    };

    // Gère la déconnexion de l'utilisateur.
    const handleLogout = () => {
        logout();
        closeAllMenusAndDrawers();
        navigate('/'); // Redirige vers l'accueil après la déconnexion.
    };

    // Logique pour déterminer si un des liens d'un menu déroulant ou navigation est actif.
    const isClassementActive = location.pathname.startsWith('/classement');
    const isMatchPlayActive = location.pathname.startsWith('/matchplay'); 

 
    // Le style est mis en inline pour éviter les problèmes de CSS avec MUI.
    const drawer = (
        <Box sx={{ textAlign: 'center', padding: 2 }}>
            <Typography variant="h6" sx={{ marginBottom: 2 }}>Q-Ligue Manager</Typography>
            <List>
                <ListItem disablePadding component={NavLink} to="/" onClick={closeAllMenusAndDrawers} sx={{ color: 'inherit', textDecoration: 'none' }}>
                    <ListItemButton><ListItemText primary="Accueil" /></ListItemButton>
                </ListItem>

                <ListItemButton onClick={() => handleMobileSubMenuToggle('classement')}>
                    <ListItemText primary="Classement" />
                    {mobileSubMenuOpen === 'classement' ? <ExpandLess /> : <ExpandMore />}
                </ListItemButton>
                <Collapse in={mobileSubMenuOpen === 'classement'} timeout="auto" unmountOnExit>
                    <List component="div" disablePadding>
                        <ListItem disablePadding component={NavLink} to="/classement-equipe" onClick={closeAllMenusAndDrawers} sx={{ color: 'inherit', textDecoration: 'none', pl: 4 }}>
                            <ListItemButton><ListItemText primary="Équipes" /></ListItemButton>
                        </ListItem>
                        <ListItem disablePadding component={NavLink} to="/classement-joueurs" onClick={closeAllMenusAndDrawers} sx={{ color: 'inherit', textDecoration: 'none', pl: 4 }}>
                            <ListItemButton><ListItemText primary="Joueurs" /></ListItemButton>
                        </ListItem>
                    </List>
                </Collapse>

                <ListItemButton onClick={() => handleMobileSubMenuToggle('match-play')}>
                    <ListItemText primary="Match-Play" />
                    {mobileSubMenuOpen === 'match-play' ? <ExpandLess /> : <ExpandMore />}
                </ListItemButton>
                <Collapse in={mobileSubMenuOpen === 'match-play'} timeout="auto" unmountOnExit>
                    <List component="div" disablePadding>
                        <ListItem disablePadding component={NavLink} to="/matchplay-qualification" onClick={closeAllMenusAndDrawers} sx={{ color: 'inherit', textDecoration: 'none', pl: 4 }}>
                            <ListItemButton><ListItemText primary="Qualification M-P" /></ListItemButton>
                        </ListItem>
                        <ListItem disablePadding component={NavLink} to="/matchplay-games" onClick={closeAllMenusAndDrawers} sx={{ color: 'inherit', textDecoration: 'none', pl: 4 }}>
                            <ListItemButton><ListItemText primary="Résultats M-P" /></ListItemButton>
                        </ListItem>
                    </List>
                </Collapse>

                <ListItem disablePadding component={NavLink} to="/horaire" onClick={closeAllMenusAndDrawers} sx={{ color: 'inherit', textDecoration: 'none' }}>
                    <ListItemButton><ListItemText primary="Horaire" /></ListItemButton>
                </ListItem>

                {isAuthenticated ? (
                    <Box sx={{ border: '1px solid rgba(0,0,0,0.12)', margin: '8px 0', borderRadius: '4px' }}>
                        <ListItem disablePadding component={NavLink} to="/admin/dashboard" onClick={closeAllMenusAndDrawers} sx={{ color: 'inherit', textDecoration: 'none' }}>
                           <ListItemButton sx={{ justifyContent: 'center' }}><ListItemText primary="Admin" /></ListItemButton>
                        </ListItem>
                        <ListItem disablePadding onClick={handleLogout}>
                           <ListItemButton sx={{ justifyContent: 'center' }}>
                               <ListItemText 
                                   primary="Déconnexion" 
                                   sx={{ color: 'var(--accent-red)' }} 
                                />
                            </ListItemButton>
                        </ListItem>
                    </Box>
                ) : (
                    <ListItem disablePadding component={NavLink} to="/admin" onClick={closeAllMenusAndDrawers} sx={{ color: 'inherit', textDecoration: 'none' }}>
                        <ListItemButton><ListItemText primary="Admin" /></ListItemButton>
                    </ListItem>
                )}
            </List>
        </Box>
    );

    // Rendu principal de la barre de navigation.
    return (
        <Box className={styles.root} sx={{ display: 'flex' }}>
            <AppBar component="nav" sx={{ backgroundColor: 'var(--primary-dark)' }}>
                <Toolbar>
                    <Box component="img" src={logo} alt="Q-Ligue Manager Logo" sx={{ height: { xs: '50px', sm: '100px' }, margin: '15px' }} />
                    <Box sx={{ flexGrow: 1 }} />
                    
                    {/* Section pour les grands écrans*/}
                    <Box sx={{ display: { xs: 'none', sm: 'block' } }}>
                        <Button component={NavLink} to="/" sx={{ color: 'var(--nav-button-text-color)', '&.active': { backgroundColor: 'var(--nav-active-bg-color)' } }}>Accueil</Button>
                        
                        <Button onClick={(e) => handleMenuClick(e, 'classement')} sx={{ color: 'var(--nav-button-text-color)', ...(isClassementActive && { backgroundColor: 'var(--nav-active-bg-color)' }) }}>Classement</Button>
                        <Menu anchorEl={anchorEl} open={openMenu === 'classement'} onClose={handleMenuClose}>
                            <MenuItem onClick={handleMenuClose} component={NavLink} to="/classement-equipe">Classement Équipes</MenuItem>
                            <MenuItem onClick={handleMenuClose} component={NavLink} to="/classement-joueurs">Classement Joueurs</MenuItem>
                        </Menu>

                        <Button onClick={(e) => handleMenuClick(e, 'match-play')} sx={{ color: 'var(--nav-button-text-color)', ...(isMatchPlayActive && { backgroundColor: 'var(--nav-active-bg-color)' }) }}>Match-Play</Button>
                        <Menu anchorEl={anchorEl} open={openMenu === 'match-play'} onClose={handleMenuClose}>
                            <MenuItem onClick={handleMenuClose} component={NavLink} to="/matchplay-qualification">Qualification M-P</MenuItem>
                            <MenuItem onClick={handleMenuClose} component={NavLink} to="/matchplay-games">Résultats M-P</MenuItem>
                        </Menu>
                        
                        <Button component={NavLink} to="/horaire" sx={{ color: 'var(--nav-button-text-color)', '&.active': { backgroundColor: 'var(--nav-active-bg-color)' } }}>Horaire</Button>
                        
                        {/* Affichage conditionnel des boutons Admin/Déconnexion en fonction de l'état d'authentification. */}
                        {isAuthenticated ? (
                            <Box sx={{ textAlign: 'center', border: '1px solid rgba(255,255,255,0.23)', padding: '5px', borderRadius: '12px', ml: 2 }}>
                                <Button component={NavLink} to="/admin/dashboard" sx={{ color: 'var(--nav-button-text-color)', '&.active': { backgroundColor: 'var(--nav-active-bg-color)' } }}>Admin</Button>
                                <Button 
                                    onClick={handleLogout}
                                    sx={{
                                        color: '#fff',
                                        backgroundColor: 'var(--accent-red)',
                                        marginLeft: '8px',
                                        '&:hover': {
                                            backgroundColor: '#d32f2f'
                                        }
                                    }}
                                >
                                    Déconnexion
                                </Button>
                            </Box>
                        ) : (
                            <Button component={NavLink} to="/admin" sx={{ color: 'var(--nav-button-text-color)', '&.active': { backgroundColor: 'var(--nav-active-bg-color)' } }}>Admin</Button>
                        )}
                    </Box>

                    {/* Bouton "hamburger" pour les petits écrans*/}
                    <IconButton color="inherit" aria-label="Ouvrir le menu" edge="end" onClick={handleDrawerToggle} sx={{ display: { sm: 'none' } }}>
                        <MenuIcon />
                    </IconButton>
                </Toolbar>
            </AppBar>
            
            {/* Menu latéral*/}
            <Box component="nav">
                <Drawer variant="temporary" open={mobileOpen} onClose={handleDrawerToggle} ModalProps={{ keepMounted: true }} anchor="right" sx={{ display: { xs: 'block', sm: 'none' }, '& .MuiDrawer-paper': { boxSizing: 'border-box', width: 240 } }}>
                    {drawer}
                </Drawer>
            </Box>
        </Box>
    );
}

export default Navigation;