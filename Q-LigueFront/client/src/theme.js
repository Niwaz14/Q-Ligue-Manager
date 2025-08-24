import { createTheme } from '@mui/material/styles';

// Crée un thème personnalisé pour l'application
const theme = createTheme({
  typography: {
    // Définit la police par défaut pour tous les composants MUI
    fontFamily: [
      'Noto Sans',
      'sans-serif',
    ].join(','),
  },
  // Vous pouvez également personnaliser les couleurs, les points d'arrêt, etc. ici
});

export default theme;
