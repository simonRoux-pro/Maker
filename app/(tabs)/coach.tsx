import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Switch, View } from 'react-native';
import { Body, Card, PrimaryButton, Screen, SecondaryButton, Subtitle, Title } from '../../lib/components/ui';
import { useAppState } from '../../lib/context/AppStateContext';
import { getStageById } from '../../lib/data/roadmap';
import { pickDailyMessage } from '../../lib/data/nudges';
import {
  cancelDailyNudge,
  cancelWeeklyReview,
  requestNotificationPermission,
  scheduleDailyNudge,
  scheduleWeeklyReview,
  sendTestNotification,
} from '../../lib/notifications';
import { colors, spacing } from '../../lib/theme';

export default function Coach() {
  const router = useRouter();
  const { coachSettings, setCoachSettings, permissions, setPermissions, progress } = useAppState();
  const [busy, setBusy] = useState(false);

  const todayMessage = pickDailyMessage(new Date().getDate());
  const currentStage = getStageById(progress.currentStageId);
  const nextAction = currentStage?.actions.find((a) => !progress.completedActionIds.includes(a.id));

  const ensureNotificationPermission = async (): Promise<boolean> => {
    if (permissions.notifications) return true;
    const granted = await requestNotificationPermission();
    await setPermissions({ ...permissions, notifications: granted });
    return granted;
  };

  const toggleDaily = async (value: boolean) => {
    setBusy(true);
    try {
      if (value) {
        const granted = await ensureNotificationPermission();
        if (!granted) return;
        await scheduleDailyNudge(coachSettings.dailyNudgeHour);
      } else {
        await cancelDailyNudge();
      }
      await setCoachSettings({ ...coachSettings, dailyNudgeEnabled: value });
    } finally {
      setBusy(false);
    }
  };

  const toggleWeekly = async (value: boolean) => {
    setBusy(true);
    try {
      if (value) {
        const granted = await ensureNotificationPermission();
        if (!granted) return;
        await scheduleWeeklyReview();
      } else {
        await cancelWeeklyReview();
      }
      await setCoachSettings({ ...coachSettings, weeklyReviewEnabled: value });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <View style={{ gap: spacing.xs }}>
        <Title>Coach</Title>
        <Body muted>Un message par jour, un rappel par semaine.</Body>
      </View>

      <Card>
        <Subtitle>Aujourd'hui</Subtitle>
        <Body>{todayMessage}</Body>
      </Card>

      {nextAction && currentStage && (
        <Card>
          <Subtitle>Prochaine action</Subtitle>
          <Body muted>{currentStage.title}</Body>
          <Body>{nextAction.label}</Body>
          <SecondaryButton label="Voir l'étape" onPress={() => router.push(`/milestone/${currentStage.id}`)} />
        </Card>
      )}

      <Card>
        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <Subtitle>Rappel quotidien</Subtitle>
            <Body muted>Un message de motivation chaque matin.</Body>
          </View>
          <Switch
            value={coachSettings.dailyNudgeEnabled}
            onValueChange={toggleDaily}
            disabled={busy}
            trackColor={{ true: colors.accent, false: colors.surfaceAlt }}
          />
        </View>
      </Card>

      <Card>
        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <Subtitle>Bilan hebdomadaire</Subtitle>
            <Body muted>Un rappel le lundi soir pour faire le point.</Body>
          </View>
          <Switch
            value={coachSettings.weeklyReviewEnabled}
            onValueChange={toggleWeekly}
            disabled={busy}
            trackColor={{ true: colors.accent, false: colors.surfaceAlt }}
          />
        </View>
      </Card>

      <PrimaryButton
        label="Envoyer une notification de test"
        onPress={async () => {
          const granted = await ensureNotificationPermission();
          if (granted) await sendTestNotification();
        }}
      />
    </Screen>
  );
}

const styles = {
  row: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: spacing.sm,
  },
};
