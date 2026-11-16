const STORAGE_KEY = "api_base_url";

// Servidor central desplegado (API bajo /backend). En local se puede
// sobrescribir desde Settings o con VITE_*.
export const DEFAULT_API_BASE_URL = "https://sauron.uv.es";

// Acepta la URL con o sin /backend (o /backend/api/v1): la app ya añade esa parte.
export function normalizeApiBaseUrl(value) {
  return String(value || "")
    .trim()
    .replace(/\/+$/, "")
    .replace(/\/backend(\/api(\/v1)?)?$/i, "");
}

export async function initApiConfig() {
  try {
    const url = await window.api.getSetting("api_base_url");
    if (url) {
      const base = normalizeApiBaseUrl(url);
      sessionStorage.setItem(STORAGE_KEY, base);
      return base;
    }
  } catch (e) {
    console.warn("[apiConfig] No se pudo leer config, usando fallback");
  }
  sessionStorage.setItem(STORAGE_KEY, DEFAULT_API_BASE_URL);
  return DEFAULT_API_BASE_URL;
}

export function getApiBaseUrl() {
  return (
    normalizeApiBaseUrl(sessionStorage.getItem(STORAGE_KEY)) ||
    DEFAULT_API_BASE_URL
  );
}

// El Chrono se sirve por Caddy/nginx en el mismo origen que el API.
// Si api_base_url apunta directo al contenedor (:8000), se quita ese puerto.
export function getChronoBaseUrl() {
  const override = sessionStorage.getItem("chrono_base_url");
  if (override) return override.replace(/\/+$/, "");

  try {
    const api = new URL(getApiBaseUrl());

    // En local, el API suele apuntar al contenedor :8000 y el Chrono está
    // expuesto directamente en :5001. En producción se usa la URL de Caddy.
    if (
      api.port === "8000" &&
      (api.hostname === "localhost" || api.hostname === "127.0.0.1")
    ) {
      return `${api.protocol}//${api.hostname}:5001`;
    }

    const port = api.port === "8000" ? "" : api.port;
    return `${api.protocol}//${api.hostname}${port ? `:${port}` : ""}`;
  } catch {
    return "http://localhost";
  }
}

export function apiPath(path) {
  return `${getApiBaseUrl()}/backend/api/v1${path.startsWith("/") ? path : `/${path}`}`;
}
