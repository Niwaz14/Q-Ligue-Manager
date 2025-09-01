import { createTheme } from '@mui/material/styles';

// Crée un thème personnalisé pour l'application
const theme = createTheme({
  breakpoints: {
    values: {
      xs: 0,
      sm: 810,
      md: 900,
      lg: 1200,
      xl: 1536,
    },
  },
  typography: {
   
    fontFamily: [
      'Noto Sans',
      'sans-serif',
    ].join(','),
  },
  
});

export default theme;
