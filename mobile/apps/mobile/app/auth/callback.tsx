/**
 * auth/callback.tsx — Deep link handler for OAuth redirects (Google, Apple)
 * Displayed briefly while expo-auth-session completes the OAuth flow.
 */

import { View, Image, StyleSheet, ActivityIndicator, Dimensions } from 'react-native';
import * as WebBrowser from 'expo-web-browser';

WebBrowser.maybeCompleteAuthSession();

const { width, height } = Dimensions.get('window');

export default function AuthCallback() {
  return (
    <View style={s.root}>
      <Image
        source={require('../../assets/images/icon.png')}
        style={s.bg}
        resizeMode="cover"
      />
      <View style={s.overlay} />
      <ActivityIndicator
        size="large"
        color="rgba(255,255,255,0.7)"
        style={s.spinner}
      />
    </View>
  );
}

const s = StyleSheet.create({
  root:    { flex: 1, backgroundColor: '#0A0A0A', alignItems: 'center', justifyContent: 'center' },
  bg:      { position: 'absolute', width, height },
  overlay: { position: 'absolute', width, height, backgroundColor: 'rgba(10,10,10,0.35)' },
  spinner: { position: 'absolute', bottom: height * 0.15 },
});
