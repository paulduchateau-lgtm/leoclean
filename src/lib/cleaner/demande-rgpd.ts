import "server-only";

import { BusinessError } from "@/lib/booking/errors";
import { prisma } from "@/lib/db";

/**
 * Les demandes RGPD d'un intervenant.
 *
 * **Elles partent chez un humain, et c'est une différence de fond avec le
 * client.** Un client efface depuis son espace : le module sait quoi
 * neutraliser, et ce qui reste — factures, montants — est détaché de son
 * identité. Un intervenant a émis des factures **en son nom**, encaissé des
 * reversements, signé des chartes, et son SIRET figure sur des pièces que le
 * code de commerce impose de conserver dix ans. Effacer sur simple clic
 * produirait des factures sans émetteur, donc irrégulières.
 *
 * Ce que le produit garantit, c'est que la demande **ne se perde pas** : elle
 * est enregistrée et datée, le délai légal courant à compter de sa réception.
 * Un email n'aurait offert aucune de ces deux garanties.
 */

export class DemandeRefuseeError extends BusinessError {}

export type TypeDemande = "ACCES" | "EFFACEMENT";

/**
 * Dépose une demande.
 *
 * **Recliquer ne crée pas de doublon** : un index unique partiel n'autorise
 * qu'une demande ouverte par personne et par type. Sans lui, quelqu'un
 * d'inquiet en empilerait cinq dans la file de quelqu'un d'autre, et c'est la
 * file qui cesserait d'être lue.
 */
export async function deposerUneDemande(
  organizationId: string,
  userId: string,
  type: TypeDemande,
  message: string | null,
): Promise<{ deja: boolean }> {
  const ouverte = await prisma.demandeRgpd.findFirst({
    where: { userId, type, statut: { in: ["RECUE", "EN_COURS"] } },
    select: { id: true },
  });
  if (ouverte) return { deja: true };

  await prisma.demandeRgpd.create({
    data: {
      organizationId,
      userId,
      type,
      message: message?.trim() || null,
    },
  });

  return { deja: false };
}

export interface DemandeVue {
  type: TypeDemande;
  statut: string;
  deposeeLe: string;
}

/** Les demandes de cette personne, pour que l'écran ne les redemande pas. */
export async function lireMesDemandes(userId: string): Promise<DemandeVue[]> {
  const demandes = await prisma.demandeRgpd.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 10,
    select: { type: true, statut: true, createdAt: true },
  });

  return demandes.map((demande) => ({
    type: demande.type,
    statut: demande.statut,
    deposeeLe: demande.createdAt.toISOString(),
  }));
}

export interface DemandeEnAttente {
  id: string;
  type: TypeDemande;
  statut: string;
  nom: string | null;
  email: string;
  message: string | null;
  deposeeLe: Date;
  /** Jours écoulés : le délai légal est d'un mois à compter de la réception. */
  jours: number;
}

/**
 * La file du back-office, du plus ancien au plus récent.
 *
 * L'ordre n'est pas cosmétique : le délai d'un mois court depuis la réception,
 * et traiter la dernière arrivée en premier laisse expirer celle qui attend.
 */
export async function lireLaFileRgpd(
  maintenant: Date = new Date(),
): Promise<DemandeEnAttente[]> {
  const demandes = await prisma.demandeRgpd.findMany({
    where: { statut: { in: ["RECUE", "EN_COURS"] } },
    orderBy: { createdAt: "asc" },
    take: 50,
    select: {
      id: true,
      type: true,
      statut: true,
      message: true,
      createdAt: true,
      user: { select: { name: true, email: true } },
    },
  });

  return demandes.map((demande) => ({
    id: demande.id,
    type: demande.type,
    statut: demande.statut,
    nom: demande.user.name,
    email: demande.user.email,
    message: demande.message,
    deposeeLe: demande.createdAt,
    jours: Math.floor(
      (maintenant.getTime() - demande.createdAt.getTime()) / 86_400_000,
    ),
  }));
}

/**
 * Clôt une demande.
 *
 * **Une résolution écrite est exigée, y compris pour refuser.** C'est la règle
 * déjà tenue par les réclamations : « on n'a rien fait » est une décision qui
 * se justifie, et qui se relit le jour où la même personne revient — ou le jour
 * où la CNIL demande.
 */
export async function cloreUneDemande(
  id: string,
  statut: "TRAITEE" | "REFUSEE",
  resolution: string,
  traiteeParId: string,
  maintenant: Date = new Date(),
): Promise<void> {
  const texte = resolution.trim();
  if (texte.length < 10) {
    throw new DemandeRefuseeError(
      "Écrivez ce qui a été fait, même si c'est un refus. C'est ce qu'on relira.",
    );
  }

  await prisma.demandeRgpd.update({
    where: { id },
    data: { statut, resolution: texte, traiteeParId, traiteeLe: maintenant },
  });
}
