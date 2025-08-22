

import React from 'react';
import { Navigate } from 'react-router-dom';

const ProtectedRoute = ({ children }) => {
    const isAuthenticated = sessionStorage.getItem('isAuthenticated');

    if (!isAuthenticated) {
        
        return <Navigate to="/admin" />;
    }

    return children;
};

export default ProtectedRoute;