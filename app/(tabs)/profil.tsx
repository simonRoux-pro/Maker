import * as Contacts from 'expo-contacts';
import { useState } from 'react';
import { Alert, Switch, TextInput, View } from 'react-native';
import {
  Body,
  Card,
  DangerButton,
  Screen,
  SecondaryButton,
  Subtitle,
  Title,
} from '../../lib/components/ui';
import { requestCalendarPermission } from '../../lib/calendar';
import { useAppState } from '../../lib/context/AppStateContext';
import { requestNotificationPermission } from '../../lib/notifications';
import { colors, radius, spacing } from '../../lib/theme';

export default function Profil() {
  const { profile, permissions, setPermissions, webhookSettings, setWebhookSettings, resetAll } = useAppState();
  const [webhookUrl, setWebhookUrl] = useState(webhookSettings.url);
  const [grantingKey, setGrantingKey] = useState<string | null>(null);

  const grant = async (key: 'notifications' | 'calendar' | 'contacts') => {
    setGrantingKey(key);
    try {
      let ok = false;
      if (key === 'notifications') ok = await requestNotificationPermission();
      if (key === 'calendar') ok = await requestCalendarPermission();
      if (key === 'contacts') ok = (await Contacts.requestPermissionsAsync()).status === 'granted';
      await setPermissions({ ...permissions, [key]: ok });
    } finally {
      setGrantingKey(null);
    }
  };

  const confirmReset = () => {
    Alert.alert(
      'Réinitialiser les données',
      'Ton profil, ton parcours, ton réseau et tes réglages seront définitivement supprimés de cet appareil.',
      [
        { text: 'Annuler', style: 'cancel' },
        { text: 'Réinitialiser', style: 'destructive', onPress: () => resetAll() },
      ]
    );
  };

  return (
    <Screen>
      <View style={{ gap: spacing.xs }}>
        <Title>Profil</Title>
        <Body muted>
          {profile.firstName || 'Sans nom'} · {profile.city ?? '—'}
        </Body>
      </View>

      <Card>
        <Subtitle>Permissions</Subtitle>
        <PermissionLine
          label="Notifications"
          granted={permissions.notifications}
          loading={grantingKey === 'notifications'}
          onGrant={() => grant('notifications')}
        />
        <PermissionLine
          label="Agenda"
          granted={permissions.calendar}
          loading={grantingKey === 'calendar'}
          onGrant={() => grant('calendar')}
        />
        <PermissionLine
          label="Contacts du téléphone"
          granted={permissions.contacts}
          loading={grantingKey === 'contacts'}
          onGrant={() => grant('contacts')}
        />
      </Card>

      <Card>
        <Subtitle>Webhook personnel</Subtitle>
        <Body muted>
          Optionnel. Renseigne l'URL d'une automatisation personnelle (ex. IFTTT,
          Zapier, ou ton propre service) qui pourra t'envoyer des alertes
          pertinentes (actualité locale, échéances). Rien n'est activé par défaut.
        </Body>
        <TextInput
          value={webhookUrl}
          onChangeText={setWebhookUrl}
          placeholder="https://..."
          placeholderTextColor={colors.textMuted}
          autoCapitalize="none"
          autoCorrect={false}
          style={{
            backgroundColor: colors.surfaceAlt,
            borderRadius: radius.sm,
            borderWidth: 1,
            borderColor: colors.border,
            color: colors.text,
            paddingHorizontal: spacing.md,
            paddingVertical: spacing.sm + 2,
            fontSize: 14,
          }}
        />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          <Body muted>Activé</Body>
          <Switch
            value={webhookSettings.enabled}
            onValueChange={(v) => setWebhookSettings({ ...webhookSettings, enabled: v })}
            trackColor={{ true: colors.accent, false: colors.surfaceAlt }}
          />
        </View>
        <SecondaryButton
          label="Enregistrer l'URL"
          onPress={() => setWebhookSettings({ ...webhookSettings, url: webhookUrl.trim() })}
        />
      </Card>

      <Card>
        <Subtitle>Données</Subtitle>
        <Body muted>
          Tout est stocké uniquement sur cet appareil. Aucune synchronisation
          externe n'est active.
        </Body>
        <DangerButton label="Réinitialiser toutes les données" onPress={confirmReset} />
      </Card>
    </Screen>
  );
}

function PermissionLine({
  label,
  granted,
  loading,
  onGrant,
}: {
  label: string;
  granted: boolean;
  loading: boolean;
  onGrant: () => void;
}) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
      <Body>{label}</Body>
      {granted ? (
        <Body muted>Activé</Body>
      ) : (
        <SecondaryButton label={loading ? '...' : 'Activer'} onPress={onGrant} disabled={loading} />
      )}
    </View>
  );
}
