# aidd-diagnostic

CLI qui évalue le niveau AI-Driven Development d'un développeur à partir de son profil.

Donne un profil, récupère un diagnostic : niveau (White → Gold), explication de ce qui a mené là, et un plan concret pour monter d'un cran.

> Projet construit pour le hackathon [LAIVEL UP](https://github.com/ai-driven-dev/laivel-up) (28–31 août 2026).

## Lancer l'outil

Prérequis : Node.js 22+, une clé API Anthropic.

```bash
git clone https://github.com/CharnaceRegis/aidd-diagnostic.git
cd aidd-diagnostic
npm install
```

Exporter la clé API :

```bash
export ANTHROPIC_API_KEY="sk-ant-..."
```

Compiler

```bash
npm run build
```

## Usage

```
aidd-diagnostic --profil <fichier_ou_dossier> [options]
```

| Option | Description |
| --- | --- |
| `-p, --profil` | Chemin vers un profil JSON/YAML ou un dossier de profils |
| `-v, --verbose` | Affiche les scores de confiance et les justifications par axe |
| `--json` | Sortie JSON brute (pour du traitement automatisé) |
| `-h, --help` | Affiche l'aide |

Exemples :

```bash
# Un seul profil
node dist/cli.js --profil profiles/perceval.json

# Tous les profils d'un dossier
node dist/cli.js --profil profiles/

# Sortie JSON avec détails de confiance
node dist/cli.js --profil profiles/ --json --verbose

# Configurer ou changer le provider LLM
node dist/cli.js --setup
```

## Qu'est-ce qui sort

Pour chaque profil, l'outil affiche :

- **Le niveau AIDD** (❖ White → 🥇 Gold)
- **Le score de chaque axe** (Taille, Harness, Intervention, Parallèle)
- **L'axe limitant** — celui qui empêche de monter
- **Une explication** — pourquoi ce niveau, en termes clairs
- **Un plan de progression** — quoi faire concrètement pour passer au niveau suivant

En mode `--verbose`, chaque axe affiche aussi son indice de confiance (`high`, `medium`, `low`) et la justification détaillée du LLM.

## Architecture

```
Profil (JSON/YAML)
  │
  ▼
┌─────────┐     ┌──────────┐     ┌──────────┐     ┌───────────┐
│ Parser  │────▶│ Scorer   │────▶│ Engine   │────▶│ Explainer │
│ (adapt) │     │ (LLM)    │     │ (min)    │     │ (LLM)     │
└─────────┘     └──────────┘     └──────────┘     └───────────┘
```

Quatre modules dans un pipeline :

| Module | Rôle | LLM ? |
| --- | --- | --- |
| **Parser** (`parser.ts`) | Lit le profil JSON/YAML, normalise vers une structure interne. Gère les champs manquants sans crasher. | Non |
| **Scorer** (`scorer.ts`) | Évalue chaque axe via Claude API. Un appel par axe, structured output (`tool_use`) pour fiabiliser la réponse. Retourne rank + justification + confiance. | Oui |
| **Engine** (`engine.ts`) | Applique la règle `min(4 axes)` → niveau global. Identifie l'axe limitant. Purement déterministe. | Non |
| **Explainer** (`explainer.ts`) | Génère l'explication et le plan de progression en langage naturel à partir du diagnostic structuré. | Oui |

La grille de référence AIDD (`grille.yml`) est chargée au démarrage et injectée dans les prompts. C'est la source de vérité pour les niveaux et les seuils.

### Pourquoi hybride LLM + algo

Le scoring par axe demande d'interpréter des données potentiellement textuelles ou ambiguës — un LLM est bon pour ça. Mais la mécanique `min(4 axes)` doit être déterministe et testable, pas laissée à l'appréciation d'un modèle. La séparation permet de tester le moteur indépendamment du LLM.

## Structure du projet

```
aidd-diagnostic/
├── grille.yml              # Référentiel AIDD (7 niveaux, 4 axes, échelles)
├── fixtures/               # Profils de test
│   └── profil-exemple.json
├── src/
│   ├── types.ts            # Types partagés
│   ├── grille.ts           # Chargement et validation de la grille YAML
│   ├── parser.ts           # Adaptateur de profils JSON/YAML
│   ├── scorer.ts           # Scoring par axe via Claude API
│   ├── engine.ts           # Moteur déterministe min(4 axes)
│   ├── explainer.ts        # Génération d'explication et progression
│   ├── cli.ts              # Point d'entrée CLI
│   └── prompts/
│       └── score-axis.md   # Template de prompt pour le scoring
├── METHOD.md               # Méthode en une page
├── package.json
└── tsconfig.json
```

## La méthode en bref

Jette un œil à [METHOD.md](./METHOD.md) pour le détail. En résumé :

Le référentiel AIDD définit 4 axes d'adoption de l'IA (Taille, Harness, Intervention, Parallèle) et 7 niveaux. Le niveau global d'un dev est le **minimum de ses 4 axes** — un seul axe faible tire tout le niveau vers le bas.

L'outil demande à Claude d'évaluer chaque axe indépendamment à partir du profil, puis applique la règle du minimum de façon déterministe. Quand les données manquent, le score est attribué avec une confiance `low` plutôt qu'inventé.

## Licence

[MIT](./LICENSE)
