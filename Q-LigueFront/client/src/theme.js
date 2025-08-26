import { createTheme } from '@mui/material/styles';

// Crée un thème personnalisé pour l'application
const theme = createTheme({
  typography: {
   
    fontFamily: [
      'Noto Sans',
      'sans-serif',
    ].join(','),
  },
  
});

export default theme;
