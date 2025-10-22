import React, { useState } from 'react';
import { Box, Button, Checkbox, FormControlLabel, Paper, Stack, TextField, Typography } from '@mui/material';

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
    <Paper component="form" onSubmit={handleSubmit} sx={{ p: 2 }} variant="outlined">
      <Typography variant="h6" gutterBottom>
        Share hinzufügen
      </Typography>
      <Stack spacing={2}>
        <TextField label="Name" value={name} onChange={(e) => setName(e.target.value)} required />
        <TextField
          label={managed ? 'Unterordner-Name' : 'Pfad im Netzwerk'}
          value={path}
          onChange={(e) => setPath(e.target.value)}
          required
          helperText={managed ? 'Verzeichnis wird unter dem Import-Wurzelpfad angelegt' : 'UNC- oder lokaler Pfad zu überwachen'}
        />
        <FormControlLabel
          control={<Checkbox checked={managed} onChange={(e) => setManaged(e.target.checked)} />}
          label="Verzeichnis durch System verwalten"
        />
        <FormControlLabel
          control={<Checkbox checked={recursive} onChange={(e) => setRecursive(e.target.checked)} />}
          label="Unterordner überwachen"
        />
        <Box textAlign="right">
          <Button type="submit" variant="contained" disabled={loading}>
            Speichern
          </Button>
        </Box>
      </Stack>
    </Paper>
  );
};

export default CreateShareForm;
