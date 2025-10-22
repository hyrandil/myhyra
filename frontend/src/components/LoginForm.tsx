import React, { useState } from 'react';
import { Box, Button, Paper, Stack, TextField, Typography } from '@mui/material';
import { useAuth } from '../hooks/useAuth';

const LoginForm: React.FC = () => {
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [totp, setTotp] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await login(username, password, totp || undefined);
    } catch (err) {
      setError('Anmeldung fehlgeschlagen. Bitte Zugangsdaten prüfen.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box display="flex" justifyContent="center" alignItems="center" minHeight="100vh">
      <Paper elevation={6} sx={{ p: 4, width: 360 }} component="form" onSubmit={handleSubmit}>
        <Stack spacing={2}>
          <Typography variant="h5" textAlign="center">
            MyHyra DMS Login
          </Typography>
          <TextField label="Benutzername" value={username} onChange={(e) => setUsername(e.target.value)} required fullWidth />
          <TextField
            label="Passwort"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            fullWidth
          />
          <TextField
            label="2FA Code (optional)"
            value={totp}
            onChange={(e) => setTotp(e.target.value)}
            helperText="Nur notwendig, wenn Zwei-Faktor aktiviert ist"
            fullWidth
          />
          {error && (
            <Typography color="error" variant="body2">
              {error}
            </Typography>
          )}
          <Button type="submit" variant="contained" disabled={loading} size="large">
            {loading ? 'Anmeldung...' : 'Anmelden'}
          </Button>
        </Stack>
      </Paper>
    </Box>
  );
};

export default LoginForm;
