// src/App.js (Version de test)
import React from 'react';
import { BrowserRouter as Router, Link, Routes, Route } from 'react-router-dom';
import './App.css';

// --- On met le code de Navigation DIRECTEMENT ici pour le test ---
function Navigation() {
  return (
    <nav style={{ 
      padding: '1rem', 
      background: 'red', 
      color: 'white', 
      fontSize: '20px' 
    }}>
      <Link to="/" style={{ color: 'white', marginRight: '15px' }}>Accueil</Link>
      <Link to="/saison" style={{ color: 'white' }}>Saison</Link>
    </nav>
  );
}
// ---------------------------------------------------------------

function App() {
  return (
    <Router>
      <div className="App">
        <header>
          {/* On utilise le composant Navigation défini juste au-dessus */}
          <Navigation />
          <h1>Le test fonctionne si tu vois ce titre.</h1>
        </header>
        <main>
          {/* On peut même ajouter une route pour tester */}
          <Routes>
            <Route path="/" element={<h2>Page d'accueil</h2>} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;
