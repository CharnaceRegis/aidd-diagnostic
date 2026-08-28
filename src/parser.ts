import { readFileSync, statSync, readdirSync, existsSync } from "node:fs";
import { resolve, relative, basename } from "node:path";
import type {
  Profil,
  ProfileMeta,
  ProfilPieces,
  CodeFile,
  RepoContextSummary,
} from "./types.js";

export function chargerProfils(chemin: string): Profil[] {
  const stat = statSync(chemin);

  if (!stat.isDirectory()) {
    throw new Error(`${chemin} n'est pas un dossier.`);
  }

  // Si le dossier contient un profile.json, c'est un profil unique
  if (existsSync(resolve(chemin, "profile.json"))) {
    return [chargerUnProfil(chemin)];
  }

  // Sinon c'est un dossier de profils (profiles/)
  const sousDossiers = readdirSync(chemin, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => resolve(chemin, d.name));

  return sousDossiers
    .filter((d) => existsSync(resolve(d, "profile.json")))
    .map(chargerUnProfil);
}

function chargerUnProfil(dossier: string): Profil {
  const metaPath = resolve(dossier, "profile.json");
  const meta: ProfileMeta = JSON.parse(readFileSync(metaPath, "utf-8"));

  return {
    id: meta.profile_id,
    nom: meta.profile_id,
    meta,
    pieces: chargerPieces(dossier, meta.available),
  };
}

function chargerPieces(dossier: string, available: string[]): ProfilPieces {
  return {
    gitActivity: chargerJson(dossier, "git-activity.json", available),
    pullRequests: chargerJson(dossier, "pull-requests.json", available),
    sonarMeasures: chargerJson(dossier, "sonar-measures.json", available),
    declaratif: chargerTexte(dossier, "declaratif.md", available),
    session: chargerTexte(dossier, "session.md", available),
    code: chargerCode(dossier, available),
    repoContext: chargerRepoContext(dossier, available),
  };
}

function estDisponible(nom: string, available: string[]): boolean {
  return available.some((a) => a === nom || a === `${nom}/`);
}

function chargerJson(
  dossier: string,
  fichier: string,
  available: string[]
): Record<string, unknown> | null {
  if (!estDisponible(fichier, available)) return null;
  const chemin = resolve(dossier, fichier);
  if (!existsSync(chemin)) return null;
  return JSON.parse(readFileSync(chemin, "utf-8"));
}

function chargerTexte(
  dossier: string,
  fichier: string,
  available: string[]
): string | null {
  if (!estDisponible(fichier, available)) return null;
  const chemin = resolve(dossier, fichier);
  if (!existsSync(chemin)) return null;
  return readFileSync(chemin, "utf-8");
}

function chargerCode(dossier: string, available: string[]): CodeFile[] {
  if (!estDisponible("code", available)) return [];
  const codePath = resolve(dossier, "code");
  if (!existsSync(codePath)) return [];

  return listerFichiersRecursifs(codePath).map((absPath) => ({
    path: relative(codePath, absPath),
    content: readFileSync(absPath, "utf-8"),
  }));
}

function chargerRepoContext(
  dossier: string,
  available: string[]
): RepoContextSummary | null {
  if (!estDisponible("repo-context", available)) return null;
  const rcPath = resolve(dossier, "repo-context");
  if (!existsSync(rcPath)) return null;

  const lire = (rel: string): string | null => {
    const p = resolve(rcPath, rel);
    return existsSync(p) ? readFileSync(p, "utf-8") : null;
  };

  const lireJson = (rel: string): Record<string, unknown> | null => {
    const contenu = lire(rel);
    if (!contenu) return null;
    try {
      return JSON.parse(contenu);
    } catch {
      return null;
    }
  };

  // Lister les fichiers dans un sous-dossier s'il existe
  const listerSous = (rel: string): string[] => {
    const p = resolve(rcPath, rel);
    if (!existsSync(p)) return [];
    return listerFichiersRecursifs(p).map((f) => relative(rcPath, f));
  };

  return {
    claudeMd: lire("CLAUDE.md"),
    agentsMd: lire("AGENTS.md"),
    agentFiles: listerSous(".claude/agents"),
    skillFiles: listerSous(".claude/skills"),
    ruleFiles: listerSous(".claude/rules"),
    hookFiles: listerSous(".claude/hooks"),
    settingsJson: lireJson(".claude/settings.json"),
    docsFiles: listerSous("docs"),
  };
}

function listerFichiersRecursifs(dir: string): string[] {
  const resultats: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = resolve(dir, entry.name);
    if (entry.isDirectory()) {
      resultats.push(...listerFichiersRecursifs(full));
    } else {
      resultats.push(full);
    }
  }
  return resultats;
}
