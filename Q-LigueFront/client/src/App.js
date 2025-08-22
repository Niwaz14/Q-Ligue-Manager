import React from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useNavigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import Navigation from './components/navigation';
import Accueil from './pages/Accueil';
import ClassementJoueurs from './pages/ClassementJoueurs';
import ClassementEquipe from './pages/ClassementEquipe';
import Horaire from './pages/Horaire';
import Bourses from './pages/Bourses';
import AdminLoginPage from './pages/AdminLoginPage';
import AdminPage from './pages/AdminPage';
import ProtectedRoute from './components/ProtectedRoute';
import './App.css';

const AppLayout = () => {
  const { isAuthenticated, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <div className="App">
      <Navigation />
      <main className="app-main">
        <Routes>
          <Route path="/" element={<Accueil />} />
          <Route path="/classement-joueurs" element={<ClassementJoueurs />} />
          <Route path="/classement-equipes" element={<ClassementEquipe />} />
          <Route path="/horaire" element={<Horaire />} />
          <Route path="/bourses" element={<Bourses />} />
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

      <footer className="app-footer">
        <div className="footer-content">
          <div className="footer-actions">
            {/* --- UPDATED BUTTON LOGIC --- */}
            {isAuthenticated ? (
              <>
                <Link to="/admin/dashboard" className="footer-button">Admin</Link>
                <button onClick={handleLogout} className="footer-button">Déconnexion</button>
              </>
            ) : (
              <Link to="/admin" className="footer-button">Admin</Link>
            )}
          </div>
          <p className="copyright-text">
            &copy; {new Date().getFullYear()} Q-Ligue Manager. Tous droits réservés.
          </p>
        </div>
      </footer>
    </div>
  );
};

function App() {
  return (
    <Router>
      <AppLayout />
    </Router>
  );
}

export default App;