import "server-only";

import { BusinessError } from "@/lib/booking/errors";
import type { TenantClient } from "@/lib/db";
import { prisma } from "@/lib/db";
import { isValidFrenchPhone, normalizePhone } from "@/lib/phone";

/**
 * Les informations personnelles d'un client.
 *
 * Ce que la personne peut corriger elle-même, et rien de plus : le nom et le
 * téléphone. **Les adresses ne s'éditent pas ici** — une adresse porte des
 * coordonnées géocodées, des consignes d'accès et un code de porte chiffré, et
 * la modifier hors du parcours qui les collecte produirait une adresse dont le
 * point géographique ne correspond plus au texte. Le moteur calculerait alors
 * des trajets vers un endroit où personne n'habite.
 */

export class InformationsRefuseesError extends BusinessError {}

export interface InformationsVue {
  nom: string | null;
  /** Portrait choisi par le client, ou `null`. */
  photoUrl: string | null;
  email: string;
  telephone: string | null;
  adresses: {
    id: string;
    libelle: string | null;
    ligne: string;
    commune: string;
    /** Nombre de réservations qui la désignent : une adresse employée reste. */
    utilisations: number;
  }[];
}

export async function lireLesInformations(
  db: TenantClient,
  userId: string,
): Promise<InformationsVue | null> {
  const utilisateur = await prisma.user.findUnique({
    where: { id: userId },
    select: { name: true, email: true },
  });
  if (!utilisateur) return null;

  const profil = await db.clientProfile.findFirst({
    where: { userId },
    select: {
      phone: true,
      photoUrl: true,
      addresses: {
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          label: true,
          street: true,
          postalCode: true,
          cityName: true,
          _count: { select: { bookings: true } },
        },
      },
    },
  });

  return {
    nom: utilisateur.name,
    photoUrl: profil?.photoUrl ?? null,
    email: utilisateur.email,
    telephone: profil?.phone ?? null,
    adresses: (profil?.addresses ?? []).map((adresse) => ({
      id: adresse.id,
      libelle: adresse.label,
      ligne: adresse.street,
      commune: `${adresse.postalCode} ${adresse.cityName}`,
      utilisations: adresse._count.bookings,
    })),
  };
}

/**
 * Enregistre le nom et le téléphone.
 *
 * Le numéro est **normalisé avant d'être validé**, jamais l'inverse : le
 * formulaire accepte `+33 6.84.36.38.62` comme `06 84 36 38 62`, parce que
 * refuser une forme valide ferait perdre un contact pour une raison
 * incompréhensible. C'est la même règle que le formulaire de rappel, et elle
 * s'était déjà retournée une fois pour avoir été appliquée à l'envers.
 *
 * **L'adresse email ne se change pas ici.** Elle est l'identifiant du compte et
 * le destinataire des liens de connexion : la modifier sur simple saisie
 * permettrait de détourner un compte depuis un poste laissé ouvert. Le jour où
 * ce sera nécessaire, il faudra vérifier la nouvelle adresse avant de basculer.
 */
export async function enregistrerLesInformations(
  db: TenantClient,
  userId: string,
  input: { nom: string; telephone: string | null },
): Promise<void> {
  const nom = input.nom.trim();
  if (nom.length < 2) {
    throw new InformationsRefuseesError("Indiquez votre nom.");
  }

  let telephone: string | null = null;
  if (input.telephone && input.telephone.trim().length > 0) {
    telephone = normalizePhone(input.telephone);
    if (!isValidFrenchPhone(telephone)) {
      throw new InformationsRefuseesError(
        "Ce numéro ne semble pas être un numéro français.",
      );
    }
  }

  await prisma.user.update({ where: { id: userId }, data: { name: nom } });

  /*
   * Le téléphone vit sur le profil client, pas sur l'utilisateur : c'est le
   * numéro auquel l'intervenant appelle pour cette prestation, et une personne
   * peut être cliente de plusieurs organisations.
   */
  await db.clientProfile.updateMany({
    where: { userId },
    data: { phone: telephone },
  });
}

/**
 * Retire une adresse du carnet.
 *
 * **Refusée si une réservation la désigne**, et pas seulement une réservation à
 * venir : la comptabilité rattache une facture à une prestation, qui se tient à
 * une adresse. La supprimer laisserait des factures sans lieu, ce que la
 * conservation de dix ans du code de commerce interdit — c'est la même limite
 * que celle annoncée au droit à l'effacement.
 */
export async function retirerUneAdresse(
  db: TenantClient,
  userId: string,
  addressId: string,
): Promise<void> {
  const adresse = await db.address.findFirst({
    where: { id: addressId, clientProfile: { userId } },
    select: { id: true, _count: { select: { bookings: true } } },
  });

  if (!adresse) {
    throw new InformationsRefuseesError("Cette adresse est introuvable.");
  }
  if (adresse._count.bookings > 0) {
    throw new InformationsRefuseesError(
      "Des interventions ont eu lieu à cette adresse : elle est conservée avec leurs factures. Vous pouvez demander l'effacement de votre compte depuis « Mes données ».",
    );
  }

  await db.address.delete({ where: { id: adresse.id } });
}
