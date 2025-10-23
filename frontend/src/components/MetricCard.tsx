import React from 'react';
import { Box, Paper, Typography } from '@mui/material';

interface MetricCardProps {
  title: string;
  value: string;
  icon: React.ReactNode;
  caption?: string;
}

const MetricCard: React.FC<MetricCardProps> = ({ title, value, icon, caption }) => {
  return (
    <Paper
      elevation={0}
      sx={{
        position: 'relative',
        p: 3,
        borderRadius: 3,
        height: '100%',
        overflow: 'hidden',
        border: (theme) => `1px solid ${theme.palette.divider}`,
        background: (theme) =>
          theme.palette.mode === 'dark'
            ? 'linear-gradient(160deg, rgba(27,31,64,0.95), rgba(14,17,38,0.88))'
            : 'linear-gradient(160deg, rgba(255,255,255,0.95), rgba(235,240,255,0.9))'
      }}
    >
      <Box
        sx={{
          width: 44,
          height: 44,
          borderRadius: 2,
          display: 'grid',
          placeItems: 'center',
          color: 'primary.contrastText',
          bgcolor: 'primary.main',
          mb: 2,
          boxShadow: '0 12px 30px rgba(91,103,242,0.35)'
        }}
      >
        {icon}
      </Box>
      <Typography variant="subtitle2" color="text.secondary" gutterBottom fontWeight={600}>
        {title}
      </Typography>
      <Typography variant="h4" component="div" fontWeight={700}>
        {value}
      </Typography>
      {caption && (
        <Typography variant="body2" color="text.secondary" mt={1}>
          {caption}
        </Typography>
      )}
    </Paper>
  );
};

export default MetricCard;
