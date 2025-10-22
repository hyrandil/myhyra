import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AppBar,
  Box,
  Button,
  Container,
  CssBaseline,
  IconButton,
  InputAdornment,
  TextField,
  ThemeProvider,
  Toolbar,
  Typography,
  createTheme
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import LogoutIcon from '@mui/icons-material/Logout';

import LoginForm from './components/LoginForm';
import DocumentTable from './components/DocumentTable';
import TagFilter from './components/TagFilter';
import UploadDialog from './components/UploadDialog';
import ShareManager from './components/ShareManager';
import ThemeToggle from './components/ThemeToggle';
import CreateShareForm from './components/CreateShareForm';
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

  const theme = useMemo(() =>
    createTheme({
      palette: {
        mode: themeMode,
        primary: {
          main: '#5B67F2'
        },
        background: {
          default: themeMode === 'dark' ? '#101223' : '#f3f4f6'
        }
      }
    }), [themeMode]);

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
      <AppBar position="static" color="transparent" elevation={0} sx={{ backdropFilter: 'blur(12px)' }}>
        <Toolbar>
          <Typography variant="h6" sx={{ flexGrow: 1 }}>
            MyHyra DMS
          </Typography>
          <TextField
            variant="outlined"
            size="small"
            placeholder="Suche"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            sx={{ mr: 2, width: 260 }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" />
                </InputAdornment>
              )
            }}
          />
          <Button variant="contained" onClick={() => setUploadOpen(true)} sx={{ mr: 1 }}>
            Dokument hochladen
          </Button>
          <ThemeToggle mode={themeMode} onToggle={toggleTheme} />
          <IconButton color="inherit" onClick={logout}>
            <LogoutIcon />
          </IconButton>
        </Toolbar>
      </AppBar>
      <Container maxWidth="xl" sx={{ py: 3 }}>
        <Box display="grid" gridTemplateColumns={{ xs: '1fr', md: '2fr 1fr' }} gap={3}>
          <Box>
            <DocumentTable documents={documents} />
          </Box>
          <Box display="flex" flexDirection="column" gap={3}>
            <TagFilter tags={tags} selected={selectedTags} onToggle={handleTagToggle} />
            <ShareManager shares={shares} />
            <CreateShareForm onCreate={handleCreateShare} />
          </Box>
        </Box>
      </Container>
      <UploadDialog open={uploadOpen} onClose={() => setUploadOpen(false)} onUpload={handleUpload} />
    </ThemeProvider>
  );
};

const App: React.FC = () => (
  <AuthProvider>
    <Dashboard />
  </AuthProvider>
);

export default App;
