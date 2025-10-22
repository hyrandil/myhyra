import React, { useMemo } from 'react';
import { Box, Chip, Paper, Stack, Typography } from '@mui/material';
import { Share } from '../api';

interface Props {
  shares: Share[];
}

const ShareManager: React.FC<Props> = ({ shares }) => {
  const activeShares = useMemo(() => shares.filter((share) => share.active), [shares]);
  return (
    <Paper sx={{ p: 2 }} variant="outlined">
      <Typography variant="h6" gutterBottom>
        Import-Verzeichnisse
      </Typography>
      <Stack spacing={1}>
        {activeShares.map((share) => (
          <Box key={share.id}>
            <Typography variant="subtitle2">{share.name}</Typography>
            <Typography variant="body2" color="text.secondary">
              {share.path}
            </Typography>
            <Stack direction="row" spacing={1} mt={0.5}>
              {share.managed && <Chip label="Managed" size="small" color="primary" />}
              <Chip label={share.recursive ? 'Rekursiv' : 'Einfach'} size="small" />
            </Stack>
          </Box>
        ))}
        {activeShares.length === 0 && <Typography variant="body2">Keine aktiven Shares.</Typography>}
      </Stack>
    </Paper>
  );
};

export default ShareManager;
