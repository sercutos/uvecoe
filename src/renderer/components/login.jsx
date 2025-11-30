
import React, { useState } from 'react';
import { TextField, Button, Box, Typography, Paper } from '@mui/material';

export default function Login({ onLogin }) {
  // Declaración de los valores de estado iniciales
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError]       = useState('');

  const handleSubmit = (e) => {
      e.preventDefault(); // evita recarga de página
      // Ejemplo de validación simple
      if (username === "admin" && password === "1234") {
        onLogin(); // callback para avisar a la app que el login fue correcto
      } else {
        setError("Usuario o contraseña incorrectos");
      }
    };

  return (
    <Box
      sx={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        backgroundColor: '#1976d2'
      }}
    >
      <Paper elevation={3} sx={{ padding: 4, width: 300 }}>
        <Typography variant="h5" gutterBottom>
          Iniciar sesión
        </Typography>
        <form onSubmit={handleSubmit}>
          <TextField
            label="Usuario"
            variant="outlined"
            fullWidth
            margin="normal"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
          <TextField
            label="Contraseña"
            type="password"
            variant="outlined"
            fullWidth
            margin="normal"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {error && (
            <Typography color="error" variant="body2">
              {error}
            </Typography>
          )}
          <Button
            type="submit"
            variant="contained"
            color="primary"
            fullWidth
            sx={{ marginTop: 2 }}            
          >
            Entrar
          </Button>
        </form>
      </Paper>
    </Box>
  );
}
