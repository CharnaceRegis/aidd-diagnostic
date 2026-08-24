import { readFileSync, statSync, readdirSync } from "node:fs";
import { resolve, extname, basename } from "node:path";
import { parse as parseYaml } from "yaml";
import type { Profil } from "./types.js";

/**
 * Charge un ou plusieurs profils depuis un chemin (fichier ou dossier).
 */
export function chargerProfils(chemin: string): Profil[] {
  const stat = statSync(chemin);

  if (stat.isDirectory()) {
    const fichiers = readdirSync(chemin)
      .filter((f) => [".json", ".yml", ".yaml"].includes(extname(f)))
      .map((f) => resolve(chemin, f));
    return fichiers.map(chargerUnProfil);
  }

  return [chargerUnProfil(chemin)];
}

function chargerUnProfil(fichier: string): Profil {
  const contenu = readFileSync(fichier, "utf-8");
  const ext = extname(fichier).toLowerCase();

  let donnees: Record<string, unknown>;

  if (ext === ".json") {
    donnees = JSON.parse(contenu);
  } else if (ext === ".yml" || ext === ".yaml") {
    donnees = parseYaml(contenu);
  } else {
    throw new Error(`Format non supporté : ${ext}`);
  }

  if (typeof donnees !== "object" || donnees === null) {
    throw new Error(`Profil invalide dans ${fichier}`);
  }

  return normaliser(donnees, fichier);
}

// ponytail: normalisation naïve — à adapter le 28 une fois le format connu
function normaliser(
  donnees: Record<string, unknown>,
  fichier: string
): Profil {
  const id =
    (donnees["id"] as string) ??
    (donnees["name"] as string) ??
    basename(fichier, extname(fichier));

  const nom =
    (donnees["nom"] as string) ??
    (donnees["name"] as string) ??
    null;

  return { id, nom, donnees };
}
