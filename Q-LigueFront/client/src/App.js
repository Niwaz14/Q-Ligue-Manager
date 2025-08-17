import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, useNavigate, Link } from 'react-router-dom';


import Navigation from './components/navigation.js';
import Accueil from './pages/Accueil.js';
import SaisonMenu from './pages/SaisonMenu.js';
import SemaineMenu from './pages/SemaineMenu.js';
import EquipeMenu from './pages/EquipeMenu.js';
import JoueurMenu from './pages/JoueurMenu.js';
import ClassementJoueurs from './pages/ClassementJoueurs.js';
import Horaire from './pages/Horaire.js';
import AdminPage from './pages/AdminPage.js'; 
import AdminLoginPage from './pages/AdminLoginPage.js';
import ProtectedRoute from './components/ProtectedRoute.js';

import './App.css';


const AppFooter = () => {
    const navigate = useNavigate();
    const [isAdmin, setIsAdmin] = useState(sessionStorage.getItem('isAdminAuthenticated'));

    const handleLogout = () => {
        sessionStorage.removeItem('isAdminAuthenticated');
        setIsAdmin(null);
        navigate('/');
    };

    useEffect(() => {
        const checkAuth = () => {
            setIsAdmin(sessionStorage.getItem('isAdminAuthenticated'));
        };
        window.addEventListener('authChange', checkAuth);
        checkAuth(); 
        return () => {
            window.removeEventListener('authChange', checkAuth);
        };
    }, []);

    return (
        <footer className="app-footer">
            <div className="footer-content">
                <span className="copyright-text">© 2025 Q-Ligue Manager. Tous droits réservés.</span>
                <div className="footer-actions">
                    {isAdmin ? (
                        <>
                            <Link to="/admin/dashboard" className="footer-button">Tableau de bord</Link>
                            <button onClick={handleLogout} className="footer-button">Déconnexion</button>
                        </>
                    ) : (
                        <Link to="/admin" className="footer-button">Connexion Admin</Link>
                    )}
                </div>
            </div>
        </footer>
    );
};


function App() {
  return (
    <Router>
      <div className="App">
        <header>
          <Navigation /> 
        </header>
        <main className="app-main">
          <Routes>
            <Route path="/" element={<Accueil />} />
            <Route path="/saison" element={<SaisonMenu />}>
              <Route path="classement-joueurs" element={<ClassementJoueurs />} />
              <Route path="horaire" element={<Horaire />} />
            </Route>
            <Route path="/semaine" element={<SemaineMenu />} />
            <Route path="/equipe" element={<EquipeMenu />} />
            <Route path="/joueur" element={<JoueurMenu />} />
            <Route path="/admin" element={<AdminLoginPage />} />
            <Route
              path="/admin/dashboard"
              element={
                <ProtectedRoute>
                  <AdminPage />
                </ProtectedRoute>
              }
            />
          </Routes>
        </main>
        <AppFooter />
      </div>
    </Router>
  );
}

export default App;