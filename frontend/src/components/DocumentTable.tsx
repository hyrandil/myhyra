import React from 'react';
import {
  Chip,
  IconButton,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip
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
    <TableContainer component={Paper} sx={{ maxHeight: 'calc(100vh - 200px)' }}>
      <Table stickyHeader size="small">
        <TableHead>
          <TableRow>
            <TableCell>Titel</TableCell>
            <TableCell>Erstellt</TableCell>
            <TableCell>Tags</TableCell>
            <TableCell>Größe</TableCell>
            <TableCell align="right">Aktionen</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {documents.map((doc) => (
            <TableRow key={doc.id} hover>
              <TableCell>{doc.title ?? doc.original_filename}</TableCell>
              <TableCell>{dayjs(doc.created_at).format('DD.MM.YYYY HH:mm')}</TableCell>
              <TableCell>
                {doc.tags.map((tag) => (
                  <Chip key={tag.id} label={tag.name} size="small" sx={{ mr: 0.5, mb: 0.5 }} />
                ))}
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
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
};

export default DocumentTable;
