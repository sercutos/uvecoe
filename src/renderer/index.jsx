import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { ThemeProvider, createTheme, CssBaseline } from "@mui/material";
//import "./styles.css"; // tu CSS personalizado sigue cargándose

const theme = createTheme({
  palette: {
    mode: "light", // o 'dark'
  },
});

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ThemeProvider theme={theme}>
      <CssBaseline /> {/* Aplica estilos base de Material UI */}
      <App />
    </ThemeProvider>
  </React.StrictMode>
);
