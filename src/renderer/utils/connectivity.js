import { useEffect, useState } from "react";
import { getApiBaseUrl } from "./apiConfig";
import {
  getServerToken,
  markServerAuthRequired,
  saveServerToken
} from "./auth";

const EVENT = "uvecoe:server-status";
const CHECK_INTERVAL_MS = 30000;
const CHECK_TIMEOUT_MS = 5000;

let serverOnline = true;
let stopMonitor = null;
let renewing = false;

export function isServerOnline() {
  return serverOnline;
}

export function setServerOnline(online) {
  if (serverOnline === online) return;
  serverOnline = online;
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(EVENT, { detail: { online } }));
  }
}

function timeoutSignal() {
  return typeof AbortSignal.timeout === "function"
    ? AbortSignal.timeout(CHECK_TIMEOUT_MS)
    : undefined;
}

async function persistRenewedExpiration(expiration) {
  const email = sessionStorage.getItem("user_email");
  if (!email || !window.api?.obtenerUsuarioLocal || !window.api?.guardarUsuarioLocal) {
    return;
  }

  try {
    const usuario = await window.api.obtenerUsuarioLocal(email);
    if (!usuario) return;
    await window.api.guardarUsuarioLocal({
      ...usuario,
      token_expires_at: expiration || null
    });
  } catch (error) {
    console.warn(
      "[AUTH] No se pudo guardar la nueva caducidad del token:",
      error.message
    );
  }
}

// Renueva la caducidad del token al recuperar la conexión, sin pedir
// credenciales mientras el token siga siendo válido.
export async function renewServerToken() {
  if (renewing) return false;

  const token = getServerToken();
  if (!token) return false;

  renewing = true;
  try {
    const signal = timeoutSignal();
    const response = await fetch(
      `${getApiBaseUrl()}/backend/auth/tokens/refresh`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        ...(signal ? { signal } : {})
      }
    );

    if (response.status === 401 || response.status === 403) {
      markServerAuthRequired();
      window.dispatchEvent(new Event("uvecoe:pending-changed"));
      return false;
    }
    if (!response.ok) return false;

    const data = await response.json().catch(() => ({}));
    saveServerToken(token, data.expiration || null);
    await persistRenewedExpiration(data.expiration);
    window.dispatchEvent(new Event("uvecoe:pending-changed"));
    return true;
  } catch {
    setServerOnline(false);
    return false;
  } finally {
    renewing = false;
  }
}

export async function checkServerStatus() {
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    setServerOnline(false);
    return false;
  }

  const wasOnline = serverOnline;

  try {
    const signal = timeoutSignal();
    const response = await fetch(`${getApiBaseUrl()}/backend/status`, {
      ...(signal ? { signal } : {})
    });
    const data = await response.json().catch(() => ({}));
    const online = response.ok && data?.status === "ok";
    setServerOnline(online);
    if (online && !wasOnline) renewServerToken();
    return online;
  } catch {
    setServerOnline(false);
    return false;
  }
}

export function startServerMonitor() {
  if (stopMonitor || typeof window === "undefined") return;

  const handleOnline = () => checkServerStatus();
  const handleOffline = () => setServerOnline(false);

  window.addEventListener("online", handleOnline);
  window.addEventListener("offline", handleOffline);
  checkServerStatus();
  const interval = setInterval(checkServerStatus, CHECK_INTERVAL_MS);

  stopMonitor = () => {
    clearInterval(interval);
    window.removeEventListener("online", handleOnline);
    window.removeEventListener("offline", handleOffline);
  };
}

export function useServerOnline() {
  const [online, setOnline] = useState(serverOnline);

  useEffect(() => {
    const handler = (event) => setOnline(event.detail.online);
    window.addEventListener(EVENT, handler);
    return () => window.removeEventListener(EVENT, handler);
  }, []);

  return online;
}
