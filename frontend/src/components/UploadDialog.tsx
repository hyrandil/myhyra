import React, { useState } from 'react';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  TextField,
  Typography
} from '@mui/material';

interface Props {
  open: boolean;
  onClose: () => void;
  onUpload: (file: File, tags: string[]) => Promise<void>;
}

const UploadDialog: React.FC<Props> = ({ open, onClose, onUpload }) => {
  const [file, setFile] = useState<File | null>(null);
  const [tags, setTags] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleUpload = async () => {
    if (!file) return;
    setSubmitting(true);
    const tagList = tags.split(',').map((t) => t.trim()).filter(Boolean);
    await onUpload(file, tagList);
    setFile(null);
    setTags('');
    setSubmitting(false);
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>
        <Typography variant="h6" fontWeight={600}>
          Dokument hochladen
        </Typography>
      </DialogTitle>
      <DialogContent>
        <Stack spacing={3} mt={1}>
          <Button
            variant="contained"
            component="label"
            sx={{
              py: 1.5,
              borderRadius: 2,
              boxShadow: '0 12px 30px rgba(91,103,242,0.35)'
            }}
          >
            {file ? 'Andere Datei auswählen' : 'Datei auswählen'}
            <input type="file" hidden onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          </Button>
          {file && (
            <Box
              sx={{
                px: 2,
                py: 1,
                borderRadius: 2,
                bgcolor: 'action.hover',
                display: 'flex',
                alignItems: 'center'
              }}
            >
              <Typography variant="body2">{file.name}</Typography>
            </Box>
          )}
          <TextField
            label="Tags (Kommagetrennt)"
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            helperText="Neue Tags werden automatisch angelegt"
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Abbrechen</Button>
        <Button onClick={handleUpload} disabled={!file || submitting} variant="contained">
          Hochladen
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default UploadDialog;
