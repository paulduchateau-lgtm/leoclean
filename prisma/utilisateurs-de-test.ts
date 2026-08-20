import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import "dotenv/config";

import { hacher } from "../src/lib/auth/mot-de-passe";
import { quote } from "../src/lib/pricing";
import { getCommuneBySlug } from "../src/lib/territory";

/**
 * Comptes de test nominatifs, pour parcourir les espaces connectés.
 *
 * Les trois espaces — client, intervenant, back-office — n'étaient jusqu'ici
 * atteignables par personne : le seed ne crée que des identités fictives dont
 * on ne reçoit pas les liens de connexion. Cette commande installe des comptes
 * dont les emails arrivent dans une vraie boîte.
 *
 * **Une adresse par compte, et pourtant une seule boîte.** `User.email` est
 * unique — quatre comptes ne peuvent pas partager une adresse. L'adressage plus
 * de Gmail règle le problème sans rien changer au schéma :
 * `paul.duchateau+ambre@gmail.com` est une identité distincte pour la base, et
 * le même dossier de réception pour un humain.
 *
 * **Ambre a deux comptes, et ce n'est pas une facilité.** `Membership` porte
 * `@@unique([userId, organizationId])` — une personne n'occupe qu'un rôle par
 * organisation — et les rôles ne sont pas hiérarchisés : `PLATFORM_ADMIN` ne
 * détient pas `assignment:respond:own`, précisément pour qu'un rôle de gestion
 * ne puisse pas répondre à une mission à la place de quelqu'un. Être
 * administratrice *et* intervenante suppose donc deux identités, ce qui est la
 * traduction fidèle du modèle plutôt qu'un contournement.
 *
 * **Elle ne détruit rien** et se relance sans dommage : tout est adressé par
 * email ou reconstruit à l'identique. Contrairement à `prisma/seed.ts`, qui
 * tronque toutes les tables, elle est sûre sur une base peuplée — et c'est le
 * seul moyen d'ajouter ces comptes à la base de dev sans perdre son contenu.
 *
 * Usage :
 *   npm run db:utilisateurs-test
 */

const BOITE = "paul.duchateau";
const DOMAINE = "gmail.com";

/**
 * Mot de passe commun aux cinq comptes.
 *
 * Il est **écrit en clair dans le dépôt**, et c'est assumé : son intérêt est
 * précisément qu'on puisse le lire ici plutôt que le retrouver quelque part.
 * C'est aussi ce qui rend la garde ci-dessous non négociable — un mot de passe
 * public ne doit jamais ouvrir de vraies données clients.
 */
const MOT_DE_PASSE = "leoclean-demo-2026";

/** Adresse plus, qui arrive dans la boîte ci-dessus. */
function adresse(tag: string | null): string {
  return tag === null ? `${BOITE}@${DOMAINE}` : `${BOITE}+${tag}@${DOMAINE}`;
}

interface CompteVoulu {
  tag: string | null;
  nom: string;
  role: "PLATFORM_ADMIN" | "CLEANER" | "CLIENT";
  /** Commune de résidence, pour les intervenants. */
  commune?: string;
}

const COMPTES: readonly CompteVoulu[] = [
  { tag: null, nom: "Paul Duchateau", role: "PLATFORM_ADMIN" },
  { tag: "ambre-admin", nom: "Ambre Duchateau", role: "PLATFORM_ADMIN" },
  {
    tag: "ambre",
    nom: "Ambre Duchateau",
    role: "CLEANER",
    commune: "leognan",
  },
  {
    tag: "micheline",
    nom: "Micheline Proprette",
    role: "CLEANER",
    commune: "gradignan",
  },
  { tag: "michel", nom: "Michel Crado", role: "CLIENT" },
];

/** Heures déclarées : du lundi au vendredi, 9 h – 17 h, heure locale. */
const SEMAINE_TYPE = [1, 2, 3, 4, 5].map((weekday) => ({
  weekday,
  startMinute: 9 * 60,
  endMinute: 17 * 60,
}));

const TAMPON_TRAJET_MINUTES = 15;

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
});
const prisma = new PrismaClient({ adapter });

async function main(): Promise<void> {
  /*
   * Garde-fou, au même titre que celui de `prisma/seed.ts` sur le nom de base.
   * Cette commande pose un mot de passe connu de tous sur des comptes
   * administrateurs : en production, elle ouvrirait le back-office à quiconque
   * a lu ce fichier. Elle refuse donc, plutôt que d'avertir.
   */
  if (process.env.NEXT_PUBLIC_ENVIRONMENT === "production") {
    throw new Error(
      "Refus : cette commande installe un mot de passe public sur des comptes " +
        "administrateurs. Elle n'a rien à faire en production.",
    );
  }

  const organization = await prisma.organization.findFirst({
    where: { type: "MARKETPLACE" },
  });
  if (!organization) {
    throw new Error(
      "Aucune organisation de type MARKETPLACE. Lancer `npm run db:init` d'abord.",
    );
  }

  const service = await prisma.service.findFirst({
    where: { organizationId: organization.id, kind: "MENAGE_REGULIER" },
  });
  const rule = service
    ? await prisma.pricingRule.findFirst({
        where: {
          organizationId: organization.id,
          serviceId: service.id,
          frequency: "WEEKLY",
        },
      })
    : null;
  if (!service || !rule) {
    throw new Error(
      "Catalogue ou grille tarifaire absents. Lancer `npm run db:init` d'abord.",
    );
  }

  const cleanerProfileIds: Record<string, string> = {};
  let clientProfileId: string | null = null;
  let clientAddressId: string | null = null;

  for (const compte of COMPTES) {
    const email = adresse(compte.tag);

    /*
     * L'empreinte est dérivée à chaque compte plutôt qu'une fois pour toutes :
     * le sel doit différer, sinon deux comptes portant le même mot de passe
     * porteraient la même empreinte, et une seule attaque les ouvrirait tous.
     */
    const passwordHash = await hacher(MOT_DE_PASSE);

    const user = await prisma.user.upsert({
      where: { email },
      update: { name: compte.nom, passwordHash, passwordUpdatedAt: new Date() },
      create: {
        email,
        name: compte.nom,
        emailVerified: new Date(),
        passwordHash,
        passwordUpdatedAt: new Date(),
      },
    });

    await prisma.membership.upsert({
      where: {
        userId_organizationId: {
          userId: user.id,
          organizationId: organization.id,
        },
      },
      update: { role: compte.role, status: "ACTIVE" },
      create: {
        userId: user.id,
        organizationId: organization.id,
        role: compte.role,
        status: "ACTIVE",
        acceptedAt: new Date(),
      },
    });

    if (compte.role === "CLEANER") {
      const commune = getCommuneBySlug(compte.commune!);
      if (!commune) throw new Error(`Commune inconnue : ${compte.commune}`);

      let profile = await prisma.cleanerProfile.findFirst({
        where: { organizationId: organization.id, userId: user.id },
      });

      if (!profile) {
        const home = await prisma.address.create({
          data: {
            organizationId: organization.id,
            label: "Domicile",
            street: "2 ter rue Camille Desmoulins",
            postalCode: commune.postalCode,
            cityName: commune.name,
            inseeCode: commune.insee,
            lat: commune.lat,
            lng: commune.lng,
          },
        });

        profile = await prisma.cleanerProfile.create({
          data: {
            organizationId: organization.id,
            userId: user.id,
            displayName: compte.nom.split(" ")[0]!,
            /*
             * Active d'emblée, et les pièces avec : un compte de test bloqué en
             * vérification ne recevrait aucune mission, donc ne permettrait de
             * tester ni l'acceptation ni le planning.
             */
            status: "ACTIVE",
            employmentType: "INDEPENDENT",
            siret: "89822870500019",
            insuranceExpiresAt: new Date(Date.now() + 365 * 86_400_000),
            homeAddressId: home.id,
            activatedAt: new Date(),
            maxTravelMinutes: 30,
          },
        });

        await prisma.availabilityRule.createMany({
          data: SEMAINE_TYPE.map((plage) => ({
            organizationId: organization.id,
            cleanerProfileId: profile!.id,
            ...plage,
          })),
        });
      }

      cleanerProfileIds[compte.tag!] = profile.id;
    }

    if (compte.role === "CLIENT") {
      let profile = await prisma.clientProfile.findFirst({
        where: { organizationId: organization.id, userId: user.id },
      });
      if (!profile) {
        profile = await prisma.clientProfile.create({
          data: {
            organizationId: organization.id,
            userId: user.id,
            phone: "+33684363862",
          },
        });
      }
      clientProfileId = profile.id;

      const gradignan = getCommuneBySlug("gradignan")!;
      let address = await prisma.address.findFirst({
        where: { clientProfileId: profile.id },
      });
      if (!address) {
        address = await prisma.address.create({
          data: {
            organizationId: organization.id,
            clientProfileId: profile.id,
            label: "Domicile",
            street: "12 avenue de Chartrèze",
            postalCode: gradignan.postalCode,
            cityName: gradignan.name,
            inseeCode: gradignan.insee,
            lat: gradignan.lat,
            lng: gradignan.lng,
            accessNotes: "Portail vert, chien très gentil.",
          },
        });
      }
      clientAddressId = address.id;
    }
  }

  if (!clientProfileId || !clientAddressId) {
    throw new Error("Le compte client n'a pas été créé.");
  }

  /*
   * Le devis passe par le moteur, jamais par un calcul refait ici : c'est la
   * règle du seed, et elle vaut d'autant plus pour des données qu'on va lire à
   * l'écran pour vérifier des montants.
   */
  const surface = 75;
  const priced = quote({
    service: {
      slug: service.slug,
      name: service.slug,
      sqmPerHour: service.sqmPerHour,
      minDurationMinutes: service.minDurationMinutes,
    },
    options: [],
    surfaceSqm: surface,
    frequency: "WEEKLY",
    hourlyRateCents: rule.hourlyRateCents,
    professionalHourlyRateCents: rule.professionalHourlyRateCents,
    taxCreditRateBp: rule.taxCreditRateBp,
  });

  /** Prochain lundi à 9 h, heure locale approchée — suffisant pour un test. */
  function prochainCreneau(joursDeDecalage: number, heure: number): Date {
    const date = new Date();
    date.setUTCDate(date.getUTCDate() + joursDeDecalage);
    date.setUTCHours(heure, 0, 0, 0);
    return date;
  }

  interface ReservationVoulue {
    marqueur: string;
    status: "CONFIRMED" | "PENDING_ASSIGNMENT";
    debut: Date;
    intervenant: string | null;
    affectation: "ACCEPTED" | "PROPOSED" | null;
  }

  const RESERVATIONS: readonly ReservationVoulue[] = [
    {
      marqueur: "Test — intervention confirmée",
      status: "CONFIRMED",
      debut: prochainCreneau(3, 8),
      intervenant: "ambre",
      affectation: "ACCEPTED",
    },
    {
      marqueur: "Test — mission proposée, en attente de réponse",
      status: "CONFIRMED",
      debut: prochainCreneau(4, 11),
      intervenant: "micheline",
      affectation: "PROPOSED",
    },
    {
      marqueur: "Test — personne trouvé, en recherche",
      status: "PENDING_ASSIGNMENT",
      debut: prochainCreneau(5, 8),
      intervenant: null,
      affectation: null,
    },
  ];

  for (const voulue of RESERVATIONS) {
    const existante = await prisma.booking.findFirst({
      where: { clientProfileId, internalNotes: voulue.marqueur },
    });
    if (existante) continue;

    const scheduledEnd = new Date(
      voulue.debut.getTime() + priced.durationMinutes * 60_000,
    );

    const booking = await prisma.booking.create({
      data: {
        organizationId: organization.id,
        clientProfileId,
        addressId: clientAddressId,
        serviceId: service.id,
        status: voulue.status,
        source: "LEOCLEAN",
        engagementMode: "MISE_EN_RELATION",
        scheduledStart: voulue.debut,
        scheduledEnd,
        durationMinutes: priced.durationMinutes,
        surfaceSqm: surface,
        frequency: "WEEKLY",
        hourlyRateCents: priced.hourlyRateCents,
        grossAmountCents: priced.grossAmountCents,
        taxCreditRateBp: priced.taxCreditRateBp,
        taxCreditAmountCents: priced.taxCreditAmountCents,
        netAmountCents: priced.netAmountCents,
        professionalAmountCents: priced.professionalAmountCents,
        platformFeeAmountCents: priced.platformFeeAmountCents,
        commissionRateBp: priced.commissionRateBp,
        internalNotes: voulue.marqueur,
        clientNotes: "Compte de test.",
      },
    });

    if (voulue.intervenant && voulue.affectation) {
      const buffer = TAMPON_TRAJET_MINUTES * 60_000;
      await prisma.assignment.create({
        data: {
          organizationId: organization.id,
          bookingId: booking.id,
          cleanerProfileId: cleanerProfileIds[voulue.intervenant]!,
          status: voulue.affectation,
          startAt: voulue.debut,
          endAt: scheduledEnd,
          blockStartAt: new Date(voulue.debut.getTime() - buffer),
          blockEndAt: new Date(scheduledEnd.getTime() + buffer),
          travelMinutesBefore: TAMPON_TRAJET_MINUTES,
          travelMinutesAfter: TAMPON_TRAJET_MINUTES,
          respondBy:
            voulue.affectation === "PROPOSED"
              ? new Date(Date.now() + 24 * 3_600_000)
              : null,
          respondedAt: voulue.affectation === "ACCEPTED" ? new Date() : null,
        },
      });
    }
  }

  const site = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

  console.info(`
Comptes de test installés sur ${organization.name}.

  ${adresse(null)}              Paul Duchateau — administrateur plateforme
  ${adresse("ambre-admin")}   Ambre Duchateau — administratrice plateforme
  ${adresse("ambre")}         Ambre Duchateau — intervenante (Léognan)
  ${adresse("micheline")}     Micheline Proprette — intervenante (Gradignan)
  ${adresse("michel")}        Michel Crado — client

Les cinq comptes partagent le mot de passe  ${MOT_DE_PASSE}
et se connectent depuis ${site}/connexion, sans passer par la boîte mail.

Le lien magique reste disponible pour tous : les cinq adresses arrivent dans la
même boîte, l'adressage plus de Gmail les distinguant pour la base seule.

  ${site}/mon-espace              interventions du client, annulation, messages
  ${site}/mon-compte              profil, et /mon-compte/mes-donnees pour le RGPD
  ${site}/intervenant             missions proposées et acceptées
  ${site}/intervenant/disponibilites  semaine type
  ${site}/intervenant/dossier     SIRET, assurance, parrainage
  ${site}/administration          back-office plateforme

Michel a trois interventions : une confirmée, une dont la mission est proposée
à Micheline et attend sa réponse, une sans intervenant — celle-ci apparaît dans
le back-office, sous « réservations sans intervenant ».
`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
