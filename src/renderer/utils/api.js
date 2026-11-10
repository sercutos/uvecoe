import { apiPath } from "./apiConfig";
import { markServerAuthRequired } from "./auth";

export const fetchWithAuth = async (input, options = {}) => {
  const url = input.startsWith("http") ? input : apiPath(input);

  const token = sessionStorage.getItem("token_ecoe");

  const headers = {
    "Content-Type": "application/json",
    ...options.headers,
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const response = await fetch(url, {
    ...options,
    headers
  });

  if (response.status === 401) {
    console.error("[API] Error 401: El servidor dice que este token NO es válido o ha expirado.");
    markServerAuthRequired();
    window.dispatchEvent(new Event("uvecoe:pending-changed"));
    throw new Error("No autorizado: El token es inválido o ha expirado. Pulsa 'Reconectar' en la barra superior.");
  }

  if (!response.ok) {
    throw new Error(`Error en la petición: ${response.statusText} (Código ${response.status})`);
  }

  return await response.json();
};
