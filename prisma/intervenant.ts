import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import "dotenv/config";

import { getCommuneBySlug } from "../src/lib/territory";

/**
 * Enregistrement d'un intervenant, à la main.
 *
 * Il n'existe pas encore d'espace intervenant — c'est la phase 8 — et une
 * plateforme sans personne à envoyer ne propose aucun créneau. Cette commande
 * comble l'intervalle : elle crée un intervenant réel, avec son adresse de
 * départ et ses heures déclarées, exactement comme le fera l'inscription.
 *
 * **Ce n'est pas une donnée de démonstration.** Sur le site en production,
 * tout intervenant actif est réservable par un visiteur : les créneaux qu'il
 * ouvre sont de vrais créneaux, qu'une vraie personne devra honorer. C'est
 * pourquoi la commande demande une confirmation explicite plutôt que de
 * s'exécuter sur une simple invocation.
 *
 * Usage :
 *   npm run db:intervenant -- --prenom Ambre --nom Duchâteau \
 *     --email ambre@exemple.fr --commune leognan --confirmer
 */

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL est absente.");
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

/** Lecture d'un argument `--clé valeur`. */
function argument(nom: string): string | undefined {
  const index = process.argv.indexOf(`--${nom}`);
  return index === -1 ? undefined : process.argv[index + 1];
}

/**
 * Heures déclarées par défaut.
 *
 * Du lundi au vendredi de 9 h à 17 h, heure locale — les horaires annoncés sur
 * le site vont de 8 h à 19 h, mais on n'ouvre pas pour quelqu'un des plages
 * qu'il n'a pas choisies. Elles se modifieront depuis l'espace intervenant.
 */
const HEURES_PAR_DEFAUT = [1, 2, 3, 4, 5].map((weekday) => ({
  weekday,
  startMinute: 9 * 60,
  endMinute: 17 * 60,
}));

async function main(): Promise<void> {
  const prenom = argument("prenom");
  const nom = argument("nom");
  const email = argument("email");
  const communeSlug = argument("commune") ?? "leognan";
  const rue = argument("rue") ?? "place Joane";
  const confirme = process.argv.includes("--confirmer");

  if (!prenom || !nom || !email) {
    throw new Error(
      "Arguments attendus : --prenom, --nom, --email. " +
        "Facultatifs : --commune (défaut leognan), --rue.",
    );
  }

  const commune = getCommuneBySlug(communeSlug);
  if (!commune) {
    throw new Error(`Commune inconnue dans le référentiel : ${communeSlug}`);
  }

  const organization = await prisma.organization.findFirst({
    where: { type: "MARKETPLACE" },
    select: { id: true, name: true },
  });
  if (!organization) {
    throw new Error(
      "Aucune organisation MARKETPLACE : lancer d'abord `npm run db:init`.",
    );
  }

  const hote = new URL(connectionString!).host;

  if (!confirme) {
    console.log(
      [
        "",
        `Base           : ${hote}`,
        `Organisation   : ${organization.name}`,
        `Intervenant    : ${prenom} ${nom} <${email}>`,
        `Départ         : ${rue}, ${commune.postalCode} ${commune.name}`,
        `Heures         : lundi au vendredi, 9 h – 17 h`,
        "",
        "Cet intervenant sera ACTIF, donc réservable par un visiteur : les",
        "créneaux qu'il ouvre devront être honorés par une vraie personne.",
        "",
        "Relancer avec --confirmer pour l'enregistrer.",
        "",
      ].join("\n"),
    );
    return;
  }

  const adresseEmail = email.trim().toLowerCase();

  const user = await prisma.user.upsert({
    where: { email: adresseEmail },
    create: { email: adresseEmail, name: `${prenom} ${nom}` },
    update: {},
    select: { id: true },
  });

  const existant = await prisma.cleanerProfile.findUnique({
    where: {
      organizationId_userId: {
        organizationId: organization.id,
        userId: user.id,
      },
    },
    select: { id: true },
  });

  if (existant) {
    console.log(`${prenom} ${nom} est déjà enregistrée. Rien à faire.`);
    return;
  }

  const adresse = await prisma.address.create({
    data: {
      organizationId: organization.id,
      street: rue,
      postalCode: commune.postalCode,
      cityName: commune.name,
      inseeCode: commune.insee,
      lat: commune.lat,
      lng: commune.lng,
    },
    select: { id: true },
  });

  const cleaner = await prisma.cleanerProfile.create({
    data: {
      organizationId: organization.id,
      userId: user.id,
      // On ne publie jamais le nom complet : le client voit un prénom.
      displayName: prenom,
      status: "ACTIVE",
      employmentType: "INDEPENDENT",
      homeAddressId: adresse.id,
      maxTravelMinutes: 30,
      activatedAt: new Date(),
    },
    select: { id: true },
  });

  for (const regle of HEURES_PAR_DEFAUT) {
    await prisma.availabilityRule.create({
      data: {
        organizationId: organization.id,
        cleanerProfileId: cleaner.id,
        weekday: regle.weekday,
        startMinute: regle.startMinute,
        endMinute: regle.endMinute,
        validFrom: new Date(Date.UTC(2026, 0, 1)),
      },
    });
  }

  console.log(
    [
      `${prenom} ${nom} est enregistrée sur ${hote}.`,
      `  profil  : ${cleaner.id}`,
      `  départ  : ${rue}, ${commune.postalCode} ${commune.name}`,
      `  heures  : lundi au vendredi, 9 h – 17 h`,
      "",
      "Le tunnel proposera désormais ses créneaux.",
    ].join("\n"),
  );
}

main()
  .catch((error: unknown) => {
    console.error(
      "Enregistrement interrompu :",
      error instanceof Error ? error.message : error,
    );
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
