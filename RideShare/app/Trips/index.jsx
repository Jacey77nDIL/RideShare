import { StyleSheet, Text, View, FlatList, TouchableOpacity } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { useRouter } from "expo-router";
import { useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';

const API_URL = process.env.EXPO_PUBLIC_API_URL;

const api = axios.create({ baseURL: API_URL });

api.interceptors.request.use(async (config) => {
  const token = await AsyncStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

function TripsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const isFirstLoad = useRef(true);

  const fetchTripsAndMatches = async () => {
    try {
      const tripRes = await api.post('/trips/fetch_trip');
      const tripId = tripRes.data.trip_id;

      const matchesRes = await api.get('/trips/get_matches', {
        params: { trip_id: tripId }
      });

      return matchesRes.data;
    } catch (error) {
      if (error.response && error.response.status === 404) {
        console.log("Trip not found, redirecting home...");
        router.replace("/Home");
        return [];
      }
    
      throw error;
    }
  };

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['matches'],
    queryFn: fetchTripsAndMatches,
    retry: false,
    refetchOnWindowFocus: false,
    refetchInterval: 60000,
    staleTime: 60_000
  });

  useEffect(() => {
    if (isLoading || !data) return;
    if (isFirstLoad.current) {
      isFirstLoad.current = false;
      return;
    }
    // Notifications
  }, [data, isLoading]);

  const handleCancelTrip = async () => {
    try {
      await api.post('/trips/cancel_trips');
      router.replace('/Home');
    } catch {
      console.log("Error", "Failed to cancel trip.");
    }
  };

  const handleJoinTrip = async () => {
    try {
      // ENHANCE FUNCTIONALITY - Add trip to a group, create chat group
      router.replace('/Confirm');
    } catch {
      console.log("Error", "Failed to join trip.");
    }
  };

  const formatTime = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  };

  const renderTrip = ({ item }) => (
    <View style={styles.card}>
      <View style={styles.routeContainer}>
        <View style={styles.dotContainer}>
          <View style={[styles.dot, { backgroundColor: '#4CAF50' }]} />
          <View style={styles.line} />
          <View style={[styles.dot, { backgroundColor: '#F44336' }]} />
        </View>

        <View style={styles.textContainer}>
          <Text style={styles.locationLabel}>Origin</Text>
          <Text style={styles.locationText}>{item.origin}</Text>
          <View style={{ height: 10 }} />
          <Text style={styles.locationLabel}>Destination</Text>
          <Text style={styles.locationText}>{item.destination}</Text>
        </View>
      </View>

      <View style={styles.footer}>
        <View style={styles.iconRow}>
          <Ionicons name={item.gender.toLowerCase() === 'male' ? 'male' : 'female'} size={18} color="#555" />
          <Text style={styles.footerText}>{item.gender}</Text>
        </View>

        <View style={styles.iconRow}>
          {/* <MaterialCommunityIcons name="clock-outline" size={18} color="#555" /> */}
          <Text style={styles.footerText}>{formatTime(item.time)} (WAT)</Text>
        </View>

        <TouchableOpacity style={styles.joinButton} onPress={handleJoinTrip}>
          <Text style={styles.joinButtonText}>Join Trip</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  if (error) {
    console.log("Error Loading trips")
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.headerContainer}>
        <TouchableOpacity style={styles.backButton} onPress={handleCancelTrip}>
          <Ionicons name="chevron-back" size={24} color="black" />
          <Text style={styles.backText}>Cancel</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Matching Trips</Text>
      </View>

      <FlatList
        data={data}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderTrip}
        contentContainerStyle={styles.listContent}
        refreshing={isLoading}
        onRefresh={refetch}
      />
    </View>
  );
}

export default function Trips() {
  return (
    <SafeAreaProvider>
      <TripsScreen />
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: '#F8F9FA' 
  },
  center: { 
    flex: 1, alignItems: 'center', 
    justifyContent: 'center' 
  },
  headerContainer: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    paddingHorizontal: 16, 
    paddingVertical: 15, 
    backgroundColor: '#fff', 
    borderBottomWidth: 1, 
    borderBottomColor: '#EEE' 
  },
  backButton: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    position: 'absolute', 
    left: 10, 
    zIndex: 1 
  },
  backText: { 
    fontSize: 16, 
    color: '#000' 
  },
  headerTitle: { 
    flex: 1, 
    textAlign: 'center', 
    fontSize: 18, 
    fontWeight: '700' 
  },
  listContent: { 
    padding: 16 
  },
  card: { 
    backgroundColor: '#fff', 
    borderRadius: 16, 
    padding: 20, 
    marginBottom: 20, 
    shadowColor: '#000', 
    shadowOffset: { width: 0, height: 4 }, 
    shadowOpacity: 0.05, 
    shadowRadius: 10, 
    elevation: 2 
  },
  routeContainer: { 
    flexDirection: 'row', 
    marginBottom: 20 
  },
  dotContainer: { 
    alignItems: 'center', 
    marginRight: 12, 
    paddingVertical: 5 
  },
  dot: { 
    width: 10, 
    height: 10, 
    borderRadius: 5 
  },
  line: { 
    width: 2, 
    height: 40, 
    backgroundColor: '#F0F0F0', 
    marginVertical: 4 
  },
  textContainer: { 
    flex: 1 
  },
  locationLabel: { 
    fontSize: 11, 
    color: '#999', 
    textTransform: 'uppercase', 
    letterSpacing: 0.5 
  },
  locationText: { 
    fontSize: 16, 
    fontWeight: '600', 
    color: '#1A1A1A' 
  },
  footer: { 
    flexDirection: 'row', 
    borderTopWidth: 1, 
    borderTopColor: '#F5F5F5', 
    paddingVertical: 15, 
    justifyContent: 'space-between' 
  },
  iconRow: { 
    flexDirection: 'row', 
    alignItems: 'center' 
  },
  footerText: { 
    marginLeft: 8, 
    fontSize: 14, 
    color: '#444', 
    textTransform: 'capitalize' 
  },
  joinButton: { 
    backgroundColor: '#000', 
    borderRadius: 10, 
    paddingVertical: 14, 
    paddingHorizontal: 18 
  },
  joinButtonText: { 
    color: '#FFF', 
    fontSize: 16, 
    fontWeight: '700' 
  },
});
