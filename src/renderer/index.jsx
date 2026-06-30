import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom"; 
import App from "./App"; // 🚀 Importamos nuestro Guardián de inicialización

import Loginpage from "./pages/login/login";
import SelectDatePage from "./pages/dates/SelectDatePage";
import SelectRoundPage from "./pages/rounds/SelectRoundPage";
import SelectTurnPage from "./pages/turns/SelectTurnPage";

import Settings from "./pages/settings/settings";
import Questions from "./pages/questions/questions";
import Students from "./pages/students/students";
import Evaluation from "./pages/evaluation/evaluation";

import { ThemeProvider, createTheme, CssBaseline } from "@mui/material";

const theme = createTheme({
  palette: {
    mode: "light", 
  },
});

function PrivateRoute({ children }) {  
  const hasToken = sessionStorage.getItem("token_ecoe") !== null;
  return hasToken ? children : <Navigate to="/login" />;
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <ThemeProvider theme={theme}>
    <CssBaseline />
    <BrowserRouter>
      <Routes>
        {/* 1. El Login se queda totalmente libre por fuera */}
        <Route path="/login" element={<Loginpage />} />

        {/* 2. Las rutas operativas pasan por el Token y luego por el chequeo de SQLite de <App> */}
        <Route path="/" element={<PrivateRoute><App><SelectDatePage /></App></PrivateRoute>} />
        <Route path="/rounds" element={<PrivateRoute><App><SelectRoundPage /></App></PrivateRoute>} />
        <Route path="/turns" element={<PrivateRoute><App><SelectTurnPage /></App></PrivateRoute>} />
        
        <Route path="/settings" element={<PrivateRoute><App><Settings /></App></PrivateRoute>} />
        <Route path="/questions" element={<PrivateRoute><App><Questions /></App></PrivateRoute>} />
        <Route path="/evaluation" element={<PrivateRoute><App><Evaluation /></App></PrivateRoute>} />
        <Route path="/students" element={<PrivateRoute><App><Students /></App></PrivateRoute>} />
      </Routes>
    </BrowserRouter>
  </ThemeProvider>
);