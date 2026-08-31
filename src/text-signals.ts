import type { ProfilPieces } from "./types.js";

export interface TextSignals {
  /** 0–2 : qualité du cadrage initial dans la session */
  sessionFraming: number;
  /** Nombre de corrections/redirections par la personne en session */
  sessionCorrections: number;
  /** 0–2 : niveau de méthodologie déclaré */
  declaratifMethode: number;
  /** 0–2 : qualité de documentation des PR (body structuré) */
  prBodyQualite: number;
  /** Au moins un texte exploitable */
  hasTexts: boolean;
}

const FRAMING_PATTERNS = [
  /contexte\s*:/i,
  /convention/i,
  /règle/i,
  /contrainte/i,
  /ne touche pas/i,
  /ne (dévie|modifie|change) pas/i,
  /commence par/i,
  /spec\b/i,
  /spécification/i,
  /objectif\s*:/i,
  /procédure/i,
  /applique la procédure/i,
  /avant d'écrire/i,
  /propose[- ]moi.*avant/i,
];

const CORRECTION_PATTERNS = [
  /\bça me gêne\b/i,
  /\bje préfère\b/i,
  /\bpas ça\b/i,
  /\bcorrige\b/i,
  /\bplutôt\b/i,
  /\bnon[,.]?\s/i,
  /\bje veux pas\b/i,
  /\bne fais pas\b/i,
  /\bc'est pas ce que/i,
  /\brefais\b/i,
  /\bsupprime\b/i,
  /\breviens sur\b/i,
];

// Mots-clés de méthodologie structurée dans le déclaratif
const METHODE_POSITIVE = [
  /\bcadre\b/i,
  /\bcadrer\b/i,
  /\binstructions?\s+(à la racine|projet)/i,
  /\brègles?\s+(par domaine|projet|dédié)/i,
  /\bspécification/i,
  /\bcas limites/i,
  /\bcritères d'acceptation/i,
  /\btests?\s+(avant|systématique|d'abord|en même temps)/i,
  /\borchestre/i,
  /\bpilote\b/i,
  /\bdécoupe.*en amont/i,
  /\bje ne code plus/i,
  /\bcontexte.*avant/i,
];

// Mots-clés de pratique passive
const METHODE_PASSIVE = [
  /\bcopie.*dans.*conversation/i,
  /\brecolle\b/i,
  /\bcorriger ce qu'il a/i,
  /\bpas vraiment\b.*context/i,
  /\bredonn.*contexte à chaque fois/i,
  /\bcopier[\s-]coller/i,
  /\bquand j'ai le temps\b/i,
  /\bje les (écris|fais) pas\b/i,
];

export function analyserTextes(pieces: ProfilPieces): TextSignals {
  const hasSession = !!pieces.session;
  const hasDeclaratif = !!pieces.declaratif;
  const prBodies = extrairePRBodies(pieces);

  return {
    sessionFraming: hasSession ? analyserFraming(pieces.session!) : 0,
    sessionCorrections: hasSession ? compterCorrections(pieces.session!) : 0,
    declaratifMethode: hasDeclaratif ? analyserMethode(pieces.declaratif!) : 0,
    prBodyQualite: prBodies.length > 0 ? analyserPRBodies(prBodies) : 0,
    hasTexts: hasSession || hasDeclaratif || prBodies.length > 0,
  };
}

/** Évalue la qualité du cadrage dans le premier bloc Personne */
function analyserFraming(session: string): number {
  const premierBloc = extrairePremierBlocPersonne(session);
  if (!premierBloc) return 0;

  const matches = FRAMING_PATTERNS.filter((p) => p.test(premierBloc)).length;
  if (matches >= 3) return 2;
  if (matches >= 1) return 1;
  return 0;
}

/** Compte les corrections/redirections dans tous les blocs Personne sauf le premier */
function compterCorrections(session: string): number {
  const blocs = extraireBlocsPersonne(session);
  // Le premier bloc c'est du cadrage, pas des corrections
  const blocsSuivants = blocs.slice(1).join("\n");
  if (!blocsSuivants) return 0;

  return CORRECTION_PATTERNS.filter((p) => p.test(blocsSuivants)).length;
}

/** Évalue le niveau de méthodologie déclaré */
function analyserMethode(declaratif: string): number {
  const positifs = METHODE_POSITIVE.filter((p) => p.test(declaratif)).length;
  const passifs = METHODE_PASSIVE.filter((p) => p.test(declaratif)).length;

  const score = positifs - passifs;
  if (score >= 3) return 2;
  if (score >= 1) return 1;
  return 0;
}

// Sections structurées dans un body de PR
const PR_BODY_SECTIONS = [
  /^##\s+(why|context|the problem|problem|motivation)/im,
  /^##\s+(what (i )?(change|did|checked)|changes)/im,
  /^##\s+(what (i )?(did not|am not) do|not doing|still to do|out of scope)/im,
  /^##\s+(review|review thread)/im,
  /^##\s+(how|approach|design|solution)/im,
  /^##\s+(test|what (i )?checked|verification)/im,
];

/** Évalue la qualité de documentation des PR à partir de leurs bodies */
function analyserPRBodies(bodies: string[]): number {
  let meilleur = 0;
  for (const body of bodies) {
    const sections = PR_BODY_SECTIONS.filter((p) => p.test(body)).length;
    if (sections >= 3) return 2;
    if (sections >= 1 && sections > meilleur) meilleur = 1;
  }
  return meilleur;
}

function extrairePRBodies(pieces: ProfilPieces): string[] {
  if (!pieces.pullRequests) return [];
  const raw = pieces.pullRequests;
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((pr: Record<string, unknown>) => typeof pr.body === "string" && pr.body.length > 0)
    .map((pr: Record<string, unknown>) => pr.body as string);
}

function extrairePremierBlocPersonne(session: string): string | null {
  const blocs = extraireBlocsPersonne(session);
  return blocs[0] ?? null;
}

/** Extrait les blocs de texte après chaque marqueur **Personne** */
function extraireBlocsPersonne(session: string): string[] {
  const parts = session.split(/\*\*Personne\*\*/i);
  return parts.slice(1).map((p) => {
    const fin = p.search(/\*\*Assistant\*\*/i);
    return (fin >= 0 ? p.slice(0, fin) : p).trim();
  });
}
