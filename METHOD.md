# Méthode d'évaluation

## Ce qu'on mesure

Le niveau d'adoption de l'IA dans le workflow d'un développeur, selon le [référentiel AIDD](https://github.com/ai-driven-dev/laivel-up/blob/main/levels/aidd.md).

Quatre axes, chacun indépendant :

| Axe | Question posée |
| --- | --- |
| **Taille** | Quelle taille de features le dev livre-t-il habituellement avec l'IA ? |
| **Harness** | Qu'a-t-il mis en place autour du modèle ? (contexte, règles, boucles) |
| **Intervention** | À quel moment intervient-il dans le travail de l'IA ? |
| **Parallèle** | Combien de chantiers mène-t-il de front, habituellement ? |

Le niveau global est le **minimum des 4 axes**. Un dev brillant sur 3 axes mais faible sur un seul est au niveau de son axe le plus faible.

## Pourquoi cette approche

### Le min plutôt que la moyenne

La grille dit : « Un niveau n'est atteint que si **tous ses axes** le sont. » Faire une moyenne masquerait les faiblesses. Le `min()` reflète la réalité : un dev qui livre des features XL mais n'a aucun contexte IA en place n'est pas Silver — son harness le retient.

### Heuristique par défaut, LLM en option

Les profils contiennent des données structurées (métriques git, fichiers repo-context, analyse statique) et des données textuelles (déclaratif, sessions de travail).

L'approche heuristique score les axes à partir des signaux mesurables. Ça couvre bien 3 axes sur 4 :

| Axe | Signaux utilisés | Fiabilité |
| --- | --- | --- |
| **Taille** | Distribution de taille des PR × ratio de commits IA | Bonne |
| **Harness** | Inventaire des fichiers repo-context (CLAUDE.md, agents, skills, rules, hooks) | Très bonne |
| **Intervention** | Corrections après ouverture, PR mergées sans édition, taux de revert, CI | Correcte |
| **Parallèle** | Médiane de branches concurrentes | Directe |

L'axe Intervention est le moins fiable en heuristique : les métriques quantitatives (corrections, reverts) sont des signaux indirects. Le mode LLM lit les sessions de travail et le déclaratif pour un diagnostic plus fin.

### La confiance plutôt que l'invention

Quand un profil ne donne pas assez d'information sur un axe, l'outil ne devine pas. Il attribue le score avec une confiance `low` et dit ce qui manque.

### Le déclaratif n'est pas une preuve

Ce que la personne dit de sa pratique (déclaratif.md) est traité comme un témoignage, pas un fait. En mode LLM, le prompt demande explicitement de confronter le déclaratif aux données factuelles. En cas de contradiction, les faits priment.

## Comment ça marche, concrètement

1. **Parsing** — Le dossier profil est chargé. Chaque pièce (git-activity, code, repo-context, déclaratif, session) est identifiée et structurée. Les pièces absentes ne sont pas des erreurs.

2. **Scoring par axe** — En mode heuristique, des règles déterministes extraient les signaux pertinents de chaque pièce et les mappent sur l'échelle (rank 0–6). En mode LLM, seules les pièces pertinentes à l'axe sont envoyées au modèle (pas tout le dossier à chaque axe) pour un scoring plus fin.

3. **Niveau global** — Le moteur prend les 4 scores et applique `min()`. Il identifie l'axe limitant.

4. **Explication et progression** — En mode heuristique, des templates paramétrés par l'axe limitant et le niveau cible génèrent le diagnostic. En mode LLM, le modèle produit une explication et un plan en langage naturel.

## Les limites

- **L'heuristique ne lit pas le texte.** Les pièces narratives (déclaratif, session) ne sont exploitées qu'en mode LLM. Un profil dont la richesse est principalement textuelle sera mieux diagnostiqué avec un LLM.

- **La qualité dépend du profil.** Un profil incomplet donne un diagnostic incertain. L'outil le signale (confiance `low`), mais il ne peut pas inventer ce qui n'est pas fourni.

- **Les seuils heuristiques sont calibrés sur 6 profils.** Ils couvrent les niveaux Red à Copper. Des profils Silver ou Gold n'ont pas été testés — les seuils pourraient nécessiter un ajustement.
