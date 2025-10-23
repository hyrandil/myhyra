import React, { useMemo } from 'react';
import { Box, Chip, Divider, Paper, Stack, Typography } from '@mui/material';
import { Share } from '../api';

interface Props {
  shares: Share[];
}

const ShareManager: React.FC<Props> = ({ shares }) => {
  const activeShares = useMemo(() => shares.filter((share) => share.active), [shares]);
  return (
    <Paper
      elevation={0}
      sx={{
        p: 3,
        borderRadius: 3,
        border: (theme) => `1px solid ${theme.palette.divider}`,
        background: (theme) =>
          theme.palette.mode === 'dark'
            ? 'linear-gradient(160deg, rgba(18,22,45,0.94), rgba(10,13,28,0.82))'
            : 'linear-gradient(160deg, rgba(255,255,255,0.94), rgba(240,244,255,0.9))'
      }}
    >
      <Stack spacing={2.5}>
        <Box>
          <Typography variant="h6" fontWeight={600} gutterBottom>
            Import-Verzeichnisse
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Behalten Sie den Überblick über alle Shares, die automatisch überwacht werden.
          </Typography>
        </Box>
        <Stack spacing={2} divider={<Divider flexItem sx={{ opacity: 0.2 }} />}> 
          {activeShares.map((share) => (
            <Box key={share.id}>
              <Typography variant="subtitle1" fontWeight={600}>
                {share.name}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {share.path}
              </Typography>
              <Stack direction="row" spacing={1} mt={1}>
                {share.managed && (
                  <Chip label="Managed" size="small" color="primary" sx={{ borderRadius: 1 }} />
                )}
                <Chip
                  label={share.recursive ? 'Rekursiv' : 'Einfach'}
                  size="small"
                  variant="outlined"
                  sx={{ borderRadius: 1 }}
                />
              </Stack>
            </Box>
          ))}
        </Stack>
        {activeShares.length === 0 && (
          <Typography variant="body2" color="text.secondary">
            Keine aktiven Shares – richten Sie unten neue Import-Verzeichnisse ein.
          </Typography>
        )}
      </Stack>
    </Paper>
  );
};

export default ShareManager;
