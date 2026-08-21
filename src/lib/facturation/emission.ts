import "server-only";

import { BusinessError } from "@/lib/booking/errors";
import type { TenantClient } from "@/lib/db";
import { SITE } from "@/lib/site";

import {
  type Emetteur,
  type Facture,
  type LigneFacture,
  type RegimeTva,
  MESSAGES_MANQUE,
  decomposerTtc,
  partEligible,
  verifierLaFacture,
} from "./document";
import {
  SERIE_PLATEFORME,
  anneeDemission,
  composerNumero,
  serieIntervenant,
} from "./numerotation";

/**
 * L'émission des factures d'une prestation.
 *
 * **Deux factures, deux entités**, et la règle vient des CGU autant que du
 * droit : Léo Clean est un opérateur de mise en relation, l'intervenant vend
 * sa prestation pour son propre compte. Émettre une facture unique ferait de la
 * plateforme le prestataire au sens de l'article L7232-6, avec la
 * responsabilité de l'exécution et le risque de requalification de la relation
 * en contrat de travail.
 *
 * Les deux s'écrivent **ensemble ou pas du tout**. Une prestation dont une
 * seule moitié serait facturée laisserait la comptabilité fausse d'un côté et
 * le client sans justificatif de l'autre — et la suite de numéros, elle,
 * porterait déjà le trou.
 */

export class EmissionRefuseeError extends BusinessError {}

/** Facture émise, telle qu'on la rend à l'appelant. */
export interface FactureEmise {
  id: string;
  numero: string;
  type: "CLIENT_SERVICE" | "CLIENT_COORDINATION";
  totalCents: number;
  eligibleCreditImpotCents: number;
}

function lignesAdresse(parties: {
  street?: string | null;
  complement?: string | null;
  postalCode?: string | null;
  cityName?: string | null;
}): string[] {
  return [
    parties.street,
    parties.complement,
    [parties.postalCode, parties.cityName].filter(Boolean).join(" ").trim(),
  ].filter((ligne): ligne is string => Boolean(ligne && ligne.trim()));
}

/**
 * Attribue le prochain numéro d'une série.
 *
 * **Le compteur s'incrémente dans la transaction qui écrit la facture.** C'est
 * la raison d'être de la table plutôt que d'une `SEQUENCE` PostgreSQL : une
 * séquence ne revient pas en arrière quand la transaction échoue, et laisserait
 * précisément le trou que l'article 242 nonies A interdit. Le verrou de ligne
 * sérialise en outre deux émissions simultanées sur la même série.
 */
async function prochainNumero(
  tx: TenantClient,
  organizationId: string,
  serie: string,
  annee: number,
): Promise<string> {
  const compteur = await tx.invoiceSequence.upsert({
    where: {
      organizationId_serie_annee: { organizationId, serie, annee },
    },
    create: { organizationId, serie, annee, dernierRang: 1 },
    update: { dernierRang: { increment: 1 } },
    select: { dernierRang: true },
  });

  return composerNumero({ serie, annee, rang: compteur.dernierRang });
}

interface Contexte {
  emiseLe: Date;
  executeeLe: Date;
  lieu: string;
  destinataire: { nom: string; adresse: string[] };
}

function composerFacture(
  numero: string,
  emetteur: Emetteur,
  contexte: Contexte,
  designation: string,
  /** Part du prix client revenant à cet émetteur — toutes taxes comprises. */
  ttcCents: number,
  quantiteCentiemes: number,
): Facture {
  /*
   * Le montant réparti est du TTC : le client est annoncé un prix tout
   * compris, et les deux factures se partagent ce prix-là. La TVA s'en extrait
   * donc, elle ne s'y ajoute pas — l'ajouter ferait somme des deux factures
   * supérieure à ce que le client a réglé.
   */
  const { htCents, tvaCents } = decomposerTtc(
    ttcCents,
    emetteur.regimeTva,
    emetteur.tauxTvaBp,
  );

  const ligne: LigneFacture = {
    designation,
    quantiteCentiemes,
    unite: "h",
    /*
     * Le prix unitaire est déduit du total hors taxes et de la durée, jamais
     * l'inverse : c'est le total qui a été annoncé au client, et une facture
     * dont les lignes ne totalisent pas ce total est une facture fausse.
     */
    prixUnitaireCents: Math.round((htCents * 100) / quantiteCentiemes),
    totalCents: htCents,
  };

  /*
   * L'éligibilité au crédit d'impôt porte sur la somme **versée**, donc sur le
   * TTC : c'est ce que le client a sorti de sa poche. `partEligible` la ramène
   * à zéro quand l'émetteur n'a pas de numéro de déclaration.
   */
  const eligible = partEligible(ttcCents, emetteur.numeroSap);

  return {
    numero,
    emiseLe: contexte.emiseLe.toISOString(),
    executeeLe: contexte.executeeLe.toISOString(),
    lieu: contexte.lieu,
    emetteur,
    destinataire: contexte.destinataire,
    lignes: [ligne],
    totalHtCents: htCents,
    tvaCents,
    totalTtcCents: ttcCents,
    eligibleCreditImpotCents: eligible,
  };
}

/**
 * Émet les deux factures d'une prestation terminée.
 *
 * Idempotente : un index unique partiel sur `(bookingId, type)` interdit le
 * doublon, et l'appel rend simplement ce qui existe déjà. L'ordonnanceur
 * repasse toutes les heures ; sans cela, la deuxième exécution émettrait une
 * seconde facture qu'on ne pourrait plus retirer sans faire un trou.
 */
export async function emettreLesFactures(
  db: TenantClient,
  bookingId: string,
  maintenant: Date = new Date(),
): Promise<FactureEmise[]> {
  const reservation = await db.booking.findFirst({
    where: { id: bookingId },
    select: {
      id: true,
      organizationId: true,
      status: true,
      scheduledStart: true,
      scheduledEnd: true,
      completedAt: true,
      durationMinutes: true,
      professionalAmountCents: true,
      platformFeeAmountCents: true,
      address: {
        select: {
          street: true,
          complement: true,
          postalCode: true,
          cityName: true,
        },
      },
      clientProfile: {
        select: {
          user: { select: { name: true } },
          addresses: {
            take: 1,
            orderBy: { createdAt: "asc" },
            select: {
              street: true,
              complement: true,
              postalCode: true,
              cityName: true,
            },
          },
        },
      },
      organization: {
        select: {
          legalName: true,
          siret: true,
          sapDeclarationNumber: true,
          vatRegime: true,
          vatRateBp: true,
        },
      },
      invoices: {
        select: {
          id: true,
          number: true,
          type: true,
          totalCents: true,
          taxCreditEligibleCents: true,
        },
      },
      assignments: {
        where: { status: { in: ["ACCEPTED", "COMPLETED"] } },
        take: 1,
        select: {
          cleaner: {
            select: {
              id: true,
              displayName: true,
              siret: true,
              sapDeclarationNumber: true,
              vatRegime: true,
              vatRateBp: true,
              user: { select: { name: true } },
              homeAddress: {
                select: {
                  street: true,
                  complement: true,
                  postalCode: true,
                  cityName: true,
                },
              },
            },
          },
        },
      },
    },
  });

  if (!reservation) {
    throw new EmissionRefuseeError("Cette prestation est introuvable.");
  }

  /* Déjà émises : on rend l'existant plutôt que de recommencer. */
  if (reservation.invoices.length >= 2) {
    return reservation.invoices.map((facture) => ({
      id: facture.id,
      numero: facture.number,
      type: facture.type as FactureEmise["type"],
      totalCents: facture.totalCents,
      eligibleCreditImpotCents: facture.taxCreditEligibleCents,
    }));
  }

  /*
   * Le fait générateur d'une facture de services est l'exécution de la
   * prestation. On n'émet donc rien avant la clôture — une facture émise sur
   * une mission qui n'a pas eu lieu se corrige par un avoir, jamais par une
   * suppression.
   */
  if (reservation.status !== "COMPLETED" || !reservation.completedAt) {
    throw new EmissionRefuseeError(
      "La prestation n'est pas terminée : rien n'est facturable.",
    );
  }

  const intervenant = reservation.assignments[0]?.cleaner;
  if (!intervenant) {
    throw new EmissionRefuseeError(
      "Aucun intervenant rattaché : la facture de prestation n'a pas d'émetteur.",
    );
  }
  if (!intervenant.siret) {
    throw new EmissionRefuseeError(
      `Le SIRET de ${intervenant.displayName} manque : sa facture serait irrégulière.`,
    );
  }

  const siretPlateforme = reservation.organization.siret ?? SITE.siret;
  if (!siretPlateforme) {
    throw new EmissionRefuseeError(
      "Le SIRET de l'organisation manque : sa facture serait irrégulière.",
    );
  }

  const contexte: Contexte = {
    emiseLe: maintenant,
    /*
     * La date d'exécution est celle de la clôture réelle, pas l'heure prévue :
     * c'est elle que la mention obligatoire désigne, et elle seule qu'on
     * pourrait avoir à prouver.
     */
    executeeLe: reservation.completedAt,
    lieu: `${reservation.address.postalCode} ${reservation.address.cityName}`,
    destinataire: {
      nom: reservation.clientProfile.user.name ?? "Client",
      /*
       * L'adresse de facturation est celle de la prestation : c'est le domicile
       * où le ménage a eu lieu, et le crédit d'impôt suppose précisément une
       * prestation rendue au domicile du contribuable.
       */
      adresse: lignesAdresse(reservation.address),
    },
  };

  /*
   * La quantité facturée est la durée **vendue**, pas la durée réelle.
   *
   * Le dépôt a déjà tranché : « la durée réelle ne refacture rien, le montant
   * reste celui qui a été annoncé ». Porter la durée réelle sur la facture
   * tout en gardant le montant convenu produirait un prix unitaire de fiction
   * — une intervention pointée en une minute affichait 6 882 € de l'heure — et
   * c'est précisément le prix unitaire qu'un contrôle recalcule.
   *
   * L'écart entre prévu et réalisé a sa place, mais c'est le rapport de
   * mission, pas la facture.
   */
  const quantiteCentiemes = Math.round(
    (reservation.durationMinutes / 60) * 100,
  );

  const emetteurIntervenant: Emetteur = {
    nom: intervenant.user.name ?? intervenant.displayName,
    formeJuridique: "Entrepreneur individuel",
    /*
     * L'adresse de l'intervenant, **jamais celle du client**. Les deux sont à
     * portée de main dans la même requête, et les confondre imprimerait le
     * domicile d'un client comme siège du prestataire — sur un document qu'on
     * lui remet, et qu'il conserve dix ans.
     *
     * Absente, `verifierLaFacture` refuse l'émission : une facture sans adresse
     * de prestataire est irrégulière, et il vaut mieux la bloquer que la
     * remettre.
     */
    adresse: lignesAdresse(intervenant.homeAddress ?? {}),
    siret: intervenant.siret,
    regimeTva: intervenant.vatRegime as RegimeTva,
    tauxTvaBp: intervenant.vatRateBp,
    numeroSap: intervenant.sapDeclarationNumber,
    /* Établie par la plateforme au nom et pour le compte de l'intervenant. */
    autofacturee: true,
  };

  const emetteurPlateforme: Emetteur = {
    nom: reservation.organization.legalName ?? SITE.legalName,
    formeJuridique: SITE.legalForm,
    /*
     * `SITE.address.street` est nullable : une NAP incomplète est masquée
     * plutôt que remplie d'un espace réservé. Sur une facture, une adresse
     * incomplète est un défaut de forme — `verifierLaFacture` refuse alors
     * l'émission, ce qui vaut mieux qu'une facture irrégulière déjà remise.
     */
    adresse: lignesAdresse({
      street: SITE.address.street,
      postalCode: SITE.address.postalCode,
      cityName: SITE.address.city,
    }),
    siret: siretPlateforme,
    regimeTva: reservation.organization.vatRegime as RegimeTva,
    tauxTvaBp: reservation.organization.vatRateBp,
    numeroSap: reservation.organization.sapDeclarationNumber,
    autofacturee: false,
  };

  const aEmettre = [
    {
      type: "CLIENT_SERVICE" as const,
      emetteur: emetteurIntervenant,
      cleanerProfileId: intervenant.id,
      serie: serieIntervenant(intervenant.siret.slice(0, 9)),
      designation: "Ménage à domicile",
      /* Part du prix client, toutes taxes comprises. */
      ttcCents: reservation.professionalAmountCents,
    },
    {
      type: "CLIENT_COORDINATION" as const,
      emetteur: emetteurPlateforme,
      cleanerProfileId: null,
      serie: SERIE_PLATEFORME,
      designation: "Mise en relation et coordination",
      ttcCents: reservation.platformFeeAmountCents,
    },
  ];

  const annee = anneeDemission(maintenant);

  return db.$transaction(async (tx) => {
    const emises: FactureEmise[] = [];

    for (const projet of aEmettre) {
      const numero = await prochainNumero(
        tx as TenantClient,
        reservation.organizationId,
        projet.serie,
        annee,
      );

      const facture = composerFacture(
        numero,
        projet.emetteur,
        contexte,
        projet.designation,
        projet.ttcCents,
        quantiteCentiemes,
      );

      /*
       * On refuse d'écrire une facture irrégulière. Une facture déjà remise au
       * client ne se corrige que par un avoir — un second document, et une
       * explication — alors qu'un refus ici se voit dans le back-office et se
       * répare avant que quiconque l'ait vue.
       */
      const manques = verifierLaFacture(facture);
      if (manques.length > 0) {
        throw new EmissionRefuseeError(
          manques.map((manque) => MESSAGES_MANQUE[manque]).join(" "),
        );
      }

      const creee = await tx.invoice.create({
        data: {
          organizationId: reservation.organizationId,
          bookingId: reservation.id,
          type: projet.type,
          number: numero,
          issuedAt: maintenant,
          totalCents: facture.totalTtcCents,
          taxCreditEligibleCents: facture.eligibleCreditImpotCents,
          issuedByCleanerProfileId: projet.cleanerProfileId,
          snapshot: facture as unknown as object,
        },
        select: { id: true },
      });

      emises.push({
        id: creee.id,
        numero,
        type: projet.type,
        totalCents: facture.totalTtcCents,
        eligibleCreditImpotCents: facture.eligibleCreditImpotCents,
      });
    }

    return emises;
  });
}

/**
 * Émet ce qui est facturable et ne l'est pas encore.
 *
 * **Chaque prestation est traitée séparément** : une qui échoue — un SIRET
 * manquant, un intervenant détaché — ne doit pas empêcher les autres d'être
 * facturées. C'est la règle des échéances, et elle vaut d'autant plus ici qu'un
 * blocage silencieux se découvrirait à la clôture comptable.
 */
export async function emettreLesFacturesDues(
  db: TenantClient,
  maintenant: Date = new Date(),
  limite = 200,
): Promise<{ emises: number; echecs: { bookingId: string; motif: string }[] }> {
  const dues = await db.booking.findMany({
    where: { status: "COMPLETED", invoices: { none: {} } },
    orderBy: { completedAt: "asc" },
    take: limite,
    select: { id: true },
  });

  const echecs: { bookingId: string; motif: string }[] = [];
  let emises = 0;

  for (const reservation of dues) {
    try {
      await emettreLesFactures(db, reservation.id, maintenant);
      emises += 1;
    } catch (erreur) {
      echecs.push({
        bookingId: reservation.id,
        motif: erreur instanceof Error ? erreur.message : "inconnu",
      });
    }
  }

  return { emises, echecs };
}
