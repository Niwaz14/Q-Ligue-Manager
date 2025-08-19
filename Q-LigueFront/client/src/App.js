import React from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
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
function App() {
  return (
    <Router>
      <div className="App">
        <Navigation />
        
        <main className="app-main">
          <Routes>
            <Route path="/" element={<Accueil />} />
            
            <Route path="/classement-joueurs" element={<ClassementJoueurs />} />
            <Route path="/classement-equipes" element={<ClassementEquipe />} />
            <Route path="/horaire" element={<Horaire />} />
            <Route path="/bourses" element={<Bourses />} />

            <Route path="/admin-login" element={<AdminLoginPage />} />
            <Route 
              path="/admin" 
              element={
                <ProtectedRoute>
                  <AdminPage />
                </ProtectedRoute>
              } 
            />
          </Routes>
        </main>

        {/* --- SECTION FOOTER --- */}
        <footer className="app-footer">
          <div className="footer-content">
            <div className="footer-actions">
              
              <Link to="/admin-login" className="footer-button">Admin</Link>
            </div>
            <p className="copyright-text">
              &copy; {new Date().getFullYear()} Q-Ligue Manager. Tous droits réservés.
            </p>
          </div>
        </footer>
        {/* --- END FOOTER --- */}
        
      </div>
    </Router>
  );
}

export default App;