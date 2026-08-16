"use server";

import { z } from "zod";

import { authedAction } from "@/lib/actions";
import { requireOrganization } from "@/lib/auth/session";
import { BusinessError } from "@/lib/booking/errors";
import { marketplaceOrganizationId } from "@/lib/organizations";
import {
  type DonneesPersonnelles,
  rassemblerDonnees,
} from "@/lib/rgpd/donnees";
import { MOT_DE_CONFIRMATION } from "@/lib/rgpd/confirmation";
import { effacerDonnees } from "@/lib/rgpd/effacement";

/**
 * Droits d'accès et d'effacement.
 *
 * Les deux actions opèrent sur la session et sur elle seule : elles ne
 * prennent aucun identifiant d'utilisateur en entrée, de sorte qu'il n'existe
 * aucun champ à modifier pour exporter ou effacer les données d'un autre.
 */

class ConfirmationManquanteError extends BusinessError {
  constructor() {
    super(
      "Pour supprimer vos données, recopiez exactement le mot demandé. " +
        "C'est le seul garde-fou entre un clic et une décision.",
    );
  }
}

export const exporterMesDonnees = authedAction(
  z.object({}),
  async (_input, user): Promise<DonneesPersonnelles> => {
    const organizationId = await marketplaceOrganizationId();
    const { db } = await requireOrganization(organizationId);
    return rassemblerDonnees(db, { id: user.id, email: user.email });
  },
);

export const supprimerMesDonnees = authedAction(
  z.object({ confirmation: z.string() }),
  async ({ confirmation }, user) => {
    if (confirmation.trim().toUpperCase() !== MOT_DE_CONFIRMATION) {
      throw new ConfirmationManquanteError();
    }

    const organizationId = await marketplaceOrganizationId();
    const { db } = await requireOrganization(organizationId);

    const resultat = await effacerDonnees(db, organizationId, {
      id: user.id,
      email: user.email,
    });

    /*
     * La session vient d'être détruite en base : la personne est déconnectée
     * de fait, y compris sur ses autres appareils. On ne redirige pas ici —
     * l'écran affiche d'abord ce qui a été effacé et ce qui a dû être
     * conservé, puis renvoie à l'accueil. Disparaître sans un mot laisserait
     * croire à une erreur.
     */
    return resultat;
  },
);
