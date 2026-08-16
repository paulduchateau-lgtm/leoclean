import { describe, expect, it } from "vitest";

import { publishedCommunes } from "@/lib/communes-content";
import {
  FACTS,
  FREE_CANCELLATION_HOURS,
  INTERVENANTS,
  INTERVENANT_PAGE_READY,
  MAX_DRIVE_MINUTES,
  PARRAINAGE,
  PENDING_INTERVENANT_FIELDS,
  canSayGuaranteed,
  netRateLabel,
  netRatePhrase,
} from "@/lib/facts";
import { CANCELLATION_TIERS } from "@/lib/pricing/cancellation";
import { LOWEST_HOURLY_RATE_CENTS } from "@/lib/pricing/public-grid";
import { MAX_REFERRAL_DEPTH, REFERRAL_PROGRAMS } from "@/lib/referral/rules";
import { SITE } from "@/lib/site";
import { COMMUNES } from "@/lib/territory";

describe("chiffres mis en avant", () => {
  it("dérive chaque valeur de son module d'origine", () => {
    // Le bandeau d'accueil rassemble quatre nombres que quatre modules
    // détiennent. S'ils étaient recopiés, la page d'accueil finirait par
    // annoncer un tarif que le tunnel ne facture pas — et rien à l'écran ne le
    // signalerait. C'est la seule raison d'être de ce module.
    expect(FACTS.communeCount).toBe(COMMUNES.length);
    expect(FACTS.lowestHourlyRateCents).toBe(LOWEST_HOURLY_RATE_CENTS);
    expect(FACTS.phone).toBe(SITE.phone);
    expect(FACTS.phoneE164).toBe(SITE.phoneE164);
  });

  it("annonce comme maximum le trajet réellement le plus long", () => {
    // Le brief annonçait « 20 min de route au maximum ». La donnée dit 21 :
    // Saint-Morillon est la commune la plus éloignée. Un chiffre présenté comme
    // un maximum doit en être un, sans quoi la preuve de la thèse est fausse
    // sur la page qui la porte.
    const longest = Math.max(
      ...publishedCommunes().map(
        ({ content }) => content.driveMinutesFromLeognan,
      ),
    );

    expect(MAX_DRIVE_MINUTES).toBe(longest);
    expect(FACTS.maxDriveMinutes).toBe(longest);
    for (const { content } of publishedCommunes()) {
      expect(content.driveMinutesFromLeognan).toBeLessThanOrEqual(
        FACTS.maxDriveMinutes,
      );
    }
  });

  it("reste cohérent avec la prose « une vingtaine de minutes »", () => {
    // L'accueil dit « une vingtaine de minutes » et le bandeau donne la valeur
    // exacte. Les deux ne peuvent coexister que tant que le maximum reste
    // effectivement de l'ordre de vingt minutes : au-delà, ce n'est plus une
    // approximation, c'est une contradiction, et c'est la prose qu'il faudra
    // reprendre — ou le périmètre qu'il faudra discuter.
    expect(FACTS.maxDriveMinutes).toBeGreaterThanOrEqual(15);
    expect(FACTS.maxDriveMinutes).toBeLessThanOrEqual(25);
  });

  it("lit le délai d'annulation gratuite dans le barème", () => {
    // « Annulation gratuite jusqu'à 24 h avant » est à la fois une promesse
    // affichée et une somme prélevée. Les deux viennent du même endroit.
    const free = CANCELLATION_TIERS.find(
      (tier) => tier.rateBp === 0 && tier.capCents === 0,
    );

    expect(free).toBeDefined();
    expect(FREE_CANCELLATION_HOURS).toBe(free!.fromHoursBefore);
    expect(FACTS.freeCancellationHours).toBe(free!.fromHoursBefore);
  });

  it("ne porte aucune métrique d'activité", () => {
    // Nombre de clients, note moyenne, interventions réalisées : tant qu'elles
    // n'existent pas, elles ne sont pas dans ce module, donc pas affichables.
    // Un chiffre d'activité inventé est une pratique commerciale trompeuse au
    // sens de l'article L121-2 du code de la consommation.
    const forbidden = [
      "clientCount",
      "averageRating",
      "ratingCount",
      "reviewCount",
      "interventionCount",
      "satisfactionRate",
    ];

    for (const key of forbidden) {
      expect(Object.keys(FACTS)).not.toContain(key);
    }
  });

  it("garde les avis derrière un drapeau, faux tant qu'il n'y en a pas", () => {
    expect(FACTS.hasReviews).toBe(false);
  });
});

describe("conditions faites aux intervenants", () => {
  it("annonce le même rayon que la page client", () => {
    // C'est la même contrainte, vue de l'autre côté : le client s'entend dire
    // « vingt minutes, donc toujours la même personne », l'intervenant
    // « vingt minutes, donc une journée remplie sans la passer en voiture ».
    // Deux chiffres différents sur les deux faces ruineraient l'argument.
    expect(INTERVENANTS.maxDriveMinutes).toBe(MAX_DRIVE_MINUTES);
    expect(INTERVENANTS.maxDriveMinutes).toBe(FACTS.maxDriveMinutes);
  });

  it("n'écrit pas « garanti » tant que les trois situations sont sans réponse", () => {
    // Le mot n'engage à rien tant qu'on n'a pas dit contre quoi il garantit.
    // On dit alors ce qu'on tient réellement : le délai de versement.
    expect(canSayGuaranteed()).toBe(false);
    expect(netRateLabel()).toBe("net");
    expect(netRateLabel()).not.toContain("garanti");
    expect(netRatePhrase()).not.toContain("garanti");
  });

  it("décrit le versement par son délai réel, pas par une date fixe", () => {
    // Cinq jours ouvrés après l'intervention est un délai. Écrire « à date
    // fixe » décrirait un engagement mensuel qu'on ne prend pas.
    expect(INTERVENANTS.paymentTerms).toBe("sous 5 jours ouvrés");
    expect(netRatePhrase()).toBe("net, versé sous 5 jours ouvrés");
    expect(netRatePhrase()).not.toContain("date fixe");
  });

  it("annonce un net cohérent avec la marge de coordination du dépôt", () => {
    // 18 € nets pour 29 € payés : 38 % de coordination, l'exemple des CGU.
    // Le test tient le rapport, pas le chiffre — si le tarif client bouge, il
    // faudra rouvrir la question plutôt que laisser filer la marge.
    const net = INTERVENANTS.netHourlyRateCents;
    expect(net).not.toBeNull();

    const margin = 1 - net! / LOWEST_HOURLY_RATE_CENTS;
    expect(margin).toBeGreaterThan(0.35);
    expect(margin).toBeLessThan(0.4);
  });

  it("écrit « garanti » dès que les trois ont une réponse", () => {
    const complet = {
      latePayment: "Vous êtes payé à la date prévue.",
      unpaidClient: "L'impayé est porté par Léo Clean.",
      lateCancellation: "Vous percevez la moitié du barème.",
    };
    const manquant = { ...complet, unpaidClient: null };

    // On vérifie la règle, pas l'état du jour : la fonction doit basculer sur
    // la seule condition que les trois champs soient renseignés.
    const regle = (g: Record<string, string | null>) =>
      Object.values(g).every((value) => value !== null);

    expect(regle(complet)).toBe(true);
    expect(regle(manquant)).toBe(false);
  });

  it("tient la page hors de l'index tant qu'une garantie manque", () => {
    // La rémunération et le délai de paiement sont arbitrés ; les trois
    // situations de garantie ne le sont pas. Une page d'offre qui se
    // classerait sans pouvoir dire ce qui se passe en cas d'impayé décevrait
    // précisément les gens qu'elle cherche à convaincre.
    expect(PENDING_INTERVENANT_FIELDS).not.toContain("rémunération nette");
    expect(PENDING_INTERVENANT_FIELDS).not.toContain("délai de paiement");
    expect(PENDING_INTERVENANT_FIELDS).toContain("garantie en cas d'impayé");
    expect(INTERVENANT_PAGE_READY).toBe(false);
  });

  it("ne demande aucune exclusivité et ne facture aucune inscription", () => {
    // Ce ne sont pas des arguments commerciaux : ce sont deux des
    // caractéristiques qui font qu'un indépendant reste indépendant.
    expect(INTERVENANTS.requiresExclusivity).toBe(false);
    expect(INTERVENANTS.signupFeeCents).toBe(0);
  });

  it("exige des clients la même chose que ce qu'il promet aux clients", () => {
    const requirements = INTERVENANTS.requirements.join(" ").toLowerCase();
    for (const piece of ["siret", "responsabilité civile", "identité", "rib"]) {
      expect(requirements).toContain(piece);
    }
  });
});

describe("cooptation entre intervenants", () => {
  it("lit toutes ses valeurs dans le module qui verse réellement", () => {
    // Une page d'offre qui annoncerait douze mois quand la machine en compte
    // six serait démentie au treizième, par la personne la plus fidèle.
    const programme = REFERRAL_PROGRAMS.CLEANER;
    expect(PARRAINAGE.rateBp).toBe(programme.recurringRateBp);
    expect(PARRAINAGE.months).toBe(programme.recurringMonths);
    expect(PARRAINAGE.qualifyingBookings).toBe(
      programme.qualifyingCompletedBookings,
    );
    expect(PARRAINAGE.monthlyCapCents).toBe(programme.monthlyCapCents);
  });

  it("annonce le plafond mensuel, qui est la seule limite du dispositif", () => {
    // Le taire reproduirait exactement l'opacité reprochée aux plateformes
    // nationales. Il existe dans le calcul, il doit donc être sur la page.
    expect(PARRAINAGE.monthlyCapCents).toBeGreaterThan(0);
  });

  it("reste à un seul niveau", () => {
    // Toucher sur les filleuls de ses filleuls ferait dépendre le gain du
    // recrutement opéré par autrui — la définition de la vente à la boule de
    // neige à l'article L.121-15 du code de la consommation.
    expect(PARRAINAGE.depth).toBe(1);
    expect(PARRAINAGE.depth).toBe(MAX_REFERRAL_DEPTH);
  });

  it("verse en espèces, donc en revenu déclarable", () => {
    // C'est ce qui oblige la page à dire que la commission entre dans le
    // chiffre d'affaires du parrain et dans ses plafonds de micro-entreprise.
    expect(PARRAINAGE.rewardKind).toBe("CASH");
  });
});
