import React, { useState } from 'react';
import {
  Box,
  Button,
  Checkbox,
  FormControlLabel,
  LinearProgress,
  Paper,
  Stack,
  TextField,
  Typography
} from '@mui/material';

interface Props {
  onCreate: (data: { name: string; path: string; managed: boolean; recursive: boolean }) => Promise<void>;
}

const CreateShareForm: React.FC<Props> = ({ onCreate }) => {
  const [name, setName] = useState('');
  const [path, setPath] = useState('');
  const [managed, setManaged] = useState(false);
  const [recursive, setRecursive] = useState(true);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    await onCreate({ name, path, managed, recursive });
    setName('');
    setPath('');
    setManaged(false);
    setRecursive(true);
    setLoading(false);
  };

  return (
    <Paper
      component="form"
      onSubmit={handleSubmit}
      elevation={0}
      sx={{
        p: 3,
        borderRadius: 3,
        border: (theme) => `1px solid ${theme.palette.divider}`,
        background: (theme) =>
          theme.palette.mode === 'dark'
            ? 'linear-gradient(165deg, rgba(20,24,48,0.96), rgba(12,16,36,0.86))'
            : 'linear-gradient(165deg, rgba(255,255,255,0.95), rgba(238,243,255,0.9))'
      }}
    >
      <Stack spacing={3}>
        <Box>
          <Typography variant="h6" fontWeight={600} gutterBottom>
            Share hinzufügen
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Legen Sie neue Importquellen fest, die automatisch überwacht und verarbeitet werden.
          </Typography>
        </Box>
        <TextField label="Name" value={name} onChange={(e) => setName(e.target.value)} required fullWidth />
        <TextField
          label={managed ? 'Unterordner-Name' : 'Pfad im Netzwerk'}
          value={path}
          onChange={(e) => setPath(e.target.value)}
          required
          fullWidth
          helperText={
            managed
              ? 'Verzeichnis wird unter dem Import-Wurzelpfad angelegt'
              : 'UNC- oder lokaler Pfad, der überwacht werden soll'
          }
        />
        <FormControlLabel
          control={<Checkbox checked={managed} onChange={(e) => setManaged(e.target.checked)} />}
          label="Verzeichnis durch System verwalten"
        />
        <FormControlLabel
          control={<Checkbox checked={recursive} onChange={(e) => setRecursive(e.target.checked)} />}
          label="Unterordner überwachen"
        />
        {loading && <LinearProgress color="primary" sx={{ borderRadius: 1 }} />}
        <Box textAlign="right">
          <Button type="submit" variant="contained" disabled={loading} size="large">
            Speichern
          </Button>
        </Box>
      </Stack>
    </Paper>
  );
};

export default CreateShareForm;
