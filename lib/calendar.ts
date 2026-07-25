import * as Calendar from 'expo-calendar';
import { Platform } from 'react-native';

export async function requestCalendarPermission(): Promise<boolean> {
  const { status } = await Calendar.requestCalendarPermissionsAsync();
  return status === 'granted';
}

async function getWritableCalendarId(): Promise<string | null> {
  const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
  const writable = calendars.find((c) => c.allowsModifications);
  if (writable) return writable.id;

  if (Platform.OS === 'ios') {
    const defaultCalendar = await Calendar.getDefaultCalendarAsync();
    return defaultCalendar?.id ?? null;
  }

  const newCalendarId = await Calendar.createCalendarAsync({
    title: 'Maker',
    color: '#F2B441',
    entityType: Calendar.EntityTypes.EVENT,
    sourceId: calendars[0]?.source?.id,
    source: calendars[0]?.source ?? { isLocalAccount: true, name: 'Maker', type: 'LOCAL' },
    name: 'maker-engagement',
    ownerAccount: 'personal',
    accessLevel: Calendar.CalendarAccessLevel.OWNER,
  });
  return newCalendarId;
}

export async function addEventToCalendar(params: {
  title: string;
  notes?: string;
  startDate: Date;
  endDate: Date;
}): Promise<string | null> {
  const calendarId = await getWritableCalendarId();
  if (!calendarId) return null;
  return Calendar.createEventAsync(calendarId, {
    title: params.title,
    notes: params.notes,
    startDate: params.startDate,
    endDate: params.endDate,
  });
}
