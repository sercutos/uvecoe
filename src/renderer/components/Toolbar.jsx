
import React from 'react';
import { Box, IconButton, Tooltip } from '@mui/material';
import HomeIcon from '@mui/icons-material/Home';
import SaveIcon from '@mui/icons-material/Save';
import UploadIcon from '@mui/icons-material/Upload';
import GridViewIcon from '@mui/icons-material/GridView';
import BarChartIcon from '@mui/icons-material/BarChart';

import { useNavigate } from "react-router-dom";

export default function Toolbar() {
  const navigate = useNavigate();
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
      <Tooltip title="Home">
        <IconButton><HomeIcon onClick={() => navigate("/")} /></IconButton>
      </Tooltip>
      <Tooltip title="Upload">
        <IconButton><UploadIcon onClick={() => navigate("/settings")} /></IconButton>
      </Tooltip>
      <Tooltip title="Save">
        <IconButton><SaveIcon onClick={() => navigate("/students")}/></IconButton>
      </Tooltip>
      <Tooltip title="Grid">
        <IconButton><GridViewIcon onClick={() => navigate("/questions")}/></IconButton>
      </Tooltip>
      <Tooltip title="Charts">
        <IconButton><BarChartIcon onClick={() => navigate("/evaluation")}/></IconButton>
      </Tooltip>
    </Box>
  );
}
