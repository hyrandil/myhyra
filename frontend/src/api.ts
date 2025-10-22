import axios from 'axios';

const api = axios.create({
  baseURL: '/api'
});

export interface Document {
  id: number;
  title?: string | null;
  description?: string | null;
  original_filename: string;
  mime_type?: string | null;
  size_bytes?: number | null;
  checksum?: string | null;
  imported_from_share_id?: number | null;
  ocr_text?: string | null;
  created_at: string;
  tags: Tag[];
}

export interface Tag {
  id: number;
  name: string;
  created_at: string;
}

export interface Share {
  id: number;
  name: string;
  path: string;
  managed: boolean;
  recursive: boolean;
  active: boolean;
  created_at: string;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
}

export interface UserProfile {
  id: number;
  username: string;
  is_active: boolean;
  created_at: string;
}

export const login = async (username: string, password: string, totp?: string): Promise<TokenResponse> => {
  const params = new URLSearchParams();
  params.append('username', username);
  params.append('password', password);
  if (totp) {
    params.append('scope', totp);
  }
  const response = await api.post<TokenResponse>('/auth/login', params);
  return response.data;
};

export const register = async (username: string, password: string): Promise<UserProfile> => {
  const response = await api.post<UserProfile>('/auth/register', { username, password });
  return response.data;
};

export const fetchProfile = async (): Promise<UserProfile> => {
  const response = await api.get<UserProfile>('/auth/me');
  return response.data;
};

export const fetchDocuments = async (query?: string, tags?: number[]): Promise<Document[]> => {
  const params = new URLSearchParams();
  if (query) params.append('query', query);
  if (tags && tags.length > 0) {
    tags.forEach((tag) => params.append('tags', tag.toString()));
  }
  const response = await api.get<Document[]>('/documents/', { params });
  return response.data;
};

export const uploadDocument = async (file: File, tags: string[]): Promise<Document> => {
  const formData = new FormData();
  formData.append('file', file);
  tags.forEach((tag) => formData.append('tags', tag));
  const response = await api.post<Document>('/documents/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  });
  return response.data;
};

export const fetchTags = async (): Promise<Tag[]> => {
  const response = await api.get<Tag[]>('/documents/tags');
  return response.data;
};

export const createTag = async (name: string): Promise<Tag> => {
  const response = await api.post<Tag>('/documents/tags', { name });
  return response.data;
};

export const fetchShares = async (): Promise<Share[]> => {
  const response = await api.get<Share[]>('/documents/shares');
  return response.data;
};

export const createShare = async (payload: { name: string; path: string; managed: boolean; recursive: boolean }): Promise<Share> => {
  const response = await api.post<Share>('/documents/shares', payload);
  return response.data;
};

export const setAuthToken = (token: string | null) => {
  if (token) {
    api.defaults.headers.common.Authorization = `Bearer ${token}`;
  } else {
    delete api.defaults.headers.common.Authorization;
  }
};

export default api;
