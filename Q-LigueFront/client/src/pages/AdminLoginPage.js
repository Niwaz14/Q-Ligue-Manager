import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import styles from './AdminLoginPage.module.css';
import { useAuth } from '../context/AuthContext';

function AdminLoginPage() {
    // États locaux pour le champ de saisie du code et les messages d'erreur.
    const [accessCode, setAccessCode] = useState('');
    const [error, setError] = useState('');
    const navigate = useNavigate();
    const { login } = useAuth(); // Extraction de l'état
    
    // Gère la soumission du formulaire de connexion.
    const handleSubmit = async (e) => {
        e.preventDefault(); // Empêche le rechargement de la page par le formulaire.
        setError('');

        try {
           
            // Vérification du code d'accès via une requête POST à l'API.
            const response = await fetch(`${process.env.REACT_APP_API_URL}/api/verify`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ accessCode }),
            });
            const data = await response.json();

            // Si la vérification est réussie
            if (data.success) {
                login(); // Appel de la fonction du contexte pour mettre à jour l'état d'authentification global.
                
                // On diffuse un événement global pour notifier les autres composants du changement d'authentification.
                window.dispatchEvent(new Event('authChange')); 
                navigate('/admin/dashboard'); // Redirection vers le tableau de bord de l'administrateur.
            } else {
                // En cas d'échec, afficher une erreur et réinitialiser le champ.
                setError(`Code d'accès invalide.`);
                setAccessCode('');
            }
        } catch (err) {
            console.error('Login request failed:', err);
            setError('Une erreur est survenue lors de la connexion.');
        }
    };

    // Rendu du formulaire de connexion.
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
                {/* Affichage conditionnel du message d'erreur. */}
                {error && <p className={styles.errorMessage}>{error}</p>}
            </form>
        </div>
    );
}

export default AdminLoginPage;
