# Worth The Bag - Comparateur NBA

Un site web one-page pour analyser si un joueur NBA vaut son salaire.

## Installation et Lancement

### Prérequis
- MAMP installé et en cours d'exécution
- Les fichiers du projet dans `/Applications/MAMP/htdocs/site_wtb/`

### Démarrage
1. Ouvrez MAMP et démarrez les serveurs Apache et MySQL
2. Accédez à `http://localhost/site_wtb/` dans votre navigateur
3. Le site charge automatiquement le fichier CSV et affiche le premier joueur

## Structure du Projet

```
site_wtb/
├── index.html              # Page principale
├── css/
│   └── style.css          # Styles complets
├── js/
│   └── app.js             # Logique JavaScript
├── data/
│   └── players.csv        # Données des joueurs
├── asset/
│   ├── logo/              # Logos du site
│   ├── icons/             # Icônes SVG
│   └── ...
├── photo_joueurs/         # Photos des joueurs
└── README.md              # Ce fichier
```

## Fonctionnalités

### 1. Navigation Latérale (Sidebar)
- Barre de navigation fixed avec 4 sections
- Icônes pour naviguer entre les sections
- Indicateur d'état actif

### 2. Section 1 - Accueil
- Logo et texte explicatif
- Bouton CTA pour commencer

### 3. Section 2 - Sélection du Joueur
- Avatar cliquable du joueur sélectionné
- Sélecteur modal pour choisir un autre joueur
- Diagramme radar avec 6 stats clés
- Cartes de contexte (équipe, matchs, salaire)

### 4. Section 3 - Pourcentages au Tir
- Affichage de 6 pourcentages de tir
- Barres de progression visuelles
- Demi-terrain interactif avec zones d'attaque

### 5. Section 4 - Verdict Final
- Évaluation du rapport qualité/prix
- Pastille de couleur (rouge/jaune/vert)
- Value Index calculé automatiquement

## Données CSV

Le fichier `data/players.csv` doit contenir :
- **Format** : Séparateur virgule (,)
- **Colonnes** : Player, Age, Position, Team, Games_Played, Games_Started, Minutes_Played, PTS_per_game, AST_per_game, REB_per_game, STL_per_game, BLK_per_game, TOV_per_game, FGA_per_game, FG_Pct, TwoPA_per_game, TwoP_per_game, TwoP_Pct, ThreePA_per_game, ThreeP_per_game, ThreeP_Pct, FTA_per_game, FT_per_game, FT_Pct, eFG_Pct, AST_TOV_ratio, PER, TS_Pct, BPM, OBPM, DBPM, WS, Salary

### Notes sur les données
- Les décimales utilisent la virgule (ex: "32,2")
- Les pourcentages incluent le symbole % (ex: "57%")
- Le salaire est en millions avec le suffixe "millions" (ex: "55 761 216 millions")
- L'app normalise automatiquement ces formats

## Calcul du Verdict

### Performance Score
```
performanceScore = (PTS×2) + (REB×1.2) + (AST×1.5) + (BPM×2) + (WS×1.5) + (PER×1)
```

### Value Index
```
valueIndex = performanceScore / salaryMillions
```

### Classification
- **Vert** (≥2.2) : Sous-payé, excellente affaire
- **Jaune** (1.0-2.2) : Correct à légèrement surpayé
- **Rouge** (<1.0) : Clairement surpayé

## Technologie

- **HTML5** : Structure sémantique
- **CSS3** : Design moderne et responsive
- **JavaScript Vanilla** : Pas de framework
- **Chart.js** : Pour les diagrammes radar (CDN)
- **Google Fonts** : Inter Tight

## Responsive

Le site s'adapte à tous les écrans :
- Desktop (full layout)
- Tablet (grille adaptée)
- Mobile (sidebar compacte, layout optimisé)

## Troubleshooting

### "Erreur chargement CSV"
- Vérifier que MAMP est actif (fetch nécessite un serveur)
- Vérifier le chemin du fichier `data/players.csv`
- Ouvrir la console du navigateur pour plus de détails

### Photos manquantes
- L'app affiche automatiquement un placeholder SVG
- Les fichiers PNG doivent être dans `photo_joueurs/`

### Radar chart ne s'affiche pas
- Vérifier que Chart.js est chargé (CDN accessible)
- Vérifier la console pour les erreurs JavaScript

## Auteur

Projet étudiant BUT MMI 2e année - Worth The Bag © 2025
