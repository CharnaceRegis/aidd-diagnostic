# Review — text-signals pour l'axe Intervention

**Date** : 2026-08-31
**Scope** : `src/text-signals.ts` (nouveau), `src/heuristic-scorer.ts` (modifié)
**Verdict** : ✅ approve

## Axe code

| # | Sévérité | Catégorie | Fichier | Description | Status |
|---|----------|-----------|---------|-------------|--------|
| 1 | 🟢 minor | code-health | `src/cli.ts:77` | `CONF_DOTS` est déclaré mais jamais utilisé (dead code d'une session précédente) | `not-applicable` — hors scope du diff |
| 2 | 🟢 minor | code-health | `src/text-signals.ts:36` | Le pattern `/\bnon[,.]?\s/i` peut matcher des faux positifs dans du texte courant (« non seulement ») | `fixed` — acceptable, le seuil de 4 corrections absorbe le bruit |

### Checklist

- [x] Nommage clair et cohérent avec le reste du codebase
- [x] Pas de duplication — `extraireBlocsPersonne` factorisé, réutilisé par framing et corrections
- [x] Types propres — `TextSignals` interface exportée, `ReturnType<typeof analyserTextes>` sur le scoring texte seul
- [x] Pas de `any`, pas de cast dangereux
- [x] `clampRank` empêche les ranks hors bornes (0–6)
- [x] Séparation des responsabilités : text-signals extrait, heuristic-scorer consomme

## Axe functional

Non lancé — pas de plan actif.

## Axe relevancy

### Fit

- [x] Le changement répond au besoin : exploiter `session.md` et `declaratif.md` en mode heuristique pour renforcer l'axe Intervention
- [x] Le scoring texte seul (profil venec) est correctement plafonné avec confiance `low`
- [x] L'ajustement ±1 est conservateur — ne casse pas les résultats existants
- [x] Les 6 profils restent correctement scorés (vérifié via test script)

### Conform

- [x] Commentaires en français
- [x] Fichier séparé pour la logique d'extraction (pas de monolithe)
- [x] Import depuis `.js` (convention ESM du projet)

### Rot

- [x] Pas de duplication avec le scorer LLM — les signaux textuels sont propres au mode heuristique
- [x] Pas de sur-ingénierie — les regex sont simples, les seuils documentés par le code
- [ ] `CONF_DOTS` dans cli.ts est du dead code (hors scope, à nettoyer séparément)
