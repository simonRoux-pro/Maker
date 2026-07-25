import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import * as storage from '../storage';
import {
  Contact,
  CoachSettings,
  PermissionsState,
  ProgressState,
  UserProfile,
  WebhookSettings,
} from '../types';

interface AppStateValue {
  loading: boolean;
  profile: UserProfile;
  setProfile: (p: UserProfile) => Promise<void>;
  permissions: PermissionsState;
  setPermissions: (p: PermissionsState) => Promise<void>;
  progress: ProgressState;
  toggleAction: (actionId: string) => Promise<void>;
  setCurrentStage: (stageId: ProgressState['currentStageId']) => Promise<void>;
  contacts: Contact[];
  addContact: (c: Contact) => Promise<void>;
  updateContact: (c: Contact) => Promise<void>;
  removeContact: (id: string) => Promise<void>;
  coachSettings: CoachSettings;
  setCoachSettings: (c: CoachSettings) => Promise<void>;
  webhookSettings: WebhookSettings;
  setWebhookSettings: (w: WebhookSettings) => Promise<void>;
  onboardingDone: boolean;
  setOnboardingDone: (v: boolean) => Promise<void>;
  resetAll: () => Promise<void>;
}

const defaultProfile: UserProfile = {
  firstName: '',
  city: null,
  situation: null,
  party: null,
  onboardedAt: null,
};

const defaultPermissions: PermissionsState = {
  notifications: false,
  calendar: false,
  contacts: false,
};

const defaultProgress: ProgressState = {
  completedActionIds: [],
  currentStageId: 'engagement',
};

const defaultCoachSettings: CoachSettings = {
  dailyNudgeEnabled: false,
  dailyNudgeHour: 8,
  weeklyReviewEnabled: false,
};

const defaultWebhookSettings: WebhookSettings = {
  enabled: false,
  url: '',
};

const AppStateContext = createContext<AppStateValue | null>(null);

export function AppStateProvider({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [profile, setProfileState] = useState<UserProfile>(defaultProfile);
  const [permissions, setPermissionsState] = useState<PermissionsState>(defaultPermissions);
  const [progress, setProgressState] = useState<ProgressState>(defaultProgress);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [coachSettings, setCoachSettingsState] = useState<CoachSettings>(defaultCoachSettings);
  const [webhookSettings, setWebhookSettingsState] = useState<WebhookSettings>(defaultWebhookSettings);
  const [onboardingDone, setOnboardingDoneState] = useState(false);

  useEffect(() => {
    (async () => {
      const [p, perm, prog, c, coach, webhook, done] = await Promise.all([
        storage.getItem(storage.StorageKeys.profile, defaultProfile),
        storage.getItem(storage.StorageKeys.permissions, defaultPermissions),
        storage.getItem(storage.StorageKeys.progress, defaultProgress),
        storage.getItem(storage.StorageKeys.contacts, [] as Contact[]),
        storage.getItem(storage.StorageKeys.coachSettings, defaultCoachSettings),
        storage.getItem(storage.StorageKeys.webhookSettings, defaultWebhookSettings),
        storage.getItem(storage.StorageKeys.onboardingDone, false),
      ]);
      setProfileState(p);
      setPermissionsState(perm);
      setProgressState(prog);
      setContacts(c);
      setCoachSettingsState(coach);
      setWebhookSettingsState(webhook);
      setOnboardingDoneState(done);
      setLoading(false);
    })();
  }, []);

  const setProfile = useCallback(async (p: UserProfile) => {
    setProfileState(p);
    await storage.setItem(storage.StorageKeys.profile, p);
  }, []);

  const setPermissions = useCallback(async (p: PermissionsState) => {
    setPermissionsState(p);
    await storage.setItem(storage.StorageKeys.permissions, p);
  }, []);

  const toggleAction = useCallback(
    async (actionId: string) => {
      setProgressState((prev) => {
        const has = prev.completedActionIds.includes(actionId);
        const next: ProgressState = {
          ...prev,
          completedActionIds: has
            ? prev.completedActionIds.filter((id) => id !== actionId)
            : [...prev.completedActionIds, actionId],
        };
        storage.setItem(storage.StorageKeys.progress, next);
        return next;
      });
    },
    []
  );

  const setCurrentStage = useCallback(async (stageId: ProgressState['currentStageId']) => {
    setProgressState((prev) => {
      const next = { ...prev, currentStageId: stageId };
      storage.setItem(storage.StorageKeys.progress, next);
      return next;
    });
  }, []);

  const persistContacts = useCallback(async (next: Contact[]) => {
    setContacts(next);
    await storage.setItem(storage.StorageKeys.contacts, next);
  }, []);

  const addContact = useCallback(
    async (c: Contact) => {
      await persistContacts([...contacts, c]);
    },
    [contacts, persistContacts]
  );

  const updateContact = useCallback(
    async (c: Contact) => {
      await persistContacts(contacts.map((existing) => (existing.id === c.id ? c : existing)));
    },
    [contacts, persistContacts]
  );

  const removeContact = useCallback(
    async (id: string) => {
      await persistContacts(contacts.filter((c) => c.id !== id));
    },
    [contacts, persistContacts]
  );

  const setCoachSettings = useCallback(async (c: CoachSettings) => {
    setCoachSettingsState(c);
    await storage.setItem(storage.StorageKeys.coachSettings, c);
  }, []);

  const setWebhookSettings = useCallback(async (w: WebhookSettings) => {
    setWebhookSettingsState(w);
    await storage.setItem(storage.StorageKeys.webhookSettings, w);
  }, []);

  const setOnboardingDone = useCallback(async (v: boolean) => {
    setOnboardingDoneState(v);
    await storage.setItem(storage.StorageKeys.onboardingDone, v);
  }, []);

  const resetAll = useCallback(async () => {
    await storage.removeAll();
    setProfileState(defaultProfile);
    setPermissionsState(defaultPermissions);
    setProgressState(defaultProgress);
    setContacts([]);
    setCoachSettingsState(defaultCoachSettings);
    setWebhookSettingsState(defaultWebhookSettings);
    setOnboardingDoneState(false);
  }, []);

  const value = useMemo<AppStateValue>(
    () => ({
      loading,
      profile,
      setProfile,
      permissions,
      setPermissions,
      progress,
      toggleAction,
      setCurrentStage,
      contacts,
      addContact,
      updateContact,
      removeContact,
      coachSettings,
      setCoachSettings,
      webhookSettings,
      setWebhookSettings,
      onboardingDone,
      setOnboardingDone,
      resetAll,
    }),
    [
      loading,
      profile,
      setProfile,
      permissions,
      setPermissions,
      progress,
      toggleAction,
      setCurrentStage,
      contacts,
      addContact,
      updateContact,
      removeContact,
      coachSettings,
      setCoachSettings,
      webhookSettings,
      setWebhookSettings,
      onboardingDone,
      setOnboardingDone,
      resetAll,
    ]
  );

  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>;
}

export function useAppState() {
  const ctx = useContext(AppStateContext);
  if (!ctx) throw new Error('useAppState must be used within AppStateProvider');
  return ctx;
}
