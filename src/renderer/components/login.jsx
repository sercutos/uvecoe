
import React, { useState } from 'react';
import { TextField, Button, Box, Typography, Paper } from '@mui/material';

export default function Login({ onLogin }) {
  // Declaración de los valores de estado iniciales
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError]       = useState('');

 const handleSubmit = async (e) => {
    e.preventDefault();

    const result = await await window.api.invoke("login", {
      email,
      password
    });

    if (result.success) {
      localStorage.setItem("user", JSON.stringify(result.user));
      onLogin();
    } else {
      setError("Credenciales incorrectas");
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
            label="Email"
            variant="outlined"
            fullWidth
            margin="normal"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
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
