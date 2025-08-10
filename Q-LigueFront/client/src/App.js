import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';

// Importer les composants pages
import Navigation from './components/navigation.js';
import Accueil from './pages/Accueil.js';
import SaisonMenu from './pages/SaisonMenu.js';
import SemaineMenu from './pages/SemaineMenu.js';
import EquipeMenu from './pages/EquipeMenu.js';
import JoueurMenu from './pages/JoueurMenu.js';
import ClassementJoueurs from './pages/ClassementJoueurs.js';
import Horaire from './pages/Horaire.js';
import AdminPage from './pages/AdminPage.js'; 

import './App.css';

function App() {
  return (
    <Router>
      <div className="App">
        <header>
          <Navigation /> 
        </header>
        <main>
          <Routes>
            <Route path="/" element={<Accueil />} />

            <Route path="/saison" element={<SaisonMenu />}>
              <Route path="classement-joueurs" element={<ClassementJoueurs />} />
              <Route path="horaire" element={<Horaire />} />
            </Route>

            <Route path="/semaine" element={<SemaineMenu />} />
            <Route path="/equipe" element={<EquipeMenu />} />
            <Route path="/joueur" element={<JoueurMenu />} />

             <Route path="/admin" element={<AdminPage />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;