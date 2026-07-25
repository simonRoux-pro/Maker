import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { Body, PrimaryButton, Title } from '../../lib/components/ui';
import { colors, spacing } from '../../lib/theme';

export default function Welcome() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <View style={{ gap: spacing.md }}>
        <Title>Bienvenue</Title>
        <Body muted>
          Cet espace t'aide à structurer ton engagement sur la durée : un
          parcours clair, un réseau organisé, des repères stratégiques et des
          rappels réguliers pour avancer, même les semaines chargées.
        </Body>
        <Body muted>
          Tout reste privé et stocké uniquement sur cet appareil. Toi seul y
          as accès.
        </Body>
      </View>
      <PrimaryButton label="Commencer" onPress={() => router.push('/onboarding/profile')} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    padding: spacing.lg,
    paddingTop: spacing.xl * 2,
    justifyContent: 'space-between',
  },
});
