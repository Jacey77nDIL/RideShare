import { Text, StyleSheet, View, TextInput, TouchableOpacity, FlatList, ActivityIndicator, BackHandler, Image } from "react-native";
import MapView, { Marker, Polyline } from 'react-native-maps';
import { useEffect, useState, useRef } from "react";
import DateTimePickerModal from 'react-native-modal-datetime-picker';
import { useRouter } from "expo-router";
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export default function Home() {
    const API_URL = process.env.EXPO_PUBLIC_API_URL;
    const router = useRouter();
    const [location, setLocation] = useState('');
    const [destination, setDestination] = useState('');
    const [locationSuggestions, setLocationSuggestions] = useState([]);
    const [destinationSuggestions, setDestinationSuggestions] = useState([]);
    const [isLocationFocused, setIsLocationFocused] = useState(false);
    const [isDestinationFocused, setIsDestinationFocused] = useState(false);
    const [isFetching, setIsFetching] = useState(false);
    const [origin, setOrigin] = useState(null);
    const [target, setTarget] = useState(null);
    const [routeCoordinates, setRouteCoordinates] = useState(null);
    const [ time, setTime ] = useState("");
    const [showTimePicker, setShowTimePicker] = useState(false);
    const [selectedTime, setSelectedTime] = useState(null);

    const queryClient = useQueryClient();

    useEffect(() => {
        registerForPushNotificationsAsync();

        const subscription = Notifications.addNotificationResponseReceivedListener(response => {
            router.push('/Trips');
        });

        return () => subscription.remove();
    }, []);

    async function registerForPushNotificationsAsync() {
        let token;
        if (Device.isDevice) {
        const { status: existingStatus } = await Notifications.getPermissionsAsync();
        let finalStatus = existingStatus;

        if (existingStatus !== 'granted') {
            const { status } = await Notifications.requestPermissionsAsync();
            finalStatus = status;
        }

        if (finalStatus !== 'granted') {
            console.log('Failed to get push token for push notification!');
            return;
        }

        const projectId = Constants.expoConfig?.extra?.eas?.projectId;
        token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
        console.log("Device Push Token:", token);

        // 4. SEND THE TOKEN TO YOUR BACKEND
        try {
            const authToken = await AsyncStorage.getItem('token');
                await axios.post(`${API_URL}/auth/update_push_token`, 
                { token: token },
                { headers: { Authorization: `Bearer ${authToken}` } }
            );
        } catch (err) {
            console.error("Error saving token to backend:", err);
        }
        } else {
        console.log('Must use physical device for Push Notifications');
        }
    }


    const originArrayToObject = (originArray) => {
        setOrigin({
            latitude: originArray[1],
            longitude: originArray[0],
        });
    }

    const targetArrayToObject = (targetArray) => {
        setTarget({
            latitude: targetArray[1],
            longitude: targetArray[0],
        });
    }

    const timeToWords = (time) => {
        const timeReduced = time/60;

        if (timeReduced >= 60) {
            const timeInHours = {
                Hours: Math.floor(timeReduced/60),
                Minutes: timeReduced % 60
            };
            return(`${timeInHours.Hours} Hours and ${(timeInHours.Minutes).toFixed(0)} Minutes`);
        } else {
            const timeInMinutes = {
                Minutes: Math.floor(timeReduced),
                Seconds: timeReduced % 1
            }
            return(`${timeInMinutes.Minutes} Minutes and ${(timeInMinutes.Seconds * 60).toFixed(0)} Seconds`);
        }
    };

    const handleConfirmTrip = () => {
        if (origin && target) {
            setShowTimePicker(true);
        } else {
            console.log("Please select both origin and destination.");
        }
    };

    const postTripMutation = useMutation({
        mutationFn: async (tripInfo) => {
            const res = await axios.post(`${API_URL}/trips/post_trips`, tripInfo);
            return res.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['matches'] });
            router.replace('/Trips');
        },
        onError: (error) => {
            console.error('Failed to send trip info', error);
        }
    });

    const handleTimePickerConfirm = async (date) => {
        setSelectedTime(date);
        setShowTimePicker(false);

        const token = await AsyncStorage.getItem('token');

        const tripInfo = {
            origin_name: location,
            target_name: destination,
            time: date.toISOString(),
            route_coordinates: routeCoordinates,
            access_token: token
        };

        postTripMutation.mutate(tripInfo);
    };

    const handleTimePickerCancel = () => {
        setShowTimePicker(false);
    };

    const fetchCoordinates = async (start, end) => {
        try {
            const response = await axios.post(`${API_URL}/suggestions_routes/coordinates`,
                {
                    coordinates: [
                        [start.longitude, start.latitude],
                        [end.longitude, end.latitude]
                    ]
                }
            );
            const coordinates = response.data.coordinates.map(([lon, lat]) => ({
                latitude: lat,
                longitude: lon
            }));

            const time = (response.data.duration);
            const timeInWords = timeToWords(time);

            setTime(timeInWords);
            setRouteCoordinates(coordinates);
        } catch (error) {
            console.error('Failed to fetch route', error);
        }
    }

    const fetchSuggestions = async (query, setSuggestions) => {
        if (!query || query.length < 2) {
            setSuggestions([]);
            return;
        }

        setIsFetching(true);
        const formattedQuery = { encoded_URI_component: encodeURIComponent(query) };

        try {
            const res = await axios.post(`${API_URL}/suggestions_routes/suggestions`, formattedQuery);
            const newSuggestions = res.data.features.map(feature => ({
                id: feature.properties.id,
                name: feature.properties.name,
                place: feature.properties.country,
                coordinates: feature.geometry.coordinates,
            }));
            setSuggestions(newSuggestions);
        } catch (error) {
            console.log('Error fetching suggestions:', error);
            setSuggestions([]);
        } finally {
            setIsFetching(false);
        }
    };

    const handleSelectSuggestion = (suggestion, setInput, setIsFocused, setCoordinates) => {
        setInput(suggestion.name);
        setIsFocused(false);
        setCoordinates(suggestion.coordinates);
    };

    const onBackPress = () => {
        if (isLocationFocused) {
            setLocation('');
            setIsLocationFocused(false);
            return true;
        } else if (isDestinationFocused) {
            setDestination('');
            setIsDestinationFocused(false);
            return true;
        }
        return false;
    };

    useEffect(() => {
        const backAction = () => {
            if (isLocationFocused || isDestinationFocused) {
                onBackPress();
                return true;
            }
            return false;
        };

        const backHandler = BackHandler.addEventListener('hardwareBackPress', backAction);

        return () => backHandler.remove();
    }, [isLocationFocused, isDestinationFocused]);

    useEffect(() => {
        const handler = setTimeout(() => {
            if (isLocationFocused) {
                fetchSuggestions(location, setLocationSuggestions);
            }
        }, 500);
        return () => clearTimeout(handler);
    }, [location, isLocationFocused]);

    useEffect(() => {
        const handler = setTimeout(() => {
            if (isDestinationFocused) {
                fetchSuggestions(destination, setDestinationSuggestions);
            }
        }, 500);
        return () => clearTimeout(handler);
    }, [destination, isDestinationFocused]);

    useEffect(() => {
        if (origin && target) {
            fetchCoordinates(origin, target);
        }
    }, [origin, target]);

    const renderSuggestionItem = ({ item }) => (
        <TouchableOpacity
            style={styles.suggestionButton}
            onPress={() => {
                if (isLocationFocused) {
                    handleSelectSuggestion(item, setLocation, setIsLocationFocused, originArrayToObject);
                } else if (isDestinationFocused) {
                    handleSelectSuggestion(item, setDestination, setIsDestinationFocused, targetArrayToObject);
                }
            }}
        >
            <Text style={styles.suggestionText}>{item.name}</Text>
            <Text style={styles.suggestionSubText}>{item.place}</Text>
        </TouchableOpacity>
    );

    const focusedView = () => (
        <View style={styles.focusedContainer}>
            <TouchableOpacity style={styles.closeButton} onPress={() => onBackPress()}>
                <Text style={styles.closeButtonText}>X</Text>
            </TouchableOpacity>

            <TextInput
                style={styles.focusedInput}
                placeholder={isLocationFocused ? "From" : "To"}
                value={isLocationFocused ? location : destination}
                onChangeText={isLocationFocused ? setLocation : setDestination}
                autoFocus={true}
            />

            {isFetching && <ActivityIndicator style={styles.loader} size="small" color="#000" />}

            {((isLocationFocused && locationSuggestions.length > 0) || (isDestinationFocused && destinationSuggestions.length > 0)) && (
                <FlatList
                    style={styles.suggestionList}
                    data={isLocationFocused ? locationSuggestions : destinationSuggestions}
                    renderItem={renderSuggestionItem}
                    keyExtractor={(item) => item.id.toString()}
                />
            )}
        </View>
    );

    const normalView = () => (
        <View style={styles.container}>
            <View style={styles.mapContainer}>
                {origin ? (
                    <MapView
                        style={styles.map}
                        initialRegion={{
                            latitude: origin.latitude,
                            longitude: origin.longitude,
                            latitudeDelta: 0.1,
                            longitudeDelta: 0.1,
                        }}
                    >
                        <Marker coordinate={origin} title="Start" />
                        {target && <Marker coordinate={target} title="End" />}
                        {routeCoordinates && <Polyline coordinates={routeCoordinates} strokeColor="blue" strokeWidth={4} />}
                    </MapView>
                ): (
                    <Image 
                        source={require ("../../assets/images/logo.png")}
                    />
                )}
            </View>
            <View style={styles.timeContainer}>
                {routeCoordinates && time && <Text style={styles.timeText}>{time}</Text>}
            </View>
            <View style={styles.inputContainer}>
                <View style={styles.fromContainer}>
                    <TextInput
                        style={styles.fromText}
                        placeholder="From"
                        value={location}
                        onChangeText={setLocation}
                        onFocus={() => setIsLocationFocused(true)}
                    />
                </View>
                <View style={styles.toContainer}>
                    <TextInput
                        style={styles.toText}
                        placeholder="To"
                        value={destination}
                        onChangeText={setDestination}
                        onFocus={() => setIsDestinationFocused(true)}
                    />
                </View>
                <TouchableOpacity style={styles.button} onPress={handleConfirmTrip}>
                    <Text style={styles.buttonText}>Confirm</Text>
                </TouchableOpacity>
            </View>
            <DateTimePickerModal
                isVisible={showTimePicker}
                mode="time"
                onConfirm={handleTimePickerConfirm}
                onCancel={handleTimePickerCancel}
            />
        </View>
    );

    if (isLocationFocused || isDestinationFocused) {
        return focusedView();
    } else {
        return normalView();
    }
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#fff",
        flexDirection: "column",
    },
    mapContainer: {
        height: "50%",
        width: "100%",
        justifyContent: "center",
        alignItems: "center",
    },
    map: {
        width: '100%',
        height: '100%',
    },
    timeContainer: {
        width: '100%',
        paddingVertical: 10,
        alignItems: 'center',
        justifyContent: 'center',
    },
    timeText: {
        fontFamily: 'Inter-Regular',
        fontSize: 24,
        fontWeight: '900',
        color: '#333',
    },
    inputContainer: {
        height: "50%",
        width: "100%",
        paddingHorizontal: 30,
        paddingVertical: 20,
        justifyContent: "flex-start",
        alignItems: "center",
    },
    fromContainer: {
        width: "100%",
        marginBottom: 15,
    },
    fromText: {
        fontFamily: "Inter-Regular",
        width: "100%",
        height: 45,
        borderColor: "#eee",
        borderWidth: 1,
        borderRadius: 8,
        paddingHorizontal: 15,
        fontSize: 14,
        backgroundColor: "#f9f9f9",
    },
    toContainer: {
        width: "100%",
        marginBottom: 20,
    },
    toText: {
        fontFamily: "Inter-Regular",
        width: "100%",
        height: 45,
        borderColor: "#eee",
        borderWidth: 1,
        borderRadius: 8,
        paddingHorizontal: 15,
        fontSize: 14,
        backgroundColor: "#f9f9f9",
    },
    button: {
        width: "100%",
        height: 50,
        backgroundColor: "#000",
        borderRadius: 8,
        justifyContent: "center",
        alignItems: "center",
    },
    buttonText: {
        fontFamily: "Inter-Regular",
        color: "#fff",
        fontSize: 18,
        fontWeight: "bold",
    },
    focusedContainer: {
        flex: 1,
        backgroundColor: "#fff",
        paddingHorizontal: 30,
        paddingVertical: 60,
    },
    focusedInput: {
        fontFamily: "Inter-Regular",
        width: "100%",
        height: 45,
        borderColor: "#eee",
        borderWidth: 1,
        borderRadius: 8,
        paddingHorizontal: 15,
        fontSize: 14,
        backgroundColor: "#f9f9f9",
    },
    suggestionList: {
        marginTop: 10,
    },
    suggestionButton: {
        paddingVertical: 15,
        borderBottomWidth: 1,
        borderBottomColor: "#eee",
    },
    suggestionText: {
        fontFamily: "Inter-Regular",
        fontSize: 16,
        fontWeight: "bold",
    },
    suggestionSubText: {
        fontFamily: "Inter-Regular",
        fontSize: 12,
        color: "#888",
    },
    closeButton: {
        position: 'absolute',
        top: 60,
        right: 30,
        padding: 10,
        zIndex: 10,
    },
    closeButtonText: {
        fontSize: 20,
        fontWeight: 'bold',
    },
    loader: {
        marginTop: 10,
    }
});