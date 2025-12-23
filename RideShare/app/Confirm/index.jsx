import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons'; // Built into Expo

export default function ConfirmTrip() {
    const router = useRouter();

    const handleGoHome = () => {
        router.replace('/Home');
    };

    return (
        <View style={styles.container}>
            <View style={styles.card}>
                {/* Success Icon */}
                <View style={styles.iconContainer}>
                    <Ionicons name="checkmark-circle" size={100} color="#4CAF50" />
                </View>

                <Text style={styles.title}>Officially joined a trip!</Text>
                
                <Text style={styles.subtitle}>
                    Your request has been sent. Now, just wait for your driver to arrive at the starting point.
                </Text>

                <TouchableOpacity 
                    style={styles.button} 
                    onPress={handleGoHome}
                    activeOpacity={0.8}
                >
                    <Text style={styles.buttonText}>Create another trip</Text>
                </TouchableOpacity>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F5F7FA', // Light grey-blue background
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    card: {
        width: '100%',
        backgroundColor: '#fff',
        borderRadius: 20,
        padding: 30,
        alignItems: 'center',
        // Shadow for iOS
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.1,
        shadowRadius: 10,
        // Shadow for Android
        elevation: 5,
    },
    iconContainer: {
        marginBottom: 20,
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#333',
        textAlign: 'center',
        marginBottom: 15,
    },
    subtitle: {
        fontSize: 16,
        color: '#666',
        textAlign: 'center',
        lineHeight: 24,
        marginBottom: 40,
    },
    button: {
        backgroundColor: '#000',
        width: '100%',
        height: 55,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
    },
    buttonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
});