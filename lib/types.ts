export type City = 'saint-etienne' | 'lyon';

export type Situation =
  | 'sympathisant'
  | 'adherent'
  | 'militant-actif'
  | 'responsable-local'
  | 'elu-local';

export interface UserProfile {
  firstName: string;
  city: City | null;
  situation: Situation | null;
  party: string | null;
  onboardedAt: string | null;
}

export interface PermissionsState {
  notifications: boolean;
  calendar: boolean;
  contacts: boolean;
}

export type StageId =
  | 'engagement'
  | 'implantation-locale'
  | 'responsabilites'
  | 'mandat-municipal'
  | 'rayonnement'
  | 'legislatives';

export interface RoadmapAction {
  id: string;
  label: string;
  detail: string;
}

export interface RoadmapStage {
  id: StageId;
  order: number;
  title: string;
  timeframe: string;
  summary: string;
  actions: RoadmapAction[];
}

export interface ProgressState {
  completedActionIds: string[];
  currentStageId: StageId;
}

export type ContactCategory =
  | 'mentor'
  | 'elu'
  | 'parti'
  | 'militant'
  | 'presse'
  | 'financement'
  | 'associatif'
  | 'autre';

export interface Contact {
  id: string;
  name: string;
  category: ContactCategory;
  role: string;
  city: string;
  notes: string;
  phone: string;
  email: string;
  lastContactAt: string | null;
  nextFollowUpAt: string | null;
  createdAt: string;
}

export interface StrategyArticle {
  id: string;
  title: string;
  category: string;
  readMinutes: number;
  summary: string;
  body: string[];
}

export interface CoachSettings {
  dailyNudgeEnabled: boolean;
  dailyNudgeHour: number;
  weeklyReviewEnabled: boolean;
}

export interface WebhookSettings {
  enabled: boolean;
  url: string;
}
