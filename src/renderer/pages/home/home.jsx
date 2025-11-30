import Toolbar from "../../components/Toolbar";
import { useNavigate } from "react-router-dom";

export default function Settings() {
  const navigate = useNavigate();
  return (    
    <>
      <Toolbar />

      <Box sx={{ p: 4, marginTop: "60px" }}>
        <Typography variant="h4" gutterBottom>Usuarios</Typography>

        {/* Input para agregar usuario */}
        <Box sx={{ display: "flex", gap: 2, mb: 4 }}>
          <TextField
            label="Nuevo usuario"
            value={newUser}
            onChange={(e) => setNewUser(e.target.value)}
          />
          <Button variant="contained" onClick={addUser}>
            Agregar
          </Button>
        </Box>

        {/* Tabla */}
        <Typography variant="h5" gutterBottom>Tabla de Usuarios</Typography>
        <TableContainer component={Paper} sx={{ mb: 4 }}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>ID</TableCell>
                <TableCell>Nombre</TableCell>
                <TableCell>Fecha de creación</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {users.map((u) => (
                <TableRow key={u.id}>
                  <TableCell>{u.id}</TableCell>
                  <TableCell>{u.name}</TableCell>
                  <TableCell>{u.created_at}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>

        {/* Select */}
        <Typography variant="h5" gutterBottom>Seleccione un Usuario</Typography>
        <FormControl sx={{ minWidth: 200 }}>
          <InputLabel>Usuario</InputLabel>
          <Select
            value={selectedUser}
            label="Usuario"
            onChange={(e) => setSelectedUser(e.target.value)}
          >
            {users.map((u) => (
              <MenuItem key={u.id} value={u.id}>
                {u.name}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Box>
    </>
  );
}