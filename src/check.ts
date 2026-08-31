import { chargerGrille } from "./grille.js";
import { chargerProfils } from "./parser.js";
import { scorerProfilHeuristique } from "./heuristic-scorer.js";
import { evaluer } from "./engine.js";

const ATTENDUS: Record<string, number> = {
  perceval: 1,
  bohort: 2,
  lancelot: 2,
  leodagan: 3,
  arthur: 4,
  venec: 0,
};

export async function autoCheck(chemin: string): Promise<void> {
  const grille = chargerGrille();
  const profils = chargerProfils(chemin);

  let exact = 0;
  let proche = 0;
  let total = 0;

  console.log("\n  Auto-validation heuristique\n");
  console.log("  Profil         Attendu  Obtenu  Statut");
  console.log("  " + "─".repeat(44));

  for (const profil of profils) {
    const attendu = ATTENDUS[profil.id];
    if (attendu === undefined) continue;

    const scores = scorerProfilHeuristique(grille, profil);
    const { niveauGlobal } = evaluer(grille, scores);
    const obtenu = niveauGlobal.rank;
    const delta = Math.abs(obtenu - attendu);

    let statut: string;
    if (delta === 0) { statut = "✅"; exact++; }
    else if (delta === 1) { statut = "~ (±1)"; proche++; }
    else { statut = "❌"; }

    total++;
    const id = profil.id.padEnd(15);
    console.log(`  ${id}  ${attendu}        ${obtenu}      ${statut}`);
  }

  console.log("  " + "─".repeat(44));
  console.log(`  Exact : ${exact}/${total} — Tolérance ±1 : ${exact + proche}/${total}`);

  const taux = total > 0 ? Math.round(((exact + proche) / total) * 100) : 0;
  console.log(`  Précision : ${taux}%\n`);

  if (exact + proche < total) process.exit(1);
}
