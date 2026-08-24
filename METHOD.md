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

Le niveau global est le **minimum des 4 axes**. Un dev brillant sur 3 axes mais faible sur un seul est au niveau de son axe le plus faible — la grille AIDD est explicite là-dessus.

## Pourquoi cette approche

### Le min plutôt que la moyenne

La grille dit : « Un niveau n'est atteint que si **tous ses axes** le sont. » Faire une moyenne masquerait les faiblesses. Le `min()` reflète la réalité : un dev qui livre des features XL mais n'a aucun contexte IA en place n'est pas Silver — son harness le retient.

### Un LLM pour interpréter, un algo pour trancher

Les profils contiennent des données hétérogènes : du texte libre, des chiffres, des descriptions qualitatives. Un ensemble de règles codées en dur casserait sur la première formulation imprévue. Le LLM est bon pour comprendre « il reprend environ un tiers du code » et en déduire un rang sur l'axe Intervention.

Mais la règle du minimum, elle, n'a rien d'ambigu. La laisser au LLM introduirait de la variance inutile. Le moteur déterministe l'applique sans surprise.

### La confiance plutôt que l'invention

Quand un profil ne donne pas assez d'information sur un axe, l'outil ne devine pas. Il attribue le score avec une confiance `low` et dit ce qui manque. Mieux vaut un diagnostic honnête qu'un diagnostic confiant et faux.

## Comment ça marche, concrètement

1. **Parsing** — Le profil (JSON ou YAML) est chargé et normalisé. Les champs manquants deviennent `null`, pas des erreurs.

2. **Scoring par axe** — Pour chaque axe, le profil est envoyé à Claude avec la définition de l'axe et son échelle complète. Le modèle retourne un rank (0–6), une justification et un indice de confiance, le tout en structured output pour éviter les problèmes de parsing.

3. **Niveau global** — Le moteur prend les 4 scores et applique `min()`. Il identifie l'axe limitant.

4. **Explication et progression** — À partir du diagnostic structuré, le LLM génère une explication en langage clair et un plan d'action ciblé sur l'axe limitant.

## Les limites

- **Le scoring n'est pas 100 % déterministe.** Deux exécutions sur le même profil peuvent donner des justifications différentes. Le rank, lui, est stable dans la grande majorité des cas grâce au cadrage du prompt et au structured output.

- **La qualité dépend du profil.** Un profil vague donne un diagnostic vague. L'outil le signale (confiance `low`), mais il ne peut pas inventer ce qui n'est pas décrit.

- **Pas de validation terrain.** L'outil évalue ce que le profil *dit*, pas ce que le dev *fait*. C'est un diagnostic sur déclaration, pas un audit de dépôt.
