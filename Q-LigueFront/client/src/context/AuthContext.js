import React, { createContext, useContext, useState } from 'react';
const AuthContext = createContext(null);
export const useAuth = () => useContext(AuthContext);
export const AuthProvider = ({ children }) => {
    
    // Initialise l'état.
    const [isAuthenticated, setIsAuthenticated] = useState(
  
        sessionStorage.getItem('isAuthenticated') === 'true'
    );

    // On met à jour si l'utilisateur se connecte.
    const login = () => {
        sessionStorage.setItem('isAuthenticated', 'true');
        setIsAuthenticated(true);
    };

    // La fonction de déconnexion.
    const logout = () => {
        sessionStorage.removeItem('isAuthenticated');
        setIsAuthenticated(false);
    };

    // On met à disposition les états selon le contexte.
    const value = {
        isAuthenticated,
        login,
        logout
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
};