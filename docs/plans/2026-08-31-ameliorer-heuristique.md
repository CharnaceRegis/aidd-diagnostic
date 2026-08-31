# Améliorer le scorer heuristique

- **Date** : 2026-08-31
- **Statut** : pending

## Objectif

Trois améliorations ciblées au scoring heuristique : exploiter les pièces
inutilisées (PR détaillées, Sonar), détecter les incohérences inter-axes,
et fournir un mode d'auto-validation sur les profils de référence. Résultat :
diagnostic plus précis, plus crédible, et auto-testable pour la soutenance.

## Surface d'édition

| Fichier | Raison |
|---------|--------|
| `src/heuristic-scorer.ts` | P1 : consommer PR + Sonar. P2 : exposer hook cohérence |
| `src/types.ts` | P1 : type `PullRequestEntry` pour typer le tableau PR |
| `src/engine.ts` | P2 : annoter les incohérences après `evaluer()` |
| `src/cli.ts` | P3 : brancher `--check` via `process.argv` |
| `src/check.ts` (nouveau) | P3 : logique d'auto-validation isolée |

## Hors-scope

- Modifier le scorer LLM (hors-sujet hackathon)
- Changer les ranks de référence attendus (calibrés sur les profils existants)
- Ajouter des profils de test supplémentaires
- Refacto du typage global de `ProfilPieces` (seul `PullRequestEntry` est ajouté)

## Phases

### Phase 1 : Exploiter pull-requests.json et sonar-measures.json

**Fichiers** : `src/types.ts`, `src/heuristic-scorer.ts`

**Quoi** :

1. Ajouter un type `PullRequestEntry` dans `types.ts` pour typer le tableau
   (le JSON est un `PR[]`, pas un `Record`).

2. Dans `scoreIntervention` — enrichir avec les PR détaillées :
   - Ratio `review_comments / PR` : beaucoup de commentaires de review →
     intervention humaine active (rank +1 si médiane > 3 comments/PR)
   - Taille médiane des corrections (`additions + deletions` des PR
     non-mergées ou avec corrections) → confirme ou infirme le signal
     `median_correction_commits_after_open` de git-activity

3. Dans `scoreTaille` — croiser avec Sonar :
   - `ncloc` (lignes de code) → confirme la taille réelle du projet
   - `coverage` → signal de maturité : si coverage > 60% et ratio IA
     élevé, les features IA sont testées → confiance haute
   - Ne pas changer le rank, seulement enrichir la justification et
     éventuellement monter la confiance de `"medium"` à `"high"`

**Acceptance criteria** :
- [ ] `PullRequestEntry` typé avec les champs utilisés (number, merged, additions, deletions, review_comments, body)
- [ ] `scoreIntervention` utilise `pieces.pullRequests` quand disponible, ajuste rank ±1 avec clamp
- [ ] `scoreTaille` mentionne Sonar dans la justification quand disponible
- [ ] Les 6 profils produisent des résultats cohérents (pas de régression)
- [ ] Les profils sans PR/Sonar (venec, perceval pour PR) ne crashent pas

**Done quand** : les 6 profils passent sans erreur, les justifications
mentionnent PR/Sonar quand les données existent.

### Phase 2 : Cohérence inter-axes (annotation)

**Fichiers** : `src/engine.ts`, `src/types.ts`

**Quoi** :

Après `evaluer()`, scanner les écarts entre axes. Si deux axes ont un
écart > 3 ranks, ajouter un warning dans le résultat :

```
⚠ Harness (rank 5) très supérieur à Intervention (rank 1) —
  l'outillage est en place mais l'intervention reste massive.
  Vérifier la pratique réelle.
```

L'annotation est un champ `warnings: string[]` ajouté à `ResultatEngine`.
Le warning est affiché par `afficherDiagnostic` dans le CLI. Les ranks
ne sont pas modifiés — c'est informatif.

Paires à surveiller :
- Harness élevé + Intervention faible → outillage sans discipline
- Taille élevée + Parallèle faible → grosses features mais pas en parallèle
- Intervention élevée + Harness faible → autonome mais sans filet

**Acceptance criteria** :
- [ ] `ResultatEngine` a un champ `warnings: string[]`
- [ ] `evaluer()` détecte les écarts > 3 et génère les warnings
- [ ] Le CLI affiche les warnings après les axes
- [ ] Les profils de référence ne génèrent pas de faux warnings (écarts ≤ 3)

**Done quand** : le champ `warnings` est peuplé sur un cas synthétique
d'écart > 3, et vide sur les 6 profils de référence.

### Phase 3 : Auto-validation (`--check`)

**Fichiers** : `src/cli.ts`, `src/check.ts` (nouveau)

**Quoi** :

1. `src/check.ts` — module indépendant :
   - Table des niveaux attendus :
     ```
     perceval → 1, bohort → 2, lancelot → 2,
     leodagan → 3, arthur → 4, venec → 0
     ```
   - Fonction `autoCheck(chemin: string)` :
     - Charge les profils via `chargerProfils(chemin)`
     - Score chacun en mode heuristique
     - Compare `diagnostic.niveau.rank` au rang attendu
     - Affiche un tableau : profil | attendu | obtenu | ✅/❌
     - Affiche le taux de précision (ex: `5/6 — 83%`)
     - Tolérance ±1 acceptée (affichée `~` au lieu de `✅`)
   - Retourne `process.exit(0)` si 100% exact ou dans la tolérance,
     `process.exit(1)` sinon (utilisable en CI)

2. `src/cli.ts` — au début de `main()` :
   ```ts
   if (process.argv.includes("--check")) {
     const chemin = process.argv[process.argv.indexOf("--check") + 1] || "profiles/";
     await autoCheck(chemin);
     process.exit(0);
   }
   ```

**Acceptance criteria** :
- [ ] `npm start -- --check` lance la validation sur `profiles/`
- [ ] `npm start -- --check profiles/` fait la même chose
- [ ] Le tableau affiche les 6 profils avec attendu/obtenu/statut
- [ ] Le taux de précision est affiché
- [ ] Exit code 0 si tous dans la tolérance, 1 sinon
- [ ] Sans `--check`, le CLI démarre normalement (pas de régression)

**Done quand** : `npm start -- --check` affiche le tableau et retourne 0.

## Risques et points d'attention

- **Typage PR** : `pullRequests` est `Record<string, unknown> | null`
  mais c'est un tableau. Le cast `as unknown as PullRequestEntry[]` est
  nécessaire — vérifier `Array.isArray` avant.
- **Sonar values en string** : toutes les valeurs Sonar sont des strings
  (`"61.0"`, `"0"`). `parseFloat` systématique.
- **Deadline** : c'est aujourd'hui. Les 3 phases sont indépendantes —
  si le temps manque, la phase 3 (--check) a le meilleur ratio
  effort/impact pour la soutenance.

## Décisions

**Cohérence = annotation seule, pas d'ajustement de rank.**
*Pourquoi* : modifier les ranks risque de casser des diagnostics corrects.
Un warning informatif est plus honnête et plus facile à justifier devant
le jury.

**Tolérance ±1 dans --check.**
*Pourquoi* : le référentiel a des zones grises entre niveaux adjacents.
Accepter ±1 comme « proche » évite de faussement échouer sur des cas
limites légitimes.

**Phase 3 en priorité si le temps manque.**
*Pourquoi* : c'est le plus visible en soutenance (30 lignes, impact
démonstratif maximal) et ça prouve la rigueur de l'approche.
