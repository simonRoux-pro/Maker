import * as Contacts from 'expo-contacts';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Body, Card, PrimaryButton, SecondaryButton, Subtitle, Title } from '../../lib/components/ui';
import { requestCalendarPermission } from '../../lib/calendar';
import { useAppState } from '../../lib/context/AppStateContext';
import { requestNotificationPermission } from '../../lib/notifications';
import { colors, spacing } from '../../lib/theme';

export default function PermissionsStep() {
  const router = useRouter();
  const { permissions, setPermissions, profile, setProfile, setOnboardingDone } = useAppState();
  const [granting, setGranting] = useState<string | null>(null);

  const grant = async (key: 'notifications' | 'calendar' | 'contacts') => {
    setGranting(key);
    try {
      let ok = false;
      if (key === 'notifications') ok = await requestNotificationPermission();
      if (key === 'calendar') ok = await requestCalendarPermission();
      if (key === 'contacts') ok = (await Contacts.requestPermissionsAsync()).status === 'granted';
      await setPermissions({ ...permissions, [key]: ok });
    } finally {
      setGranting(null);
    }
  };

  const finish = async () => {
    await setProfile({ ...profile, onboardedAt: new Date().toISOString() });
    await setOnboardingDone(true);
    router.replace('/(tabs)/parcours');
  };

  return (
    <View style={styles.container}>
      <View style={{ gap: spacing.md }}>
        <Title>Des permissions, à toi de choisir</Title>
        <Body muted>
          Chaque permission est optionnelle et sert un usage précis. Tu peux
          les activer maintenant ou plus tard depuis Profil.
        </Body>

        <PermissionRow
          title="Notifications"
          description="Rappels d'actions et messages de motivation réguliers."
          granted={permissions.notifications}
          loading={granting === 'notifications'}
          onGrant={() => grant('notifications')}
        />
        <PermissionRow
          title="Agenda"
          description="Ajouter directement les réunions et échéances à ton calendrier."
          granted={permissions.calendar}
          loading={granting === 'calendar'}
          onGrant={() => grant('calendar')}
        />
        <PermissionRow
          title="Contacts du téléphone"
          description="Importer facilement un contact existant dans ton réseau. Rien n'est envoyé ailleurs que sur cet appareil."
          granted={permissions.contacts}
          loading={granting === 'contacts'}
          onGrant={() => grant('contacts')}
        />
      </View>

      <PrimaryButton label="Terminer" onPress={finish} />
    </View>
  );
}

function PermissionRow({
  title,
  description,
  granted,
  loading,
  onGrant,
}: {
  title: string;
  description: string;
  granted: boolean;
  loading: boolean;
  onGrant: () => void;
}) {
  return (
    <Card>
      <Subtitle>{title}</Subtitle>
      <Body muted>{description}</Body>
      {granted ? (
        <Body>Activé</Body>
      ) : (
        <SecondaryButton label={loading ? '...' : 'Activer'} onPress={onGrant} disabled={loading} />
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    padding: spacing.lg,
    paddingTop: spacing.xl,
    justifyContent: 'space-between',
    gap: spacing.lg,
  },
});
