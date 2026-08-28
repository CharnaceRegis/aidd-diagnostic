# aidd-diagnostic

CLI qui évalue le niveau AI-Driven Development d'un développeur à partir de son dossier de profil.

Donne un profil, récupère un diagnostic : niveau (White → Gold), explication de ce qui a mené là, et un plan concret pour monter d'un cran.

> Projet construit pour le hackathon [LAIVEL UP](https://github.com/ai-driven-dev/laivel-up) (28–31 août 2026).

## Lancer l'outil

Prérequis : Node.js 22+.

```bash
git clone https://github.com/CharnaceRegis/aidd-diagnostic.git
cd aidd-diagnostic
npm install
npm run build
```

## Usage

```bash
npm start
```

L'outil démarre en **mode heuristique** : aucune clé API requise, aucune dépendance externe. Il score les profils à partir des métriques mesurables (activité git, repo-context, analyse statique).

### Menu

```
  Mode : heuristique (sans LLM)

  1. Évaluer un profil ou un dossier
  2. Configurer un LLM (mode enrichi)
  3. Quitter
```

L'option 1 demande un chemin vers un dossier de profil (ex : `profiles/perceval`) ou un dossier parent contenant plusieurs profils (ex : `profiles/`).

### Mode enrichi (optionnel)

L'option 2 permet de configurer une clé API Claude ou OpenAI. En mode LLM, l'outil interprète aussi les pièces textuelles (déclaratif, sessions de travail) et génère des explications en langage naturel.

On peut aussi passer la clé en variable d'environnement :

```bash
export ANTHROPIC_API_KEY="sk-ant-..."
# ou
export OPENAI_API_KEY="sk-..."
```

Si une clé est détectée au démarrage, l'outil passe automatiquement en mode LLM.

## Format des profils

Chaque profil est un **dossier** contenant jusqu'à 8 pièces :

| Fichier | Contenu |
| --- | --- |
| `profile.json` | Identité, stack, taille d'équipe, liste des pièces disponibles |
| `git-activity.json` | Activité git : taille des PR, parallélisme, CI, usage IA |
| `pull-requests.json` | Détail des pull requests (optionnel) |
| `code/` | Échantillons de code du dépôt |
| `sonar-measures.json` | Analyse statique SonarQube |
| `repo-context/` | Fichiers de contexte IA : CLAUDE.md, agents, skills, rules, hooks |
| `declaratif.md` | Auto-évaluation (ce que la personne dit de sa pratique) |
| `session.md` | Transcript d'une session de travail avec l'IA |

Tous les profils n'ont pas les mêmes fichiers. L'outil s'adapte et signale les données manquantes via un indice de confiance.

## Qu'est-ce qui sort

Pour chaque profil évalué, l'outil affiche :

- **Le niveau AIDD** (White → Gold, 7 niveaux)
- **Le score de chaque axe** (Taille, Harness, Intervention, Parallèle)
- **L'axe limitant** — celui qui empêche de monter
- **Une explication** — pourquoi ce niveau
- **Un plan de progression** — quoi faire concrètement pour passer au niveau suivant

Chaque axe affiche son indice de confiance (`high`, `medium`, `low`) et la justification détaillée.

## Architecture

```
Dossier profil
  │
  ▼
┌─────────┐     ┌──────────┐     ┌──────────┐     ┌───────────┐
│ Parser  │────▶│ Scorer   │────▶│ Engine   │────▶│ Explainer │
│         │     │          │     │ (min)    │     │           │
└─────────┘     └──────────┘     └──────────┘     └───────────┘
                 heuristique      déterministe      templates
                 ou LLM                             ou LLM
```

| Module | Rôle | Mode heuristique | Mode LLM |
| --- | --- | --- | --- |
| **Parser** | Charge le dossier profil, inventorie les pièces | Identique | Identique |
| **Scorer** | Évalue chaque axe (rank 0–6 + justification + confiance) | Règles sur les métriques mesurables | Interprétation du dossier complet par le LLM |
| **Engine** | `min(4 axes)` → niveau global, axe limitant | Identique | Identique |
| **Explainer** | Explication + plan de progression | Templates paramétrés | Génération en langage naturel |

### Pourquoi deux modes

Le mode heuristique couvre 3 axes sur 4 avec une bonne fiabilité (Taille, Harness, Parallèle sont directement mesurables). L'axe Intervention est scoré avec des signaux indirects (corrections après ouverture, PR mergées sans édition) — fonctionnel mais moins fin que l'interprétation LLM d'une session de travail.

Le mode LLM enrichit le diagnostic en lisant les pièces textuelles (déclaratif, session) et en confrontant le déclaratif aux faits.

## Structure du projet

```
aidd-diagnostic/
├── grille.yml                # Référentiel AIDD (7 niveaux, 4 axes, échelles)
├── src/
│   ├── types.ts              # Types partagés (Profil, ProfilPieces, Diagnostic)
│   ├── grille.ts             # Chargement de la grille YAML
│   ├── parser.ts             # Chargement d'un dossier profil multi-pièces
│   ├── heuristic-scorer.ts   # Scoring déterministe par règles
│   ├── heuristic-explainer.ts # Explications et progression par templates
│   ├── scorer.ts             # Scoring par axe via LLM (mode enrichi)
│   ├── explainer.ts          # Explication via LLM (mode enrichi)
│   ├── engine.ts             # Moteur déterministe min(4 axes)
│   ├── config.ts             # Gestion de la config (.env, env vars)
│   ├── setup.ts              # Setup interactif du provider LLM
│   ├── cli.ts                # Point d'entrée CLI interactif
│   ├── llm/                  # Abstraction LLM (Claude, OpenAI)
│   └── prompts/
│       └── score-axis.md     # Template de prompt pour le scoring LLM
├── METHOD.md                 # Méthode en une page
├── package.json
└── tsconfig.json
```

## La méthode en bref

Voir [METHOD.md](./METHOD.md) pour le détail.

## Licence

[MIT](./LICENSE)
