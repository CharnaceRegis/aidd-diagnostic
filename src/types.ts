export type AxeId = "taille" | "harness" | "intervention" | "parallele";

export type NiveauId =
  | "white"
  | "red"
  | "blue"
  | "green"
  | "copper"
  | "silver"
  | "gold";

export type Confiance = "high" | "medium" | "low";

export interface EchelleEntry {
  rank: number;
  valeur: string | number;
}

export interface AxeDefinition {
  id: AxeId;
  label: string;
  description: string;
  echelle: EchelleEntry[];
}

export interface NiveauDefinition {
  id: NiveauId;
  label: string;
  rank: number;
}

export interface Grille {
  id: string;
  axes: AxeDefinition[];
  niveaux: NiveauDefinition[];
}

export interface AxeScore {
  axe: AxeId;
  rank: number;
  justification: string;
  confiance: Confiance;
}

export interface Diagnostic {
  scores: AxeScore[];
  niveauGlobal: NiveauDefinition;
  axeLimitant: AxeId;
  explication: string;
  progression: string;
  confianceGlobale: Confiance;
}

/** Profil normalisé — chaque champ peut être null si absent du profil brut */
export interface Profil {
  id: string;
  nom: string | null;
  donnees: Record<string, unknown>;
}
