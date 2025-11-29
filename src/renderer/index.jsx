import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom"; // ✅ Import necesario
import Login from './components/Login';
import App from "./App";
import { ThemeProvider, createTheme, CssBaseline } from "@mui/material";


const theme = createTheme({
  palette: {
    mode: "light", // o 'dark'
  },
});
/* <Route path="/login" element={<Login />} /> */
ReactDOM.createRoot(document.getElementById("root")).render(
  <BrowserRouter>
    <Routes>
      
      <Route path="/" element={<App />} />
    </Routes>
  </BrowserRouter>

);
