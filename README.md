# Générateur de devis pliage / profilage

Application web simple pour transformer un fichier client CSV/XLSX en tableau de chiffrage interne, puis générer une vue devis client propre et imprimable.

## Objectif

Cet outil ne cherche pas à recréer Excel. Il sert à remplacer un travail répétitif de chiffrage commercial :

1. importer un fichier client,
2. mapper les colonnes du client vers des champs internes,
3. compléter les données métier,
4. calculer les coûts et prix,
5. générer un devis client propre.

## Fichiers du projet

- `index.html` : structure de l'application.
- `style.css` : mise en page, tableau et devis imprimable.
- `app.js` : logique principale de l'interface.
- `import.js` : import CSV/XLSX/XLSB via SheetJS et mapping des colonnes.
- `chiffrage.js` : formules de chiffrage pures et persistance des paramètres.
- `chiffrage.test.js` : tests unitaires Node sur les formules.
- `calculations.js` : schéma des champs ligne et orchestration des calculs.
- `export.js` : export CSV, sauvegarde locale et rendu du devis client.
- `README.md` : documentation.
- `assets/images/` : logos et visuels personnalisés (ex. `logo.png`).


## Ajouter ton logo

1. Place ton logo dans `assets/images/` avec le nom `logo.png`.
2. Recharge la page dans le navigateur.
3. Le logo s’affiche automatiquement dans l’en-tête.

## Lancer l'application

### Méthode simple

Ouvre simplement `index.html` dans ton navigateur.

### Méthode conseillée avec un petit serveur local

Dans le dossier du projet, lance :

```bash
python -m http.server 8000
```

Puis ouvre :

```text
http://localhost:8000
```

## Importer un fichier client

Dans l'onglet **Import** :

1. glisse un fichier CSV/XLSX dans la zone d'import,
2. vérifie l'aperçu,
3. vérifie le mapping automatique,
4. corrige les champs si besoin,
5. clique sur **Appliquer le mapping**.

L'application accepte aussi les fichiers `.xlsb` via SheetJS, mais pour une meilleure fiabilité il vaut mieux demander ou générer un export `.csv` ou `.xlsx`.

## Champs internes disponibles

Le mapping peut alimenter :

- Référence pièce
- Désignation
- Quantité
- Matière (code, ex. `AC15`)
- Épaisseur
- Finition
- RAL / couleur
- Longueur
- Développé
- Nombre de plis
- Surface unitaire (sinon recalculée à partir de longueur × développé)
- Commentaire client

Après mapping, le tableau de chiffrage affiche en plus :

- Temps / pli (s) — saisie manuelle si non importée
- Surface unitaire et totale (calculées)
- MAT, MO, PL, PR, PV unit, PV total (calculés)
- Soudure € (saisie manuelle, défaut 0)
- Commentaire interne

## Modifier les paramètres de chiffrage

Va dans l'onglet **Paramètres**. Deux sections :

### 1. Matières (prix au m²)

Table éditable. Chaque ligne associe un **code matière** (ex. `GA20/10`,
`AC15`, `AC10`) à un **prix €/m²**. Tu peux ajouter, modifier ou supprimer
des lignes. Le code matière sert de clé de jointure avec la colonne
`Matière` du fichier importé.

Si une ligne du chiffrage référence un code absent de cette table, elle est
**surlignée en rouge** et un avertissement s’affiche au-dessus du tableau ;
le coût matière est alors calculé à 0 € tant que la matière n’est pas
ajoutée.

### 2. Coefficients globaux

| Variable | Défaut | Rôle |
|---|---|---|
| Taux de chute (`coeffChute`) | 0,9 | Diviseur appliqué au coût matière |
| Coeff transport (`coeffTransport`) | 0,88 | Diviseur appliqué pour passer du coût total au prix de revient |
| Marge finale (`coeffMarge`) | 0,7 | Diviseur appliqué pour passer du PR au PV unitaire |
| Prix MO €/sec (`prixMoSec`) | 0,017 | Coût main-d'œuvre à la seconde |
| Prix pliage €/m² (`prixPliageM2`) | 15,00 | Coût pliage par m² de surface unitaire |

Les paramètres sont persistés dans `localStorage` sous la clé
`devis-params-v1`.

## Formules de chiffrage

Les formules vivent dans `chiffrage.js` (fonction pure
`computeChiffrage(row, params)`). Elles sont couvertes par les tests
unitaires `chiffrage.test.js`.

```
Surface_unit  = (Longueur × Développé) / 1 000 000        // mm² → m²
Surface_tot   = Surface_unit × Quantité

MAT           = Surface_unit × Prix_matière / coeffChute
PL            = Surface_unit × prixPliageM2
MO            = nb_plis × temps_par_pli_sec × prixMoSec   // 0 si données absentes
SOUDURE       = saisie manuelle (€, défaut 0)

PR            = (MAT + MO + SOUDURE + PL) / coeffTransport
PV_unit       = PR / coeffMarge
PV_tot        = PV_unit × Quantité
```

### Vérification (Excel de référence)

Ligne AC15, longueur 1581 mm, développé 245 mm, 4 plis × 55 s :

| Champ | Valeur |
|---|---|
| Surface unit. | 0,387345 m² |
| MAT | 5,810 € |
| PL | 5,810 € |
| MO | 3,740 € |
| PR | 17,455 € |
| PV unit. | 24,94 € |

Cette vérification est codée dans `chiffrage.test.js`.

### Lancer les tests

```bash
node chiffrage.test.js
```

## Générer le devis client

Va dans l'onglet **Devis client**.

La vue client affiche uniquement :

- Référence
- Désignation
- Quantité
- Matière / finition
- Prix unitaire HT
- Total HT

Les coûts internes, coefficients et commentaires internes ne sont pas affichés.

Clique sur **Imprimer / PDF** pour générer un PDF via l'impression du navigateur.

## Sauvegarde locale

Le bouton **Sauvegarder localement** enregistre le projet dans le navigateur avec `localStorage`.

Le bouton **Recharger** récupère la dernière sauvegarde locale.

Important : cette sauvegarde reste liée au navigateur et à l'ordinateur utilisé. Ce n'est pas une sauvegarde serveur.

## Limites connues de la version 1

- Pas de backend.
- Pas de comptes utilisateurs.
- Pas de vraie base clients.
- Pas de génération PDF serveur.
- Pas d'import Excel ultra-complexe avec cellules fusionnées et mises en page spécifiques.
- Les fichiers `.xlsb` peuvent fonctionner, mais le CSV/XLSX reste préférable.
- Le mapping automatique est volontairement simple et peut nécessiter une correction manuelle.

## Améliorations possibles version 2

- Base de prix matière par épaisseur et nuance.
- Gestion des chutes matière.
- Remises par chantier ou client.
- Bibliothèque clients.
- Numérotation automatique des devis.
- Export PDF plus professionnel avec logo réel.
- Import XLSB plus robuste.
- Reconnaissance de formats clients récurrents.
- Historique des devis.
- Export vers un fichier Excel final.
- Ajout de plans ou miniatures associées aux lignes.
