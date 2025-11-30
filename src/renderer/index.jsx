import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom"; // RUTAS
import Login from './components/Login';
import App from "./App";
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
/* <Route path="/login" element={<Login />} /> */
ReactDOM.createRoot(document.getElementById("root")).render(
  <BrowserRouter>
    <Routes>
      <Route path="/" element={<App />} />
       <Route path="/settings" element={<Settings />} />
       <Route path="/questions" element={<Questions />} />
       <Route path="/evaluation" element={<Evaluation />} />
       <Route path="/students" element={<Students />} />
    </Routes>
  </BrowserRouter>

);
