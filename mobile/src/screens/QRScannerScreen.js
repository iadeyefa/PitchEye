import { useState, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';

const API_URL = process.env.EXPO_PUBLIC_API_URL;

function extractSessionCode(scannedData) {
  try {
    const url = new URL(scannedData);
    const parts = url.pathname.split('/').filter(Boolean);
    const joinIndex = parts.indexOf('join');
    if (joinIndex !== -1 && parts[joinIndex + 1]) {
      return parts[joinIndex + 1].toUpperCase();
    }
  } catch {
    const trimmed = scannedData.trim().toUpperCase();
    if (/^[A-Z0-9]{4,10}$/.test(trimmed)) {
      return trimmed;
    }
  }
  return null;
}

export default function QRScannerScreen({ navigation }) {
  const [permission, requestPermission] = useCameraPermissions();
  const [isScanning, setIsScanning] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [isFocused, setIsFocused] = useState(true);

  useFocusEffect(
    useCallback(() => {
      setIsFocused(true);
      setIsScanning(true);
      return () => setIsFocused(false);
    }, [])
  );

  const handleBarCodeScanned = async ({ data }) => {
    if (!isScanning || isLoading) return;

    const sessionCode = extractSessionCode(data);
    if (!sessionCode) {
      Alert.alert('Invalid QR Code', 'This QR code is not a PitchEye session code.');
      return;
    }

    setIsScanning(false);
    setIsLoading(true);

    try {
      const response = await fetch(`${API_URL}/games/join/${sessionCode}/`);
      if (!response.ok) {
        throw new Error('Session not found');
      }
      const game = await response.json();
      navigation.navigate('LiveStream', { sessionCode, gameTitle: game.title });
    } catch (err) {
      Alert.alert(
        'Session Not Found',
        `No active session found for code "${sessionCode}". Please check the QR code and try again.`,
        [{ text: 'Try Again', onPress: () => setIsScanning(true) }]
      );
    } finally {
      setIsLoading(false);
    }
  };

  if (Platform.OS === 'web') {
    return (
      <View style={styles.centered}>
        <Text style={styles.title}>QR Scanner</Text>
        <Text style={styles.subtext}>Use Expo Go on iOS or Android to scan QR codes.</Text>
      </View>
    );
  }

  if (!permission) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color="#00FF00" />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.centered}>
        <Text style={styles.subtext}>Camera access is required to scan QR codes.</Text>
        <TouchableOpacity style={styles.button} onPress={requestPermission}>
          <Text style={styles.buttonText}>Grant Permission</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!isFocused) {
    return <View style={styles.container} />;
  }

  return (
    <View style={styles.container}>
      <CameraView
        style={styles.camera}
        onBarcodeScanned={isScanning && !isLoading ? handleBarCodeScanned : undefined}
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
      >
        <View style={styles.overlay}>
          <View style={styles.scanFrame} />
        </View>

        <View style={styles.topBar}>
          <Text style={styles.title}>Scan Session QR Code</Text>
          <Text style={styles.subtext}>Point at the QR code displayed on the webapp</Text>
        </View>

        <View style={styles.bottomBar}>
          {isLoading ? (
            <>
              <ActivityIndicator color="#00FF00" style={{ marginBottom: 8 }} />
              <Text style={styles.statusText}>Joining session...</Text>
            </>
          ) : (
            <Text style={styles.statusText}>
              {isScanning ? 'Ready to scan' : 'Processing...'}
            </Text>
          )}
        </View>
      </CameraView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  camera: {
    flex: 1,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  scanFrame: {
    width: 260,
    height: 260,
    borderColor: '#00FF00',
    borderWidth: 3,
    borderRadius: 12,
    backgroundColor: 'transparent',
  },
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingTop: 60,
    paddingBottom: 20,
    paddingHorizontal: 24,
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingVertical: 32,
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFF',
    marginBottom: 4,
  },
  subtext: {
    fontSize: 13,
    color: '#AAA',
    textAlign: 'center',
  },
  statusText: {
    fontSize: 14,
    color: '#00FF00',
    fontWeight: '600',
  },
  centered: {
    flex: 1,
    backgroundColor: '#111',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    gap: 16,
  },
  button: {
    backgroundColor: '#00FF00',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  buttonText: {
    color: '#000',
    fontWeight: 'bold',
    fontSize: 14,
  },
});