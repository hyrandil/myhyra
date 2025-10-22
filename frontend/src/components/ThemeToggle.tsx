import React from 'react';
import { IconButton, Tooltip } from '@mui/material';
import DarkModeIcon from '@mui/icons-material/DarkMode';
import LightModeIcon from '@mui/icons-material/LightMode';

interface Props {
  mode: 'light' | 'dark';
  onToggle: () => void;
}

const ThemeToggle: React.FC<Props> = ({ mode, onToggle }) => {
  return (
    <Tooltip title="Theme wechseln">
      <IconButton color="inherit" onClick={onToggle}>
        {mode === 'dark' ? <LightModeIcon /> : <DarkModeIcon />}
      </IconButton>
    </Tooltip>
  );
};

export default ThemeToggle;
