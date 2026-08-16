import { describe, expect, it } from "vitest";

import { publishedCommunes } from "@/lib/communes-content";
import { FACTS, FREE_CANCELLATION_HOURS, MAX_DRIVE_MINUTES } from "@/lib/facts";
import { CANCELLATION_TIERS } from "@/lib/pricing/cancellation";
import { LOWEST_HOURLY_RATE_CENTS } from "@/lib/pricing/public-grid";
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
