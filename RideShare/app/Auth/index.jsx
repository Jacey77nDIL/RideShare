import { TextInput, Text, TouchableOpacity, View, StyleSheet } from "react-native";
import {Picker} from '@react-native-picker/picker';
import { useEffect, useState } from "react";
import { useRouter } from "expo-router";
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import qs from 'qs';

export default function Auth() {
    const router = useRouter();
    const API_URL = process.env.EXPO_PUBLIC_API_URL;
    const [ selectedGender, setSelectedGender ] = useState("Male");
    const [ email, setEmail ] = useState("");
    const [ age, setAge ] = useState();
    const [ password, setPassword ] = useState("");
    const [ userFormData, setUserFormData ] = useState(null);
    const [ loginFormData, setLoginFormData ] = useState(null);
    const [ message, setMessage ] = useState("");
    const handleSubmit = (email, age, password, selectedGender) => {
        if(!email || !age || !selectedGender || !password || password.length < 8){
          setMessage('Complete all fields and Pasword must be up to 8 characters')
        } else {
          const userFormData = {
          email: email,
          age: age,
          gender: selectedGender,
          password: password,
        };
        const loginFormData = {
          username: email,
          password: password,
        };
        setUserFormData(userFormData);
        setLoginFormData(loginFormData);
        }
    };
    
    // js - store all values and send to the backend
    // password viewing
    useEffect(() => {
      if (!userFormData) return;
      const sendAuthDetails = async () => {
        try {
          const res = await fetch(`${API_URL}/auth/`, {
            method: "POST",
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(userFormData)
          });
          const responseData = await res.json();
          console.log('Server Response:', responseData);
          if (responseData.message === 'Account already exists') {
            setMessage('Account already exists');
          }
        } catch (error) {
          console.error('Error sending details', error);
        }
      };

      sendAuthDetails();
    }, [userFormData]);

    useEffect(() => {
      if (!loginFormData) return;
      const sendLoginData = async () => {
        try {
          const response = await axios.post(`${API_URL}/auth/token`, qs.stringify(loginFormData), {
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
            },
          });
          console.log('Login successful', response.data.access_token, response.data.token_type)
          // store token in async storage then push to next page
          await AsyncStorage.setItem('token', response.data.access_token);
          router.replace('/Home');
        } catch (error) {
          console.log('Login unsuccessful', error) 
        }
      }
      sendLoginData();
    }, [loginFormData])

  return (
    <View style={styles.container}>
        <View style={styles.centerContainer}>
            <Text style={styles.text}>RideShare</Text>
            {message && <Text style={styles.errorText}>{message}</Text>}
            <View style={styles.inputContainer}>
                <TextInput style={styles.email} placeholder="Email" inputMode="email" keyboardType="email-address" value={email} onChangeText={text => setEmail(text)}/>
                <View style={styles.sideBySideContianer}>
                    <TextInput style={styles.age} placeholder="Age" maxLength={2} keyboardType="numeric" inputMode="numeric" value={age} onChangeText={newAge => setAge(newAge)}/>
                    <Picker
                        selectedValue={selectedGender}
                        style={styles.gender}
                        onValueChange={(itemValue) =>
                            setSelectedGender(itemValue)
                        }>
                        <Picker.Item label="Male" value="Male" />
                        <Picker.Item label="Female" value="Female" />
                    </Picker>
                </View>
                <TextInput style={styles.passsword} placeholder="Password" secureTextEntry={true} value={password} onChangeText={newPassword => setPassword(newPassword)}/>
            </View>
            <TouchableOpacity style={styles.button} onPress={() => handleSubmit(email, age, password, selectedGender)}>
                <Text style={styles.buttonText}>Join</Text>
            </TouchableOpacity>
        </View>
    </View>
  )
}

const styles = StyleSheet.create({
    container: {
    flex: 1,
    backgroundColor: '#fff', // White background for the entire screen
    justifyContent: 'center', // Center content vertically on the screen
    alignItems: 'center', // Center content horizontally on the screen
  },
  centerContainer: {
    width: '85%', // Occupy 85% of the screen width for a centered block
    maxWidth: 400, // Optional: Maximum width for larger screens
    alignItems: 'center', // Center items like the Text and InputContainer horizontally within itself
  },
  text: {
    fontFamily: 'Inter-Regular',
    fontSize: 48, // Large font size for "RideShare"
    fontWeight: 'bold', // Make it bold for impact
    color: '#000', // Black text
    marginBottom: 30, // Space below the title
    textAlign: 'center', // Ensure text is centered
    width: '100%', // Take full width to align with inputs below
  },
  errorText: {
    fontFamily: 'Inter-Regular' ,
    fontSize: 16,
    color: 'red',
    marginBottom: 30,
    textAlign: 'center', // Ensure text is centered
    width: '100%', // Take full width to align with inputs below
  },
  inputContainer: {
    width: '100%', // Inputs will take up the full width of centerContainer
    marginBottom: 20, // Space below the input group
  },
  email: {
    fontFamily: 'Inter-Regular',
    width: '100%',
    height: 50,
    borderColor: '#eee', // Light grey border for a subtle modern look
    borderWidth: 1,
    borderRadius: 8, // Slightly rounded corners
    paddingHorizontal: 15,
    marginBottom: 15, // Space between inputs
    color: '#000', // Black text for input
    fontSize: 16,
    backgroundColor: '#f9f9f9', // Very light grey background for inputs
  },
  sideBySideContianer: {
    flexDirection: 'row', // Arrange age and gender horizontally
    justifyContent: 'space-between', // Space out the elements evenly
    marginBottom: 15, // Space below this row
    width: '100%',
  },
  age: {
    fontFamily: 'Inter-Regular',
    flex: 1, // Take available space
    height: 50,
    borderColor: '#eee',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 15,
    marginRight: 10, // Space between age and gender inputs
    color: '#000',
    fontSize: 16,
    backgroundColor: '#f9f9f9',
  },
  gender: {
    fontFamily: 'Inter-Regular',
    flex: 1, // Take available space
    height: 50,
    borderColor: '#eee',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 5, // Adjust padding for picker items if needed
    color: '#000', // Text color for selected item
    backgroundColor: '#f9f9f9',
    justifyContent: 'center', // Center items inside picker (might vary by platform)
  },
  passsword: {
    fontFamily: 'Inter-Regular',
    width: '100%',
    height: 50,
    borderColor: '#eee',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 15,
    marginBottom: 25, // Space above the button
    color: '#000',
    fontSize: 16,
    backgroundColor: '#f9f9f9',
  },
  button: {
    width: '100%',
    height: 50,
    backgroundColor: '#000', // Black button
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonText: { // You'll need to wrap 'Join' in a <Text> tag for this to apply
    fontFamily: 'Inter-Regular',
    color: '#fff', // White text on the button
    fontSize: 18,
    fontWeight: 'bold',
  },
});
