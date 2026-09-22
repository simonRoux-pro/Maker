/**
 * Definition des pages du site public.
 *
 * Chaque page vise une question que les gens tapent reellement, y repond en
 * texte d'abord, puis offre l'outil. L'ordre compte: une page qui n'est
 * qu'un formulaire n'a rien a se faire indexer.
 *
 * Le calcul se fait entierement dans le navigateur, avec les memes moteurs
 * que les APIs. Aucune donnee ne part du poste du visiteur, aucun appel
 * reseau, donc aucun cout par visite et rien a surveiller.
 */

export const SITE = {
  name: "Jours ouvrés, délais et identifiants",
  tagline: "Outils de calcul français, gratuits, sans inscription",
  api_holidays:
    "https://rapidapi.com/prosimonroux/api/french-public-holidays-business-days",
};

export const PAGES = [
  {
    path: "/",
    slug: "index",
    title: "Calcul de jours ouvrés, de délais et vérification d'identifiants",
    description:
      "Outils gratuits de calcul français : jours ouvrés entre deux dates, échéance d'un délai avec report légal, jours fériés par zone, vérification d'IBAN, de SIREN, de SIRET et de TVA.",
    engine: null,
    body: `
<h1>Des calculs français qui tombent juste</h1>
<p class="lead">Six outils, aucune inscription, aucune donnée envoyée. Tout le
calcul se fait dans votre navigateur.</p>

<div class="cards">
  <a class="card" href="/jours-ouvres"><strong>Jours ouvrés entre deux dates</strong>
    <span>Compter, ou ajouter un nombre de jours ouvrés à une date.</span></a>
  <a class="card" href="/delai"><strong>Échéance d'un délai</strong>
    <span>Avec report au premier jour ouvrable, article 642 du CPC.</span></a>
  <a class="card" href="/jours-feries"><strong>Jours fériés</strong>
    <span>Métropole, Alsace-Moselle et outre-mer, de 1982 à 2100.</span></a>
  <a class="card" href="/iban"><strong>Vérifier un IBAN</strong>
    <span>Clé de contrôle et longueur, 37 pays de la zone SEPA.</span></a>
  <a class="card" href="/siret"><strong>SIREN, SIRET et TVA</strong>
    <span>Clé de Luhn, exception La Poste, numéro de TVA français.</span></a>
  <a class="card" href="/rib"><strong>Clé RIB</strong>
    <span>Calculer ou vérifier la clé d'un relevé d'identité bancaire.</span></a>
</div>

<h2>Pourquoi ces outils existent</h2>
<p>Ces calculs ont l'air simples et ne le sont pas. Un délai d'un jour à
partir du 7 mai 2026 n'échoit pas le 8 mai : le 8 mai est férié, donc
l'échéance glisse au lundi 11. Les SIRET de La Poste échouent au contrôle de
Luhn que tout le monde applique. La clé d'un RIB convertit la lettre S en 2 et
non en 1. Chacune de ces règles est une source d'erreur banale dans un
logiciel de facturation ou de paie.</p>
`,
  },
  {
    path: "/jours-ouvres",
    slug: "jours-ouvres",
    title: "Calculer les jours ouvrés entre deux dates",
    description:
      "Compter les jours ouvrés ou ouvrables entre deux dates, ou ajouter un nombre de jours ouvrés à une date. Jours fériés français déduits, zones métropole, Alsace-Moselle et outre-mer.",
    engine: "holidays",
    body: `
<h1>Jours ouvrés entre deux dates</h1>
<p class="lead">Comptez les jours ouvrés d'une période, ou ajoutez un nombre de
jours ouvrés à une date. Les jours fériés de la zone choisie sont déduits.</p>

<div class="tool" id="tool"></div>

<h2>Jours ouvrés ou jours ouvrables : la distinction qui change tout</h2>
<p>Les <strong>jours ouvrés</strong> vont du lundi au vendredi, jours fériés
déduits. C'est la notion utilisée dans la plupart des contrats commerciaux et
des délais de livraison.</p>
<p>Les <strong>jours ouvrables</strong> vont du lundi au samedi, jours fériés
déduits. C'est la notion du code du travail pour les congés payés : cinq
semaines de congés font 30 jours ouvrables et non 25.</p>
<p>Confondre les deux sur un délai de 30 jours crée un écart d'environ une
semaine. Vérifiez toujours laquelle de ces deux notions votre contrat ou votre
convention collective emploie.</p>

<h2>Un exemple qui surprend</h2>
<p>Du lundi 11 au vendredi 15 mai 2026, il y a cinq jours de calendrier mais
seulement quatre jours ouvrés : le jeudi 14 mai est l'Ascension.</p>
`,
  },
  {
    path: "/delai",
    slug: "delai",
    title: "Calculer l'échéance d'un délai avec report au jour ouvrable",
    description:
      "Calculer la date d'échéance d'un délai en jours ou en mois, avec report au premier jour ouvrable suivant selon l'article 642 du code de procédure civile.",
    engine: "holidays",
    body: `
<h1>Échéance d'un délai</h1>
<p class="lead">Donnez une date de départ et un délai. L'outil applique les
règles de report du code de procédure civile.</p>

<div class="tool" id="tool"></div>

<h2>Article 642 : le report au premier jour ouvrable</h2>
<p>Un délai qui expirerait normalement un samedi, un dimanche, un jour férié
ou un jour chômé est prorogé jusqu'au premier jour ouvrable suivant. C'est la
règle la plus souvent oubliée dans les calculs automatisés.</p>
<p>Exemple : un délai d'un jour à partir du 7 mai 2026 mène au 8 mai, qui est
férié. L'échéance réelle est le lundi 11 mai 2026.</p>

<h2>Article 641 : les délais exprimés en mois</h2>
<p>Un délai en mois expire le jour du dernier mois qui porte le même chiffre
que le jour de départ. Quand ce chiffre n'existe pas dans le mois d'arrivée,
le délai expire le dernier jour de ce mois.</p>
<p>Exemple : un mois à partir du 31 janvier 2026 échoit le 28 février 2026.</p>

<h2>Les fermetures de votre entreprise</h2>
<p>Une fermeture annuelle retire un jour ouvré, mais ne rallonge pas un délai
compté en jours calendaires. Elle ne joue que sur le report de l'échéance.</p>
`,
  },
  {
    path: "/jours-feries",
    slug: "jours-feries",
    title: "Jours fériés en France, métropole et outre-mer",
    description:
      "Liste des jours fériés légaux français pour n'importe quelle année de 1982 à 2100. France métropolitaine, Alsace-Moselle et les sept collectivités d'outre-mer.",
    engine: "holidays",
    body: `
<h1>Jours fériés français</h1>
<p class="lead">Choisissez une année et une zone. Les dates mobiles sont
calculées à partir de Pâques.</p>

<div class="tool" id="tool"></div>

<h2>Onze jours en métropole, treize en Alsace-Moselle</h2>
<p>L'Alsace-Moselle conserve deux jours fériés supplémentaires hérités du droit
local : le Vendredi saint et le 26 décembre, jour de la Saint Étienne.</p>

<h2>Outre-mer : la date d'abolition de l'esclavage</h2>
<p>Chaque collectivité commémore l'abolition de l'esclavage à sa propre date :
le 27 avril à Mayotte, le 22 mai en Martinique, le 27 mai en Guadeloupe, le
28 mai à Saint-Martin, le 10 juin en Guyane, le 9 octobre à Saint-Barthélemy
et le 20 décembre à La Réunion.</p>

<h2>Pourquoi nos calculs commencent en 1982</h2>
<p>Le 8 mai n'est férié sans interruption que depuis la loi du 2 octobre 1981.
Avant 1982, un calcul automatique donnerait un résultat faux : nous préférons
refuser de répondre.</p>
`,
  },
  {
    path: "/iban",
    slug: "iban",
    title: "Vérifier un IBAN en ligne",
    description:
      "Vérifier la validité d'un IBAN par sa clé de contrôle et sa longueur, pour les 37 pays de la zone SEPA. Calcul local, aucune donnée transmise.",
    engine: "identifiers",
    body: `
<h1>Vérifier un IBAN</h1>
<p class="lead">Le contrôle se fait dans votre navigateur. Votre IBAN ne
quitte pas votre poste et n'est enregistré nulle part.</p>

<div class="tool" id="tool"></div>

<h2>Ce que cette vérification prouve, et ce qu'elle ne prouve pas</h2>
<p>Elle prouve que l'IBAN est <strong>formellement correct</strong> : bonne
longueur pour son pays, et clé de contrôle cohérente. Une faute de frappe est
détectée dans la quasi-totalité des cas.</p>
<p>Elle ne prouve pas que le compte <strong>existe</strong>, ni qu'il
appartient à la personne annoncée. Aucun calcul ne peut établir cela : seule
une vérification auprès de la banque le peut.</p>

<h2>Comment fonctionne la clé de contrôle</h2>
<p>On déplace les quatre premiers caractères à la fin, on remplace chaque
lettre par un nombre à deux chiffres, puis on vérifie que le nombre obtenu
donne 1 comme reste dans une division par 97. C'est la norme ISO 13616.</p>
`,
  },
  {
    path: "/siret",
    slug: "siret",
    title: "Vérifier un SIREN, un SIRET et calculer un numéro de TVA",
    description:
      "Vérifier la clé d'un SIREN ou d'un SIRET, avec l'exception La Poste, et calculer le numéro de TVA intracommunautaire français correspondant.",
    engine: "identifiers",
    body: `
<h1>SIREN, SIRET et TVA intracommunautaire</h1>
<p class="lead">Contrôle de clé et calcul du numéro de TVA français, en local.</p>

<div class="tool" id="tool"></div>

<h2>L'exception La Poste</h2>
<p>Les SIRET sont validés par la clé de Luhn, sauf ceux de La Poste, dont le
SIREN est 356000000. Pour eux, la règle est différente : la somme des quatorze
chiffres doit être un multiple de 5. Une implémentation qui ignore cette
exception rejette tous les établissements de La Poste.</p>

<h2>Le numéro de TVA se déduit du SIREN</h2>
<p>La clé du numéro de TVA intracommunautaire français vaut
(12 + 3 × (SIREN modulo 97)) modulo 97. Le numéro complet s'écrit FR, puis
cette clé sur deux chiffres, puis le SIREN.</p>
<p>Certains numéros anciens portent une clé alphabétique. Elle ne se recalcule
pas, et nous le signalons au lieu de les déclarer faux.</p>
`,
  },
  {
    path: "/rib",
    slug: "rib",
    title: "Calculer ou vérifier une clé RIB",
    description:
      "Calculer la clé d'un relevé d'identité bancaire français à partir du code banque, du code guichet et du numéro de compte, ou vérifier une clé existante.",
    engine: "identifiers",
    body: `
<h1>Clé RIB</h1>
<p class="lead">Laissez la clé vide pour la calculer, remplissez-la pour la
vérifier.</p>

<div class="tool" id="tool"></div>

<h2>La formule</h2>
<p>La clé vaut 97 moins le reste de la division par 97 de
(89 × code banque + 15 × code guichet + 3 × numéro de compte).</p>

<h2>Le piège des lettres</h2>
<p>Un numéro de compte peut contenir des lettres, converties avant le calcul
par une table officielle. Elle n'est pas alphabétique : A vaut 1, mais S vaut
2 et non 19, et Z vaut 9. Supposer A égale 1, B égale 2 et ainsi de suite
jusqu'à Z donne une clé fausse dès qu'une lettre après I apparaît.</p>
`,
  },
];
