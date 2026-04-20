import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import QRScannerScreen from './src/screens/QRScannerScreen';
import LiveStreamScreen from './src/screens/LiveStreamScreen';

const Stack = createNativeStackNavigator();

export default function App() {
  return (
    <NavigationContainer>
      <StatusBar barStyle="light-content" />
      <Stack.Navigator
        screenOptions={{
          headerStyle: { backgroundColor: '#111' },
          headerTintColor: '#fff',
          headerTitleStyle: { fontWeight: 'bold' },
          contentStyle: { backgroundColor: '#000' },
        }}
      >
        <Stack.Screen
          name="QRScanner"
          component={QRScannerScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="LiveStream"
          component={LiveStreamScreen}
          options={{ headerShown: false }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
