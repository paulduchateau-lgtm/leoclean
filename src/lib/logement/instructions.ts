import "server-only";

import type { TenantClient } from "@/lib/db";
import { annoncerDansLeFil } from "@/lib/messagerie/conversation";
import {
  CONSIGNES_VIDES,
  type Consignes,
  type Reponse,
  TOUTES_LES_QUESTIONS,
  lireLesConsignes,
  validerUneReponse,
} from "@/lib/logement/consignes";

/**
 * Lecture et écriture des consignes d'un logement.
 *
 * La règle est dans `consignes.ts`, qui est pur ; ce module ne fait que la
 * poser en base. La séparation n'est pas décorative : l'écran client, l'écran
 * de mission et les tests lisent tous le module pur, et aucun d'eux n'a besoin
 * d'une base pour savoir ce qu'une consigne veut dire.
 *
 * **L'appartenance est vérifiée dans la requête, jamais après.** Un logement se
 * modifie par `where: { id, clientProfile: { userId } }` : si l'adresse n'est
 * pas la sienne, `updateMany` touche zéro ligne et rend `false`. Charger puis
 * comparer laisserait une fenêtre entre les deux, et surtout laisserait à
 * l'appelant le soin de ne pas oublier la comparaison.
 */

export interface LogementAvecConsignes {
  addressId: string;
  libelle: string;
  consignes: Consignes;
}

/** Les logements d'un client, avec leurs consignes relues. */
export async function lireLesLogements(
  db: TenantClient,
  userId: string,
): Promise<LogementAvecConsignes[]> {
  const adresses = await db.address.findMany({
    where: { clientProfile: { userId } },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      label: true,
      street: true,
      cityName: true,
      consignes: true,
    },
  });

  return adresses.map((adresse) => ({
    addressId: adresse.id,
    libelle: adresse.label ?? `${adresse.street}, ${adresse.cityName}`,
    consignes: lireLesConsignes(adresse.consignes),
  }));
}

/** Les consignes d'un logement précis, ou `null` s'il n'est pas à ce client. */
export async function lireUnLogement(
  db: TenantClient,
  userId: string,
  addressId: string,
): Promise<LogementAvecConsignes | null> {
  const adresse = await db.address.findFirst({
    where: { id: addressId, clientProfile: { userId } },
    select: {
      id: true,
      label: true,
      street: true,
      cityName: true,
      consignes: true,
    },
  });
  if (!adresse) return null;

  return {
    addressId: adresse.id,
    libelle: adresse.label ?? `${adresse.street}, ${adresse.cityName}`,
    consignes: lireLesConsignes(adresse.consignes),
  };
}

export interface EcritureConsignes {
  actif: boolean;
  /** Réponses brutes venues du formulaire, validées ici question par question. */
  reponses: Record<string, unknown>;
}

/**
 * Enregistre les consignes d'un logement.
 *
 * **Les réponses sont revalidées ici, jamais reprises telles quelles.** Elles
 * viennent d'un formulaire, donc de l'extérieur : `validerUneReponse` écarte ce
 * qui ne correspond plus au catalogue, et une réponse vide n'est pas conservée.
 * C'est la règle du dépôt — une donnée venue du navigateur n'est jamais typée
 * par assertion.
 *
 * Rend `false` si le logement n'appartient pas à cette personne.
 */
export async function enregistrerLesConsignes(
  db: TenantClient,
  userId: string,
  addressId: string,
  entree: EcritureConsignes,
  maintenant: Date,
): Promise<boolean> {
  const reponses: Record<string, Reponse> = {};
  for (const question of TOUTES_LES_QUESTIONS) {
    const valide = validerUneReponse(question, entree.reponses[question.id]);
    if (valide !== null) reponses[question.id] = valide;
  }

  const consignes: Consignes = {
    actif: entree.actif,
    reponses,
    /*
     * La date ne bouge que si quelque chose a changé de main : elle est montrée
     * à l'intervenant, et une consigne « mise à jour aujourd'hui » qui n'a pas
     * bougé depuis six mois lui ferait croire à une instruction fraîche.
     */
    majAt: maintenant.toISOString(),
  };

  const { count } = await db.address.updateMany({
    where: { id: addressId, clientProfile: { userId } },
    data: { consignes },
  });
  if (count === 0) return false;

  /*
   * Les intervenants des interventions à venir sur ce logement l'apprennent
   * dans leur fil. C'est le seul moyen qu'ils ont de le savoir : ils lisent les
   * consignes avant de partir, mais rien ne leur dit qu'elles ont changé depuis
   * la dernière fois — et une consigne modifiée qu'on ne relit pas est une
   * consigne qui n'existe pas.
   *
   * **Seulement à l'activation**, jamais à la mise en pause : annoncer « les
   * consignes ont changé » quand elles viennent d'être retirées enverrait lire
   * une liste vide.
   */
  if (entree.actif) {
    await annoncerLesConsignes(db, addressId, maintenant);
  }

  return true;
}

/**
 * Prévient, dans leur fil, les intervenants attendus sur ce logement.
 *
 * Silencieuse s'il n'y en a aucun : personne n'a besoin d'apprendre qu'une
 * consigne a changé pour une intervention qui n'existe pas.
 */
async function annoncerLesConsignes(
  db: TenantClient,
  addressId: string,
  maintenant: Date,
): Promise<void> {
  const aVenir = await db.booking.findMany({
    where: {
      addressId,
      scheduledStart: { gt: maintenant },
      status: { in: ["ASSIGNED", "CONFIRMED"] },
      assignments: { some: { status: "ACCEPTED" } },
    },
    select: { id: true, organizationId: true },
  });

  for (const reservation of aVenir) {
    await annoncerDansLeFil(
      db,
      reservation.organizationId,
      reservation.id,
      "Le client a mis à jour les consignes du logement. Elles sont sur la mission.",
      "intervenant",
      maintenant,
    );
  }
}

/**
 * Les consignes d'un logement, pour l'intervenant affecté.
 *
 * Volontairement sans vérification d'affectation : l'appelant est l'écran de
 * mission, qui a déjà résolu l'affectation acceptée pour charger la
 * réservation. Redemander ici obligerait à repasser le `cleanerProfileId` dans
 * une fonction qui n'en a pas besoin, et deux vérifications valent moins qu'une
 * seule au bon endroit.
 *
 * Rien de sensible n'y transite de toute façon : le code de porte vit dans
 * `accessSecretEnc` et ne se lit que par `logement/secret.ts`, sous fenêtre
 * temporelle et avec journal des accès.
 */
export function consignesDeLAdresse(brut: unknown): Consignes {
  return brut === null || brut === undefined
    ? CONSIGNES_VIDES
    : lireLesConsignes(brut);
}
