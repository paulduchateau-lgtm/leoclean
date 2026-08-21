import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import "dotenv/config";

import { formatEuros } from "../src/lib/pricing";
import { STANDARD_SQM_PER_HOUR } from "../src/lib/pricing/public-grid";
import { RATES } from "./socle";

/**
 * Applique la grille publique aux tarifs en base.
 *
 * Le socle ne crée une règle que s'il n'en existe aucune : il installe une base
 * neuve, il ne change pas les prix d'une base vivante. Sans cette commande, une
 * modification de la grille ne toucherait donc que le site — les pages
 * afficheraient 28 € pendant que le tunnel continuerait de chiffrer à 29 €, et
 * personne ne s'en apercevrait avant la première facture.
 *
 * **Rien n'est écrasé.** `PricingRule` est historisée par construction : on
 * ferme la règle en vigueur en lui posant un `validUntil`, et on en ouvre une
 * nouvelle à la même date. Une réservation passée continue de pointer sur le
 * tarif qui l'a chiffrée, et l'on peut expliquer un an plus tard pourquoi telle
 * facture porte tel montant.
 *
 * **Seule la marketplace est touchée.** Une société cliente du SaaS fixe ses
 * propres prix : les siens ne sont pas les nôtres, et les aligner d'office
 * serait décider à sa place.
 *
 * Usage :
 *   npm run db:tarifs                 # montre ce qui changerait
 *   npm run db:tarifs -- --confirmer  # applique
 */

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
});
const prisma = new PrismaClient({ adapter });

const CONFIRME = process.argv.includes("--confirmer");

/** Le supplément des prestations exigeantes va à l'intervenant. */
function cibleFor(
  kind: string,
  rate: { hourlyRateCents: number; professionalHourlyRateCents: number },
) {
  const supplement =
    kind === "MENAGE_REGULIER" || kind === "REPASSAGE" ? 0 : 400;
  return {
    hourlyRateCents: rate.hourlyRateCents + supplement,
    professionalHourlyRateCents: rate.professionalHourlyRateCents + supplement,
  };
}

async function main(): Promise<void> {
  const organization = await prisma.organization.findFirst({
    where: { type: "MARKETPLACE" },
    select: { id: true, name: true },
  });
  if (!organization) {
    throw new Error("Aucune organisation de type MARKETPLACE.");
  }

  let changementsRendement = 0;

  const services = await prisma.service.findMany({
    where: { organizationId: organization.id },
    select: { id: true, slug: true, kind: true, sqmPerHour: true },
  });

  /*
   * Le rendement d'abord, parce qu'il est le piège le plus silencieux du lot.
   * Le tunnel affiche la surface qu'il tire de la grille publique ; le devis
   * serveur, lui, chiffre depuis cette colonne. Les laisser diverger fait
   * afficher « 3 h, idéal pour 100 m² » et facturer quatre heures — sans
   * qu'aucune erreur ne remonte, puisque chacun des deux fait son travail.
   *
   * Seule la prestation d'entretien courant est concernée : le grand ménage et
   * la fin de bail ont leurs propres rendements, qui n'ont pas été arbitrés.
   */
  const standard = services.find((s) => s.kind === "MENAGE_REGULIER");
  if (standard && standard.sqmPerHour !== STANDARD_SQM_PER_HOUR) {
    console.info(
      `  ${standard.slug.padEnd(20)} rendement   ` +
        `${standard.sqmPerHour} → ${STANDARD_SQM_PER_HOUR.toFixed(2)} m²/h`,
    );
    changementsRendement += 1;

    if (CONFIRME) {
      await prisma.service.update({
        where: { id: standard.id },
        data: { sqmPerHour: STANDARD_SQM_PER_HOUR },
      });
    }
  }

  const maintenant = new Date();
  let changements = 0;

  for (const service of services) {
    for (const frequency of Object.keys(RATES) as (keyof typeof RATES)[]) {
      const cible = cibleFor(service.kind, RATES[frequency]);

      const enVigueur = await prisma.pricingRule.findFirst({
        where: {
          organizationId: organization.id,
          serviceId: service.id,
          frequency,
          validFrom: { lte: maintenant },
          OR: [{ validUntil: null }, { validUntil: { gt: maintenant } }],
        },
        orderBy: { validFrom: "desc" },
      });

      const inchange =
        enVigueur &&
        enVigueur.hourlyRateCents === cible.hourlyRateCents &&
        enVigueur.professionalHourlyRateCents ===
          cible.professionalHourlyRateCents;

      if (inchange) continue;

      changements += 1;
      const avant = enVigueur
        ? `${formatEuros(enVigueur.hourlyRateCents)} / ${formatEuros(enVigueur.professionalHourlyRateCents)}`
        : "aucun tarif";
      console.info(
        `  ${service.slug.padEnd(20)} ${frequency.padEnd(10)} ` +
          `${avant}  →  ${formatEuros(cible.hourlyRateCents)} / ${formatEuros(cible.professionalHourlyRateCents)}`,
      );

      if (!CONFIRME) continue;

      await prisma.$transaction(async (tx) => {
        if (enVigueur) {
          await tx.pricingRule.update({
            where: { id: enVigueur.id },
            data: { validUntil: maintenant },
          });
        }
        await tx.pricingRule.create({
          data: {
            organizationId: organization.id,
            serviceId: service.id,
            frequency,
            hourlyRateCents: cible.hourlyRateCents,
            professionalHourlyRateCents: cible.professionalHourlyRateCents,
            taxCreditRateBp: enVigueur?.taxCreditRateBp ?? 5000,
            validFrom: maintenant,
          },
        });
      });
    }
  }

  if (changements === 0 && changementsRendement === 0) {
    console.info(`\n${organization.name} : les tarifs sont déjà à jour.`);
    return;
  }

  const resume = [
    changements > 0 ? `${changements} tarif(s)` : null,
    changementsRendement > 0 ? `${changementsRendement} rendement(s)` : null,
  ]
    .filter(Boolean)
    .join(" et ");

  console.info(
    CONFIRME
      ? `\n${resume} remplacé(s). Les anciens tarifs restent lisibles, fermés à cette date.`
      : `\n${resume} à remplacer. Relancer avec --confirmer pour appliquer.`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
