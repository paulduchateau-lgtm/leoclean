import { describe, expect, it } from "vitest";

import {
  PROPOSAL_MIN_LEAD_HOURS,
  PROPOSAL_RESPONSE_WINDOW_HOURS,
  canAnswerProposal,
  canProposeSlot,
  proposalRefusalMessage,
  proposedEndFor,
  respondByFor,
} from "@/lib/booking/slot-proposal";

const NOW = new Date("2026-09-01T08:00:00Z");
const CURRENT_START = new Date("2026-09-05T09:00:00Z");
/** Bien au-delà du délai minimal, et sur la grille des trente minutes. */
const PROPOSED = new Date("2026-09-06T14:30:00Z");

describe("proposer un autre créneau", () => {
  it("accepte une proposition régulière sur une réservation orpheline", () => {
    const check = canProposeSlot({
      bookingStatus: "PENDING_ASSIGNMENT",
      currentStart: CURRENT_START,
      proposedStart: PROPOSED,
      now: NOW,
    });

    expect(check.allowed).toBe(true);
    expect(check.refusal).toBeNull();
  });

  it("ne s'ouvre que sur une réservation que personne n'a prise", () => {
    // Hors de ce cas, ce n'est plus une contre-proposition mais une
    // replanification, qui se négocie et se traite au téléphone.
    for (const status of [
      "CONFIRMED",
      "ASSIGNED",
      "IN_PROGRESS",
      "COMPLETED",
      "CANCELLED_BY_CLIENT",
    ] as const) {
      const check = canProposeSlot({
        bookingStatus: status,
        currentStart: CURRENT_START,
        proposedStart: PROPOSED,
        now: NOW,
      });
      expect(check.allowed).toBe(false);
      expect(check.refusal).toBe("RESERVATION_NON_ORPHELINE");
    }
  });

  it("refuse un créneau hors de la grille de trente minutes", () => {
    // Le planning entier travaille à ce pas : un créneau à 14 h 07 ne serait
    // proposable à personne d'autre ensuite.
    const check = canProposeSlot({
      bookingStatus: "PENDING_ASSIGNMENT",
      currentStart: CURRENT_START,
      proposedStart: new Date("2026-09-06T14:07:00Z"),
      now: NOW,
    });

    expect(check.allowed).toBe(false);
    expect(check.refusal).toBe("CRENEAU_HORS_GRILLE");
  });

  it("refuse de reproposer le créneau déjà refusé", () => {
    const check = canProposeSlot({
      bookingStatus: "PENDING_ASSIGNMENT",
      currentStart: CURRENT_START,
      proposedStart: CURRENT_START,
      now: NOW,
    });

    expect(check.allowed).toBe(false);
    expect(check.refusal).toBe("CRENEAU_INCHANGE");
  });

  it("exige que le client ait le temps de s'organiser", () => {
    const trop_proche = new Date(
      NOW.getTime() + (PROPOSAL_MIN_LEAD_HOURS - 1) * 3_600_000,
    );
    // Ramené sur la grille pour n'échouer que sur le délai.
    trop_proche.setUTCMinutes(0, 0, 0);

    const check = canProposeSlot({
      bookingStatus: "PENDING_ASSIGNMENT",
      currentStart: CURRENT_START,
      proposedStart: trop_proche,
      now: NOW,
    });

    expect(check.allowed).toBe(false);
    expect(check.refusal).toBe("CRENEAU_TROP_PROCHE");
  });
});

describe("durée et échéance", () => {
  it("déduit la fin de la durée de la réservation, sans la renégocier", () => {
    // Un intervenant qui changerait aussi la durée changerait le prix, et un
    // prix qui bouge après la réservation n'est plus une proposition.
    expect(proposedEndFor(PROPOSED, 210).toISOString()).toBe(
      "2026-09-06T18:00:00.000Z",
    );
  });

  it("laisse une fenêtre de réponse, jamais au-delà du créneau", () => {
    /*
     * La fenêtre vaut désormais deux semaines : seul un créneau situé au-delà
     * la laisse s'appliquer pleinement. C'est voulu — le client doit pouvoir
     * demander qu'on continue à chercher son heure exacte, puis revenir
     * accepter l'alternative des jours plus tard.
     */
    const lointain = new Date(NOW.getTime() + 30 * 24 * 3_600_000);
    expect(respondByFor(lointain, NOW).getTime()).toBe(
      NOW.getTime() + PROPOSAL_RESPONSE_WINDOW_HOURS * 3_600_000,
    );

    // Créneau plus proche que la fenêtre : répondre après le début n'aurait
    // aucun sens, l'échéance se rabat sur le créneau lui-même. C'est le cas
    // courant, la plupart des créneaux proposés tombant sous les deux semaines.
    for (const proche of [new Date(NOW.getTime() + 13 * 3_600_000), PROPOSED]) {
      expect(respondByFor(proche, NOW).getTime()).toBe(proche.getTime());
    }
  });
});

describe("répondre à une proposition", () => {
  const RESPOND_BY = new Date("2026-09-02T08:00:00Z");

  it("accepte une réponse dans les temps", () => {
    const check = canAnswerProposal({
      status: "PENDING",
      proposedStart: PROPOSED,
      respondBy: RESPOND_BY,
      now: NOW,
    });

    expect(check.allowed).toBe(true);
  });

  it("refuse ce qui n'est plus en attente", () => {
    for (const status of [
      "ACCEPTED",
      "DECLINED",
      "WITHDRAWN",
      "EXPIRED",
    ] as const) {
      expect(
        canAnswerProposal({
          status,
          proposedStart: PROPOSED,
          respondBy: RESPOND_BY,
          now: NOW,
        }).refusal,
      ).toBe("PROPOSITION_CLOSE");
    }
  });

  it("refuse après l'échéance", () => {
    expect(
      canAnswerProposal({
        status: "PENDING",
        proposedStart: PROPOSED,
        respondBy: RESPOND_BY,
        now: new Date(RESPOND_BY.getTime() + 60_000),
      }).refusal,
    ).toBe("PROPOSITION_PERIMEE");
  });

  it("refuse une fois le créneau commencé, même sans échéance", () => {
    // Accepter une heure passée écrirait un rendez-vous derrière soi, et
    // l'intervenant découvrirait une mission qu'il n'a plus le temps de faire.
    expect(
      canAnswerProposal({
        status: "PENDING",
        proposedStart: PROPOSED,
        respondBy: null,
        now: new Date(PROPOSED.getTime() + 1),
      }).refusal,
    ).toBe("PROPOSITION_PERIMEE");
  });

  it("donne des motifs lisibles, jamais des codes", () => {
    for (const refusal of [
      "RESERVATION_NON_ORPHELINE",
      "CRENEAU_HORS_GRILLE",
      "CRENEAU_TROP_PROCHE",
      "CRENEAU_INCHANGE",
      "PROPOSITION_CLOSE",
      "PROPOSITION_PERIMEE",
    ] as const) {
      const message = proposalRefusalMessage(refusal);
      expect(message.length).toBeGreaterThan(20);
      expect(message).not.toContain("_");
    }
  });
});
