import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom"; // RUTAS
import App from "./App";
import Settings from "./pages/settings/settings";
import Questions from "./pages/questions/questions";
import Students from "./pages/students/students";
import Evaluation from "./pages/evaluation/evaluation";
import Loginpage from "./pages/login/login";

import { ThemeProvider, createTheme, CssBaseline } from "@mui/material";


const theme = createTheme({
  palette: {
    mode: "light", 
    //mode: "dark", 
  },
});

function PrivateRoute({ children }) {  
  const isLogged = sessionStorage.getItem("user") !== null;
  return isLogged ? children : <Navigate to="/login" />;
}



ReactDOM.createRoot(document.getElementById("root")).render(
  <BrowserRouter>
    <Routes>
      <Route path="/" element={ <PrivateRoute><App /></PrivateRoute>} />
       <Route path="/settings" element={<Settings />} />
       <Route path="/questions" element={<Questions />} />
       <Route path="/evaluation" element={<Evaluation />} />
       <Route path="/students" element={<Students />} />
       <Route path="/login" element={<Loginpage />} />
    </Routes>
  </BrowserRouter>

);
