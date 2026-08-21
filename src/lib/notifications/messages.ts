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
    }
  /**
   * Le prélèvement a été refusé.
   *
   * **Trois relances, puis une suspension annoncée** — jamais d'annulation
   * silencieuse, qui ferait découvrir la rupture au client le matin où
   * personne ne vient. Le ton monte avec le rang sans jamais devenir
   * comminatoire : une carte expirée n'est pas une mauvaise foi, et c'est le
   * cas le plus fréquent.
   */
  | {
      type: "prelevement-refuse";
      prenom: string;
      montantCents: number;
      /** 1, 2 ou 3. Le troisième annonce la suspension. */
      rang: number;
      /** Nombre de relances avant suspension, lu du calendrier. */
      avantSuspension: number;
      lienMoyenDePaiement: string;
    }

  /**
   * L'intervenant apprend qu'une mission est gelée.
   *
   * C'est la contrepartie de la promesse faite sur la page d'offre : « vous ne
   * vous déplacez pas pour rien ». Sans ce message, le gel n'existerait que
   * dans une colonne de base et l'intervenant partirait quand même.
   *
   * **Rien n'est dit du client.** Ni son nom de famille, ni le montant, ni
   * depuis quand : ce n'est pas l'affaire de l'intervenant, et la cause la plus
   * fréquente est une carte expirée. Ce qu'il doit savoir tient en deux
   * phrases — ne pas partir, et que ce qu'il a déjà fait lui reste dû.
   */
  | {
      type: "intervention-gelee";
      prenom: string;
      intervention: Intervention;
      lienMission: string;
    }

  /**
   * Au client, quelques jours après une intervention qu'il n'a pas notée.
   *
   * **Envoyé une fois, et une seule.** Une relance qui revient tous les jours
   * n'obtient pas une note, elle obtient un désabonnement. La marque vit sur la
   * réservation, comme celle des relances d'impayé.
   *
   * Le texte demande un service rendu à l'intervenant, pas à nous : c'est vrai,
   * puisque la note décide de qui reviendra chez ce client, et c'est ce qui
   * fait répondre.
   */
  | {
      type: "avis-attendu";
      prenom: string;
      /** Prénom de l'intervenant. Jamais son nom complet. */
      intervenant: string | null;
      intervention: Intervention;
      lienNotation: string;
    }

  /** La situation est réglée, la mission reprend. */
  | {
      type: "intervention-degelee";
      prenom: string;
      intervention: Intervention;
      lienMission: string;
    }

  /**
   * Au client, à la clôture de l'intervention — **avant le prélèvement**.
   *
   * L'ordre n'est pas indifférent : le débit part à H+24, si bien qu'un mail
   * envoyé à la clôture annonce une somme qui n'a pas encore bougé. Il écrit
   * donc « nous prélèverons », au futur, et jamais « nous avons prélevé ».
   * Annoncer un débit déjà fait quand il ne l'est pas ferait chercher sur un
   * relevé une ligne qui n'y est pas — et douter du reste du message.
   *
   * **Le crédit d'impôt n'est pas décidé ici.** `creditImpotCents` vaut `null`
   * tant que `canShowTaxCredit()` l'interdit, et le composeur n'écrit alors pas
   * même le mot. La règle vit dans `fiscal.ts`, seul endroit où cette frontière
   * se tranche ; ce module compose ce qu'on lui donne.
   *
   * **La durée réelle est dite, jamais facturée.** Le dépôt a tranché que le
   * montant reste celui qui a été annoncé. L'écrire ici sans le montant qui va
   * avec évite la question « alors je paie combien ? » — c'est une information
   * de transparence, pas une ligne de facture.
   */
  | {
      type: "intervention-terminee";
      prenom: string;
      intervention: Intervention;
      /** Pointée à l'arrivée et au départ. Dite, jamais refacturée. */
      dureeReelleMinutes: number;
      /** Le rapport photo existe-t-il ? Il n'est jamais bloquant. */
      rapportDisponible: boolean;
      /** Jour du prélèvement, déjà formaté en heure locale par l'appelant. */
      prelevementLe: string;
      /** `null` tant que la déclaration SAP n'est pas obtenue. */
      creditImpotCents: number | null;
      /** Prochain passage d'un abonné, `null` sinon. */
      prochaineIntervention: string | null;
      lienEspace: string;
      lienNotation: string;
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

    case "prelevement-refuse": {
      const montant = new Intl.NumberFormat("fr-FR", {
        style: "currency",
        currency: "EUR",
      }).format(evenement.montantCents / 100);

      const dernier = evenement.rang >= evenement.avantSuspension;

      return {
        objet: dernier
          ? "Votre prochain ménage est suspendu"
          : "Le paiement de votre ménage n'est pas passé",
        apercu: dernier
          ? "Un geste suffit à le rétablir."
          : "Votre banque a refusé le prélèvement.",
        paragraphes: [
          `Bonjour ${evenement.prenom},`,
          /*
           * On dit d'abord ce qui s'est passé et pour combien, avant de
           * demander quoi que ce soit : une relance qui commence par une
           * consigne se lit comme un reproche, et la cause la plus fréquente
           * est une carte expirée.
           */
          `Le prélèvement de ${montant} pour votre ménage a été refusé par votre banque. Le plus souvent, c'est une carte arrivée à expiration.`,
          dernier
            ? "Votre prochaine intervention est suspendue le temps d'y remédier. Elle n'est pas annulée : mettez votre carte à jour et nous la rétablissons — ou appelez-nous, on s'en occupe ensemble."
            : "Mettez votre moyen de paiement à jour et nous représentons le prélèvement. Rien d'autre à faire.",
        ],
        action: {
          libelle: "Mettre à jour ma carte",
          url: evenement.lienMoyenDePaiement,
        },
      };
    }

    case "intervention-gelee":
      return {
        objet: "Une de vos missions est gelée",
        apercu: "Ne vous déplacez pas sans confirmation.",
        paragraphes: [
          `Bonjour ${evenement.prenom},`,
          /*
           * L'instruction d'abord : c'est la seule chose qui change quelque
           * chose à sa journée, et un message qui la noie sous le contexte se
           * lit en diagonale.
           */
          `Cette mission est gelée : ${recap(evenement.intervention, false)} Le paiement du client n'est pas régularisé — ne vous y rendez pas tant que nous ne vous avons pas confirmé qu'elle reprend.`,
          /*
           * Puis ce qui le rassure, et qui est la promesse de la page d'offre :
           * ce qu'il a déjà fait lui est dû. Rien sur le client — ni montant,
           * ni ancienneté : ce n'est pas son affaire, et la cause la plus
           * fréquente est une carte expirée.
           */
          "Rien n'est annulé et votre créneau reste tenu. Ce que vous avez déjà réalisé vous reste dû, quoi qu'il arrive ensuite.",
          "Nous vous prévenons dès que la situation est réglée.",
        ],
        action: { libelle: "Voir la mission", url: evenement.lienMission },
      };

    case "intervention-degelee":
      return {
        objet: "Votre mission reprend",
        apercu: "La situation est réglée.",
        paragraphes: [
          `Bonjour ${evenement.prenom},`,
          `Le paiement a été régularisé : votre mission reprend normalement. ${recap(evenement.intervention, false)}`,
          "Vous n'avez rien à faire de plus — le créneau n'avait pas bougé.",
        ],
        action: { libelle: "Voir la mission", url: evenement.lienMission },
      };

    case "avis-attendu":
      return {
        objet: evenement.intervenant
          ? `Comment s'est passé le ménage avec ${evenement.intervenant} ?`
          : "Comment s'est passé votre ménage ?",
        apercu: "Deux secondes, deux étoiles.",
        paragraphes: [
          `Bonjour ${evenement.prenom},`,
          /*
           * On rappelle laquelle : quelqu'un qui reçoit plusieurs passages par
           * mois ne sait pas de quelle intervention on parle, et la question
           * reste sans réponse faute de savoir quoi noter.
           */
          `Vous avez reçu ${evenement.intervenant ?? "votre intervenant"} ${recap(evenement.intervention, false)}`,
          /*
           * La demande est formulée comme un service rendu à l'intervenant —
           * ce qu'elle est : la note décide de qui reviendra chez ce client.
           */
          "Deux secondes pour le noter ? C'est ce qui permet de vous renvoyer la même personne, et c'est ce qui compte le plus pour elle.",
          "Si quelque chose n'a pas été, dites-le aussi : on rappelle.",
        ],
        action: { libelle: "Noter le passage", url: evenement.lienNotation },
      };

    case "intervention-terminee": {
      const montant = formatEuros(evenement.intervention.grossAmountCents);

      return {
        objet: "Votre ménage est terminé",
        apercu: `Prélèvement de ${montant} le ${evenement.prelevementLe}.`,
        paragraphes: [
          `Bonjour ${evenement.prenom},`,
          /*
           * Ce qui vient de se passer, d'abord. La durée réelle est donnée
           * pour ce qu'elle est — une information — et jamais suivie d'un
           * montant recalculé : le prix reste celui qui a été annoncé.
           */
          `Votre ménage ${evenement.intervention.adresse} est terminé. L'intervention a duré ${formatDuration(evenement.dureeReelleMinutes)} ; le montant convenu ne change pas.`,
          ...(evenement.rapportDisponible
            ? [
                "Les photos avant et après sont dans votre espace : vous pouvez voir ce qui a été fait sans avoir à le demander.",
              ]
            : []),
          /*
           * Le prélèvement, au futur. Il part à H+24 — écrire « nous avons
           * prélevé » ferait chercher sur un relevé une ligne qui n'y est pas.
           */
          `Nous prélèverons ${montant} le ${evenement.prelevementLe}. Rien à faire de votre côté.`,
          /*
           * Le crédit d'impôt n'apparaît que si `fiscal.ts` l'autorise. Tant
           * que la déclaration n'est pas obtenue, pas même le mot.
           */
          ...(evenement.creditImpotCents === null
            ? []
            : [
                `Après crédit d'impôt, cette intervention vous revient à ${formatEuros(evenement.creditImpotCents)}.`,
              ]),
          /*
           * La notation en dernier, et formulée comme un service rendu à
           * l'intervenant plutôt qu'à nous : c'est vrai, et c'est ce qui fait
           * répondre.
           */
          "Deux secondes pour noter le passage ? C'est ce qui permet de vous renvoyer la même personne.",
          ...(evenement.prochaineIntervention === null
            ? []
            : [`Prochain passage prévu ${evenement.prochaineIntervention}.`]),
        ],
        action: { libelle: "Noter le passage", url: evenement.lienNotation },
      };
    }
  }
}
