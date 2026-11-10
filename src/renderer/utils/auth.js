import bcrypt from "bcryptjs";
import { getApiBaseUrl } from "./apiConfig";

const ADMIN_ROLES = ["administrator", "superadmin"];
const TOKEN_KEY = "token_ecoe";
const TOKEN_EXPIRES_KEY = "token_expires_at";
const AUTH_REQUIRED_KEY = "sync_auth_required";
const LOCAL_SESSION_KEY = "local_session";

function roleNames(user) {
  if (!user) return [];
  if (Array.isArray(user.roles)) return user.roles.map(String);
  if (typeof user.roles === "string") return [user.roles];
  return [];
}

export function isSuperadminUser(user) {
  return user?.is_superadmin === true || roleNames(user).includes("superadmin");
}

export function isAdminUser(user) {
  const role = String(user?.role || "");
  return (
    isSuperadminUser(user) ||
    user?.is_admin === true ||
    roleNames(user).some((name) => ADMIN_ROLES.includes(name)) ||
    ADMIN_ROLES.includes(role)
  );
}

export function saveUserSession(user = {}) {
  const roles = roleNames(user);
  const role = user.role || roles[0] || "";
  const isSuperadmin = isSuperadminUser(user);
  const isAdmin = isAdminUser(user);
  const organizationId = user.id_organization ?? user.organization?.id ?? null;

  sessionStorage.setItem(LOCAL_SESSION_KEY, "true");
  sessionStorage.setItem("user_email", user.email || "");
  sessionStorage.setItem(
    "user_role",
    String(role || (isAdmin ? "administrator" : "evaluador"))
  );
  sessionStorage.setItem("user_is_admin", isAdmin ? "true" : "false");
  sessionStorage.setItem("user_is_superadmin", isSuperadmin ? "true" : "false");
  sessionStorage.setItem(
    "user_org_id",
    organizationId === null || organizationId === undefined
      ? ""
      : String(organizationId)
  );
  sessionStorage.setItem(
    "user_org_name",
    user.organization?.name || user.organization_name || ""
  );
}

export function isLocalSession() {
  return sessionStorage.getItem(LOCAL_SESSION_KEY) === "true";
}

export function saveServerToken(token, expiresAt = null) {
  if (!token) {
    sessionStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(TOKEN_EXPIRES_KEY);
    sessionStorage.setItem(AUTH_REQUIRED_KEY, "true");
    return;
  }

  sessionStorage.setItem(TOKEN_KEY, token);
  if (expiresAt) {
    sessionStorage.setItem(TOKEN_EXPIRES_KEY, String(expiresAt));
  } else {
    sessionStorage.removeItem(TOKEN_EXPIRES_KEY);
  }
  sessionStorage.setItem(AUTH_REQUIRED_KEY, "false");
}

export function getServerToken() {
  return sessionStorage.getItem(TOKEN_KEY);
}

export function markServerAuthRequired() {
  sessionStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(TOKEN_EXPIRES_KEY);
  sessionStorage.setItem(AUTH_REQUIRED_KEY, "true");
}

export function clearServerAuthRequired() {
  sessionStorage.setItem(AUTH_REQUIRED_KEY, "false");
}

export function isServerAuthRequired() {
  return sessionStorage.getItem(AUTH_REQUIRED_KEY) === "true";
}

export async function loginOnline(email, password, baseUrl = getApiBaseUrl()) {
  const signal =
    typeof AbortSignal.timeout === "function"
      ? AbortSignal.timeout(10000)
      : undefined;

  const response = await fetch(`${baseUrl}/backend/auth/tokens`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
    ...(signal ? { signal } : {})
  });

  if (response.status === 401 || response.status === 403) {
    const error = new Error("Usuario o contraseña incorrectos en el servidor.");
    error.status = response.status;
    throw error;
  }

  if (!response.ok) {
    const error = new Error(
      `El servidor respondió HTTP ${response.status}.`
    );
    error.status = response.status;
    throw error;
  }

  const data = await response.json();
  if (!data.token) {
    const error = new Error("El servidor no devolvió un token.");
    error.code = "no_token";
    throw error;
  }

  return data;
}

export async function fetchCurrentUser(token, baseUrl = getApiBaseUrl()) {
  const signal =
    typeof AbortSignal.timeout === "function"
      ? AbortSignal.timeout(10000)
      : undefined;

  const response = await fetch(`${baseUrl}/backend/api/v1/users/me`, {
    headers: { Authorization: `Bearer ${token}` },
    ...(signal ? { signal } : {})
  });

  if (!response.ok) {
    const error = new Error(
      `No se pudo leer /users/me (HTTP ${response.status}).`
    );
    error.status = response.status;
    throw error;
  }

  return response.json();
}

// Guarda token, sesión local y perfil offline en un solo paso.
export async function persistLogin({
  token,
  expiration,
  me,
  email,
  password
}) {
  saveServerToken(token, expiration);

  let usuario = me;
  if (!usuario) {
    try {
      usuario = await window.api?.obtenerUsuarioLocal(email);
    } catch (error) {
      console.warn("[AUTH] No se pudo leer el usuario local:", error.message);
    }
  }

  usuario = usuario || { email, role: "evaluador" };

  const isAdmin = isAdminUser(usuario);
  const rol =
    usuario.role ||
    (Array.isArray(usuario.roles) ? usuario.roles[0] : "") ||
    (isAdmin ? "administrator" : "evaluador");

  saveUserSession({ ...usuario, email });

  try {
    const cambios = {
      id: usuario.id || Date.now(),
      usuario_id_server: usuario.usuario_id_server ?? usuario.id ?? null,
      email,
      role: rol,
      is_admin: isAdmin,
      is_superadmin: isSuperadminUser(usuario),
      id_organization: usuario.id_organization ?? null,
      token,
      token_expires_at: expiration || null
    };

    if (password) {
      cambios.password_hash = await bcrypt.hash(password, 10);
    }

    await window.api.guardarUsuarioLocal(cambios);
  } catch (error) {
    console.warn("[AUTH] No se pudo guardar el usuario local:", error.message);
  }

  return usuario;
}

export function isAdminSession() {
  return sessionStorage.getItem("user_is_admin") === "true";
}

export function isSuperadminSession() {
  return (
    sessionStorage.getItem("user_is_superadmin") === "true" ||
    sessionStorage.getItem("user_role") === "superadmin"
  );
}

export function getSessionOrganizationId() {
  const value = sessionStorage.getItem("user_org_id");
  if (!value) return null;

  const id = Number(value);
  return Number.isFinite(id) ? id : null;
}
