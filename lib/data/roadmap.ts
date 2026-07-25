import { RoadmapStage } from '../types';

/**
 * Parcours générique inspiré du fonctionnement réel des partis et des
 * institutions françaises (adhésion → mandat local → mandat national).
 * Les échéances électorales exactes changent : vérifie toujours les dates
 * officielles sur service-public.fr avant de t'organiser autour d'elles.
 */
export const ROADMAP_STAGES: RoadmapStage[] = [
  {
    id: 'engagement',
    order: 1,
    title: "S'engager et se former",
    timeframe: '0 à 6 mois',
    summary:
      "Avant de militer, comprends le terrain : institutions, familles politiques, enjeux locaux. C'est la base sur laquelle tout le reste se construit.",
    actions: [
      {
        id: 'eng-1',
        label: 'Choisir un parti ou mouvement aligné avec tes valeurs',
        detail:
          "Rencontre plusieurs sections locales avant de trancher. Assiste à une réunion publique de chaque mouvement qui t'intéresse à Saint-Étienne ou à Lyon. L'alignement idéologique compte moins que la qualité du collectif local — c'est avec ces gens que tu vas travailler pendant des années.",
      },
      {
        id: 'eng-2',
        label: 'Adhérer officiellement',
        detail:
          "L'adhésion (souvent 20 à 40€/an) te donne accès aux réunions internes, aux votes de motions et, plus tard, à l'investiture. Sans carte, pas de légitimité interne.",
      },
      {
        id: 'eng-3',
        label: 'Se former aux institutions',
        detail:
          "Comprends le rôle du conseil municipal, du conseil métropolitain (Saint-Étienne Métropole ou Métropole de Lyon), du conseil départemental et de l'Assemblée nationale. Le site vie-publique.fr et les MOOC de Sciences Po sont de bons points de départ.",
      },
      {
        id: 'eng-4',
        label: 'Cartographier les enjeux locaux',
        detail:
          "Lis la presse locale (Le Progrès à Lyon, Le Progrès / La Tribune-Le Progrès à Saint-Étienne), suis les comptes-rendus de conseil municipal. Identifie 3 sujets sur lesquels tu peux devenir une référence.",
      },
    ],
  },
  {
    id: 'implantation-locale',
    order: 2,
    title: "S'implanter localement",
    timeframe: '6 à 18 mois',
    summary:
      'La politique est un métier de présence. Ta légitimité se construit sur le terrain, pas sur les réseaux sociaux.',
    actions: [
      {
        id: 'impl-1',
        label: 'Militer concrètement',
        detail:
          'Tractage, porte-à-porte, tenue de stands, organisation de réunions publiques. Vise une régularité (ex. un week-end sur deux) plutôt qu\'un engagement ponctuel intense.',
      },
      {
        id: 'impl-2',
        label: "Rejoindre ou créer une association de quartier",
        detail:
          "Conseil de quartier, association de riverains, club sportif, association culturelle : c'est souvent là que se construit la crédibilité locale, en dehors du seul cadre partisan.",
      },
      {
        id: 'impl-3',
        label: 'Se rendre utile sur un sujet technique',
        detail:
          "En tant qu'ingénieur informatique, tu as une expertise rare en politique locale : numérique, données publiques, cybersécurité, transformation digitale des services. Propose-toi comme référent sur ces sujets en interne.",
      },
      {
        id: 'impl-4',
        label: 'Construire une présence publique cohérente',
        detail:
          "Un compte professionnel clair (pas nécessairement volumineux) où tu documentes ton engagement. La cohérence dans la durée compte plus que la viralité ponctuelle.",
      },
    ],
  },
  {
    id: 'responsabilites',
    order: 3,
    title: 'Prendre des responsabilités internes',
    timeframe: '1 à 3 ans',
    summary:
      "Avant d'être candidat, deviens quelqu'un sur qui le parti peut s'appuyer : organisation, trésorerie, porte-parolat, animation de section.",
    actions: [
      {
        id: 'resp-1',
        label: 'Viser un poste dans la section locale',
        detail:
          "Secrétaire de section, trésorier, référent thématique. Ces postes sont souvent peu convoités et faciles à obtenir pour qui se rend disponible — ils donnent une vraie vue sur le fonctionnement interne.",
      },
      {
        id: 'resp-2',
        label: 'Participer aux instances de vote internes',
        detail:
          'Congrès, motions, désignations : ta participation active et ton vote comptent pour te faire connaître des cadres du parti au niveau local et régional.',
      },
      {
        id: 'resp-3',
        label: 'Développer une expertise reconnue',
        detail:
          "Rédige des notes, interventions ou propositions sur 1 à 2 sujets (numérique et service public, souveraineté technologique, données personnelles). Deviens la personne qu'on sollicite sur ces thèmes.",
      },
      {
        id: 'resp-4',
        label: 'Se constituer un premier cercle de soutien',
        detail:
          "Repère 5 à 10 personnes qui te feraient confiance pour te placer sur une liste ou te déléguer une responsabilité. Entretiens ces relations dans la durée, pas seulement avant une échéance.",
      },
    ],
  },
  {
    id: 'mandat-municipal',
    order: 4,
    title: 'Obtenir un premier mandat local',
    timeframe: 'Aligné sur le calendrier des élections municipales',
    summary:
      "Le conseil municipal est la porte d'entrée classique en France vers une carrière politique. Une place éligible sur une liste, même en position modeste, change tout.",
    actions: [
      {
        id: 'mun-1',
        label: 'Se positionner tôt pour une place sur liste',
        detail:
          "Les listes se构 constituent 12 à 18 mois avant le scrutin. Fais savoir en interne, suffisamment tôt, que tu es candidat à une place — y compris non-éligible au premier tour : c'est un investissement pour le mandat suivant.",
      },
      {
        id: 'mun-2',
        label: 'Comprendre le mode de scrutin local',
        detail:
          "À Saint-Étienne comme à Lyon (avec la spécificité de la métropole de Lyon et du système par secteurs à Lyon même), le scrutin de liste proportionnel avec prime majoritaire structure toute la stratégie de positionnement.",
      },
      {
        id: 'mun-3',
        label: 'Construire un mini-programme crédible sur ton sujet',
        detail:
          "Propose 2-3 mesures concrètes et chiffrées sur le numérique public local (open data, cybersécurité des services municipaux, inclusion numérique). Un élu qui maîtrise un sujet technique de bout en bout gagne en crédibilité.",
      },
      {
        id: 'mun-4',
        label: "Respecter le cadre légal du financement de campagne",
        detail:
          "Renseigne-toi tôt auprès de la CNCCFP (Commission nationale des comptes de campagne) sur les règles de financement, plafonds de dépenses et mandataire financier — les irrégularités disqualifient des carrières entières.",
      },
    ],
  },
  {
    id: 'rayonnement',
    order: 5,
    title: 'Monter en responsabilité',
    timeframe: '1 à 2 mandats locaux',
    summary:
      "Un siège de conseiller municipal ne suffit pas : c'est la qualité de ton mandat qui ouvre la suite (adjoint, conseiller métropolitain, départemental, régional).",
    actions: [
      {
        id: 'ray-1',
        label: 'Viser une délégation ou une vice-présidence',
        detail:
          'Numérique, transition écologique, finances : une délégation te donne un budget, une administration et une vitrine d\'action concrète.',
      },
      {
        id: 'ray-2',
        label: 'Siéger à la métropole ou au département',
        detail:
          'Saint-Étienne Métropole ou la Métropole de Lyon (collectivité à statut particulier) sont des tremplins naturels après un mandat municipal réussi.',
      },
      {
        id: 'ray-3',
        label: "Élargir ton réseau au niveau régional et national",
        detail:
          "Fédération départementale du parti, université d'été, congrès national : c'est là que se jouent les investitures aux élections suivantes.",
      },
      {
        id: 'ray-4',
        label: 'Documenter ton bilan',
        detail:
          "Prépare un bilan de mandat factuel (réalisations, votes, initiatives) : c'est ton meilleur argument pour une investiture aux législatives.",
      },
    ],
  },
  {
    id: 'legislatives',
    order: 6,
    title: "Viser l'investiture aux législatives",
    timeframe: 'Aligné sur le calendrier des élections législatives',
    summary:
      "Devenir député suppose une investiture de parti dans une circonscription (Loire pour Saint-Étienne, Rhône pour Lyon), un ancrage local reconnu et une capacité à mener campagne au scrutin uninominal à deux tours.",
    actions: [
      {
        id: 'leg-1',
        label: 'Étudier les circonscriptions de la Loire et du Rhône',
        detail:
          "Identifie la circonscription où ton implantation est la plus forte et où le rapport de force est le plus favorable à ta famille politique.",
      },
      {
        id: 'leg-2',
        label: 'Constituer un dossier de candidature interne',
        detail:
          "Bilan de mandat, soutiens locaux, programme de circonscription : les commissions d'investiture des partis arbitrent sur ces critères, rarement sur la seule ancienneté.",
      },
      {
        id: 'leg-3',
        label: 'Anticiper les règles du scrutin uninominal',
        detail:
          "Le scrutin législatif français à deux tours exige une organisation de campagne différente d'une élection de liste : porte-à-porte massif, débats, gestion des triangulaires éventuelles.",
      },
      {
        id: 'leg-4',
        label: 'Sécuriser le financement et les parrainages internes',
        detail:
          "Vérifie les obligations déclaratives (HATVP en cas d'élection), le plafond de dépenses de la circonscription et le soutien financier du parti national.",
      },
    ],
  },
];

export function getStageById(id: string) {
  return ROADMAP_STAGES.find((s) => s.id === id);
}

export function getAllActionIds(): string[] {
  return ROADMAP_STAGES.flatMap((s) => s.actions.map((a) => a.id));
}
