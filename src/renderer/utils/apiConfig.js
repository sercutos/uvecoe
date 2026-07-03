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

export function apiPath(path) {
  return `${getApiBaseUrl()}/backend/api/v1${path.startsWith("/") ? path : `/${path}`}`;
}

export function authPath(path) {
  return `${getApiBaseUrl()}/backend/auth${path.startsWith("/") ? path : `/${path}`}`;
}
