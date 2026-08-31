# Review : CLI interactif

- **Verdict** : changes-requested
- **Diff** : `main` (unstaged)
- **Axes lancés** : code, relevancy
- **Date** : 2026-08-24
- **Findings** : 0 critical, 2 warning, 1 minor

---

## Phases

Non lancé (pas de plan formel pour ce changement).

---

## Findings

| Sev | Kind | Phase | Fichier | Problème | Fix |
|-----|------|-------|---------|----------|-----|
| 🟡 | code | - | `src/setup.ts:28-29` | `setup()` throw sur clé vide mais ne ferme pas le `rl` quand `rlExterne` est passé — l'erreur remonte au `.catch` global de `main()` qui ferme le rl puis `process.exit(1)`, donc ça fonctionne, mais le message utilisateur est "Erreur fatale : Clé API vide, abandon." au lieu d'un retour propre au menu. Un try/catch dans `main()` autour du `setup()` initial et du case "2" gérerait mieux ce cas. | Entourer les appels `setup(rl)` dans `cli.ts` d'un try/catch qui affiche le message et continue la boucle au lieu de crasher. |
| 🟡 | conform | - | `src/cli.ts:15` | Le `rl` est créé au top-level du module, avant `main()`. Si le module est importé sans être exécuté (test, re-export), le readline s'attache à stdin immédiatement. Pas bloquant pour l'usage actuel mais empêche tout test unitaire du module. | Déplacer la création du `rl` dans `main()` et le passer en paramètre aux fonctions qui en ont besoin. |
| 🟢 | rot | - | `src/cli.ts:22-27` | La bannière a un padding visuel asymétrique — le texte n'est pas centré dans la boîte unicode (espaces trailing dans le cadre). Cosmétique. | Aligner les espaces dans le template literal. |

---

## Vérification

Non lancé (pas de plan).
