# Outil de diagnostic AIDD — LAIVEL UP

- **Date** : 2026-08-24
- **Statut** : pending

## Objectif

Construire un CLI qui prend un profil de développeur, évalue son niveau
AI-Driven Development sur 4 axes (Taille, Harness, Intervention, Parallèle),
attribue le niveau global (min des 4), explique le raisonnement et propose
un plan de progression.

## Surface d'édition

Projet from scratch — nouveau dépôt. Structure cible :

| Fichier / dossier | Rôle |
|---|---|
| `src/grille.ts` | Modèle de données : niveaux, axes, seuils |
| `src/parser.ts` | Adaptateur de profils (JSON/YAML → structure normalisée) |
| `src/scorer.ts` | Évaluation par axe via LLM → scores structurés |
| `src/engine.ts` | Moteur déterministe : min(4 axes) → niveau global |
| `src/explainer.ts` | Génération d'explication et de recommandations via LLM |
| `src/cli.ts` | Point d'entrée CLI |
| `src/types.ts` | Types partagés |
| `src/prompts/` | Templates de prompts pour le LLM |
| `grille.yml` | Copie structurée du référentiel AIDD (source de vérité) |
| `README.md` | Lancement, méthode, architecture |
| `METHOD.md` | Méthode en une page (livrable hackathon) |

## Hors-scope

- Interface graphique (le README du hackathon dit qu'un CLI bien fait suffit)
- Base de données / persistance
- Authentification / multi-utilisateur
- Entraînement d'un modèle custom — on utilise un LLM existant via API
- Analyse de dépôts Git réels (on travaille sur des profils fournis)

## Architecture

```
Profil (JSON/YAML)
  │
  ▼
┌─────────┐     ┌──────────┐     ┌──────────┐     ┌───────────┐
│ Parser  │────▶│ Scorer   │────▶│ Engine   │────▶│ Explainer │
│ (adapt) │     │ (LLM)    │     │ (min)    │     │ (LLM)     │
└─────────┘     └──────────┘     └──────────┘     └───────────┘
                     │                │                  │
                     ▼                ▼                  ▼
              Score par axe     Niveau global    Explication +
              + confiance       + axe limitant   progression
```

**Séparation LLM / algo :**
- **LLM** : interpréter les données brutes du profil → scores par axe,
  générer les explications en langage naturel, proposer le plan de
  progression.
- **Algo** : appliquer `min(4 axes)`, valider les scores contre la grille,
  structurer la sortie.

## Phases

### Phase 1 : Fondations — modèle de données + moteur déterministe

**Fichiers** : `src/types.ts`, `src/grille.ts`, `src/engine.ts`, `grille.yml`

**Quoi** :
- Définir les types : `Profil`, `AxeScore`, `Niveau`, `Diagnostic`
- Encoder la grille AIDD en données structurées (YAML parsé au runtime)
- Implémenter le moteur `min(4 axes)` → niveau global
- Identifier l'axe limitant (celui qui tire le niveau vers le bas)

**Acceptance criteria** :
- [ ] `engine.evaluate([{axe: 'taille', rank: 3}, {axe: 'harness', rank: 5}, ...])` retourne le bon niveau
- [ ] L'axe limitant est correctement identifié
- [ ] La grille YAML est parsée et validée au démarrage

**Done quand** : tests unitaires verts sur le moteur.

### Phase 2 : Parser adaptatif

**Fichiers** : `src/parser.ts`, `src/types.ts`

**Quoi** :
- Parser JSON et YAML en entrée
- Normaliser vers la structure `Profil` interne
- Gérer les champs manquants (profil incomplet → champs `null`, pas crash)
- Détection automatique du format

Le format exact des profils est inconnu. Le parser doit être un adaptateur
léger qu'on ajuste le 28 en 30 minutes max une fois le format révélé.

**Stratégie** : parser permissif qui extrait ce qu'il trouve, marque ce
qu'il ne trouve pas comme `null`, et laisse le scorer décider quoi en faire.

**Acceptance criteria** :
- [ ] JSON et YAML supportés
- [ ] Un profil avec des champs manquants ne crashe pas
- [ ] Les champs inconnus sont ignorés sans erreur

**Done quand** : parser testé sur au moins 3 fixtures (complet, partiel, format inconnu).

### Phase 3 : Scorer LLM — évaluation par axe

**Fichiers** : `src/scorer.ts`, `src/prompts/score-axis.md`

**Quoi** :
- Pour chaque axe, envoyer le profil + la définition de l'axe au LLM
- Le LLM retourne un score (rank 0-6) + une justification + un indice
  de confiance (high/medium/low)
- Utiliser le structured output (tool_use / JSON mode) pour fiabiliser
  le parsing de la réponse
- Gestion de l'incertitude : si le profil manque de données sur un axe,
  le LLM doit retourner `confiance: low` plutôt qu'inventer

**Prompt engineering** :
- Le prompt contient la grille complète pour l'axe concerné
- Few-shot avec 2-3 exemples de profils annotés
- Instruction explicite : "Si les données sont insuffisantes, retourne
  confiance: low et explique ce qui manque"

**Acceptance criteria** :
- [ ] Chaque axe reçoit un score 0-6, une justification et une confiance
- [ ] Un profil vide retourne 4× confiance low, pas un crash
- [ ] La réponse LLM est parsée en structure typée (pas de string brut)

**Done quand** : scoring testé sur les profils exemples fournis par le hackathon
(ou nos fixtures en attendant le 28).

### Phase 4 : Explainer — explication + progression

**Fichiers** : `src/explainer.ts`, `src/prompts/explain.md`, `src/prompts/progression.md`

**Quoi** :
- Prendre le diagnostic (scores par axe + niveau global + axe limitant)
- Générer une explication structurée : "Tu es Blue parce que..."
- Identifier l'axe limitant et générer un plan de progression concret :
  "Pour passer Green, il te faut..." avec des actions spécifiques
- Mentionner les axes forts ("Ton Harness est déjà au niveau Silver")

**Acceptance criteria** :
- [ ] L'explication mentionne chaque axe avec son score
- [ ] L'axe limitant est mis en évidence
- [ ] Le plan de progression cible spécifiquement le(s) axe(s) faible(s)
- [ ] Le tout est lisible par un dev non expert AIDD

**Done quand** : sortie relue sur 3 profils différents, cohérente et utile.

### Phase 5 : CLI + sortie formatée

**Fichiers** : `src/cli.ts`, `README.md`

**Quoi** :
- CLI avec `npx`/`node` : `aidd-eval --profil path/to/profile.json`
- Mode fichier unique et mode batch (dossier de profils)
- Sortie console colorée et lisible (niveau, axes, explication, progression)
- Option `--json` pour sortie machine
- Option `--verbose` pour voir les scores de confiance

**Acceptance criteria** :
- [ ] `aidd-eval --profil p.json` affiche le diagnostic complet
- [ ] `aidd-eval --profil dossier/` traite tous les profils
- [ ] `--json` retourne du JSON valide
- [ ] Exit code 0 en cas de succès, 1 en cas d'erreur

**Done quand** : le README permet à quelqu'un de lancer l'outil en 2 commandes.

### Phase 6 : Robustesse + polish

**Fichiers** : tous

**Quoi** :
- Profils incomplets : message clair sur ce qui manque, diagnostic partiel
  avec avertissement plutôt que refus
- Profils incohérents : le scorer signale les contradictions
- Gestion des erreurs LLM (timeout, rate limit, réponse malformée) avec
  retry + fallback gracieux
- Indicateur de confiance global dans la sortie

**Acceptance criteria** :
- [ ] Un profil vide retourne un diagnostic "White par défaut" avec explication
- [ ] Une erreur API ne crashe pas — message d'erreur clair
- [ ] Le niveau de confiance global reflète les confiances par axe

**Done quand** : l'outil survit à tous les edge cases identifiés.

## Risques et points d'attention

- **Format des profils inconnu** : le parser est volontairement minimal et
  adaptable. Budget 30 min le 28 pour l'ajuster.
- **Variabilité du LLM** : le scoring n'est pas 100% déterministe. Mitigation :
  le prompt est très cadré (grille exhaustive + few-shot + structured output),
  et la mécanique `min()` est déterministe.
- **Coût API** : le scorer fait 4 appels LLM par profil + 1 pour l'explication.
  En batch sur 50 profils = ~250 appels. Acceptable sur Claude/GPT. Pas de
  risque de coût excessif.
- **Clé API requise pour le jury** : documenter clairement dans le README
  comment configurer la clé. Proposer un mode `--dry-run` qui montre la
  mécanique sans appel LLM (avec des scores factices).

## Décisions

**Stack : TypeScript + Node.js**
*Pourquoi* : écosystème familier, bon support des API LLM, CLI naturel avec
`process.argv` ou commander.js, types forts pour la grille et les scores.

**LLM : Claude API (Anthropic SDK)**
*Pourquoi* : structured output fiable (tool_use), on connaît bien le modèle,
pas de dépendance à un framework LLM lourd (pas de LangChain).

**Approche hybride LLM/algo**
*Pourquoi* : le scoring par axe bénéficie de l'interprétation LLM (le profil
peut contenir du texte libre, des données ambiguës), mais la mécanique
`min(4 axes)` doit être déterministe et testable. L'explication est
naturellement un job de LLM.

**Pas d'UI graphique**
*Pourquoi* : le README du hackathon le dit explicitement — un CLI bien fait
vaut mieux qu'une UI vide. Le temps est mieux investi dans la précision
du scoring et la qualité des explications.

**Grille en YAML, pas codée en dur**
*Pourquoi* : si la grille évolue ou si le jury a une variante, on change
un fichier YAML plutôt que du code. Aussi, ça montre une bonne pratique
de séparation données/logique au jury.
