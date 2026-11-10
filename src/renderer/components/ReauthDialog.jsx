import React, { useEffect, useState } from "react";
import {
  Alert,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  TextField
} from "@mui/material";

import {
  fetchCurrentUser,
  loginOnline,
  persistLogin
} from "../utils/auth";

// Reconexión sin salir de la pantalla de evaluación.
export default function ReauthDialog({ open, onClose, onSuccess }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const emailLocked = Boolean(sessionStorage.getItem("user_email"));

  useEffect(() => {
    if (!open) return;

    setEmail(sessionStorage.getItem("user_email") || "");
    setPassword("");
    setError(null);
  }, [open]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (submitting) return;

    setSubmitting(true);
    setError(null);

    const emailLimpio = email.trim().toLowerCase();

    try {
      const data = await loginOnline(emailLimpio, password);

      let me = null;
      try {
        me = await fetchCurrentUser(data.token);
      } catch (meError) {
        console.warn(
          "[REAUTH] No se pudo leer /users/me:",
          meError.message
        );
      }

      await persistLogin({
        token: data.token,
        expiration: data.expiration,
        me,
        email: emailLimpio,
        password
      });

      onClose();
      if (onSuccess) onSuccess();
    } catch (loginError) {
      if (loginError.status === 401 || loginError.status === 403) {
        setError("Usuario o contraseña incorrectos.");
      } else if (
        loginError.name === "TimeoutError" ||
        loginError.name === "AbortError"
      ) {
        setError(
          "El servidor no respondió. Puedes seguir evaluando y reconectar más tarde."
        );
      } else if (loginError instanceof TypeError) {
        setError(
          "No hay conexión. Puedes seguir evaluando y reconectar cuando vuelva la red."
        );
      } else {
        setError(loginError.message || "No se pudo reconectar.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={submitting ? undefined : onClose}
      maxWidth="xs"
      fullWidth
    >
      <form onSubmit={handleSubmit}>
        <DialogTitle>Reconectar con el servidor</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ mb: 2 }}>
            La sesión del servidor no está disponible. Las respuestas siguen
            guardadas en este portátil: puedes seguir evaluando y reconectar
            para sincronizarlas.
          </DialogContentText>

          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}

          <TextField
            fullWidth
            required
            autoFocus={!emailLocked}
            margin="dense"
            label="Usuario / Email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            disabled={submitting || emailLocked}
            autoComplete="username"
          />
          <TextField
            fullWidth
            required
            autoFocus={emailLocked}
            margin="dense"
            label="Contraseña"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            disabled={submitting}
            autoComplete="current-password"
          />
        </DialogContent>

        <DialogActions>
          <Button onClick={onClose} disabled={submitting}>
            Ahora no
          </Button>
          <Button
            type="submit"
            variant="contained"
            disabled={submitting || !email.trim() || !password}
          >
            {submitting ? (
              <CircularProgress size={20} color="inherit" />
            ) : (
              "Reconectar"
            )}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
