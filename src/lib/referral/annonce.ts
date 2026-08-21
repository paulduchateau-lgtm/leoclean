import { MAX_REFERRAL_DEPTH, type ReferralProgram } from "./rules";

/**
 * Ce qu'on dit d'un programme de parrainage.
 *
 * Module **pur**. Les phrases sont engendrées depuis le programme, jamais
 * écrites : un plafond recopié dans une page finit par diverger de celui qui
 * s'applique, et c'est exactement le reproche fait aux plateformes nationales.
 *
 * **Le plafond est annoncé.** C'est la seule limite du dispositif, et la taire
 * n'aurait qu'un effet : la faire découvrir au premier versement.
 */

function euros(cents: number): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: cents % 100 === 0 ? 0 : 2,
  }).format(cents / 100);
}

export function reglesLisibles(programme: ReferralProgram): string[] {
  const regles: string[] = [];

  if (programme.oneOffRewardCents > 0) {
    regles.push(
      `Vous recevez ${euros(programme.oneOffRewardCents)} en avoir sur vos prochaines prestations.`,
    );
  }

  if (programme.recurringRateBp > 0) {
    regles.push(
      `Vous touchez ${programme.recurringRateBp / 100} % du chiffre d'affaires de votre filleul pendant ${programme.recurringMonths} mois.`,
    );
    if (programme.monthlyCapCents > 0) {
      regles.push(
        `Le total est plafonné à ${euros(programme.monthlyCapCents)} par mois, tous filleuls confondus.`,
      );
    }
  }

  /*
   * La non-rétroactivité est écrite plutôt que laissée à découvrir au premier
   * versement : les prestations qui ouvrent le droit ne sont pas elles-mêmes
   * commissionnées, et la fenêtre court à partir de celle qui déclenche.
   */
  regles.push(
    programme.qualifyingCompletedBookings === 1
      ? "Le gain est dû dès la première prestation de votre filleul."
      : `Le gain est dû à partir de la ${programme.qualifyingCompletedBookings}ᵉ prestation de votre filleul. Les précédentes ouvrent le droit sans être comptées.`,
  );

  if (programme.refereeDiscountCents > 0) {
    regles.push(
      `Votre filleul reçoit ${euros(programme.refereeDiscountCents)} sur sa première prestation.`,
    );
  }

  regles.push(
    `Un parrainage non concrétisé expire au bout de ${programme.expiryDays} jours.`,
  );

  /*
   * Un seul niveau. Toucher sur les filleuls de ses filleuls ferait dépendre le
   * gain du recrutement opéré par autrui, ce qui est la définition de la vente
   * à la boule de neige à l'article L.121-15 du code de la consommation. La
   * phrase le dit parce que c'est ce qu'un lecteur cherche à vérifier.
   */
  if (MAX_REFERRAL_DEPTH === 1) {
    regles.push(
      "Un seul niveau : vous ne touchez rien sur les filleuls de vos filleuls.",
    );
  }

  return regles;
}
