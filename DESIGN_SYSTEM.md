# 🎨 EYES-ONWORK — SYSTÈME DE DESIGN OFFICIEL (STRICT & UNIFIÉ)
**Espace Freelance Créatif pour Graphistes & Studios Indépendants**

Ce document est la référence absolue pour l'interface UI/UX de l'application **eyes-onwork**. Chaque écran, modal, composant ou future fonctionnalité doit obligatoirement respecter ces règles sans aucune déviation.

L'application intègre deux univers cohérents basés sur les maquettes de référence :
1. **Mode Sombre (Aurelia / Nebula)** : Univers violet nuit profond immersif pour le travail concentré.
2. **Mode Clair (Lumina)** : Univers ivoire / crème doux chaleureux pour une lisibilité lumineuse sans éblouissement.

---

## 1. Palettes de Couleurs Strictes (Invariable)

### A. Mode Sombre (Aurelia / Nebula)
| Token | Valeur HEX / RGBA | Rôle & Utilisation |
| :--- | :---: | :--- |
| **Arrière-plan principal (Background)** | `#0f0326` | Violet nuit profond (*deep midnight violet*). |
| **Surfaces / Cartes (Surface & Cards)** | `#1a0a3a` | Cartes principales, conteneurs, modales (`rounded-2xl`). |
| **Surfaces surélevées (Elevated Surface)** | `#25124d` | États hover, menus déroulants (dropdowns), lignes survolées. |
| **Surfaces de saisie (Inputs & Forms)** | `#160830` | Champs de texte, listes déroulantes, textarea. |
| **Texte principal (Primary Text)** | `#eeebd3` | Crème doux (*soft cream*) haute lisibilité pour titres et valeurs clés. |
| **Texte secondaire & labels** | `#8a7968` | Taupe chaud (*warm taupe*) pour sous-titres, étiquettes, descriptions. |
| **Accent doré exclusif (Golden Accent)** | `#f7c548` | **Réservé exclusivement** : boutons primaires, jauges de progression, états actifs, graphiques clés. |
| **Bordures par défaut (Borders)** | `rgba(138, 121, 104, 0.25)` | Lignes de séparation, contours de cartes et d'inputs. |
| **Bordures subtiles de cartes** | `rgba(138, 121, 104, 0.16)` | Délimitation douce des cartes. |

### B. Mode Clair (Lumina)
| Token | Valeur HEX / RGBA | Rôle & Utilisation |
| :--- | :---: | :--- |
| **Arrière-plan principal (Background)** | `#faf7f0` | Ivoire chaud / crème doux doux (*warm ivory/cream*). |
| **Surfaces / Cartes (Surface & Cards)** | `#ffffff` | Cartes blanches épurées avec bordure chaude légère (`rounded-2xl`). |
| **Surfaces surélevées (Elevated Surface)** | `#f5ede0` | Menus déroulants, modales popover, états hover. |
| **Surfaces de saisie (Inputs & Forms)** | `#ffffff` / `#f6f1e7` | Champs de texte, listes déroulantes. |
| **Texte principal (Primary Text)** | `#1d1335` | Prune profond / indigo sombre très lisible et contrasté. |
| **Texte secondaire & labels** | `#7a6c62` | Taupe chaud doux pour sous-titres et indications. |
| **Accent doré exclusif (Golden Accent)** | `#f7c548` | Boutons primaires (`#f7c548` avec texte sombre `#0f0326`), barres de progression. |
| **Bordures par défaut (Borders)** | `rgba(138, 121, 104, 0.24)` | Lignes de séparation et délimitations de sections. |
| **Bordures subtiles de cartes** | `rgba(138, 121, 104, 0.15)` | Délimitations fines des cartes blanches. |

---

## 2. Système Typographique

- **Famille de police** : **Switzer** (`Switzer Variable`).
- **Titres (H1, H2, Titres de page)** : Switzer SemiBold / Bold (600–700) avec léger resserrement de l'interlettrage (`letter-spacing: -0.02em`).
- **Titres de cartes & Chiffres importants** : Switzer Medium / SemiBold avec chiffres tabulaires (`tabular-nums font-display`).
- **Corps de texte (Body)** : Switzer Regular (400).
- **Labels & Légendes** : Switzer Regular (400) en taupe secondaire.
- **Boutons & Contrôles** : Switzer Medium (500).

---

## 3. Spécifications Précises des Composants

### 1. Boutons (Buttons)
- **Bouton Primaire** : Fond `#f7c548`, texte `#0f0326`, `rounded-xl`, police Switzer Medium (500), padding `py-2.5 px-4`.
- **Bouton Secondaire** : Fond transparent ou surface carte, bordure `1px solid rgba(138, 121, 104, 0.3)`, texte de la couleur primaire du thème, survol `var(--card-surface-elevated)`.
- **Bouton Ghost** : Sans bordure, texte taupe secondaire, survol couleur primaire.
- **Boutons d'icône** : Carrés ou légèrement arrondis (`rounded-xl`), format `36px` ou `40px`.

### 2. Cartes (Cards)
- Fond `var(--card-surface)`, bordure `1px solid var(--border-card)`.
- Rayon : `rounded-2xl` (16px).
- Ombre douce : `var(--shadow-card)`.
- Espacement intérieur constant : `p-5` à `p-6` (20px à 24px).

### 3. Champs & Formulaires (Inputs & Forms)
- Fond `var(--input-bg)`, bordure `1px solid var(--input-border)`, `rounded-xl`.
- Focus : bordure `#f7c548` avec lueur dorée subtile (`shadow-[0_0_0_2px_rgba(247,197,72,0.2)]`).
- Placeholder : texte taupe secondaire.
- Label au-dessus en texte secondaire.

### 4. Menus déroulants (Dropdowns, CustomSelect & Select natifs)
- Même style que les inputs pour le déclencheur (`rounded-xl`, min-height 44px).
- Menu contextuel :
  - En mode sombre : fond `#25124d`, bordure `rgba(138, 121, 104, 0.25)`, ombre profonde.
  - En mode clair : fond `#ffffff`, bordure `rgba(138, 121, 104, 0.20)`, ombre douce.
- Option survol : léger fond doré (`hover:bg-[#f7c548]/10` ou `hover:bg-[#fef4db]`).
- Option sélectionnée : fond doré doux (`bg-[#f7c548]/20`), texte doré et icône Check dorée.
- Tiroir mobile bottom-sheet : glissement fluide du bas de l'écran avec poignée de glissement et zone de recherche intégrée.

### 5. Badges & Tags
- Forme arrondie (`rounded-full`).
- Fond doux avec transparence ou dorure légère.
- Exemples : Actif, En cours, En retard, Payé, Brouillon.

### 6. Barres de progression (Progress Bars)
- Track : surface sombre ou crème selon le thème (`h-2 rounded-full`).
- Remplissage (Fill) : `#f7c548` (doré vif).
- Hauteur stricte : 6-8px (`h-2`).

### 7. Barre latérale & Header
- **Sidebar Desktop** :
  - Fond `var(--sidebar-bg)`, largeur fixe 288px (w-72).
  - Onglet actif : fond `var(--card-surface)` avec bordure gauche dorée `#f7c548` de 2px et icône dorée.
  - Carte "Passer à Pro" intégrée.
  - Switch interactif "Mode Sombre / Mode Clair" avec icône Lune/Soleil en bas de sidebar.
- **Header Top** :
  - Titre fil d'Ariane, barre de recherche centrale, boutons d'action rapide.
  - Bouton rapide d'alternance Sombre / Clair (Lune/Soleil) accessible à tout moment.

---

## 4. Architecture de la Vue Tableau de Bord (Dashboard)

1. **En-tête de bienvenue** : Salutation dynamique ("Bonjour, [Prénom] 👋"), sous-titre contextualisé, sélecteur de période ("Ce mois", "Ce trimestre"), bouton d'action principal "+ Nouveau projet" doré.
2. **4 Cartes KPI alignées** :
   - Total Projets (icône dossier dorée, indicateur de hausse).
   - Tâches complétées (icône check dorée, décompte précis).
   - Clients actifs (icône équipe dorée).
   - CA Encaissé / Heures suivies (icône tendance dorée, montant formaté).
3. **Zone médiane (2/3 + 1/3)** :
   - *Gauche* : "Aperçu de progression des projets" avec barres verticales dorées `#f7c548` interactives.
   - *Droite* : "Progression globale" avec jauge circulaire en anneau (Donut SVG) et répartition en 3 catégories (Complétés, En production, Non démarrés).
4. **Zone inférieure** : "Projets actifs" présentant 3 à 4 cartes de projets avec barre de progression dorée, badges d'état, avatars et échéances.

---

## 5. Règle Bilingue (FR / EN)
- Français par défaut pour tous les pays et utilisateurs francophones.
- Anglais pour les utilisateurs non-francophones.
- Format monétaire standard avec séparateur d'espace et symbole monétaire paramétrable.
