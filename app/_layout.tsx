import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppStateProvider } from '../lib/context/AppStateContext';
import { colors } from '../lib/theme';

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AppStateProvider>
          <StatusBar style="light" />
          <Stack
            screenOptions={{
              headerStyle: { backgroundColor: colors.background },
              headerTintColor: colors.text,
              headerShadowVisible: false,
              contentStyle: { backgroundColor: colors.background },
            }}
          >
            <Stack.Screen name="index" options={{ headerShown: false }} />
            <Stack.Screen name="onboarding" options={{ headerShown: false }} />
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="milestone/[id]" options={{ title: 'Étape' }} />
            <Stack.Screen name="strategie/[id]" options={{ title: 'Stratégie' }} />
            <Stack.Screen name="contact/[id]" options={{ title: 'Contact' }} />
            <Stack.Screen name="contact/new" options={{ title: 'Nouveau contact', presentation: 'modal' }} />
          </Stack>
        </AppStateProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
