/**
 * login.tsx — Supabase Auth screen (Sign in / Sign up)
 *
 * Two modes toggled by the user: "Sign in" and "Create account".
 * On success: navigates to home (or onboarding if new user).
 *
 * Design: minimal, premium — dark background, email + password only.
 */

import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Alert,
  SafeAreaView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../lib/auth-context';

export default function LoginScreen() {
  const router = useRouter();
  const { login, register } = useAuth();

  const [mode,     setMode]     = useState<'signin' | 'signup'>('signin');
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [loading,  setLoading]  = useState(false);

  async function handleSubmit() {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Missing fields', 'Please enter your email and password.');
      return;
    }

    setLoading(true);
    try {
      const result = mode === 'signin'
        ? await login(email.trim(), password)
        : await register(email.trim(), password);

      if (!result.ok) {
        Alert.alert('Error', result.error ?? 'Authentication failed.');
        return;
      }

      // On signup: go to onboarding. On signin: go to home.
      if (mode === 'signup') {
        router.replace('/onboarding');
      } else {
        router.replace('/(tabs)');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={s.safe}>
      <KeyboardAvoidingView
        style={s.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {/* Logo / wordmark */}
        <View style={s.header}>
          <Text style={s.appName}>R90 Navigator</Text>
          <Text style={s.tagline}>Sleep performance. Engineered.</Text>
        </View>

        {/* Form */}
        <View style={s.form}>
          <TextInput
            style={s.input}
            placeholder="Email"
            placeholderTextColor="#6B7280"
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            value={email}
            onChangeText={setEmail}
          />
          <TextInput
            style={s.input}
            placeholder="Password"
            placeholderTextColor="#6B7280"
            secureTextEntry
            autoCapitalize="none"
            value={password}
            onChangeText={setPassword}
          />

          <Pressable
            style={[s.submitBtn, loading && s.submitBtnDisabled]}
            onPress={() => { void handleSubmit(); }}
            disabled={loading}
          >
            {loading
              ? <ActivityIndicator color="#FFFFFF" />
              : <Text style={s.submitText}>
                  {mode === 'signin' ? 'Sign in' : 'Create account'}
                </Text>
            }
          </Pressable>

          {/* Mode toggle */}
          <Pressable
            style={s.toggleBtn}
            onPress={() => setMode(m => m === 'signin' ? 'signup' : 'signin')}
          >
            <Text style={s.toggleText}>
              {mode === 'signin'
                ? "Don't have an account? Create one"
                : 'Already have an account? Sign in'}
            </Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  safe: {
    flex:            1,
    backgroundColor: '#0D0D0D',
  },
  container: {
    flex:           1,
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  header: {
    alignItems:   'center',
    marginBottom: 48,
  },
  appName: {
    color:      '#FFFFFF',
    fontSize:   32,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  tagline: {
    color:     '#6B7280',
    fontSize:  14,
    marginTop:  8,
  },
  form: {
    gap: 12,
  },
  input: {
    backgroundColor: '#1A1A1A',
    borderWidth:     1,
    borderColor:     '#2A2A2A',
    borderRadius:    12,
    color:           '#FFFFFF',
    fontSize:        16,
    paddingVertical:   14,
    paddingHorizontal: 16,
  },
  submitBtn: {
    backgroundColor: '#22C55E',
    borderRadius:    12,
    paddingVertical: 16,
    alignItems:      'center',
    marginTop:       8,
  },
  submitBtnDisabled: {
    opacity: 0.6,
  },
  submitText: {
    color:      '#FFFFFF',
    fontSize:   16,
    fontWeight: '700',
  },
  toggleBtn: {
    alignItems:  'center',
    paddingVertical: 12,
  },
  toggleText: {
    color:    '#6B7280',
    fontSize: 14,
  },
});
