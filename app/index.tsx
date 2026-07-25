import { Redirect } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import { useAppState } from '../lib/context/AppStateContext';
import { colors } from '../lib/theme';

export default function Index() {
  const { loading, onboardingDone } = useAppState();

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  if (!onboardingDone) {
    return <Redirect href="/onboarding" />;
  }

  return <Redirect href="/(tabs)/parcours" />;
}
