import { useState, useRef, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  TextInput,
  Alert,
  PermissionsAndroid,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions } from 'expo-camera';
import RTMPPublisher from 'react-native-rtmp-publisher';

const RTMP_HOST = process.env.EXPO_PUBLIC_RTMP_HOST;
const PRESET_ANGLES = ['Side', 'Goal End', 'Wide'];

function sanitizeAngle(label) {
  return label.trim().toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
}

export default function LiveStreamScreen({ route, navigation }) {
  const { sessionCode, gameTitle } = route.params;
  const [permission] = useCameraPermissions();
  const [angle, setAngle] = useState('');
  const [customAngle, setCustomAngle] = useState('');
  const [isLive, setIsLive] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [bluetoothReady, setBluetoothReady] = useState(false);
  const publisherRef = useRef(null);

  useEffect(() => {
    const requestPermissions = async () => {
      if (Platform.OS === 'android') {
        try {
          const perms = [PermissionsAndroid.PERMISSIONS.RECORD_AUDIO];
          if (Platform.Version >= 31) {
            perms.push(PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT);
          }
          await PermissionsAndroid.requestMultiple(perms);
        } catch (_) {}
      }
      setBluetoothReady(true);
    };
    requestPermissions();
  }, []);

  const activeAngle = angle === 'custom' ? customAngle : angle;
  const streamKey = activeAngle.trim()
    ? `${sessionCode}_${sanitizeAngle(activeAngle)}`
    : '';
  const rtmpUrl = `${RTMP_HOST}/${streamKey}`;

  useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', () => {
      if (isLive && publisherRef.current) {
        publisherRef.current.stopStream?.();
      }
    });
    return unsubscribe;
  }, [navigation, isLive]);

  const handleStartStop = async () => {
    if (!activeAngle.trim()) {
      Alert.alert('Select Angle', 'Please select or enter a camera angle before streaming.');
      return;
    }

    if (isLive) {
      publisherRef.current?.stopStream();
      setIsLive(false);
      setIsConnecting(false);
    } else {
      setIsConnecting(true);
      try {
        publisherRef.current?.startStream();
      } catch (e) {
        console.log('[RTMP] error:', e.message);
      }
    }
  };

  const handleBack = () => {
    if (isLive || isConnecting) {
      Alert.alert('Stop Stream', 'Stop the stream before going back?', [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Stop & Go Back',
          style: 'destructive',
          onPress: () => {
            publisherRef.current?.stopStream?.();
            navigation.goBack();
          },
        },
      ]);
    } else {
      navigation.goBack();
    }
  };

  const renderCamera = () => {
    if (!bluetoothReady) {
      return <View style={[styles.camera, { backgroundColor: '#000' }]} />;
    }
    return (
      <RTMPPublisher
        key={streamKey}
        ref={publisherRef}
        style={styles.camera}
        streamURL={rtmpUrl}
        streamName=""
        onConnectionStarted={() => { console.log('[RTMP] connection started'); }}
        onConnectionSuccess={() => { console.log('[RTMP] connected!'); setIsLive(true); setIsConnecting(false); }}
        onConnectionFailed={(code) => { 
          console.log('[RTMP] connection failed, code:', code);
          setIsLive(false);
          setIsConnecting(false);
          Alert.alert('Connection Failed', 'Could not connect to the stream server.');
        }}
        onDisconnect={() => { setIsLive(false); setIsConnecting(false); }}
      />
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack} style={styles.backButton}>
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle} numberOfLines={1}>{gameTitle}</Text>
          <View style={styles.sessionBadge}>
            <Text style={styles.sessionCode}>{sessionCode}</Text>
          </View>
        </View>
        <View style={styles.liveIndicator}>
          <View style={[styles.liveDot, isLive && styles.liveDotActive]} />
          <Text style={[styles.liveText, isLive && styles.liveTextActive]}>
            {isConnecting && !isLive ? 'CONNECTING' : isLive ? 'LIVE' : 'OFF'}
          </Text>
        </View>
      </View>

      {renderCamera()}

      <View style={styles.controls}>
        <Text style={styles.controlLabel}>CAMERA ANGLE</Text>
        <View style={styles.angleRow}>
          {PRESET_ANGLES.map((a) => (
            <TouchableOpacity
              key={a}
              style={[styles.angleButton, angle === a && styles.angleButtonActive]}
              onPress={() => setAngle(a)}
              disabled={isLive || isConnecting}
            >
              <Text style={[styles.angleButtonText, angle === a && styles.angleButtonTextActive]}>
                {a}
              </Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity
            style={[styles.angleButton, angle === 'custom' && styles.angleButtonActive]}
            onPress={() => setAngle('custom')}
            disabled={isLive || isConnecting}
          >
            <Text style={[styles.angleButtonText, angle === 'custom' && styles.angleButtonTextActive]}>
              Custom
            </Text>
          </TouchableOpacity>
        </View>

        {angle === 'custom' && (
          <TextInput
            style={styles.customInput}
            placeholder="Enter angle label..."
            placeholderTextColor="#666"
            value={customAngle}
            onChangeText={setCustomAngle}
            editable={!isLive && !isConnecting}
            autoCapitalize="words"
            returnKeyType="done"
          />
        )}

        {streamKey ? (
          <Text style={styles.streamKeyText}>
            Stream key: <Text style={styles.streamKeyValue}>{streamKey}</Text>
          </Text>
        ) : (
          <Text style={styles.streamKeyText}>Select an angle to generate stream key</Text>
        )}

        <TouchableOpacity
          style={[
            styles.streamButton,
            isLive && styles.streamButtonLive,
            isConnecting && styles.streamButtonConnecting,
          ]}
          onPress={handleStartStop}
        >
          <Text style={styles.streamButtonText}>
            {isConnecting ? 'Connecting...' : isLive ? 'Stop Stream' : 'Start Stream'}
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#111',
    borderBottomWidth: 1,
    borderBottomColor: '#222',
  },
  backButton: { paddingRight: 12 },
  backButtonText: { color: '#00FF00', fontSize: 15, fontWeight: '600' },
  headerCenter: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerTitle: { color: '#FFF', fontSize: 15, fontWeight: 'bold', flexShrink: 1 },
  sessionBadge: { backgroundColor: '#222', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4 },
  sessionCode: { color: '#888', fontSize: 12, fontFamily: 'monospace' },
  liveIndicator: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#444' },
  liveDotActive: { backgroundColor: '#FF3B30' },
  liveText: { color: '#666', fontSize: 12, fontWeight: 'bold' },
  liveTextActive: { color: '#FF3B30' },
  camera: { flex: 1 },
  controls: {
    backgroundColor: '#111',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 24,
    borderTopWidth: 1,
    borderTopColor: '#222',
  },
  controlLabel: { color: '#666', fontSize: 11, fontWeight: '700', letterSpacing: 1, marginBottom: 10 },
  angleRow: { flexDirection: 'row', gap: 8, marginBottom: 12, flexWrap: 'wrap' },
  angleButton: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#333',
    backgroundColor: '#1a1a1a',
  },
  angleButtonActive: { borderColor: '#00FF00', backgroundColor: '#002200' },
  angleButtonText: { color: '#888', fontSize: 13, fontWeight: '600' },
  angleButtonTextActive: { color: '#00FF00' },
  customInput: {
    backgroundColor: '#1a1a1a',
    borderWidth: 1,
    borderColor: '#333',
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#FFF',
    fontSize: 14,
    marginBottom: 12,
  },
  streamKeyText: { color: '#555', fontSize: 12, marginBottom: 14 },
  streamKeyValue: { color: '#888', fontFamily: 'monospace' },
  streamButton: {
    backgroundColor: '#00FF00',
    paddingVertical: 16,
    borderRadius: 10,
    alignItems: 'center',
  },
  streamButtonLive: { backgroundColor: '#FF3B30' },
  streamButtonConnecting: { backgroundColor: '#555' },
  streamButtonText: { color: '#000', fontSize: 16, fontWeight: 'bold' },
});