import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import styles from './AdminLoginPage.module.css';
import { useAuth } from '../context/AuthContext';

function AdminLoginPage() {
    
    const [accessCode, setAccessCode] = useState('');
    const [error, setError] = useState('');
    const navigate = useNavigate();
    const { login } = useAuth();

    
    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        try {
            const response = await fetch(`${process.env.REACT_APP_API_URL}/api/verify`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ accessCode }),
            });
            const data = await response.json();

            if (data.success) {
                login();
                
                window.dispatchEvent(new Event('authChange')); 
                navigate('/admin/dashboard');
            } else {
                setError(`Code d'accès invalide.`);
                setAccessCode('');
            }
        } catch (err) {
            console.error('Login request failed:', err);
            setError('Une erreur est survenue lors de la connexion.');
        }
    };

    
    return (
        <div className={styles.loginContainer}>
            <form onSubmit={handleSubmit} className={styles.loginForm}>
                <h2>Accès Administrateur</h2>
                <p>Veuillez entrer le code d'accès pour continuer.</p>
                <input
                    type="password"
                    value={accessCode}
                    onChange={(e) => setAccessCode(e.target.value)}
                    placeholder="Code d'accès"
                    className={styles.inputField}
                />
                <button type="submit" className={styles.submitButton}>
                    Connexion
                </button>
                {error && <p className={styles.errorMessage}>{error}</p>}
            </form>
        </div>
    );
}

export default AdminLoginPage;