import "server-only";

import { sendEmail } from "@/lib/email";
import { absoluteUrl } from "@/lib/site";

import { EmailTransactionnel } from "./gabarit";
import { type Evenement, composer } from "./messages";

/**
 * Envoi d'une notification, et ce qu'il ne doit jamais faire.
 *
 * **Une notification qui échoue ne défait pas ce qu'elle annonce.** Un envoi
 * est appelé après l'écriture, hors transaction, et son échec est journalisé
 * sans être propagé : une panne de messagerie ne doit pas annuler une
 * réservation ni faire échouer l'acceptation d'une mission. C'est le seul
 * endroit du dépôt où une erreur est volontairement avalée, et la raison est
 * ici — l'inverse coûterait infiniment plus cher que le message perdu.
 *
 * L'appelant ne l'attend pas non plus : `void notifier(...)` suffit, et c'est
 * ce que font les server actions. Faire patienter un intervenant qui vient
 * d'accepter pendant que quatre emails partent serait payer la lenteur d'un
 * tiers sur le geste le plus pressé du produit.
 */

export interface Destinataire {
  email: string;
  prenom: string;
}

/** Lien vers un espace connecté, absolu — un email n'a pas de base d'URL. */
export function lienEspace(chemin: string): string {
  return absoluteUrl(chemin);
}

export async function notifier(
  destinataire: string,
  evenement: Evenement,
): Promise<void> {
  const message = composer(evenement);

  try {
    await sendEmail({
      to: destinataire,
      subject: message.objet,
      react: EmailTransactionnel({ message }),
      // La version texte est celle qui fait foi : elle est composée à partir
      // des mêmes paragraphes, jamais réécrite à côté.
      text: [
        ...message.paragraphes,
        ...(message.action
          ? [`${message.action.libelle} : ${message.action.url}`]
          : []),
        "—",
        "Léo Clean, ménage à domicile au sud de Bordeaux.",
      ].join("\n\n"),
    });
  } catch (error) {
    console.error(
      `Notification « ${evenement.type} » non envoyée à ${destinataire}`,
      error,
    );
  }
}

/**
 * Envoie plusieurs notifications sans qu'un échec n'arrête les suivantes.
 *
 * Le cas type est la diffusion : cinq intervenants à prévenir, et une adresse
 * invalide parmi eux ne doit pas priver les quatre autres de la mission.
 */
export async function notifierPlusieurs(
  envois: readonly { destinataire: string; evenement: Evenement }[],
): Promise<void> {
  await Promise.allSettled(
    envois.map(({ destinataire, evenement }) =>
      notifier(destinataire, evenement),
    ),
  );
}
