// MUST be the very first import — bootstraps the native gesture handler module
// before any other React Native code runs. Without this, TurboModuleRegistry
// throws 'RNGestureHandlerModule could not be found' on New Architecture builds.
import 'react-native-gesture-handler';

import { registerRootComponent } from 'expo';
import { ExpoRoot } from 'expo-router';

// Must be exported or Fast Refresh won't update the context
export function App() {
  const ctx = require.context('./app');
  return <ExpoRoot context={ctx} />;
}

registerRootComponent(App);
