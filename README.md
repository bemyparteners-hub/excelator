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
- `calculations.js` : formules de calcul métier.
- `export.js` : export CSV, sauvegarde locale et rendu du devis client.
- `README.md` : documentation.

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
- Matière
- Épaisseur
- Finition
- RAL / couleur
- Longueur
- Développé
- Surface unitaire
- Poids unitaire
- Commentaire client

Après mapping, le tableau de chiffrage ajoute les colonnes métier :

- Nombre de plis
- Poinçonnage
- Soudure
- Post-laquage
- Pré-laquage
- Coût matière
- Coût laquage
- Coût main-d'œuvre
- Coefficient marge
- Prix unitaire HT
- Total HT
- Commentaire interne

## Modifier les paramètres de prix

Va dans l'onglet **Paramètres**.

Tu peux modifier :

- Prix acier au kg
- Prix aluminium au kg
- Prix inox au kg
- Prix post-laquage au m²
- Prix pré-laquage au m²
- Coût par pli
- Coût poinçonnage
- Coût soudure
- Forfait main-d'œuvre
- Coefficient marge par défaut
- TVA
- Densités matière

Les lignes sont recalculées automatiquement.

## Modifier les formules de calcul

Les formules sont dans le fichier :

```text
calculations.js
```

Fonction principale :

```js
calculateRow(inputRow, settings)
```

Formules actuelles :

- Surface unitaire = Longueur x Développé / 1 000 000
- Surface totale = Surface unitaire x Quantité
- Poids estimé = Surface unitaire x épaisseur x densité
- Coût matière = Poids total x prix matière au kg
- Coût laquage = Surface totale x prix laquage au m²
- Coût main-d'œuvre = forfait + plis + options
- Prix total HT = coût total x coefficient marge
- Prix unitaire HT = total HT / quantité

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
