export const MOTIVATIONAL_MESSAGES: string[] = [
  "Un mandat se construit sur des années de présence, pas sur un coup d'éclat. Aujourd'hui, fais une action, même petite.",
  "Personne ne devient élu sans avoir été un bon militant avant. Le terrain d'aujourd'hui est le mandat de demain.",
  "Ton profil d'ingénieur est rare en politique locale. C'est un avantage compétitif réel — utilise-le.",
  "As-tu relancé quelqu'un de ton réseau cette semaine ? Le suivi discret fait toute la différence sur la durée.",
  "La régularité bat l'intensité. Mieux vaut un engagement stable sur 3 ans qu'un sprint de 3 mois.",
  "Une carrière politique se construit mandat après mandat. Sois patient avec le temps long, exigeant avec toi-même sur le quotidien.",
  "Qui as-tu aidé cette semaine sans rien attendre en retour ? C'est souvent ce qui construit une vraie réputation locale.",
];

export function pickDailyMessage(seed: number): string {
  const idx = Math.abs(seed) % MOTIVATIONAL_MESSAGES.length;
  return MOTIVATIONAL_MESSAGES[idx];
}
