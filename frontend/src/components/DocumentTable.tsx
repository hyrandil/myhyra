import React from 'react';
import {
  Box,
  Chip,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
  Typography
} from '@mui/material';
import DownloadIcon from '@mui/icons-material/Download';
import VisibilityIcon from '@mui/icons-material/Visibility';
import dayjs from 'dayjs';
import { Document } from '../api';

interface Props {
  documents: Document[];
}

const formatSize = (bytes?: number | null) => {
  if (!bytes) return '—';
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes;
  let unitIndex = 0;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }
  return `${size.toFixed(1)} ${units[unitIndex]}`;
};

const DocumentTable: React.FC<Props> = ({ documents }) => {
  return (
    <TableContainer sx={{ maxHeight: { xs: 360, lg: 'calc(100vh - 320px)' } }}>
      <Table stickyHeader size="small">
        <TableHead>
          <TableRow>
            <TableCell sx={{ fontWeight: 600 }}>Titel</TableCell>
            <TableCell sx={{ fontWeight: 600 }}>Erstellt</TableCell>
            <TableCell sx={{ fontWeight: 600 }}>Tags</TableCell>
            <TableCell sx={{ fontWeight: 600 }}>Größe</TableCell>
            <TableCell align="right" sx={{ fontWeight: 600 }}>
              Aktionen
            </TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {documents.length === 0 ? (
            <TableRow>
              <TableCell colSpan={5} sx={{ py: 6 }}>
                <Box textAlign="center">
                  <Typography variant="subtitle1" fontWeight={600} gutterBottom>
                    Noch keine Dokumente vorhanden
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Laden Sie Ihr erstes Dokument hoch oder verbinden Sie ein Import-Verzeichnis, um hier Inhalte zu sehen.
                  </Typography>
                </Box>
              </TableCell>
            </TableRow>
          ) : (
            documents.map((doc) => (
              <TableRow key={doc.id} hover sx={{ transition: 'background-color 0.2s ease' }}>
                <TableCell sx={{ maxWidth: 280, fontWeight: doc.title ? 600 : undefined }}>
                  {doc.title ?? doc.original_filename}
                </TableCell>
                <TableCell sx={{ whiteSpace: 'nowrap' }}>
                  {dayjs(doc.created_at).format('DD.MM.YYYY HH:mm')}
                </TableCell>
                <TableCell>
                  {doc.tags.length > 0 ? (
                    doc.tags.map((tag) => (
                      <Chip
                        key={tag.id}
                        label={tag.name}
                        size="small"
                        color="primary"
                        variant="outlined"
                        sx={{ mr: 0.5, mb: 0.5, fontWeight: 500 }}
                      />
                    ))
                  ) : (
                    <Typography variant="caption" color="text.secondary">
                      Keine Tags
                    </Typography>
                  )}
                </TableCell>
                <TableCell>{formatSize(doc.size_bytes)}</TableCell>
                <TableCell align="right">
                  <Tooltip title="Vorschau">
                    <IconButton size="small" component="a" href={`/api/documents/${doc.id}/download`} target="_blank">
                      <VisibilityIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Download">
                    <IconButton size="small" component="a" href={`/api/documents/${doc.id}/download`} download>
                      <DownloadIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </TableContainer>
  );
};

export default DocumentTable;
