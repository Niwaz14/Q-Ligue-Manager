import React, { useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { 
    AppBar, 
    Box, 
    Toolbar, 
    IconButton, 
    Typography, 
    Button, 
    Drawer, 
    List, 
    ListItem,
    ListItemButton,
    ListItemText,
    Menu,
    MenuItem,
    Collapse
} from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import ExpandLess from '@mui/icons-material/ExpandLess';
import ExpandMore from '@mui/icons-material/ExpandMore';
import styles from './navigation.module.css';

function Navigation() {
    const { isAuthenticated, logout } = useAuth();
    const location = useLocation();
    const navigate = useNavigate();
    
    const [mobileOpen, setMobileOpen] = useState(false);
    const [anchorEl, setAnchorEl] = useState(null);
    const [openMenu, setOpenMenu] = useState(null);
    const [mobileSubMenuOpen, setMobileSubMenuOpen] = useState(null);

    const handleDrawerToggle = () => {
        setMobileOpen(!mobileOpen);
    };
    
    const handleMenuClick = (event, menuName) => {
        setAnchorEl(event.currentTarget);
        setOpenMenu(menuName);
    };

    const handleMenuClose = () => {
        setAnchorEl(null);
        setOpenMenu(null);
    };

    const handleMobileSubMenuToggle = (menuName) => {
        setMobileSubMenuOpen(prev => (prev === menuName ? null : menuName));
    };

    const closeAllMenusAndDrawers = () => {
        handleMenuClose();
        if (mobileOpen) {
            handleDrawerToggle();
        }
    };

    const handleLogout = () => {
        logout();
        closeAllMenusAndDrawers();
        navigate('/'); 
    };

    const isLinkActive = (path) => location.pathname === path;
    const isClassementActive = location.pathname.startsWith('/classement');
    const isMatchPlayActive = location.pathname.startsWith('/match-play'); 

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
                    <>
                        <ListItem disablePadding component={NavLink} to="/admin/dashboard" onClick={closeAllMenusAndDrawers} sx={{ color: 'inherit', textDecoration: 'none' }}>
                           <ListItemButton><ListItemText primary="Admin" /></ListItemButton>
                        </ListItem>
                        <ListItem disablePadding onClick={handleLogout}>
                           <ListItemButton><ListItemText primary="Déconnexion" /></ListItemButton>
                        </ListItem>
                    </>
                ) : (
                    <ListItem disablePadding component={NavLink} to="/admin" onClick={closeAllMenusAndDrawers} sx={{ color: 'inherit', textDecoration: 'none' }}>
                        <ListItemButton><ListItemText primary="Admin" /></ListItemButton>
                    </ListItem>
                )}
            </List>
        </Box>
    );

    return (
        <Box className={styles.root} sx={{ display: 'flex' }}>
            <AppBar component="nav" sx={{
                backgroundColor: 'var(--primary-dark)',
                borderRadius: { sm: 2 },
                margin: { sm: '10px' },
                width: { sm: 'calc(100% - 20px)' }
            }}>
                <Toolbar>
                    <IconButton color="inherit" aria-label="Ouvrir le tiroir" edge="start" onClick={handleDrawerToggle} sx={{ mr: 2, display: { sm: 'none' } }}>
                        <MenuIcon />
                    </IconButton>
                    
                    <Typography variant="h6" component={NavLink} to="/" sx={{ flexGrow: 1, color: 'inherit', textDecoration: 'none' }}>
                        Q-Ligue Manager
                    </Typography>

                    <Box sx={{ display: { xs: 'none', sm: 'block' } }}>
                        <Button sx={{ color: 'var(--nav-button-text-color)' }} className={isLinkActive('/') ? styles.activeLink : ''} component={NavLink} to="/">Accueil</Button>
                        
                        <Button sx={{ color: 'var(--nav-button-text-color)' }} className={isClassementActive ? styles.activeLink : ''} onClick={(e) => handleMenuClick(e, 'classement')}>Classement</Button>
                        <Menu anchorEl={anchorEl} open={openMenu === 'classement'} onClose={handleMenuClose}>
                            <MenuItem onClick={handleMenuClose} component={NavLink} to="/classement-equipe">Classement Équipes</MenuItem>
                            <MenuItem onClick={handleMenuClose} component={NavLink} to="/classement-joueurs">Classement Joueurs</MenuItem>
                        </Menu>

                        <Button sx={{ color: 'var(--nav-button-text-color)' }} className={isMatchPlayActive ? styles.activeLink : ''} onClick={(e) => handleMenuClick(e, 'match-play')}>Match-Play</Button>
                        <Menu anchorEl={anchorEl} open={openMenu === 'match-play'} onClose={handleMenuClose}>
                            <MenuItem onClick={handleMenuClose} component={NavLink} to="/matchplay-qualification">Qualification M-P</MenuItem>
                            <MenuItem onClick={handleMenuClose} component={NavLink} to="/matchplay-games">Résultats M-P</MenuItem>
                        </Menu>
                        
                        <Button sx={{ color: 'var(--nav-button-text-color)' }} className={isLinkActive('/horaire') ? styles.activeLink : ''} component={NavLink} to="/horaire">Horaire</Button>
                        
                        {isAuthenticated ? (
                             <>
                                <Button sx={{ color: 'var(--nav-button-text-color)' }} className={isLinkActive('/admin/dashboard') ? styles.activeLink : ''} component={NavLink} to="/admin/dashboard">Admin</Button>
                                <Button sx={{ color: 'var(--nav-button-text-color)' }} onClick={handleLogout}>Déconnexion</Button>
                            </>
                        ) : (
                            <Button sx={{ color: 'var(--nav-button-text-color)' }} className={isLinkActive('/admin') ? styles.activeLink : ''} component={NavLink} to="/admin">Admin</Button>
                        )}
                    </Box>
                </Toolbar>
            </AppBar>
            
            <Box component="nav">
                <Drawer
                    variant="temporary"
                    open={mobileOpen}
                    onClose={handleDrawerToggle}
                    ModalProps={{ keepMounted: true }}
                    sx={{
                        display: { xs: 'block', sm: 'none' },
                        '& .MuiDrawer-paper': { boxSizing: 'border-box', width: 240 },
                    }}
                >
                    {drawer}
                </Drawer>
            </Box>
        </Box>
    );
}

export default Navigation;