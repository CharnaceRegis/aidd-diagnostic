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
  warnings: string[];
}

export interface ProfileMeta {
  profile_id: string;
  role: string;
  experience_years: number;
  stack: string[];
  team_size: number;
  available: string[];
  note?: string;
}

/** Dossier de preuves d'un profil */
export interface Profil {
  id: string;
  meta: ProfileMeta;
  pieces: ProfilPieces;
}

export interface ProfilPieces {
  gitActivity: Record<string, unknown> | null;
  pullRequests: Record<string, unknown> | null;
  sonarMeasures: Record<string, unknown> | null;
  declaratif: string | null;
  session: string | null;
  code: CodeFile[];
  repoContext: RepoContextSummary | null;
}

export interface CodeFile {
  path: string;
  content: string;
}

export interface PullRequestEntry {
  number: number;
  title: string;
  state: string;
  draft: boolean;
  merged: boolean;
  changed_files: number;
  additions: number;
  deletions: number;
  commits: number;
  review_comments: number;
  body: string | null;
}

export interface RepoContextSummary {
  claudeMd: string | null;
  agentsMd: string | null;
  agentFiles: string[];
  skillFiles: string[];
  ruleFiles: string[];
  hookFiles: string[];
  settingsJson: Record<string, unknown> | null;
  docsFiles: string[];
}
