import React from "react";
import Login from "../../components/Login";
import { useNavigate } from "react-router-dom";

export default function Loginpage() {
  const navigate = useNavigate();

  const handleLoginSuccess = () => {
    localStorage.setItem("logged", "true");
    navigate("/"); // redirige a la página principal
  };

  return (
    <>
      <Login onLogin={() => {
        localStorage.setItem("logged", "true");
        navigate("/");
      }}  />    
    </>
  );
}