import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AppBar,
  Avatar,
  Box,
  Button,
  Container,
  CssBaseline,
  Grid,
  IconButton,
  InputAdornment,
  Paper,
  Stack,
  TextField,
  ThemeProvider,
  Toolbar,
  Tooltip,
  Typography,
  createTheme
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import LogoutIcon from '@mui/icons-material/Logout';
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined';
import FolderSharedOutlinedIcon from '@mui/icons-material/FolderSharedOutlined';
import LocalOfferOutlinedIcon from '@mui/icons-material/LocalOfferOutlined';
import StorageRoundedIcon from '@mui/icons-material/StorageRounded';

import LoginForm from './components/LoginForm';
import DocumentTable from './components/DocumentTable';
import TagFilter from './components/TagFilter';
import UploadDialog from './components/UploadDialog';
import ShareManager from './components/ShareManager';
import ThemeToggle from './components/ThemeToggle';
import CreateShareForm from './components/CreateShareForm';
import MetricCard from './components/MetricCard';
import { AuthProvider, useAuth } from './hooks/useAuth';
import {
  createShare,
  createTag,
  fetchDocuments,
  fetchShares,
  fetchTags,
  Document,
  Share,
  Tag,
  uploadDocument
} from './api';

const Dashboard: React.FC = () => {
  const { token, user, logout } = useAuth();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [shares, setShares] = useState<Share[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTags, setSelectedTags] = useState<number[]>([]);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [themeMode, setThemeMode] = useState<'light' | 'dark'>(() =>
    (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
  );

  const loadDocuments = useCallback(async () => {
    const docs = await fetchDocuments(searchQuery, selectedTags);
    setDocuments(docs);
  }, [searchQuery, selectedTags]);

  const loadTags = useCallback(async () => {
    const list = await fetchTags();
    setTags(list);
  }, []);

  const loadShares = useCallback(async () => {
    const list = await fetchShares();
    setShares(list);
  }, []);

  useEffect(() => {
    if (token) {
      loadDocuments();
      loadTags();
      loadShares();
    }
  }, [token, loadDocuments, loadTags, loadShares]);

  useEffect(() => {
    if (!token) return;
    const handle = setTimeout(() => {
      loadDocuments();
    }, 300);
    return () => clearTimeout(handle);
  }, [searchQuery, selectedTags, token, loadDocuments]);

  const theme = useMemo(
    () =>
      createTheme({
        palette: {
          mode: themeMode,
          primary: {
            main: '#5B67F2'
          },
          background: {
            default: themeMode === 'dark' ? '#0B0D1A' : '#eef1ff'
          }
        },
        typography: {
          fontFamily: '"Inter", "Helvetica Neue", Arial, sans-serif'
        },
        components: {
          MuiPaper: {
            styleOverrides: {
              root: {
                backdropFilter: 'blur(18px)'
              }
            }
          },
          MuiTableHead: {
            styleOverrides: {
              root: {
                '& .MuiTableCell-root': {
                  backgroundColor: themeMode === 'dark' ? 'rgba(15,19,40,0.9)' : 'rgba(244,247,255,0.8)'
                }
              }
            }
          }
        }
      }),
    [themeMode]
  );

  const totalSizeBytes = useMemo(
    () => documents.reduce((sum, doc) => sum + (doc.size_bytes ?? 0), 0),
    [documents]
  );

  const activeShares = useMemo(() => shares.filter((share) => share.active), [shares]);

  const formatSize = (bytes: number) => {
    if (!bytes) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let size = bytes;
    let unitIndex = 0;
    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex += 1;
    }
    return `${size.toFixed(size >= 10 || unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
  };

  const handleTagToggle = (id: number) => {
    setSelectedTags((prev) => (prev.includes(id) ? prev.filter((tag) => tag !== id) : [...prev, id]));
  };

  const handleUpload = async (file: File, tagNames: string[]) => {
    const missingTags = tagNames.filter((name) => !tags.some((tag) => tag.name === name));
    await Promise.all(missingTags.map((name) => createTag(name)));
    await uploadDocument(file, tagNames);
    await loadDocuments();
    await loadTags();
  };

  const handleCreateShare = async (data: { name: string; path: string; managed: boolean; recursive: boolean }) => {
    await createShare(data);
    await loadShares();
  };

  const toggleTheme = () => {
    setThemeMode((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  if (!token || !user) {
    return <LoginForm />;
  }

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box
        sx={{
          minHeight: '100vh',
          background: themeMode === 'dark'
            ? 'radial-gradient(115% 115% at 0% 0%, rgba(91,103,242,0.35) 0%, rgba(6,8,18,1) 55%, rgba(7,9,20,1) 100%)'
            : 'linear-gradient(135deg, #f3f5ff 0%, #ffffff 45%, #eef1ff 100%)'
        }}
      >
        <AppBar
          position="sticky"
          color="transparent"
          elevation={0}
          sx={{
            backdropFilter: 'blur(16px)',
            borderBottom: (theme) => `1px solid ${theme.palette.divider}`,
            backgroundColor: themeMode === 'dark' ? 'rgba(8,10,21,0.75)' : 'rgba(255,255,255,0.72)'
          }}
        >
          <Toolbar sx={{ py: 1.5 }}>
            <Stack direction="row" spacing={2} alignItems="center" sx={{ flexGrow: 1 }}>
              <Avatar sx={{ bgcolor: 'primary.main', color: 'primary.contrastText' }}>
                {user.username.charAt(0).toUpperCase()}
              </Avatar>
              <Box>
                <Typography variant="subtitle2" color="text.secondary">
                  Willkommen zurück
                </Typography>
                <Typography variant="h6" fontWeight={700}>
                  {user.username}
                </Typography>
              </Box>
            </Stack>
            <TextField
              variant="outlined"
              size="small"
              placeholder="Suche nach Dokumenten"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              sx={{ mr: 2, width: { xs: 200, sm: 260, lg: 340 } }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon fontSize="small" />
                  </InputAdornment>
                )
              }}
            />
            <Button
              variant="contained"
              onClick={() => setUploadOpen(true)}
              sx={{ mr: 1, borderRadius: 2, px: 3, py: 1 }}
            >
              Dokument hochladen
            </Button>
            <Tooltip title="Theme wechseln">
              <Box>
                <ThemeToggle mode={themeMode} onToggle={toggleTheme} />
              </Box>
            </Tooltip>
            <Tooltip title="Abmelden">
              <IconButton color="inherit" onClick={logout}>
                <LogoutIcon />
              </IconButton>
            </Tooltip>
          </Toolbar>
        </AppBar>
        <Container maxWidth="xl" sx={{ py: { xs: 4, md: 6 }, pb: 8 }}>
          <Stack spacing={5}>
            <Box>
              <Typography variant="h4" fontWeight={700} gutterBottom>
                Ihr Dokumenten-Hub
              </Typography>
              <Typography variant="body1" color="text.secondary" maxWidth="sm">
                Suchen, verwalten und überwachen Sie alle Dokumente, Tags und Netzwerkfreigaben in einer klaren Oberfläche.
              </Typography>
            </Box>
            <Grid container spacing={3}>
              <Grid item xs={12} sm={6} lg={3}>
                <MetricCard
                  title="Dokumente"
                  value={documents.length.toString()}
                  caption="Verfügbare Einträge"
                  icon={<DescriptionOutlinedIcon />}
                />
              </Grid>
              <Grid item xs={12} sm={6} lg={3}>
                <MetricCard
                  title="Aktive Shares"
                  value={activeShares.length.toString()}
                  caption="Aktuell überwachte Verzeichnisse"
                  icon={<FolderSharedOutlinedIcon />}
                />
              </Grid>
              <Grid item xs={12} sm={6} lg={3}>
                <MetricCard
                  title="Tags"
                  value={tags.length.toString()}
                  caption="Verfügbare Klassifizierungen"
                  icon={<LocalOfferOutlinedIcon />}
                />
              </Grid>
              <Grid item xs={12} sm={6} lg={3}>
                <MetricCard
                  title="Speicher"
                  value={formatSize(totalSizeBytes)}
                  caption="Belegter Dokumentenspeicher"
                  icon={<StorageRoundedIcon />}
                />
              </Grid>
            </Grid>
            <Grid container spacing={3} alignItems="stretch">
              <Grid item xs={12} lg={8}>
                <Paper
                  elevation={0}
                  sx={{
                    p: { xs: 2.5, md: 3 },
                    borderRadius: 3,
                    border: (theme) => `1px solid ${theme.palette.divider}`,
                    height: '100%',
                    background: (theme) =>
                      theme.palette.mode === 'dark'
                        ? 'linear-gradient(150deg, rgba(17,20,42,0.96), rgba(9,12,28,0.88))'
                        : 'linear-gradient(150deg, rgba(255,255,255,0.95), rgba(232,237,255,0.9))'
                  }}
                >
                  <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', sm: 'center' }} spacing={2} mb={3}>
                    <Box>
                      <Typography variant="h6" fontWeight={600}>
                        Dokumentenübersicht
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Alle importierten Dateien mit Live-Suche und Tag-Filter.
                      </Typography>
                    </Box>
                    <Button variant="outlined" onClick={loadDocuments}>
                      Aktualisieren
                    </Button>
                  </Stack>
                  <DocumentTable documents={documents} />
                </Paper>
              </Grid>
              <Grid item xs={12} lg={4}>
                <Stack spacing={3}>
                  <TagFilter tags={tags} selected={selectedTags} onToggle={handleTagToggle} />
                  <ShareManager shares={shares} />
                  <CreateShareForm onCreate={handleCreateShare} />
                </Stack>
              </Grid>
            </Grid>
          </Stack>
        </Container>
        <UploadDialog open={uploadOpen} onClose={() => setUploadOpen(false)} onUpload={handleUpload} />
      </Box>
    </ThemeProvider>
  );
};

const App: React.FC = () => (
  <AuthProvider>
    <Dashboard />
  </AuthProvider>
);

export default App;
