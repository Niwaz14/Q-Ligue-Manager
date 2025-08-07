import React, { useState, useEffect } from 'react';
import './App.css';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Navigation from './components/navigation.js'; // Selon ton image
import Accueil from './pages/Accueil.js';           // Selon ton image
import SaisonMenu from './pages/SaisonMenu.js';     // Selon ton image
import SemaineMenu from './pages/SemaineMenu.js';
import EquipeMenu from './pages/EquipeMenu.js';
import JoueurMenu from './pages/JoueurMenu.js';


import ClassementJoueurs from './pages/ClassementJoueurs.js';
import Horaire from './pages/Horaire.js';



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

            {/* --- Route SAISON avec ses sous-routes --- */}
            <Route path="/saison" element={<SaisonMenu />}>
              <Route path="classement-joueurs" element={<ClassementJoueurs />} />
              <Route path="horaire" element={<Horaire />} />
            </Route>
            {/* ------------------------------------------- */}

            <Route path="/semaine" element={<SemaineMenu />} />
            <Route path="/equipe" element={<EquipeMenu />} />
            <Route path="/joueur" element={<JoueurMenu />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;