import "server-only";

import { listServices } from "@/lib/catalogue";
import { forOrganization, prisma } from "@/lib/db";

/**
 * Page publique d'une société cliente du SaaS.
 *
 * Léo Clean opère en mise en relation ; une société, elle, est prestataire et
 * emploie ses propres agents. Sa page dit donc autre chose que les pages
 * communes : elle présente une entreprise, ses prestations et ses tarifs à
 * elle, qui ne sont pas ceux de la marketplace.
 *
 * **Le catalogue est lu sur un client cloisonné à cette organisation.** C'est
 * ce qui garantit qu'une société ne peut pas voir — ni faire voir — les tarifs
 * d'une autre, ce qui compte d'autant plus qu'elles se font concurrence sur le
 * même territoire.
 */

export interface SocietePublique {
  slug: string;
  nom: string;
  raisonSociale: string | null;
  accroche: string | null;
  description: string | null;
  telephone: string | null;
  email: string | null;
  prestations: {
    slug: string;
    nom: string;
    description: string | null;
    tarifHoraireCents: number | null;
    dureeMinimaleMinutes: number;
    options: { nom: string; description: string | null }[];
  }[];
}

/**
 * Charge une société publiable, ou `null`.
 *
 * `isPubliclyBookable` est la seule porte : une organisation qui ne l'a pas
 * n'existe pas publiquement, et sa page renvoie 404 — pas une page vide, pas
 * un message d'erreur qui confirmerait qu'elle existe.
 */
export async function chargerSocietePublique(
  slug: string,
): Promise<SocietePublique | null> {
  const organisation = await prisma.organization.findUnique({
    where: { slug },
    select: {
      id: true,
      slug: true,
      name: true,
      type: true,
      status: true,
      isPubliclyBookable: true,
      legalName: true,
      tagline: true,
      description: true,
      publicPhone: true,
      publicEmail: true,
    },
  });

  if (
    !organisation ||
    organisation.type !== "COMPANY" ||
    organisation.status !== "ACTIVE" ||
    !organisation.isPubliclyBookable
  ) {
    return null;
  }

  const prestations = await listServices(forOrganization(organisation.id));

  return {
    slug: organisation.slug,
    nom: organisation.name,
    raisonSociale: organisation.legalName,
    accroche: organisation.tagline,
    description: organisation.description,
    telephone: organisation.publicPhone,
    email: organisation.publicEmail,
    prestations: prestations.map((prestation) => ({
      slug: prestation.slug,
      nom: prestation.name,
      description: prestation.description,
      /*
       * Le tarif affiché est le plus bas de la prestation, toutes fréquences
       * confondues : c'est le « à partir de » que reprennent les moteurs, et
       * il doit être exact et vérifiable sur la page.
       */
      tarifHoraireCents: tarifLePlusBas(prestation.hourlyRatesByFrequency),
      dureeMinimaleMinutes: prestation.minDurationMinutes,
      options: prestation.options.map((option) => ({
        nom: option.name,
        description: option.description,
      })),
    })),
  };
}

function tarifLePlusBas(
  tarifs: Partial<Record<string, number>>,
): number | null {
  const valeurs = Object.values(tarifs).filter(
    (valeur): valeur is number => typeof valeur === "number",
  );
  return valeurs.length > 0 ? Math.min(...valeurs) : null;
}

/** Slugs des sociétés publiables, pour la génération statique et le sitemap. */
export async function slugsSocietesPubliques(): Promise<string[]> {
  const societes = await prisma.organization.findMany({
    where: { type: "COMPANY", status: "ACTIVE", isPubliclyBookable: true },
    select: { slug: true },
    orderBy: { slug: "asc" },
  });
  return societes.map((societe) => societe.slug);
}
