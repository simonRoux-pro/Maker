import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { pickDailyMessage } from './data/nudges';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

export async function requestNotificationPermission(): Promise<boolean> {
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  const result = await Notifications.requestPermissionsAsync();
  return result.granted;
}

const DAILY_NUDGE_ID = 'maker-daily-nudge';

export async function scheduleDailyNudge(hour: number): Promise<void> {
  await Notifications.cancelScheduledNotificationAsync(DAILY_NUDGE_ID).catch(() => {});
  const message = pickDailyMessage(new Date().getDate());
  await Notifications.scheduleNotificationAsync({
    identifier: DAILY_NUDGE_ID,
    content: {
      title: 'Un pas de plus',
      body: message,
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour,
      minute: 0,
    },
  });
}

export async function cancelDailyNudge(): Promise<void> {
  await Notifications.cancelScheduledNotificationAsync(DAILY_NUDGE_ID).catch(() => {});
}

const WEEKLY_REVIEW_ID = 'maker-weekly-review';

export async function scheduleWeeklyReview(): Promise<void> {
  await Notifications.cancelScheduledNotificationAsync(WEEKLY_REVIEW_ID).catch(() => {});
  await Notifications.scheduleNotificationAsync({
    identifier: WEEKLY_REVIEW_ID,
    content: {
      title: 'Bilan de la semaine',
      body: "Prends 10 minutes : quelles actions as-tu menées, qui as-tu vu, qu'est-ce que tu prévois pour la semaine prochaine ?",
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
      weekday: 1,
      hour: 18,
      minute: 0,
    },
  });
}

export async function cancelWeeklyReview(): Promise<void> {
  await Notifications.cancelScheduledNotificationAsync(WEEKLY_REVIEW_ID).catch(() => {});
}

export async function sendTestNotification(): Promise<void> {
  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Maker',
      body: 'Les notifications sont actives.',
    },
    trigger: Platform.OS === 'web' ? null : { seconds: 1, type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL },
  });
}
