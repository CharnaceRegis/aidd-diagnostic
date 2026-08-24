# Référentiel AIDD — Résumé de travail

Source : [levels/aidd.md](https://github.com/ai-driven-dev/laivel-up/blob/main/levels/aidd.md)

## Les 4 axes

| Axe | Ce qu'il mesure |
| --- | --- |
| **Taille** | Taille habituelle des features livrées avec l'IA (S → XL) |
| **Harness** | Ce qui est mis en place autour du modèle (contexte, behavior, boucles) |
| **Intervention** | Quand l'humain intervient (après coup → jamais) |
| **En parallèle** | Combien de chantiers en simultané (0 → 3+) |

## La grille

| Niveau | Taille | Harness | Intervention | En parallèle |
| --- | --- | --- | --- | --- |
| ❖ White | aucune | rien | — | 0 |
| 🔺 Red | S | prompts | après coup, sur la majorité | 1 |
| 🔹 Blue | M | context engineering | après coup, sur une partie | 1 |
| 🟢 Green | L | context eng. + behavior | aux étapes clés | 1 |
| 🥉 Copper | L-XL | context eng. + behavior | aux étapes clés | 3 |
| 🥈 Silver | L-XL | context eng. + behavior + boucles | jamais, une fois cadrée | 3 |
| 🥇 Gold | L-XL | context eng. + behavior + boucles | jamais, cadrage compris | 3 |

## Règles clés

- **Le niveau = le min des 4 axes.** Un seul axe faible tire tout vers le bas.
- **Les niveaux se cumulent.** Chaque niveau garde ce que le précédent apporte.
- **Chaque cellule est un minimum**, pas une valeur exacte : 4 chantiers satisfait la case « 3 ».
- **La qualité du code n'est pas un axe** — c'est le prérequis. Le référentiel mesure l'adoption de l'IA, à qualité équivalente.

## Hors périmètre du référentiel

| Pas mesuré | Pourquoi |
| --- | --- |
| Séniorité | Un architecte qui n'utilise pas l'IA est White |
| Qualité du code | Prérequis, pas un axe |
| Volume d'usage | Une boucle d'échec consomme plus qu'une boucle qui converge |
