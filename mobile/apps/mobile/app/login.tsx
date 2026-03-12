/**
 * login.tsx — Auth screen (Sign in / Sign up) — R90 Navigator redesign.
 *
 * Design: navy theme, R-Lo mascot hero, Inter typography, accent tabs & inputs.
 * All auth logic preserved from the original.
 */

import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuth } from '../lib/auth-context';
import { useTheme } from '../lib/theme-context';
import { MascotImage } from '../components/ui/MascotImage';
import { Button } from '../components/ui/Button';

export default function LoginScreen() {
  const router = useRouter();
  const { login, register } = useAuth();
  const { theme } = useTheme();
  const c = theme.colors;

  const [mode,         setMode]         = useState<'signin' | 'signup'>('signin');
  const [email,        setEmail]        = useState('');
  const [password,     setPassword]     = useState('');
  const [loading,      setLoading]      = useState(false);
  const [error,        setError]        = useState<string | null>(null);
  const [focusedField, setFocusedField] = useState<'email' | 'password' | null>(null);

  async function handleSubmit() {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Missing fields', 'Please enter your email and password.');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const result = mode === 'signin'
        ? await login(email.trim(), password)
        : await register(email.trim(), password);

      if (!result.ok) {
        setError(result.error ?? 'Authentication failed.');
        return;
      }

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
    <SafeAreaView style={[s.safe, { backgroundColor: c.background }]}>
      <KeyboardAvoidingView
        style={[s.kav, { paddingHorizontal: 28 }]}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {/* Hero — R-Lo + branding (≈40% screen height) */}
        <View style={s.hero}>
          <MascotImage emotion="encourageant" size="md" />
          <Text style={[s.appName, { color: c.accent }]}>R90</Text>
          <Text style={[s.tagline, { color: c.textSub }]}>Sleep. Recover. Perform.</Text>
        </View>

        {/* Form (≈60% screen height) */}
        <View style={s.form}>
          {/* Mode tabs */}
          <View style={[s.tabs, { backgroundColor: c.surface }]}>
            {(['signin', 'signup'] as const).map(tab => (
              <Pressable
                key={tab}
                style={[s.tab, mode === tab && [s.tabActive, { backgroundColor: c.surface2 }]]}
                onPress={() => { setMode(tab); setError(null); }}
              >
                <Text style={[s.tabText, { color: mode === tab ? c.accent : c.textMuted }]}>
                  {tab === 'signin' ? 'Sign in' : 'Create account'}
                </Text>
              </Pressable>
            ))}
          </View>

          {/* Email input */}
          <TextInput
            style={[
              s.input,
              {
                backgroundColor: c.surface2,
                borderColor:     focusedField === 'email' ? c.accent : c.borderSub,
                color:           c.text,
              },
            ]}
            placeholder="Email"
            placeholderTextColor={c.textMuted}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            value={email}
            onChangeText={setEmail}
            onFocus={() => setFocusedField('email')}
            onBlur={() => setFocusedField(null)}
          />

          {/* Password input */}
          <TextInput
            style={[
              s.input,
              {
                backgroundColor: c.surface2,
                borderColor:     focusedField === 'password' ? c.accent : c.borderSub,
                color:           c.text,
              },
            ]}
            placeholder="Password"
            placeholderTextColor={c.textMuted}
            secureTextEntry
            autoCapitalize="none"
            value={password}
            onChangeText={setPassword}
            onFocus={() => setFocusedField('password')}
            onBlur={() => setFocusedField(null)}
          />

          {/* Submit */}
          <Button
            label={mode === 'signin' ? 'Sign in' : 'Create account'}
            onPress={() => { void handleSubmit(); }}
            variant="primary"
            fullWidth
            loading={loading}
          />

          {/* Error message */}
          {error ? (
            <Text style={[s.errorText, { color: c.error }]}>{error}</Text>
          ) : null}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  safe: {
    flex: 1,
  },
  kav: {
    flex: 1,
  },
  // Hero takes ~40% of vertical space
  hero: {
    flex:           2,
    alignItems:     'center',
    justifyContent: 'center',
    gap:            6,
  },
  appName: {
    fontSize:      48,
    fontWeight:    '900',
    letterSpacing: -2,
    marginTop:     8,
  },
  tagline: {
    fontSize:   16,
    fontWeight: '500',
  },
  // Form takes ~60% of vertical space
  form: {
    flex: 3,
    gap:  14,
  },
  tabs: {
    flexDirection: 'row',
    borderRadius:  12,
    padding:       4,
    marginBottom:  8,
  },
  tab: {
    flex:            1,
    paddingVertical: 10,
    alignItems:      'center',
    borderRadius:    10,
  },
  tabActive: {},
  tabText: {
    fontSize:   14,
    fontWeight: '600',
  },
  input: {
    borderWidth:       1,
    borderRadius:      12,
    paddingVertical:   14,
    paddingHorizontal: 16,
    fontSize:          16,
  },
  errorText: {
    fontSize:  13,
    textAlign: 'center',
  },
});
