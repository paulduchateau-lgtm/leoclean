"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { authedAction } from "@/lib/actions";
import { espaceClient } from "@/lib/auth/espaces";
import { BusinessError } from "@/lib/booking/errors";
import { emettreLesAttestations } from "@/lib/facturation/attestation-annuelle";

class EspaceIntrouvableError extends BusinessError {}

export const demanderMonAttestation = authedAction(
  z.object({ annee: z.number().int().min(2020).max(2100) }),
  async ({ annee }) => {
    const espace = await espaceClient();
    if (!espace.ouvert) {
      throw new EspaceIntrouvableError(
        "Aucun espace client rattaché à ce compte.",
      );
    }

    const emises = await emettreLesAttestations(
      espace.db,
      espace.profil.id,
      annee,
    );

    revalidatePath("/mon-compte/attestations");
    return { emises: emises.length };
  },
);
