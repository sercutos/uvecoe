/**
 * Utilidad centralizada para hacer peticiones autenticadas al backend
 */
export const fetchWithAuth = async (url, options = {}) => {
  // 1. Recuperamos el token guardado en el login
  const token = sessionStorage.getItem("token_ecoe");

  // 🔍 LOG: Ver qué token se está intentando usar para la petición
  console.log(`[API] Intentando petición a: ${url}`);
  console.log(`[API] Token recuperado de sessionStorage:`, token);

  const headers = {
    "Content-Type": "application/json",
    ...options.headers,
  };

  // 2. Si tenemos token, lo inyectamos en la cabecera de Autorización (Bearer)
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  } else {
    console.warn("[API] ¡Advertencia! No hay ningún token en sessionStorage.");
  }

  // Log de las cabeceras finales que se envían (sin mostrar todo el token por seguridad)
  console.log("[API] Cabeceras enviadas:", { 
    ...headers, 
    Authorization: token ? `Bearer ${token.substring(0, 10)}...` : "Ninguno" 
  });

  const response = await fetch(url, {
    ...options,
    headers
  });

  // 🔍 LOG: Ver qué responde el servidor de FastAPI
  console.log(`[API] Respuesta del servidor - Estado: ${response.status} ${response.statusText}`);

  if (response.status === 401) {
    console.error("[API] Error 401: El servidor dice que este token NO es válido o ha expirado.");
    
    // 🚀 ELIMINAMOS EL window.location.reload() PARA ROMPER EL BUCLE INFINITO
    throw new Error("No autorizado: El token es inválido o ha expirado. Por favor, vuelve al Login.");
  }

  if (!response.ok) {
    throw new Error(`Error en la petición: ${response.statusText} (Código ${response.status})`);
  }

  return await response.json();
};