const STORAGE_KEY = "api_base_url";

export async function initApiConfig() {
  try {
    const url = await window.api.getSetting("api_base_url");
    if (url) {
      sessionStorage.setItem(STORAGE_KEY, url);
      return url;
    }
  } catch (e) {
    console.warn("[apiConfig] No se pudo leer config, usando fallback");
  }
  const fallback = "http://localhost:8000";
  sessionStorage.setItem(STORAGE_KEY, fallback);
  return fallback;
}

export function getApiBaseUrl() {
  return sessionStorage.getItem(STORAGE_KEY) || "http://localhost:8000";
}

// El Chrono se sirve por Caddy/nginx en el mismo origen que el API.
// Si api_base_url apunta directo al contenedor (:8000), se quita ese puerto.
export function getChronoBaseUrl() {
  const override = sessionStorage.getItem("chrono_base_url");
  if (override) return override.replace(/\/+$/, "");

  try {
    const api = new URL(getApiBaseUrl());
    const port = api.port === "8000" ? "" : api.port;
    return `${api.protocol}//${api.hostname}${port ? `:${port}` : ""}`;
  } catch {
    return "http://localhost";
  }
}

export function apiPath(path) {
  return `${getApiBaseUrl()}/backend/api/v1${path.startsWith("/") ? path : `/${path}`}`;
}

export function authPath(path) {
  return `${getApiBaseUrl()}/backend/auth${path.startsWith("/") ? path : `/${path}`}`;
}
