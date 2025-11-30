import * as React from 'react';
import Toolbar from "../../components/Toolbar";
import { useNavigate } from "react-router-dom";
import { styled } from '@mui/material/styles';
import TableCell, { tableCellClasses } from '@mui/material/TableCell';
import {
  Table, TableBody, TableContainer, TableHead, TableRow, Paper,
  TableSortLabel, Select, InputLabel, MenuItem, FormControl, TextField
} from "@mui/material";


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

function createData(name, calories, fat, carbs, protein) {
  return { name, calories, fat, carbs, protein };
}

const rows = [
  createData('706', 'Palau Perez, Patricia', 1, 1, 0),
  createData('405', 'Alcantara Barbadillo, Antonio', 1, 1, 0),
  createData('2008', 'Fuerte Barriga, Dolores', 1, 1, 0),
  createData('305', 'Cantudo Torres, Pilar', 1, 1, 0),
  createData('205', 'Rubio Norges, Paulina', 1, 1, 0),
];


export default function Estudents() {
  const navigate = useNavigate();

  const [order, setOrder] = React.useState('asc');
  const [orderBy, setOrderBy] = React.useState('name');

  const handleRequestSort = (property) => {
    const isAsc = orderBy === property && order === 'asc';
    setOrder(isAsc ? 'desc' : 'asc');
    setOrderBy(property);
  };

  function sortRows(array, comparator) {
    return [...array].sort(comparator);
  }

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

  const sortedRows = sortRows(rows, getComparator(order, orderBy));

  const [age, setAge] = React.useState('');
  const handleChange = (event) => setAge(event.target.value);

  return (
    <>
      <Toolbar />
      <div style={{ marginTop: '60px' }}>

        {/* Controles superiores */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <TextField
            id="outlined-basic"
            label="Evaluación"
            variant="outlined"
            value="Estación 1 - Diagnostico y Tratamiento."
            disabled
            sx={{
              width: `${"Estación 1 - Diagnostico y Tratamiento.".length + 2}ch`
            }}
            slotProps={{
              input: { readOnly: true }
            }}
          />

          <FormControl sx={{ m: 1, minWidth: 120 }}>
            <InputLabel id="demo-simple-select-autoWidth-label">Rueda:</InputLabel>
            <Select
              labelId="demo-simple-select-label"
              id="demo-simple-select"
              value={age}
              label="Rueda:"
              onChange={handleChange}
              sx={{ minWidth: 120 }}
            >
              <MenuItem value={0}>Todas</MenuItem>
              <MenuItem value={1}>1</MenuItem>
              <MenuItem value={2}>2</MenuItem>
              <MenuItem value={3}>3</MenuItem>
            </Select>
          </FormControl>
        </div>

        <TableContainer component={Paper}>
          <Table aria-label="customized table" style={{ tableLayout: 'fixed', width: '100%' }}>

            {/* CABECERA ORDENABLE */}
            <TableHead>
              <TableRow>
                {[
                  { id: 'name', label: 'NPI', align: 'left' },
                  { id: 'calories', label: 'Apellidos, Nombre', align: 'left' },
                  { id: 'fat', label: '1', align: 'right' },
                  { id: 'carbs', label: '2', align: 'right' },
                  { id: 'protein', label: '3', align: 'right' },
                ].map((column) => (
                  <StyledTableCell
                    key={column.id}
                    align={column.align}
                    sortDirection={orderBy === column.id ? order : false}
                  >
                    <TableSortLabel
                      active={orderBy === column.id}
                      direction={orderBy === column.id ? order : 'asc'}
                      onClick={() => handleRequestSort(column.id)}
                    >
                      {column.label}
                    </TableSortLabel>
                  </StyledTableCell>
                ))}
              </TableRow>
            </TableHead>

            <TableBody>
              {sortedRows.map((row) => (
                <StyledTableRow key={row.name}>
                  <StyledTableCell>{row.name}</StyledTableCell>
                  <StyledTableCell>{row.calories}</StyledTableCell>
                  <StyledTableCell align="right">{row.fat}</StyledTableCell>
                  <StyledTableCell align="right">{row.carbs}</StyledTableCell>
                  <StyledTableCell align="right">{row.protein}</StyledTableCell>
                </StyledTableRow>
              ))}
            </TableBody>

          </Table>
        </TableContainer>

      </div>
    </>
  );
}
