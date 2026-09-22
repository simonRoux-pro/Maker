# identifiants-france

Validation d'IBAN, de clé RIB, de SIREN, de SIRET et de numéro de TVA
intracommunautaire. Zéro dépendance, calcul pur, aucune donnée transmise.

```bash
npm install identifiants-france
```

## Exemples

```js
import {
  checkIban, ribKey, checkSiren, checkSiret, checkVat, vatFromSiren,
} from "identifiants-france";

checkIban("FR14 2004 1010 0505 0001 3M02 606").valid;   // true
ribKey("20041", "01005", "0500013M026").key;            // "06"
checkSiren("732829320").valid;                          // true
vatFromSiren("732829320").vat_number;                   // "FR44732829320"

// La Poste ne suit pas la clé de Luhn
checkSiret("35600000009075");
// { valid: true, rule: "la_poste", siren: "356000000", nic: "09075" }
```

## Les pièges que cette bibliothèque gère

**L'exception La Poste.** Les SIRET dont le SIREN est 356000000 échouent à la
clé de Luhn. Leur règle est différente : la somme des quatorze chiffres doit
être un multiple de 5. Une implémentation naïve rejette tous les
établissements de La Poste.

**La table des lettres du RIB.** Elle n'est pas alphabétique. A vaut 1, mais S
vaut 2 et non 19, et Z vaut 9. Supposer A égale 1 jusqu'à Z égale 26 donne une
clé fausse dès qu'une lettre après I apparaît dans le numéro de compte.

**Les pays inconnus sont refusés.** Un IBAN dont le code pays n'est pas dans la
table des longueurs SEPA est déclaré invalide avec un motif explicite, au lieu
d'être accepté par défaut.

**Le niveau de vérification est toujours annoncé.** Le champ `checked` vaut
`"checksum"` quand la clé a été recalculée, ce qui n'est le cas que pour la
France en matière de TVA, et `"format"` quand seule la forme a été contrôlée
pour les 26 autres États membres. Aucune ambiguïté n'est laissée à l'appelant.

**Les anciennes clés de TVA alphabétiques** ne se recalculent pas. La
bibliothèque le signale au lieu de les déclarer fausses.

## Ce que cette bibliothèque ne fait pas

Elle ne dit jamais qu'une entreprise ou qu'un compte bancaire **existe**. Elle
vérifie qu'un identifiant est formellement correct, par calcul de clé. Pour
l'existence, seule une consultation officielle fait foi.

## Fonctions

| Fonction | Rôle |
| --- | --- |
| `checkIban(iban)` | clé mod 97 et longueur, 37 pays SEPA |
| `ribKey(bank, branch, account)` | calcule la clé RIB |
| `checkRib(bank, branch, account, key)` | vérifie une clé existante |
| `checkSiren(siren)` | clé de Luhn sur 9 chiffres |
| `checkSiret(siret)` | clé de Luhn sur 14 chiffres, exception La Poste |
| `checkVat(vat)` | TVA intracommunautaire, 27 États membres |
| `vatFromSiren(siren)` | calcule le numéro de TVA français |

## Version hébergée

Les mêmes calculs existent en API pour les stacks non JavaScript et les outils
sans code.

## Licence

MIT.
