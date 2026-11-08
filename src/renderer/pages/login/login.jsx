import React from "react";
import Login from "../../components/Login";
import { useNavigate } from "react-router-dom";

export default function Loginpage() {
  const navigate = useNavigate();

  const handleLoginSuccess = () => {
    navigate("/"); // redirige a la página principal
  };

  return <Login onLogin={handleLoginSuccess} />;
}
