import "server-only";

import { BusinessError } from "@/lib/booking/errors";
import type { TenantClient } from "@/lib/db";
import { SITE } from "@/lib/site";

import {
  type Attestation,
  type Beneficiaire,
  type LigneVersement,
  type Organisme,
  MESSAGES_REFUS,
  composerAttestation,
} from "./attestation";

/**
 * L'attestation fiscale annuelle, côté base.
 *
 * `attestation.ts` décide, ce module lit et écrit. La lecture est la partie
 * délicate : **l'avantage porte sur les sommes effectivement versées**, donc on
 * part des paiements encaissés et non des factures émises.
 *
 * Une facture de décembre payée en janvier appartient à l'année du paiement.
 * Bâtir l'attestation sur les factures donnerait un montant faux pour tout
 * client servi à cheval sur deux années — c'est-à-dire pour un abonné, donc
 * pour la clientèle que le service vise.
 */

export class AttestationRefuseeError extends BusinessError {}

export interface AttestationVue {
  id: string;
  annee: number;
  emetteur: string;
  verseCents: number;
  eligibleCents: number;
  emiseLe: string;
}

/**
 * Les versements d'un client, décomposés par émetteur.
 *
 * Un paiement règle **les deux factures d'une prestation** : c'est un seul
 * prélèvement chez le client, réparti entre deux organismes déclarés. La part
 * de chacun est celle de sa facture, et son éligibilité celle qu'on y a
 * inscrite — zéro si l'émetteur n'était pas déclaré ce jour-là.
 */
async function versementsDuClient(
  db: TenantClient,
  clientProfileId: string,
): Promise<Map<string | null, LigneVersement[]>> {
  const paiements = await db.payment.findMany({
    where: {
      status: "CAPTURED",
      capturedAt: { not: null },
      booking: { clientProfileId },
    },
    select: {
      capturedAt: true,
      capturedAmountCents: true,
      refundedAmountCents: true,
      booking: {
        select: {
          status: true,
          grossAmountCents: true,
          invoices: {
            select: {
              type: true,
              totalCents: true,
              taxCreditEligibleCents: true,
              issuedByCleanerProfileId: true,
            },
          },
        },
      },
    },
  });

  const parEmetteur = new Map<string | null, LigneVersement[]>();

  for (const paiement of paiements) {
    if (!paiement.capturedAt) continue;

    /*
     * Une prestation annulée dont on a prélevé des frais n'a pas été rendue :
     * le crédit d'impôt rémunère un service, pas un dédommagement. La ligne est
     * conservée — l'attestation explique ce qu'elle écarte — mais elle
     * n'ouvre aucun droit.
     */
    const realisee = paiement.booking.status === "COMPLETED";

    /*
     * Sans facture, on ne sait pas répartir : le versement est rattaché à la
     * plateforme et déclaré non éligible. Le cas se produit sur une prestation
     * réglée avant que la facturation n'existe, et il vaut mieux sous-déclarer
     * que d'attribuer à un organisme une somme qu'il n'a pas encaissée.
     */
    if (paiement.booking.invoices.length === 0) {
      const lignes = parEmetteur.get(null) ?? [];
      lignes.push({
        encaisseLe: paiement.capturedAt,
        montantCents: paiement.capturedAmountCents,
        rembourseCents: paiement.refundedAmountCents,
        eligibleCents: 0,
        prestationRealisee: realisee,
      });
      parEmetteur.set(null, lignes);
      continue;
    }

    for (const facture of paiement.booking.invoices) {
      const cle = facture.issuedByCleanerProfileId;
      const lignes = parEmetteur.get(cle) ?? [];

      /*
       * Le remboursement du paiement se répartit au prorata de la facture :
       * rembourser la moitié d'une prestation réduit de moitié chacune des deux
       * parts, et non la seule qui viendrait en premier.
       */
      const part = paiement.booking.grossAmountCents;
      const rembourse =
        part === 0
          ? 0
          : Math.round(
              (paiement.refundedAmountCents * facture.totalCents) / part,
            );

      lignes.push({
        encaisseLe: paiement.capturedAt,
        montantCents: facture.totalCents,
        rembourseCents: rembourse,
        eligibleCents: realisee ? facture.taxCreditEligibleCents : 0,
        prestationRealisee: realisee,
      });
      parEmetteur.set(cle, lignes);
    }
  }

  return parEmetteur;
}

/**
 * Émet les attestations d'un client pour une année.
 *
 * **Une par organisme déclaré**, comme il y a une facture par organisme : chacun
 * atteste sur son propre montant, et l'avance immédiate fonctionne de toute
 * façon par demande déposée par chaque organisme avec son SIRET.
 *
 * Idempotente par index unique partiel : un client qui redemande son
 * attestation reçoit **exactement le même document**, ce qui compte pour une
 * pièce déjà jointe à une déclaration de revenus.
 */
export async function emettreLesAttestations(
  db: TenantClient,
  clientProfileId: string,
  annee: number,
  maintenant: Date = new Date(),
): Promise<AttestationVue[]> {
  const existantes = await db.taxCertificate.findMany({
    where: { clientProfileId, annee },
    select: {
      id: true,
      annee: true,
      verseCents: true,
      eligibleCents: true,
      issuedAt: true,
      snapshot: true,
    },
  });

  if (existantes.length > 0) {
    return existantes.map((certificat) => ({
      id: certificat.id,
      annee: certificat.annee,
      emetteur:
        (certificat.snapshot as unknown as Attestation).organisme?.nom ?? "—",
      verseCents: certificat.verseCents,
      eligibleCents: certificat.eligibleCents,
      emiseLe: certificat.issuedAt.toISOString(),
    }));
  }

  const client = await db.clientProfile.findFirst({
    where: { id: clientProfileId },
    select: {
      id: true,
      organizationId: true,
      user: { select: { name: true } },
      addresses: {
        take: 1,
        orderBy: { createdAt: "asc" },
        select: { street: true, postalCode: true, cityName: true },
      },
      organization: {
        select: {
          legalName: true,
          siret: true,
          sapDeclarationNumber: true,
        },
      },
    },
  });

  if (!client) {
    throw new AttestationRefuseeError("Espace client introuvable.");
  }

  const adresse = client.addresses[0];
  const beneficiaire: Beneficiaire = {
    nom: client.user.name ?? "Client",
    adresse: adresse
      ? [adresse.street, `${adresse.postalCode} ${adresse.cityName}`]
      : [],
  };

  const parEmetteur = await versementsDuClient(db, clientProfileId);

  /* Les organismes concernés, avec leur identité au moment de l'émission. */
  const intervenants = await db.cleanerProfile.findMany({
    where: {
      id: {
        in: [...parEmetteur.keys()].filter(
          (cle): cle is string => cle !== null,
        ),
      },
    },
    select: {
      id: true,
      displayName: true,
      siret: true,
      sapDeclarationNumber: true,
      user: { select: { name: true } },
    },
  });

  const emises: AttestationVue[] = [];
  /*
   * Les refus sont retenus, pas seulement comptés : le message rendu à la
   * personne doit dire *pourquoi*. Répondre « aucune somme versée » à quelqu'un
   * qui demande l'année en cours lui ferait croire à une erreur de nos
   * comptes, alors que l'année n'est simplement pas terminée.
   */
  const refus = new Set<keyof typeof MESSAGES_REFUS>();

  for (const [cleanerProfileId, lignes] of parEmetteur) {
    let organisme: Organisme;

    if (cleanerProfileId === null) {
      organisme = {
        nom: client.organization.legalName ?? SITE.legalName,
        adresse: [
          SITE.address.street ?? "",
          `${SITE.address.postalCode} ${SITE.address.city}`,
        ].filter(Boolean),
        siret: client.organization.siret ?? SITE.siret ?? "",
        numeroSap: client.organization.sapDeclarationNumber,
      };
    } else {
      const intervenant = intervenants.find(
        (candidat) => candidat.id === cleanerProfileId,
      );
      if (!intervenant) continue;
      organisme = {
        nom: intervenant.user.name ?? intervenant.displayName,
        adresse: [],
        siret: intervenant.siret ?? "",
        numeroSap: intervenant.sapDeclarationNumber,
      };
    }

    const resultat = composerAttestation({
      annee,
      organisme,
      beneficiaire,
      lignes,
      maintenant,
    });

    /*
     * Un refus n'arrête pas les autres : un intervenant non déclaré ne doit pas
     * priver le client de l'attestation de celui qui l'est. On passe, et
     * l'écran dit ce qui manque.
     */
    if ("refus" in resultat) {
      refus.add(resultat.refus);
      continue;
    }

    const certificat = await db.taxCertificate.create({
      data: {
        organizationId: client.organizationId,
        clientProfileId,
        issuedByCleanerProfileId: cleanerProfileId,
        annee,
        issuedAt: maintenant,
        verseCents: resultat.attestation.verseCents,
        eligibleCents: resultat.attestation.eligibleCents,
        snapshot: resultat.attestation as unknown as object,
      },
      select: { id: true, issuedAt: true },
    });

    emises.push({
      id: certificat.id,
      annee,
      emetteur: organisme.nom,
      verseCents: resultat.attestation.verseCents,
      eligibleCents: resultat.attestation.eligibleCents,
      emiseLe: certificat.issuedAt.toISOString(),
    });
  }

  if (emises.length === 0) {
    /*
     * L'ordre n'est pas indifférent : une année non close est la raison la plus
     * fréquente et la plus actionnable — il suffit d'attendre. « Organisme non
     * déclaré » vient ensuite, parce qu'elle ne dépend pas de la personne.
     */
    const raison = refus.has("ANNEE_NON_CLOSE")
      ? "ANNEE_NON_CLOSE"
      : refus.has("ORGANISME_NON_DECLARE")
        ? "ORGANISME_NON_DECLARE"
        : "AUCUN_VERSEMENT";

    throw new AttestationRefuseeError(MESSAGES_REFUS[raison]);
  }

  return emises;
}

/** Les années pour lesquelles ce client a versé quelque chose. */
export async function anneesAttestables(
  db: TenantClient,
  clientProfileId: string,
  maintenant: Date = new Date(),
): Promise<number[]> {
  const paiements = await db.payment.findMany({
    where: {
      status: "CAPTURED",
      capturedAt: { not: null },
      booking: { clientProfileId, status: "COMPLETED" },
    },
    select: { capturedAt: true },
  });

  const format = new Intl.DateTimeFormat("fr-FR", {
    year: "numeric",
    timeZone: "Europe/Paris",
  });
  const courante = Number(format.format(maintenant));

  const annees = new Set<number>();
  for (const paiement of paiements) {
    if (!paiement.capturedAt) continue;
    const annee = Number(format.format(paiement.capturedAt));
    /* L'année en cours ne s'atteste pas : elle n'est pas close. */
    if (annee < courante) annees.add(annee);
  }

  return [...annees].sort((a, b) => b - a);
}

/** Les attestations déjà émises, pour l'écran du client. */
export async function lireLesAttestations(
  db: TenantClient,
  clientProfileId: string,
): Promise<AttestationVue[]> {
  const certificats = await db.taxCertificate.findMany({
    where: { clientProfileId },
    orderBy: [{ annee: "desc" }, { issuedAt: "asc" }],
    select: {
      id: true,
      annee: true,
      verseCents: true,
      eligibleCents: true,
      issuedAt: true,
      snapshot: true,
    },
  });

  return certificats.map((certificat) => ({
    id: certificat.id,
    annee: certificat.annee,
    emetteur:
      (certificat.snapshot as unknown as Attestation).organisme?.nom ?? "—",
    verseCents: certificat.verseCents,
    eligibleCents: certificat.eligibleCents,
    emiseLe: certificat.issuedAt.toISOString(),
  }));
}
