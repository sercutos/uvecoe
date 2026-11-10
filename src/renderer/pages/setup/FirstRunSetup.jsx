import React, { useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Divider,
  InputAdornment,
  Paper,
  TextField,
  Typography
} from "@mui/material";
import DnsIcon from "@mui/icons-material/Dns";
import CloudDoneIcon from "@mui/icons-material/CloudDone";
import AdminPanelSettingsIcon from "@mui/icons-material/AdminPanelSettings";
import AccountCircleIcon from "@mui/icons-material/AccountCircle";
import LockIcon from "@mui/icons-material/Lock";
import bcrypt from "bcryptjs";

import logoImg from "../../../../assets/images/logo1.png";
import {
  isAdminUser,
  isSuperadminUser,
  saveUserSession
} from "../../utils/auth";

function normalizeBaseUrl(value) {
  let url = String(value || "").trim();

  if (!url) return "";
  if (!/^https?:\/\//i.test(url)) url = `http://${url}`;

  return url.replace(/\/+$/, "");
}

function isLocalHost(url) {
  try {
    const parsed = new URL(url);
    return ["localhost", "127.0.0.1", "::1"].includes(parsed.hostname);
  } catch {
    return false;
  }
}

export default function FirstRunSetup({ onComplete }) {
  const [serverUrl, setServerUrl] = useState("http://localhost:8000");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [testing, setTesting] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [connectionOk, setConnectionOk] = useState(false);
  const [feedback, setFeedback] = useState(null);

  const busy = testing || submitting;

  useEffect(() => {
    let active = true;

    const loadSavedUrl = async () => {
      try {
        const saved = await window.api.getSetting("api_base_url");
        if (active && saved) setServerUrl(saved);
      } catch (error) {
        console.warn("[SETUP] No se pudo leer la URL guardada:", error);
      }
    };

    loadSavedUrl();
    return () => {
      active = false;
    };
  }, []);

  const checkConnection = async (base) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10000);

    try {
      const response = await fetch(`${base}/backend/status`, {
        signal: controller.signal
      });

      if (!response.ok) {
        throw new Error(`El servidor respondió HTTP ${response.status}.`);
      }

      const data = await response.json().catch(() => ({}));

      if (data?.status !== "ok") {
        throw new Error("El servidor no devolvió el estado esperado.");
      }

      setConnectionOk(true);
      setFeedback({
        severity: "success",
        message: `Conexión correcta con ${base}`
      });
      return true;
    } catch (error) {
      setConnectionOk(false);
      setFeedback({
        severity: "error",
        message:
          error.name === "AbortError"
            ? "No se pudo conectar: tiempo de espera agotado."
            : `No se pudo conectar: ${error.message}`
      });
      return false;
    } finally {
      clearTimeout(timer);
    }
  };

  const handleTestConnection = async () => {
    setTesting(true);
    setFeedback(null);

    const base = normalizeBaseUrl(serverUrl);
    setServerUrl(base);
    await checkConnection(base);

    setTesting(false);
  };

  const handleServerUrlChange = (event) => {
    setServerUrl(event.target.value);
    setConnectionOk(false);
    setFeedback(null);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (busy) return;

    setSubmitting(true);
    setFeedback(null);

    const base = normalizeBaseUrl(serverUrl);
    const emailLimpio = email.trim().toLowerCase();
    setServerUrl(base);

    try {
      if (!base) throw new Error("Introduce la URL del servidor.");
      if (!emailLimpio) {
        throw new Error("Introduce el email del administrador.");
      }
      if (!password) {
        throw new Error("Introduce la contraseña del administrador.");
      }

      const connected = connectionOk ? true : await checkConnection(base);
      if (!connected) {
        return;
      }

      const loginResponse = await fetch(`${base}/backend/auth/tokens`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: emailLimpio, password })
      });

      if (loginResponse.status === 401 || loginResponse.status === 403) {
        throw new Error("Usuario o contraseña incorrectos en el servidor.");
      }

      if (!loginResponse.ok) {
        throw new Error(
          `El servidor respondió HTTP ${loginResponse.status} al iniciar sesión.`
        );
      }

      const loginData = await loginResponse.json();

      if (!loginData.token) {
        throw new Error("El servidor no devolvió un token.");
      }

      const meResponse = await fetch(`${base}/backend/api/v1/users/me`, {
        headers: { Authorization: `Bearer ${loginData.token}` }
      });

      if (!meResponse.ok) {
        throw new Error(
          `No se pudo validar el usuario (HTTP ${meResponse.status}).`
        );
      }

      const me = await meResponse.json();
      const roles = Array.isArray(me.roles) ? me.roles : [];

      if (!isAdminUser(me)) {
        throw new Error("El usuario no tiene permisos de administrador.");
      }

      const passwordHash = await bcrypt.hash(password, 10);
      const emailFinal = me.email || emailLimpio;
      const isSuperadmin = isSuperadminUser(me);

      await window.api.setSetting("api_base_url", base);
      sessionStorage.setItem("api_base_url", base);

      await window.api.guardarUsuarioLocal({
        id: me.id,
        usuario_id_server: me.id,
        email: emailFinal,
        role: roles[0] || "administrator",
        is_admin: true,
        is_superadmin: isSuperadmin,
        id_organization: me.id_organization ?? null,
        token: loginData.token,
        password_hash: passwordHash
      });

      sessionStorage.setItem("token_ecoe", loginData.token);
      saveUserSession({ ...me, email: emailFinal });
      await window.api.setSetting("setup_completed", "true");

      setFeedback({
        severity: "success",
        message: `Servidor validado. Administrador: ${emailFinal}`
      });

      if (onComplete) onComplete();
    } catch (error) {
      console.error("[SETUP] Error:", error);
      setFeedback({ severity: "error", message: error.message });
    } finally {
      setSubmitting(false);
    }
  };

  const normalized = normalizeBaseUrl(serverUrl);
  const insecure =
    normalized.startsWith("http://") && !isLocalHost(normalized);

  return (
    <Box
      sx={{
        backgroundColor: "#f4f6f8",
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        p: 2
      }}
    >
      <Paper
        elevation={4}
        sx={{
          p: 4,
          maxWidth: 680,
          width: "100%",
          borderRadius: "12px",
          maxHeight: "95vh",
          overflowY: "auto"
        }}
      >
        <Box sx={{ display: "flex", justifyContent: "center", mb: 2 }}>
          <img
            src={logoImg}
            alt="Logo UVECOE"
            style={{ width: "160px", height: "auto", objectFit: "contain" }}
          />
        </Box>

        <Typography variant="h5" sx={{ fontWeight: "bold", textAlign: "center" }}>
          Configuración inicial
        </Typography>
        <Typography
          variant="body2"
          color="text.secondary"
          sx={{ mt: 1, textAlign: "center" }}
        >
          Conecta este portátil con el servidor OpenECOE y valida un
          administrador antes de continuar.
        </Typography>

        <Alert severity="info" sx={{ mt: 3 }}>
          Introduce la URL base del servidor, sin <code>/backend/api/v1</code>.
        </Alert>

        {feedback && (
          <Alert
            severity={feedback.severity}
            sx={{ mt: 2 }}
            onClose={() => setFeedback(null)}
          >
            {feedback.message}
          </Alert>
        )}

        {insecure && (
          <Alert severity="warning" sx={{ mt: 2 }}>
            La URL usa HTTP sin cifrar. En producción utiliza HTTPS para no
            enviar las credenciales en claro.
          </Alert>
        )}

        <Box
          component="form"
          onSubmit={handleSubmit}
          sx={{ mt: 3, display: "flex", flexDirection: "column", gap: 2 }}
        >
          <Typography variant="subtitle1" sx={{ fontWeight: "bold" }}>
            1. Servidor
          </Typography>

          <Box sx={{ display: "flex", gap: 1, alignItems: "flex-start" }}>
            <TextField
              fullWidth
              name="serverUrl"
              label="URL del servidor"
              value={serverUrl}
              onChange={handleServerUrlChange}
              disabled={busy}
              placeholder="https://ecoe.midominio.es"
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <DnsIcon />
                  </InputAdornment>
                )
              }}
            />

            <Button
              type="button"
              variant="outlined"
              onClick={handleTestConnection}
              disabled={busy || !serverUrl.trim()}
              startIcon={
                testing ? (
                  <CircularProgress size={18} color="inherit" />
                ) : (
                  <CloudDoneIcon />
                )
              }
              sx={{ minWidth: 170, height: 56, flexShrink: 0 }}
            >
              {testing ? "Probando..." : "Probar conexión"}
            </Button>
          </Box>

          {connectionOk && (
            <Alert severity="success">Conexión validada.</Alert>
          )}

          <Divider sx={{ my: 1 }} />

          <Typography variant="subtitle1" sx={{ fontWeight: "bold" }}>
            2. Administrador
          </Typography>

          <TextField
            fullWidth
            required
            name="email"
            label="Email del administrador"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            disabled={busy}
            autoComplete="username"
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <AccountCircleIcon />
                </InputAdornment>
              )
            }}
          />

          <TextField
            fullWidth
            required
            name="password"
            label="Contraseña"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            disabled={busy}
            autoComplete="current-password"
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <LockIcon />
                </InputAdornment>
              )
            }}
          />

          <Button
            type="submit"
            fullWidth
            variant="contained"
            size="large"
            disabled={
              busy || !connectionOk || !email.trim() || !password
            }
            startIcon={
              submitting ? (
                <CircularProgress size={20} color="inherit" />
              ) : (
                <AdminPanelSettingsIcon />
              )
            }
            sx={{
              mt: 1,
              py: 1.4,
              fontWeight: "bold",
              textTransform: "none",
              fontSize: "1.05rem"
            }}
          >
            {submitting ? "Validando..." : "Validar y continuar"}
          </Button>

          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ textAlign: "center" }}
          >
            La contraseña no se guarda en claro; solo se guarda un hash para el
            acceso offline.
          </Typography>
        </Box>
      </Paper>
    </Box>
  );
}
