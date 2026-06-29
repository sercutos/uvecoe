import { useNavigate } from "react-router-dom";
import React, { useEffect, useState } from "react";
import { styled } from '@mui/material/styles';
import TableCell, { tableCellClasses } from '@mui/material/TableCell';
import { 
  Table, TableBody, TableContainer, TableHead, TableRow, 
  Paper, Button, TextField, Select, MenuItem, Typography, Box, FormControl, InputLabel 
} from "@mui/material";

import Toolbar from "../../components/Toolbar";

const StyledTableCell = styled(TableCell)(({ theme }) => ({
  [`&.${tableCellClasses.head}`]: {    
    backgroundColor: '#3d5afe',
    color: theme.palette.common.white,
  },
  [`&.${tableCellClasses.body}`]: {
    fontSize: 14,
  },
}));

const StyledTableRow = styled(TableRow)(({ theme }) => ({
  '&:nth-of-type(odd)': {
    backgroundColor: theme.palette.action.hover,
  },
  // hide last border
  '&:last-child td, &:last-child th': {
    border: 1,
  },
}));


export default function Students() {
  const navigate = useNavigate();
  // 1. Declarar el estado SIEMPRE en la raíz del componente
  const [students, setStudents] = useState([]);

  // 2. Función para obtener los datos
  const fetchStudents = async () => {
    try {
      const data = await window.api.getStudents();
      setStudents(data || []); // Guardar los datos en el estado
    } catch (error) {
      console.error("Error al cargar estudiantes:", error);
    }
  };

  // 3. Ejecutar la función automáticamente cuando se carga el componente
  useEffect(() => {
    fetchStudents();
  }, []);

  const [order, setOrder] = React.useState('asc');
    const [orderBy, setOrderBy] = React.useState('name');
  
    const handleRequestSort = (property) => {
      const isAsc = orderBy === property && order === 'asc';
      setOrder(isAsc ? 'desc' : 'asc');
      setOrderBy(property);
    };
  
 
  
    function getComparator(order, orderBy) {
      return order === 'desc'
        ? (a, b) => descendingComparator(a, b, orderBy)
        : (a, b) => -descendingComparator(a, b, orderBy);
    }
  
    function descendingComparator(a, b, orderBy) {
      if (b[orderBy] < a[orderBy]) return -1;
      if (b[orderBy] > a[orderBy]) return 1;
      return 0;
    }
  
      
    

  return (    
    <>
      <Toolbar />
   
      <Box sx={{ p: 4, marginTop: "60px" }}>
        <Typography variant="h4" gutterBottom>Students</Typography>     
        
        <Typography variant="h5" gutterBottom>Table of Students</Typography>
        <TableContainer component={Paper} sx={{ mb: 4 }}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>ID</TableCell>
                <TableCell>DNI</TableCell>
                <TableCell>Name</TableCell>
                <TableCell>Surnames</TableCell>                
              </TableRow>
            </TableHead>
            <TableBody>
              {students.map((u) => (
                <TableRow key={u.id}>
                  <TableCell>{u.id}</TableCell>
                  <TableCell>{u.dni}</TableCell>
                  <TableCell>{u.name}</TableCell>
                  <TableCell>{u.surnames}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>        
      </Box>
    </>
  );
}