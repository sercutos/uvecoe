
import React from 'react';
import { Box, IconButton, Tooltip } from '@mui/material';
import SaveIcon from '@mui/icons-material/Save';
import UploadIcon from '@mui/icons-material/Upload';
import GridViewIcon from '@mui/icons-material/GridView';
import BarChartIcon from '@mui/icons-material/BarChart';

export default function Toolbar() {
  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        padding: '8px',
        backgroundColor: '#f5f5f5',
        borderBottom: '1px solid #ddd',
        position: 'fixed',
        top: 0,
        width: '100%',
        zIndex: 1000
      }}
    >
      <Tooltip title="Connect">
        <IconButton><UploadIcon /></IconButton>
      </Tooltip>
      <Tooltip title="Save">
        <IconButton><SaveIcon /></IconButton>
      </Tooltip>
      <Tooltip title="Grid">
        <IconButton><GridViewIcon /></IconButton>
      </Tooltip>
      <Tooltip title="Charts">
        <IconButton><BarChartIcon /></IconButton>
      </Tooltip>
    </Box>
  );
}
