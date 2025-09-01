import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Navigation from './components/navigation';
import Accueil from './pages/Accueil';
import ClassementJoueurs from './pages/ClassementJoueurs';
import ClassementEquipe from './pages/ClassementEquipe';
import Horaire from './pages/Horaire';
import AdminLoginPage from './pages/AdminLoginPage';
import AdminPage from './pages/AdminPage';
import EntrerPointage from './pages/EntrerPointage';
import ProtectedRoute from './components/ProtectedRoute';
import MatchPlayQualification from './pages/MatchPlayQualification';
import MatchPlay from './pages/MatchPlay';
import AdminMatchPlay from './pages/AdminMatchPlay';
import './App.css';


const AppLayout = () => {
  return (
    <div className="App">
      <Navigation />
      <main className="app-main">
        {/* Le composant Routes gère l'affichage des différentes pages en fonction de l'URL. */}
        <Routes>
          {/* Routes accessibles publiquement par tous les utilisateurs. */}
          <Route path="/" element={<Accueil />} />
          <Route path="/classement-joueurs" element={<ClassementJoueurs />} />
          <Route path="/classement-equipe" element={<ClassementEquipe />} />
          <Route path="/horaire" element={<Horaire />} />
          <Route path="/matchplay-qualification" element={<MatchPlayQualification />} />
          <Route path="/matchplay-games" element={<MatchPlay />} />

          {/* Le chemin /admin mène à la page de connexion, point d'entrée de la section admin. */}
          <Route path="/admin" element={<AdminLoginPage />} />

          <Route
            path="/admin/dashboard"
            element={
              <ProtectedRoute>
                <AdminPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/dashboard/entrer-pointage"
            element={
              <ProtectedRoute>
                <EntrerPointage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/dashboard/match-play"
            element={
              <ProtectedRoute>
                <AdminMatchPlay />
              </ProtectedRoute>
            }
          />
        </Routes>
      </main>

      {/* Un pied de page uniforme pour l'ensemble du site. */}
      <footer className="app-footer">
        <div className="footer-content">
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
