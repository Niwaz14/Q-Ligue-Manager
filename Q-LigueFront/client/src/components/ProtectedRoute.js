

import React from 'react';
import { Navigate } from 'react-router-dom';


const ProtectedRoute = ({ children }) => {
    const isAuthenticated = sessionStorage.getItem('isAuthenticated');

    // Si l'utilisateur n'est pas authentifié
    if (!isAuthenticated) {
        // il est redirigé vers la page de connexion. 
        return <Navigate to="/admin" />;
    }

    // Si l'utilisateur est authentifié, on affiche le contenu protégé.
    return children;
};

export default ProtectedRoute;