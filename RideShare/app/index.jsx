import { Text, View, Image, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { useEffect } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import axios from "axios";

const API_URL = process.env.EXPO_PUBLIC_API_URL;

const api = axios.create({
  baseURL: API_URL,
});

api.interceptors.request.use(async (config) => {
  const token = await AsyncStorage.getItem("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default function Index() {
  const router = useRouter();

  useEffect(() => {
    const bootstrap = async () => {
      const token = await AsyncStorage.getItem("token");

      if (!token) {
        setTimeout(() => {
          router.replace("/Auth");
        }, 1000);
        return;
      }

      try {
        const res = await api.post("/trips/get_trip_status");

        if (res.data === true) {
          setTimeout(() => {
            router.replace("/Trips");
          }, 1000);
        } else {
          setTimeout(() => {
            router.replace("/Home");
          }, 1000);
        }
      } catch (error) {
        router.replace("/Home");
      }
    };

    bootstrap();
  }, []);

  return (
    <View style={styles.container}>
      <Image source={require("../assets/images/logo.png")} />
      <Text style={styles.text}>RideShare</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: "white",
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  text: {
    fontFamily: "Inter-Regular",
    fontSize: 20,
    marginTop: 10,
  },
});
