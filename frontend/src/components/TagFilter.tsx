import React from 'react';
import { Box, Chip, Paper, Stack, Typography } from '@mui/material';
import { Tag } from '../api';

interface Props {
  tags: Tag[];
  selected: number[];
  onToggle: (id: number) => void;
}

const TagFilter: React.FC<Props> = ({ tags, selected, onToggle }) => {
  return (
    <Paper
      elevation={0}
      sx={{
        p: 3,
        borderRadius: 3,
        background: (theme) =>
          theme.palette.mode === 'dark'
            ? 'linear-gradient(145deg, rgba(22,25,50,0.95), rgba(12,15,32,0.85))'
            : 'linear-gradient(145deg, rgba(255,255,255,0.92), rgba(241,244,255,0.9))',
        border: (theme) => `1px solid ${theme.palette.divider}`
      }}
    >
      <Stack spacing={2}>
        <Box>
          <Typography variant="subtitle1" fontWeight={600} gutterBottom>
            Tags
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Wählen Sie mehrere Tags aus, um die Ergebnisliste zu filtern.
          </Typography>
        </Box>
        <Box display="flex" flexWrap="wrap" gap={1}>
          {tags.map((tag) => {
            const isSelected = selected.includes(tag.id);
            return (
              <Chip
                key={tag.id}
                label={tag.name}
                color={isSelected ? 'primary' : 'default'}
                variant={isSelected ? 'filled' : 'outlined'}
                onClick={() => onToggle(tag.id)}
                sx={{
                  borderRadius: 2,
                  px: 1.5,
                  fontWeight: isSelected ? 600 : 500,
                  boxShadow: isSelected ? '0 8px 18px rgba(91,103,242,0.25)' : 'none'
                }}
              />
            );
          })}
        </Box>
        {tags.length === 0 && (
          <Typography variant="body2" color="text.secondary">
            Noch keine Tags vorhanden – legen Sie beim Upload neue Schlagwörter an.
          </Typography>
        )}
      </Stack>
    </Paper>
  );
};

export default TagFilter;
