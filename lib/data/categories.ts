import { ContactCategory } from '../types';

export const CATEGORY_LABELS: Record<ContactCategory, string> = {
  mentor: 'Mentor',
  elu: 'Élu',
  parti: 'Parti / appareil',
  militant: 'Militant',
  presse: 'Presse',
  financement: 'Financement',
  associatif: 'Associatif',
  autre: 'Autre',
};

export const CATEGORY_ORDER: ContactCategory[] = [
  'mentor',
  'elu',
  'parti',
  'militant',
  'presse',
  'financement',
  'associatif',
  'autre',
];
