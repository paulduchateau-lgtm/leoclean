import "server-only";

import { prisma } from "@/lib/db";
import { lienEspace, notifier } from "@/lib/notifications/envoi";

import {
  ECHECS_AVANT_SUSPENSION,
  RELANCES_ECHEC_JOURS,
  prochaineRelance,
} from "./calendrier";

/**
 * Ce qui suit un prélèvement refusé.
 *
 * `calendrier.ts` décide, ce module exécute — et il n'exécutait rien : les
 * relances étaient écrites et testées depuis le jalon E sans qu'aucun appelant
 * n'existe. Un prélèvement refusé restait `FAILED` et le silence s'installait :
 * le client ne savait pas, l'intervenant n'était pas payé, et la mission
 * suivante partait quand même.
 *
 * **Trois relances, puis une suspension annoncée.** J+1, J+3, J+7 — le calendrier
 * porte les délais, ce module les applique. Au troisième échec, la mission
 * suivante est suspendue **avec préavis explicite** : jamais d'annulation
 * silencieuse, qui ferait découvrir la rupture au client le matin où personne
 * ne vient.
 *
 * **La suspension n'annule rien.** Elle marque la réservation à traiter par un
 * humain, qui appellera. Un logiciel qui annule seul un rendez-vous pour une
 * carte expirée transforme un incident bancaire en client perdu.
 */

/**
 * Le prénom seul.
 *
 * Recopié de `notifications/evenements.ts`, qui ne l'exporte pas : trois lignes
 * dupliquées valent mieux qu'un export ouvert sur un détail de composition.
 */
function prenomDe(nom: string | null): string {
  return nom?.trim().split(/\s+/)[0] || "";
}

export interface RapportImpayes {
  examines: number;
  relances: number;
  aSuspendre: string[];
  echecs: { paymentId: string; motif: string }[];
}

/**
 * Enregistre un échec de prélèvement.
 *
 * Appelée par le webhook Stripe et par le travail planifié. **La date du premier
 * échec ne bouge jamais** : c'est elle qui datte la suite, et la remplacer à
 * chaque tentative repousserait indéfiniment la suspension — un impayé
 * deviendrait éternel à condition d'échouer régulièrement.
 */
export async function enregistrerUnEchec(
  paymentId: string,
  code: string | null,
  maintenant: Date = new Date(),
): Promise<void> {
  const paiement = await prisma.payment.findUnique({
    where: { id: paymentId },
    select: { firstFailedAt: true },
  });
  if (!paiement) return;

  await prisma.payment.update({
    where: { id: paymentId },
    data: {
      status: "FAILED",
      failureCode: code,
      firstFailedAt: paiement.firstFailedAt ?? maintenant,
      failedAttempts: { increment: 1 },
    },
  });
}

/**
 * Passe en revue les impayés et relance ce qui est dû.
 *
 * Chaque paiement est traité séparément : un échec sur l'un ne doit pas
 * empêcher les autres d'être relancés. C'est la règle des échéances, et elle
 * vaut d'autant plus qu'un blocage silencieux se découvre au relevé bancaire.
 */
export async function traiterLesImpayes(
  maintenant: Date = new Date(),
): Promise<RapportImpayes> {
  const rapport: RapportImpayes = {
    examines: 0,
    relances: 0,
    aSuspendre: [],
    echecs: [],
  };

  const impayes = await prisma.payment.findMany({
    where: { status: "FAILED", firstFailedAt: { not: null } },
    select: {
      id: true,
      organizationId: true,
      bookingId: true,
      firstFailedAt: true,
      failedAttempts: true,
      lastReminderAt: true,
      amountCents: true,
      booking: {
        select: {
          status: true,
          clientProfile: {
            select: { user: { select: { email: true, name: true } } },
          },
        },
      },
    },
    take: 200,
  });

  for (const paiement of impayes) {
    rapport.examines += 1;
    if (!paiement.firstFailedAt) continue;

    try {
      /*
       * Le rang de relance est le nombre déjà envoyées, pas le nombre d'échecs :
       * plusieurs tentatives bancaires peuvent échouer le même jour sans qu'on
       * doive écrire trois fois à quelqu'un.
       */
      const dejaEnvoyees = rangDesRelances(
        paiement.firstFailedAt,
        paiement.lastReminderAt,
      );

      const echeance = prochaineRelance(
        paiement.firstFailedAt,
        dejaEnvoyees + 1,
      );

      if (echeance && echeance.getTime() <= maintenant.getTime()) {
        await prisma.payment.update({
          where: { id: paiement.id },
          data: { lastReminderAt: maintenant },
        });
        rapport.relances += 1;

        /*
         * L'envoi part après l'écriture, et son échec ne défait pas le compteur :
         * une messagerie en panne ne doit pas faire renvoyer trois relances
         * quand elle revient. `notifier` n'échoue jamais — le filet est posé à
         * l'export du module de notifications.
         */
        await notifier(paiement.booking.clientProfile.user.email, {
          type: "prelevement-refuse",
          prenom: prenomDe(paiement.booking.clientProfile.user.name),
          montantCents: paiement.amountCents,
          rang: dejaEnvoyees + 1,
          avantSuspension: ECHECS_AVANT_SUSPENSION,
          lienMoyenDePaiement: lienEspace("/mon-espace/paiement"),
        });
      }

      if (paiement.failedAttempts >= ECHECS_AVANT_SUSPENSION) {
        rapport.aSuspendre.push(paiement.bookingId);
      }
    } catch (erreur) {
      rapport.echecs.push({
        paymentId: paiement.id,
        motif: erreur instanceof Error ? erreur.message : "inconnu",
      });
    }
  }

  return rapport;
}

/**
 * Combien de relances ont déjà été envoyées ?
 *
 * Déduit de la dernière date d'envoi plutôt que compté dans une colonne : une
 * colonne de plus se désynchroniserait de la date, et c'est la date qui décide.
 * Sans envoi, aucune relance n'est partie.
 */
function rangDesRelances(
  premierEchec: Date,
  derniereRelance: Date | null,
): number {
  if (!derniereRelance) return 0;

  const ecoules =
    (derniereRelance.getTime() - premierEchec.getTime()) / 86_400_000;

  /*
   * On compte les jalons franchis, avec une demi-journée de tolérance :
   * l'ordonnanceur passe à l'heure, pas à la seconde, et une relance envoyée
   * à J+1 h 02 ne doit pas se compter comme partie à J+0.
   */
  return RELANCES_ECHEC_JOURS.filter((jours) => ecoules >= jours - 0.5).length;
}
