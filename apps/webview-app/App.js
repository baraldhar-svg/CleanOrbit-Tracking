import { StyleSheet, SafeAreaView, Platform, View, StatusBar } from 'react-native';
import { WebView } from 'react-native-webview';
import * as Location from 'expo-location';
import { useEffect, useState } from 'react';

export default function App() {
  const [hasPermission, setHasPermission] = useState(false);

  useEffect(() => {
    (async () => {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        setHasPermission(true);
      }
    })();
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.webviewContainer}>
        <WebView 
          source={{ uri: `https://orbitbustrack.com?t=${Date.now()}` }} 
          style={styles.webview}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          cacheEnabled={true}
          allowsFullscreenVideo={true}
          startInLoadingState={true}
          geolocationEnabled={true}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    paddingTop: Platform.OS === 'android' ? 25 : 0,
  },
  webviewContainer: {
    flex: 1,
  },
  webview: {
    flex: 1,
  },
});
