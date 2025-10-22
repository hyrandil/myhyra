import React, { useState } from 'react';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  TextField
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
      <DialogTitle>Dokument hochladen</DialogTitle>
      <DialogContent>
        <Stack spacing={2} mt={1}>
          <Button variant="outlined" component="label">
            Datei auswählen
            <input type="file" hidden onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          </Button>
          {file && <Box>{file.name}</Box>}
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
