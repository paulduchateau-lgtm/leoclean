import { describe, expect, it } from "vitest";

import {
  estEnRecouvrement,
  interventionGelee,
  joursEnRecouvrement,
} from "@/lib/paiement/recouvrement";

/**
 * Le gel est une conséquence, pas un état posé — et c'est cette propriété que
 * ces tests protègent. Un statut écrit sur chaque réservation demanderait un
 * parcours au dégel, et l'oubli de ce parcours laisserait gelé quelqu'un qui
 * vient de payer.
 */

const MAINTENANT = new Date("2026-08-21T10:00:00Z");
const DEMAIN = new Date("2026-08-22T09:00:00Z");
const HIER = new Date("2026-08-20T09:00:00Z");

const AJOUR = { recouvrementDepuis: null };
const EN_RETARD = { recouvrementDepuis: new Date("2026-08-14T08:00:00Z") };

describe("recouvrement", () => {
  it("ne gèle rien tant que le client est à jour", () => {
    expect(estEnRecouvrement(AJOUR)).toBe(false);
    expect(
      interventionGelee(
        AJOUR,
        { status: "CONFIRMED", debut: DEMAIN },
        MAINTENANT,
      ),
    ).toBe(false);
  });

  it("gèle les interventions à venir d'un client en recouvrement", () => {
    expect(
      interventionGelee(
        EN_RETARD,
        { status: "CONFIRMED", debut: DEMAIN },
        MAINTENANT,
      ),
    ).toBe(true);
  });

  it("ne gèle jamais une intervention déjà commencée", () => {
    // Quelqu'un qui est chez le client doit finir son ménage et être payé pour.
    // Retirer la mission sous ses pieds lui ferait porter un litige qui n'est
    // pas le sien.
    expect(
      interventionGelee(
        EN_RETARD,
        { status: "IN_PROGRESS", debut: HIER },
        MAINTENANT,
      ),
    ).toBe(false);
  });

  it("ne gèle pas le passé ni ce qui est déjà terminé", () => {
    expect(
      interventionGelee(
        EN_RETARD,
        { status: "CONFIRMED", debut: HIER },
        MAINTENANT,
      ),
    ).toBe(false);

    for (const status of [
      "COMPLETED",
      "CANCELLED_BY_CLIENT",
      "CANCELLED_BY_CLEANER",
      "NO_SHOW",
      "DISPUTED",
    ]) {
      expect(
        interventionGelee(EN_RETARD, { status, debut: DEMAIN }, MAINTENANT),
      ).toBe(false);
    }
  });

  it("dégèle tout d'un coup quand la date retombe à null", () => {
    // C'est la propriété qui a décidé du modèle : régulariser lève le gel de
    // toutes les interventions sans en parcourir aucune. Aucun oubli possible.
    const regularise = { recouvrementDepuis: null };
    for (const startAt of [DEMAIN, new Date("2026-09-30T09:00:00Z")]) {
      expect(
        interventionGelee(
          regularise,
          { status: "CONFIRMED", debut: startAt },
          MAINTENANT,
        ),
      ).toBe(false);
    }
  });

  it("compte l'ancienneté, qui décide de l'ordre d'appel", () => {
    // Sept jours pleins entre le 14 et le 21. Le plus ancien se traite en
    // premier : traiter le plus récent laisse au fond de la pile celui qui
    // traîne, et c'est celui-là qu'on perd.
    expect(joursEnRecouvrement(EN_RETARD, MAINTENANT)).toBe(7);
    expect(joursEnRecouvrement(AJOUR, MAINTENANT)).toBeNull();
  });
});
