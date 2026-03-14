import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, View } from 'react-native';
import QRScannerScreen from './src/screens/QRScannerScreen';

export default function App() {
  return (
    <View style={styles.container}>
      <QRScannerScreen />
      <StatusBar barStyle="light-content" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
});
