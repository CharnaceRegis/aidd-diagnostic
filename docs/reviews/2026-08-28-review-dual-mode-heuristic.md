# Review : dual-mode heuristique + parser multi-pièces

- **Verdict** : changes-requested
- **Diff** : `67b4c71..a4b67df`
- **Axes lancés** : code, functional, relevancy
- **Date** : 2026-08-28
- **Findings** : 0 critical, 3 warning, 2 minor

---

## Phases

Le plan (`2026-08-24-aidd-diagnostic-tool.md`) précède la réécriture. Les critères
originaux sont tracés ci-dessous, mis à jour pour refléter l'évolution du scope.

### Phase 2 — Parser adaptatif

- [x] Dossiers de profils supportés (profile.json + pièces) — `parser.ts:11-31`
- [x] Un profil avec des pièces manquantes ne crashe pas — `parser.ts:45-54`
- [ ] `not-applicable` — JSON/YAML single-file n'est plus le format

### Phase 3 — Scorer

- [x] Chaque axe reçoit un score 0-6, justification, confiance — `heuristic-scorer.ts:315-317`
- [x] Heuristique déterministe calibrée sur 4 profils — `heuristic-scorer.ts`
- [x] LLM scorer sélectionne les pièces par axe — `scorer.ts:38-85`

### Phase 4 — Explainer

- [x] Templates heuristiques par axe/rank — `heuristic-explainer.ts:84-117`
- [x] Axe limitant mis en évidence — `heuristic-explainer.ts:27`
- [x] Plan de progression cible l'axe faible — `heuristic-explainer.ts:46-48`

### Phase 5 — CLI

- [x] Dual-mode : heuristique par défaut, LLM optionnel — `cli.ts:33-46`
- [x] Auto-détection de `profiles/` — `cli.ts:108-113`
- [x] Diagnostic toujours complet (verbose supprimé) — `cli.ts:68`
- [ ] `not-applicable` — `--json` pas implémenté (CLI interactif à la place)

---

## Findings

| Sev | Kind | Phase | Fichier | Problème | Fix |
|-----|------|-------|---------|----------|-----|
| 🟡 | code | 2 | `parser.ts:35` | `nom` duplique `meta.profile_id` — le champ `nom` est fixé à `meta.profile_id` au lieu de chercher un champ name/display_name dans le profil | Initialiser `nom` à `meta.display_name ?? meta.profile_id` ou supprimer le champ `nom` |
| 🟡 | code | 3 | `heuristic-scorer.ts:250-262` | Intervention rank 3 vs 4 repose sur un seuil absolu (`mergedNoEdit >= 30`) — un dev avec 35 PR (dont 30 merged sans édition, soit 86%) et un dev avec 300 PR (dont 30 merged, soit 10%) reçoivent le même rank 4 | Combiner le ratio et le volume absolu, ou utiliser uniquement le ratio avec un plancher |
| 🟡 | rot | - | `fixtures/profil-exemple.json` | Fixture obsolète, ancien format (JSON single-file). Ne correspond plus au format dossier actuel | Supprimer ou remplacer par un dossier fixture au nouveau format |
| 🟢 | conform | - | `heuristic-scorer.ts:302-303` | Parallèle median=1 → rank 3 : le commentaire explique bien la raison, mais la justification affichée « L'échelle ne discrimine pas en dessous de 3 branches » est technique et peu lisible pour un dev évalué | Reformuler en termes compréhensibles |
| 🟢 | rot | - | `docs/plans/2026-08-24-aidd-diagnostic-tool.md` | Plan encore en statut `pending` alors que toutes les phases sont implémentées. L'architecture y est encore « JSON/YAML → LLM only » | Passer en `done` et archiver, ou mettre à jour l'architecture |

---

## Vérification

| Métrique | Valeur |
|----------|--------|
| Vérifié | 70% (7/10 critères applicables) |
| Fichiers vérifiés | parser.ts, heuristic-scorer.ts, heuristic-explainer.ts, scorer.ts, cli.ts, types.ts, engine.ts |
| Non cochés | JSON/YAML single-file (`not-applicable`), `--json` (`not-applicable`) |
| Hors plan | `heuristic-scorer.ts` et `heuristic-explainer.ts` (nouveaux fichiers, pas dans le plan original) |
