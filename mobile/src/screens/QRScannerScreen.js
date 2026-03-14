import React, { useEffect, useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Alert,
  Platform,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';

export default function QRScannerScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [scannedData, setScannedData] = useState(null);
  const [isScanning, setIsScanning] = useState(true);
  const [allScans, setAllScans] = useState([]);

  useEffect(() => {
    (async () => {
      if (!permission) {
        return;
      }

      if (!permission.granted) {
        const result = await requestPermission();
        if (!result.granted) {
          Alert.alert(
            'Camera Permission Required',
            'Please enable camera permissions to use the QR code scanner.'
          );
        }
      }
    })();
  }, [permission, requestPermission]);

  const handleBarCodeScanned = ({ data, type }) => {
    if (!isScanning) {
      return;
    }

    const newScan = {
      data,
      timestamp: new Date().toLocaleTimeString(),
      type,
    };

    setScannedData(newScan);
    setAllScans((prevScans) => [...prevScans, newScan]);
    setIsScanning(false);

    // Auto-resume scanning after 2 seconds
    setTimeout(() => {
      setIsScanning(true);
    }, 2000);
  };

  // Web not supported
  if (Platform.OS === 'web') {
    return (
      <View style={styles.container}>
        <View style={styles.webContainer}>
          <Text style={styles.webTitle}>QR Code Scanner</Text>
          <Text style={styles.webText}>
            Camera scanning is not available on web.
          </Text>
          <Text style={styles.webText}>
            Please use Expo Go on iOS or Android to scan QR codes.
          </Text>
        </View>
      </View>
    );
  }

  if (!permission) {
    return (
      <View style={styles.container}>
        <Text style={styles.permissionText}>Requesting camera permission...</Text>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.container}>
        <Text style={styles.permissionText}>
          Camera permission is required to scan QR codes.
        </Text>
        <TouchableOpacity style={styles.clearButton} onPress={requestPermission}>
          <Text style={styles.clearButtonText}>Grant Permission</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Camera View with Scanner */}
      <CameraView
        onBarcodeScanned={isScanning ? handleBarCodeScanned : undefined}
        style={styles.camera}
        barcodeScannerSettings={{
          barcodeTypes: ['qr'],
        }}
      >
        {/* Camera frame overlay */}
        <View style={styles.overlay}>
          <View style={styles.scanFrame} />
        </View>

        {/* Camera top controls */}
        <View style={styles.cameraTopUI}>
          <Text style={styles.cameraTitle}>QR Code Scanner</Text>
        </View>
      </CameraView>

      {/* Results Panel */}
      <View style={styles.resultsPanel}>
        {scannedData ? (
          <View style={styles.resultContainer}>
            <Text style={styles.resultLabel}>Last Scan Result:</Text>
            <Text style={styles.resultData}>{scannedData.data}</Text>
            <Text style={styles.resultTimestamp}>{scannedData.timestamp}</Text>
            <TouchableOpacity
              style={styles.clearButton}
              onPress={() => setScannedData(null)}
            >
              <Text style={styles.clearButtonText}>Clear</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <Text style={styles.instructionText}>
            Point camera at a QR code to scan
          </Text>
        )}

        {/* All scans history */}
        {allScans.length > 0 && (
          <View style={styles.historyContainer}>
            <Text style={styles.historyTitle}>
              Scan History ({allScans.length})
            </Text>
            <ScrollView
              style={styles.historyScrollView}
              nestedScrollEnabled={true}
            >
              {allScans.map((scan, index) => (
                <View key={index} style={styles.historyItem}>
                  <Text style={styles.historyItemNumber}>{index + 1}.</Text>
                  <View style={styles.historyItemContent}>
                    <Text style={styles.historyItemData}>{scan.data}</Text>
                    <Text style={styles.historyItemTime}>{scan.timestamp}</Text>
                  </View>
                </View>
              ))}
            </ScrollView>

            <TouchableOpacity
              style={styles.clearHistoryButton}
              onPress={() => {
                setAllScans([]);
                setScannedData(null);
              }}
            >
              <Text style={styles.clearHistoryButtonText}>Clear History</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  webContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    paddingHorizontal: 20,
  },
  webTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFF',
    marginBottom: 20,
    textAlign: 'center',
  },
  webText: {
    fontSize: 16,
    color: '#AAA',
    marginBottom: 12,
    textAlign: 'center',
  },
  camera: {
    flex: 2,
    position: 'relative',
  },
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  scanFrame: {
    width: 280,
    height: 280,
    borderColor: '#00FF00',
    borderWidth: 3,
    borderRadius: 8,
  },
  cameraTopUI: {
    paddingTop: 40,
    paddingHorizontal: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    marginBottom: 'auto',
  },
  cameraTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFF',
  },
  resultsPanel: {
    flex: 1,
    backgroundColor: '#1a1a1a',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#333',
  },
  resultContainer: {
    backgroundColor: '#2a2a2a',
    padding: 16,
    borderRadius: 8,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#00FF00',
  },
  resultLabel: {
    fontSize: 12,
    color: '#888',
    marginBottom: 8,
    textTransform: 'uppercase',
    fontWeight: '600',
  },
  resultData: {
    fontSize: 16,
    color: '#FFF',
    marginBottom: 8,
    fontFamily: 'monospace',
    backgroundColor: '#0a0a0a',
    padding: 8,
    borderRadius: 4,
  },
  resultTimestamp: {
    fontSize: 12,
    color: '#666',
    marginBottom: 12,
  },
  clearButton: {
    backgroundColor: '#FF6B6B',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 4,
    alignSelf: 'flex-start',
  },
  clearButtonText: {
    color: '#FFF',
    fontWeight: 'bold',
    fontSize: 12,
  },
  instructionText: {
    fontSize: 14,
    color: '#888',
    textAlign: 'center',
    marginVertical: 20,
  },
  historyContainer: {
    flex: 1,
    backgroundColor: '#2a2a2a',
    borderRadius: 8,
    overflow: 'hidden',
    maxHeight: 200,
  },
  historyTitle: {
    fontSize: 12,
    color: '#888',
    paddingHorizontal: 12,
    paddingTop: 12,
    marginBottom: 8,
    textTransform: 'uppercase',
    fontWeight: '600',
  },
  historyScrollView: {
    flex: 1,
    paddingHorizontal: 8,
  },
  historyItem: {
    flexDirection: 'row',
    backgroundColor: '#1a1a1a',
    padding: 12,
    borderRadius: 4,
    marginBottom: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#00FF00',
  },
  historyItemNumber: {
    color: '#666',
    marginRight: 12,
    fontWeight: 'bold',
    minWidth: 30,
  },
  historyItemContent: {
    flex: 1,
  },
  historyItemData: {
    fontSize: 12,
    color: '#FFF',
    marginBottom: 4,
    fontFamily: 'monospace',
  },
  historyItemTime: {
    fontSize: 10,
    color: '#666',
  },
  clearHistoryButton: {
    backgroundColor: '#FF6B6B',
    paddingHorizontal: 16,
    paddingVertical: 10,
    margin: 12,
    borderRadius: 4,
    alignItems: 'center',
  },
  clearHistoryButtonText: {
    color: '#FFF',
    fontWeight: 'bold',
    fontSize: 12,
  },
  permissionText: {
    color: '#FFF',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 12,
  },
});