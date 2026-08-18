import { formatDuration, formatEuros } from "@/lib/pricing";
import { PREMIER_LOT_HEURES } from "@/lib/assignments/diffusion";

/**
 * Ce que le produit dit, et à qui.
 *
 * Module **pur** : il compose des messages, il n'en envoie aucun. Le contenu
 * d'un email est du texte soumis à des règles — ne jamais nommer quelqu'un qui
 * n'a pas accepté, ne jamais annoncer une heure comme acquise tant qu'elle ne
 * l'est pas — et ces règles se vérifient sans monter de serveur de messagerie.
 *
 * **Un seul email partait du produit avant celui-ci** : le lien de connexion.
 * Un intervenant ne savait qu'on l'attendait que s'il ouvrait son espace, et un
 * client n'avait de sa réservation que l'écran qu'il venait de quitter. C'est
 * l'écart le plus visible du dehors, et le moins coûteux à combler.
 *
 * **Le texte brut fait foi.** Chaque message porte sa version texte, celle que
 * lisent les clients de messagerie qui refusent le HTML et les lecteurs
 * d'écran. Le gabarit visuel en découle, jamais l'inverse : un message dont la
 * version texte serait incompréhensible est un message mal écrit.
 */

export interface Intervention {
  /** Début, déjà formaté en heure locale française par l'appelant. */
  quand: string;
  durationMinutes: number;
  adresse: string;
  grossAmountCents: number;
}

export type Evenement =
  /** Au client, dès que sa demande est enregistrée et diffusée. */
  | { type: "demande-recue"; prenom: string; intervention: Intervention }
  /** À chaque intervenant du lot. */
  | {
      type: "mission-proposee";
      prenom: string;
      intervention: Intervention;
      remunerationCents: number;
      lienEspace: string;
    }
  /** Au client, quand quelqu'un a accepté. */
  | {
      type: "intervenant-trouve";
      prenom: string;
      intervenant: string;
      intervention: Intervention;
    }
  /** Aux autres intervenants du lot, qui ont perdu la course. */
  | { type: "mission-prise"; prenom: string; intervention: Intervention }
  /** Au client, quand le premier lot n'a rien donné. */
  | { type: "recherche-elargie"; prenom: string; intervention: Intervention }
  /** Au client, quand des horaires alternatifs l'attendent. */
  | {
      type: "alternatives-disponibles";
      prenom: string;
      nombre: number;
      lienEspace: string;
    }
  /** Au client, au bout d'une semaine sans intervenant. */
  | {
      type: "recherche-interrompue";
      prenom: string;
      telephone: string;
      alternatives: number;
      lienEspace: string;
    }
  /** La veille, aux deux. */
  | {
      type: "rappel-veille";
      prenom: string;
      pour: "client" | "intervenant";
      intervention: Intervention;
    };

export interface Message {
  objet: string;
  /** Ligne d'aperçu des boîtes de réception. */
  apercu: string;
  paragraphes: string[];
  action?: { libelle: string; url: string };
}

/**
 * Le récapitulatif d'une intervention, avec ou sans son prix.
 *
 * **Un intervenant ne lit pas le prix client dans sa proposition.** Le chiffre
 * qui l'engage est sa rémunération ; poser les deux côte à côte dans le même
 * message invite à calculer une marge sur un coin d'email, alors que la page
 * d'offre l'explique en toutes lettres. La transparence n'est pas de tout
 * mettre partout, c'est de dire chaque chose là où elle se comprend.
 */
function recap(intervention: Intervention, avecPrix = true): string {
  const base =
    `${intervention.quand}, ${formatDuration(intervention.durationMinutes)} ` +
    `au ${intervention.adresse}`;
  return avecPrix
    ? `${base}, ${formatEuros(intervention.grossAmountCents)}.`
    : `${base}.`;
}

export function composer(evenement: Evenement): Message {
  switch (evenement.type) {
    case "demande-recue":
      return {
        objet: "Votre demande de ménage est enregistrée",
        apercu: `Nous cherchons votre intervenant, réponse sous ${PREMIER_LOT_HEURES} heures.`,
        paragraphes: [
          `Bonjour ${evenement.prenom},`,
          `Votre demande est enregistrée : ${recap(evenement.intervention)}`,
          /*
           * On annonce une recherche, pas un rendez-vous. Le tunnel ne vend
           * plus un créneau ferme : la mission vient d'être proposée à
           * plusieurs intervenants, et aucun n'a encore accepté. Écrire
           * « c'est confirmé » ici serait la promesse la plus coûteuse du
           * produit, celle qu'on découvre fausse le jour du ménage.
           */
          `Nous l'avons proposée aux intervenants les plus proches de chez vous. Dès que l'un d'eux l'accepte, nous vous prévenons — en général sous ${PREMIER_LOT_HEURES} heures.`,
          "Si personne n'est disponible à cette heure exacte, nous élargissons la recherche et nous vous tenons au courant. Vous n'avez rien à faire.",
        ],
      };

    case "mission-proposee":
      return {
        objet: `Une mission vous est proposée — ${evenement.intervention.quand}`,
        apercu: `${formatEuros(evenement.remunerationCents)} pour ${formatDuration(evenement.intervention.durationMinutes)}.`,
        paragraphes: [
          `Bonjour ${evenement.prenom},`,
          `Une mission vous est proposée : ${recap(evenement.intervention, false)}`,
          `Votre rémunération : ${formatEuros(evenement.remunerationCents)}.`,
          /*
           * On dit que d'autres l'ont reçue. Le taire donnerait à croire que la
           * mission attend sagement une réponse, et transformerait la course en
           * mauvaise surprise pour celui qui répond le second.
           */
          `Elle est proposée à plusieurs intervenants : le premier qui accepte l'obtient. Vous avez ${PREMIER_LOT_HEURES} heures pour répondre.`,
        ],
        action: { libelle: "Voir la mission", url: evenement.lienEspace },
      };

    case "intervenant-trouve":
      return {
        objet: "C'est confirmé, votre intervenant est trouvé",
        apercu: `${evenement.intervenant} vient chez vous ${evenement.intervention.quand}.`,
        paragraphes: [
          `Bonjour ${evenement.prenom},`,
          `${evenement.intervenant} a accepté votre demande : ${recap(evenement.intervention)}`,
          "Vous pouvez lui écrire depuis votre espace si vous avez une consigne d'accès à préciser.",
        ],
      };

    case "mission-prise":
      return {
        objet: "Cette mission a été prise par quelqu'un d'autre",
        apercu: "Elle ne vous est plus proposée.",
        paragraphes: [
          `Bonjour ${evenement.prenom},`,
          `La mission du ${evenement.intervention.quand} a été acceptée par un autre intervenant avant vous. Elle ne vous est plus proposée.`,
          /*
           * Aucun reproche, aucune formule d'excuse : la personne n'a rien fait
           * de mal, et son taux d'acceptation n'en souffre pas — la course
           * perdue est enregistrée comme telle, jamais comme un refus.
           */
          "Cela n'affecte en rien les missions qui vous seront proposées ensuite.",
        ],
      };

    case "recherche-elargie":
      return {
        objet: "Nous cherchons toujours pour votre ménage",
        apercu: "Nous élargissons à tous les intervenants du secteur.",
        paragraphes: [
          `Bonjour ${evenement.prenom},`,
          `Personne n'a pu prendre votre créneau du ${evenement.intervention.quand} dans les premières ${PREMIER_LOT_HEURES} heures.`,
          "Nous ne vous avons pas oublié : la demande est maintenant proposée à tous les intervenants du secteur. Nous vous écrivons dès que l'un d'eux accepte.",
        ],
      };

    case "alternatives-disponibles":
      return {
        objet: "Un autre horaire vous est proposé",
        apercu:
          evenement.nombre > 1
            ? `${evenement.nombre} intervenants proposent une autre heure.`
            : "Un intervenant propose une autre heure.",
        paragraphes: [
          `Bonjour ${evenement.prenom},`,
          evenement.nombre > 1
            ? `${evenement.nombre} intervenants sont disponibles pour votre ménage, mais à une autre heure que celle que vous aviez choisie.`
            : "Un intervenant est disponible pour votre ménage, mais à une autre heure que celle que vous aviez choisie.",
          /*
           * Les deux options sont présentées à égalité. Pousser vers
           * l'alternative reviendrait à faire payer au client la difficulté
           * qu'on a à couvrir son créneau.
           */
          "Vous pouvez accepter l'un de ces horaires, ou nous demander de continuer à chercher votre heure exacte — dans ce cas les propositions restent valables, vous pourrez y revenir plus tard.",
        ],
        action: { libelle: "Choisir", url: evenement.lienEspace },
      };

    case "recherche-interrompue":
      return {
        objet: "Nous n'avons pas trouvé d'intervenant",
        apercu: "Appelez-nous, nous trouvons souvent une solution.",
        paragraphes: [
          `Bonjour ${evenement.prenom},`,
          "Après une semaine de recherche, aucun intervenant n'a pu prendre votre créneau. Nous cessons de chercher automatiquement, et nous préférons vous le dire plutôt que de vous laisser attendre.",
          evenement.alternatives > 0
            ? "Des horaires alternatifs vous avaient été proposés : ils restent acceptables depuis votre espace."
            : `Le plus simple est de nous appeler au ${evenement.telephone} : nous trouvons souvent une solution qu'un moteur ne trouve pas.`,
        ],
        action: { libelle: "Voir ma demande", url: evenement.lienEspace },
      };

    case "rappel-veille":
      return evenement.pour === "client"
        ? {
            objet: `Rappel : votre ménage ${evenement.intervention.quand}`,
            apercu: "C'est demain.",
            paragraphes: [
              `Bonjour ${evenement.prenom},`,
              `Petit rappel : ${recap(evenement.intervention)}`,
              "Si vous devez annuler, faites-le depuis votre espace — le barème dépend du délai, et il est plus favorable maintenant qu'au dernier moment.",
            ],
          }
        : {
            objet: `Rappel : mission ${evenement.intervention.quand}`,
            apercu: "C'est demain.",
            paragraphes: [
              `Bonjour ${evenement.prenom},`,
              `Petit rappel : ${recap(evenement.intervention, false)}`,
              "Si quelque chose vous empêche d'y aller, prévenez-nous au plus tôt : plus c'est tôt, plus nous avons de chances de trouver un remplaçant.",
            ],
          };
  }
}
