import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom"; // RUTAS
import App from "./App";

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
    //mode: "dark", 
  },
});

function PrivateRoute({ children }) {  
  //const isLogged = localStorage.getItem("logged") === "true";
  //return isLogged ? children : <Navigate to="/login" />;
  const hasToken = sessionStorage.getItem("token_ecoe") !== null;
  
  return hasToken ? children : <Navigate to="/login" />;
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <ThemeProvider theme={theme}> {/* Añadido el ThemeProvider para que MUI funcione al 100% con tu tema */}
    <CssBaseline />
    <BrowserRouter>
      <Routes>
        {/* 2. La raíz protegida ahora muestra el selector de fechas que acabamos de diseñar */}
        <Route path="/" element={<PrivateRoute><SelectDatePage /></PrivateRoute>} />
        <Route path="/rounds" element={<PrivateRoute><SelectRoundPage /></PrivateRoute>} />
        <Route path="/turns" element={<PrivateRoute><SelectTurnPage /></PrivateRoute>} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/questions" element={<Questions />} />
        <Route path="/evaluation" element={<Evaluation />} />
        <Route path="/students" element={<Students />} />
        <Route path="/login" element={<Loginpage />} />
      </Routes>
    </BrowserRouter>
  </ThemeProvider>
);