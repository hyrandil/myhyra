import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, FlatList } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as Location from 'expo-location';
import * as SecureStore from 'expo-secure-store';

interface Booking {
  id: number;
  clock_in: string;
  clock_out?: string | null;
  location_lat?: number | null;
  location_lng?: number | null;
}

interface User {
  id: number;
  name: string;
  email: string;
  role: 'user' | 'admin';
}

const API_URL = (global as any).expo?.manifest?.extra?.apiUrl || 'http://localhost:4000/api';

export default function App() {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const bootstrap = async () => {
      const storedToken = await SecureStore.getItemAsync('token');
      const storedUser = await SecureStore.getItemAsync('user');
      if (storedToken && storedUser) {
        setToken(storedToken);
        setUser(JSON.parse(storedUser));
        fetchBookings(storedToken);
      }
    };
    bootstrap();
  }, []);

  const requestLocation = useCallback(async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      return undefined;
    }
    const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
    return { lat: loc.coords.latitude, lng: loc.coords.longitude };
  }, []);

  const login = async () => {
    try {
      const response = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'admin@example.com', password: 'ChangeMe!123' }),
      });
      if (!response.ok) {
        throw new Error('Login fehlgeschlagen');
      }
      const data = await response.json();
      setToken(data.token);
      setUser(data.user);
      await SecureStore.setItemAsync('token', data.token);
      await SecureStore.setItemAsync('user', JSON.stringify(data.user));
      fetchBookings(data.token);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const fetchBookings = async (jwt = token) => {
    if (!jwt) return;
    const response = await fetch(`${API_URL}/bookings/me`, {
      headers: { Authorization: `Bearer ${jwt}` },
    });
    const data = await response.json();
    setBookings(data);
  };

  const sendPunch = async (path: 'clock-in' | 'clock-out') => {
    if (!token) return;
    const location = await requestLocation();
    await fetch(`${API_URL}/bookings/${path}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ location }),
    });
    fetchBookings();
  };

  if (!token) {
    return (
      <View style={styles.centered}>
        <Text style={styles.title}>MyHyra Login</Text>
        <TouchableOpacity style={styles.primaryButton} onPress={login}>
          <Text style={styles.primaryButtonText}>Mit Demo-Admin einloggen</Text>
        </TouchableOpacity>
        {error && <Text style={styles.error}>{error}</Text>}
        <StatusBar style="auto" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      <Text style={styles.title}>Hallo {user?.name}</Text>
      <View style={styles.row}>
        <TouchableOpacity style={[styles.primaryButton, styles.success]} onPress={() => sendPunch('clock-in')}>
          <Text style={styles.primaryButtonText}>Kommen</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.primaryButton, styles.danger]} onPress={() => sendPunch('clock-out')}>
          <Text style={styles.primaryButtonText}>Gehen</Text>
        </TouchableOpacity>
      </View>
      <FlatList
        style={{ width: '100%' }}
        data={bookings}
        keyExtractor={(item) => item.id.toString()}
        renderItem={({ item }) => (
          <View style={styles.bookingCard}>
            <Text style={styles.bookingTitle}>{new Date(item.clock_in).toLocaleString()}</Text>
            <Text style={styles.bookingSubtitle}>
              {item.clock_out ? `Gehen: ${new Date(item.clock_out).toLocaleString()}` : 'Noch aktiv'}
            </Text>
            {item.location_lat && item.location_lng && (
              <Text style={styles.bookingSubtitle}>
                Standort: {item.location_lat.toFixed(5)}, {item.location_lng.toFixed(5)}
              </Text>
            )}
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    paddingTop: 80,
    paddingHorizontal: 16,
    backgroundColor: '#f8fafc',
    gap: 16,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    padding: 24,
    backgroundColor: '#f8fafc',
  },
  title: {
    fontSize: 24,
    fontWeight: '600',
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  primaryButton: {
    flex: 1,
    backgroundColor: '#2563eb',
    paddingVertical: 14,
    borderRadius: 999,
    alignItems: 'center',
  },
  success: { backgroundColor: '#059669' },
  danger: { backgroundColor: '#dc2626' },
  primaryButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  bookingCard: {
    width: '100%',
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 8,
    marginBottom: 12,
  },
  bookingTitle: {
    fontWeight: '600',
    marginBottom: 4,
  },
  bookingSubtitle: {
    color: '#475569',
    fontSize: 12,
  },
  error: { color: '#dc2626' },
});
