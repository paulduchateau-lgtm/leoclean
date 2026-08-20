import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import "dotenv/config";

import { getCommuneBySlug } from "../src/lib/territory";

/**
 * Attribue des rôles à un compte existant.
 *
 * **Pourquoi cette commande existe.** Le dépôt a choisi qu'une adresse inconnue
 * crée un compte **sans aucune appartenance**, le rattachement se faisant à la
 * première réservation. C'est la bonne règle en production — un compte sans
 * organisation ne voit rien — mais elle rend les espaces connectés
 * inatteignables sur un environnement de test : on se connecte, et
 * `/intervenant` répond « cet espace n'est pas le vôtre », `/administration`
 * répond 404.
 *
 * `db:utilisateurs-test` règle le cas en créant cinq comptes nominatifs. Il ne
 * règle pas celui-ci : quelqu'un qui se connecte avec **sa propre adresse**, ou
 * par Google, n'y figure pas.
 *
 * **Elle refuse en production**, et ce n'est pas une précaution de forme :
 * accorder `PLATFORM_ADMIN` ouvre la lecture de toutes les organisations, donc
 * de tous les clients. Une commande qui le fait n'a rien à faire près de vraies
 * données.
 *
 * Usage :
 *   npm run db:roles -- vous@exemple.fr --admin
 *   npm run db:roles -- vous@exemple.fr --intervenant --commune=leognan
 *   npm run db:roles -- vous@exemple.fr --admin --intervenant --client
 */

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

function argument(nom: string): string | null {
  const trouve = process.argv.find((valeur) => valeur.startsWith(`--${nom}=`));
  return trouve ? (trouve.split("=")[1] ?? null) : null;
}

const drapeau = (nom: string) => process.argv.includes(`--${nom}`);

async function main(): Promise<void> {
  if (process.env.NEXT_PUBLIC_ENVIRONMENT === "production") {
    throw new Error(
      "Refus : cette commande accorde des droits d'administration, qui ouvrent " +
        "la lecture de toutes les organisations. Elle n'a rien à faire en production.",
    );
  }

  const email = process.argv[2]?.trim().toLowerCase();
  if (!email || email.startsWith("--")) {
    throw new Error(
      "Indiquez l'adresse email du compte.\n" +
        "  npm run db:roles -- vous@exemple.fr --admin --intervenant",
    );
  }

  const admin = drapeau("admin");
  const intervenant = drapeau("intervenant");
  const client = drapeau("client");

  if (!admin && !intervenant && !client) {
    throw new Error(
      "Indiquez au moins un rôle : --admin, --intervenant, --client.",
    );
  }

  const organization = await prisma.organization.findFirst({
    where: { type: "MARKETPLACE" },
    select: { id: true, name: true },
  });
  if (!organization) {
    throw new Error(
      "Aucune organisation de type MARKETPLACE. Lancer `npm run db:init` d'abord.",
    );
  }

  const utilisateur = await prisma.user.findUnique({
    where: { email },
    select: { id: true, name: true },
  });
  if (!utilisateur) {
    throw new Error(
      `Aucun compte pour ${email}. Connectez-vous une fois sur le site — le ` +
        "compte se crée au premier lien de connexion — puis relancez.",
    );
  }

  const faits: string[] = [];

  /*
   * `Membership` porte `@@unique([userId, organizationId])` : une personne
   * n'occupe **qu'un rôle par organisation**, et les rôles ne sont pas
   * hiérarchisés — `PLATFORM_ADMIN` ne détient pas `assignment:respond:own`,
   * précisément pour qu'un rôle de gestion ne réponde pas à une mission à la
   * place de quelqu'un.
   *
   * Demander deux rôles suppose donc deux identités. On accorde le plus large
   * et on le dit, plutôt que d'écraser en silence.
   */
  const role = admin ? "PLATFORM_ADMIN" : intervenant ? "CLEANER" : "CLIENT";

  await prisma.membership.upsert({
    where: {
      userId_organizationId: {
        userId: utilisateur.id,
        organizationId: organization.id,
      },
    },
    update: { role, status: "ACTIVE" },
    create: {
      userId: utilisateur.id,
      organizationId: organization.id,
      role,
      status: "ACTIVE",
    },
  });
  faits.push(`appartenance ${role} sur ${organization.name}`);

  if (admin && (intervenant || client)) {
    faits.push(
      "⚠ un seul rôle par organisation : PLATFORM_ADMIN a été retenu.\n" +
        "     Pour cumuler, employez une seconde adresse — c'est ce que fait\n" +
        "     `npm run db:utilisateurs-test` avec l'adressage plus de Gmail.",
    );
  }

  if (intervenant && !admin) {
    const communeSlug = argument("commune") ?? "leognan";
    const commune = getCommuneBySlug(communeSlug);
    if (!commune) {
      throw new Error(`Commune inconnue : ${communeSlug}.`);
    }

    const existant = await prisma.cleanerProfile.findFirst({
      where: { userId: utilisateur.id, organizationId: organization.id },
      select: { id: true },
    });

    if (!existant) {
      const adresse = await prisma.address.create({
        data: {
          organizationId: organization.id,
          street: `Mairie de ${commune.name}`,
          postalCode: commune.postalCode,
          cityName: commune.name,
          inseeCode: commune.insee,
          lat: commune.lat,
          lng: commune.lng,
        },
        select: { id: true },
      });

      await prisma.cleanerProfile.create({
        data: {
          organizationId: organization.id,
          userId: utilisateur.id,
          displayName: utilisateur.name?.split(" ")[0] ?? "Intervenant",
          status: "ACTIVE",
          activatedAt: new Date(),
          homeAddressId: adresse.id,
        },
      });
      faits.push(`profil d'intervenant, départ de tournée à ${commune.name}`);
    } else {
      faits.push("profil d'intervenant déjà présent");
    }
  }

  if (client && !admin) {
    const existant = await prisma.clientProfile.findFirst({
      where: { userId: utilisateur.id, organizationId: organization.id },
      select: { id: true },
    });
    if (!existant) {
      await prisma.clientProfile.create({
        data: { organizationId: organization.id, userId: utilisateur.id },
      });
      faits.push("profil client");
    } else {
      faits.push("profil client déjà présent");
    }
  }

  console.log(`\n${email} :`);
  for (const fait of faits) console.log(`  · ${fait}`);
  console.log("");
}

main()
  .catch((error: unknown) => {
    console.error(`\n✖ ${error instanceof Error ? error.message : error}\n`);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
