import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parse } from "yaml";
import type { Grille, NiveauDefinition } from "./types.js";

let _grille: Grille | null = null;

export function chargerGrille(chemin?: string): Grille {
  if (_grille) return _grille;

  const fichier = chemin ?? resolve(import.meta.dirname, "..", "grille.yml");
  const contenu = readFileSync(fichier, "utf-8");
  const data = parse(contenu) as Grille;

  if (!data.axes || !data.niveaux) {
    throw new Error("Grille invalide : axes ou niveaux manquants");
  }

  _grille = data;
  return data;
}

export function niveauParRank(
  grille: Grille,
  rank: number
): NiveauDefinition {
  const niveau = grille.niveaux.find((n) => n.rank === rank);
  if (!niveau) {
    throw new Error(`Aucun niveau pour le rank ${rank}`);
  }
  return niveau;
}
