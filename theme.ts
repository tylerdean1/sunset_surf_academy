'use client';

import { createTheme } from '@mui/material/styles';

const theme = createTheme({
  palette: {
    primary: {
      main: '#0D726C',
      light: '#62C5B6',
      dark: '#075550',
      contrastText: '#FFFFFF',
    },
    secondary: {
      main: '#D96748',
      light: '#F2B85F',
      dark: '#AD472F',
      contrastText: '#173334',
    },
    background: {
      default: '#F7FAF8',
      paper: '#FFFFFF',
    },
    text: {
      primary: '#173334',
      secondary: '#5B6D6D',
    },
  },
  typography: {
    fontFamily: '"Inter", "Avenir Next", "Segoe UI", sans-serif',
    button: {
      fontWeight: 700,
      letterSpacing: '0.005em',
    },
    h1: {
      fontWeight: 760,
      letterSpacing: '-0.04em',
    },
    h2: {
      fontWeight: 740,
      letterSpacing: '-0.035em',
    },
    h3: {
      fontWeight: 700,
      letterSpacing: '-0.025em',
    },
    h4: {
      fontWeight: 600,
    },
    h5: {
      fontWeight: 600,
    },
    h6: {
      fontWeight: 600,
    },
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          borderRadius: 10,
          fontWeight: 600,
          '&:focus-visible': {
            outline: '3px solid #F2B85F',
            outlineOffset: 2,
          },
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          border: '1px solid rgba(14, 72, 68, 0.09)',
          borderRadius: 18,
          boxShadow: '0 8px 28px rgba(12, 62, 59, 0.07)',
        },
      },
    },
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          lineHeight: 1.6,
          WebkitFontSmoothing: 'antialiased',
          MozOsxFontSmoothing: 'grayscale',
        },
        '::selection': {
          backgroundColor: '#B8E4DA',
          color: '#173334',
        },
      },
    },
  },
});

export default theme;
