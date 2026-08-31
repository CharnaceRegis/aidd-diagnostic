# Review : améliorer le scorer heuristique

- **Verdict** : ✅ approve
- **Diff** : `HEAD~1...HEAD`
- **Axes lancés** : code, functional, relevancy
- **Date** : 2026-08-31
- **Findings** : 0 critical, 0 warning, 3 minor

---

## Phases

### Phase 1 — Exploiter pull-requests.json et sonar-measures.json

- [x] `PullRequestEntry` typé avec les champs utilisés — `src/types.ts:84-95`
- [x] `scoreIntervention` utilise `pieces.pullRequests` quand disponible, ajuste rank ±1 avec clamp — `src/heuristic-scorer.ts:257-260`
- [x] `scoreTaille` mentionne Sonar dans la justification quand disponible — `src/heuristic-scorer.ts:55-63`
- [x] Les 6 profils produisent des résultats cohérents (pas de régression) — vérifié via `--check` (6/6 exact)
- [x] Les profils sans PR/Sonar (venec, perceval pour PR) ne crashent pas — vérifié
- [ ] Taille médiane des corrections (`additions + deletions`) — `not-applicable` — non implémenté, remplacé par le signal `review_comments` qui est plus discriminant

### Phase 2 — Cohérence inter-axes (annotation)

- [x] `ResultatEngine` a un champ `warnings: string[]` — `src/engine.ts:7`
- [x] `evaluer()` détecte les écarts > 3 et génère les warnings — `src/engine.ts:44-56`
- [x] Le CLI affiche les warnings après les axes — `src/cli.ts:108-114` (txt), `src/cli.ts:154-159` (md)
- [x] Les profils de référence ne génèrent pas de faux warnings (écarts ≤ 3) — vérifié

### Phase 3 — Auto-validation (`--check`)

- [x] `npm start -- --check` lance la validation sur `profiles/` — `src/cli.ts:243-248`
- [x] `npm start -- --check profiles/` fait la même chose — chemin passé en arg
- [x] Le tableau affiche les 6 profils avec attendu/obtenu/statut — `src/check.ts:38-42`
- [x] Le taux de précision est affiché — `src/check.ts:47-48`
- [x] Exit code 0 si tous dans la tolérance, 1 sinon — `src/check.ts:50`
- [x] Sans `--check`, le CLI démarre normalement (pas de régression) — le branchement est avant la boucle readline

---

## Findings

| Sev | Kind | Phase | Fichier | Problème | Fix |
|-----|------|-------|---------|----------|-----|
| 🟢 | rot | - | `src/engine.ts:30` | `LABELS` duplique `LABELS_AXES` de `cli.ts:70` — mêmes 4 valeurs | À factoriser dans un fichier partagé |
| 🟢 | code-health | - | `src/cli.ts:77` | `CONF_DOTS` toujours dead code (flaggé dans la review précédente) | Supprimer |
| 🟢 | code | 1 | `src/heuristic-scorer.ts:399` | `as Record<string, unknown>` redondant — `sonarMeasures` a déjà ce type dans `ProfilPieces` | Supprimer le cast |

---

## Verification

| Métrique | Valeur |
|----------|--------|
| Vérifié | 94% (15/16) |
| Fichiers vérifiés | `src/check.ts`, `src/cli.ts`, `src/engine.ts`, `src/heuristic-scorer.ts`, `src/text-signals.ts`, `src/types.ts` |
| Non cochés | Taille médiane corrections — `not-applicable` (signal review_comments choisi à la place) |
| Hors plan | `docs/reviews/2026-08-31-review-text-signals.md` (review antérieure incluse dans le commit) |
