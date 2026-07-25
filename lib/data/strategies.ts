import { StrategyArticle } from '../types';

export const STRATEGY_ARTICLES: StrategyArticle[] = [
  {
    id: 'fonctionnement-partis',
    title: "Comment fonctionne vraiment un parti de l'intérieur",
    category: 'Institutions',
    readMinutes: 6,
    summary:
      "Sections locales, fédérations, congrès, motions : comprendre les rouages internes pour savoir où et comment peser.",
    body: [
      "Un parti politique français s'organise en général en trois échelons : la section ou le comité local, la fédération départementale, et la direction nationale. Le pouvoir réel se joue souvent au niveau départemental : c'est là que se décident les investitures aux élections locales et législatives.",
      "Les statuts de chaque parti définissent les modalités de vote interne (motions de congrès, désignation des candidats). Lis-les avant de t'engager : ils déterminent tes marges de manœuvre réelles.",
      "La discipline de vote interne et la loyauté envers les candidats désignés comptent presque autant que les idées défendues. Un militant qui respecte les process, même en désaccord ponctuel, gagne en crédibilité pour de futures responsabilités.",
      "Les postes internes (secrétaire de section, trésorier, délégué au congrès) sont souvent sous-pourvus : s'y investir tôt est l'un des leviers les plus rapides pour se faire connaître des instances dirigeantes locales.",
    ],
  },
  {
    id: 'financement-campagne',
    title: 'Financement de campagne : ce qu\'il faut savoir avant de te lancer',
    category: 'Cadre légal',
    readMinutes: 5,
    summary:
      'Plafonds, mandataire financier, remboursement : les règles françaises de financement électoral, à connaître avant toute candidature.',
    body: [
      "En France, toute candidature à une élection (au-delà d'un certain seuil de population pour les municipales, et systématiquement pour les législatives) impose de désigner un mandataire financier (personne physique ou association de financement) via la préfecture, avant de recevoir le moindre don ou d'engager la moindre dépense.",
      "Les dons de personnes physiques sont plafonnés (actuellement 4 600 € par élection et par donateur, à vérifier sur le site de la CNCCFP) et les dons de personnes morales (hors partis) sont interdits depuis 1995.",
      "Les comptes de campagne doivent être déposés auprès de la CNCCFP (élections nationales) ou des services préfectoraux (comptes simplifiés pour certaines élections locales) dans les délais légaux. Un compte rejeté peut entraîner l'inéligibilité du candidat.",
      "Un candidat qui dépasse un certain score (5 % des suffrages en général) peut obtenir un remboursement partiel de ses dépenses par l'État — un point clé à intégrer dans le plan de financement dès le départ.",
    ],
  },
  {
    id: 'reseautage-utile',
    title: 'Réseauter sans paraître calculateur',
    category: 'Stratégie personnelle',
    readMinutes: 4,
    summary:
      "Construire un réseau politique utile est un travail de fond, pas une série de contacts LinkedIn. Quelques principes qui font la différence sur la durée.",
    body: [
      "Le réseau politique se construit par la régularité et la fiabilité, pas par l'accumulation de contacts. Une personne qui répond présent aux réunions, tient ses engagements et rend service sans calcul immédiat devient rapidement identifiée comme fiable.",
      "Catégorise mentalement ton réseau en cercles : mentors (qui peuvent te conseiller et t'ouvrir des portes), pairs (qui avancent au même rythme que toi et avec qui tu peux t'entraider), et personnes que tu peux toi-même aider (bâtir une réputation de personne utile).",
      "Un suivi discipliné (qui tu as rencontré, quand, sur quel sujet, quelle suite donner) fait une différence énorme sur plusieurs années — c'est un travail de CRM personnel, pas d'improvisation.",
      "Ta double casquette d'ingénieur informatique est un atout de réseautage : propose ton aide technique (site web associatif, analyse de données publiques, sécurité numérique) à des structures locales. C'est un service concret qui ouvre des portes bien mieux qu'une carte de visite.",
    ],
  },
  {
    id: 'calendrier-electoral',
    title: 'Comprendre le calendrier électoral français',
    category: 'Institutions',
    readMinutes: 5,
    summary:
      'Municipales, départementales, régionales, législatives, présidentielle : quel scrutin pour quel mandat, et à quel rythme.',
    body: [
      "Les élections municipales et communautaires ont lieu tous les 6 ans (scrutin de liste, avec prime majoritaire) et renouvellent les conseils municipaux ainsi que, indirectement, les conseils métropolitains et communautaires.",
      "Les élections départementales et régionales (également tous les 6 ans, généralement organisées ensemble) renouvellent les conseils départementaux et régionaux.",
      "Les élections législatives (scrutin uninominal à deux tours, tous les 5 ans sauf dissolution) désignent les 577 députés de l'Assemblée nationale, un par circonscription.",
      "Vérifie systématiquement les dates exactes sur service-public.fr ou le site du ministère de l'Intérieur : le calendrier peut être modifié par une dissolution ou une réforme électorale.",
    ],
  },
  {
    id: 'prise-de-parole',
    title: 'Prise de parole publique : les bases qui comptent vraiment',
    category: 'Compétences',
    readMinutes: 4,
    summary:
      "Réunion publique, conseil municipal, média local : les fondamentaux pour être audible et crédible, en partant d'un profil technique.",
    body: [
      "Un profil d'ingénieur a souvent un vrai atout en prise de parole politique : la capacité à structurer un argument avec des faits et des chiffres. Le risque à éviter est l'excès de technicité — reformule toujours en enjeux concrets pour les habitants.",
      "Entraîne-toi d'abord dans des cadres à faible enjeu (réunion de section, conseil de quartier) avant les prises de parole plus exposées (conseil municipal, médias locaux).",
      "Prépare systématiquement trois messages clés par intervention, pas plus. La répétition du message est plus efficace que la densité d'arguments.",
      "Les médias locaux (presse quotidienne régionale, radios locales) sont beaucoup plus accessibles que les médias nationaux pour un élu ou militant local — c'est souvent le meilleur point d'entrée pour construire une notoriété.",
    ],
  },
];

export function getArticleById(id: string) {
  return STRATEGY_ARTICLES.find((a) => a.id === id);
}
