import "server-only";

import { z } from "zod";

import { checkSiret, sirenOf } from "@/lib/cleaner/identifiants";

import type { SignalAttention } from "./parcours";

/**
 * Vérification d'un SIRET auprès de l'API Sirene de l'INSEE.
 *
 * Le contrôle de Luhn de `cleaner/identifiants.ts` s'exécute d'abord : une
 * faute de frappe sur un chiffre se détecte sans interroger personne, et c'est
 * la vérification la plus rentable du formulaire.
 *
 * **Aucune re-saisie.** L'API rend la raison sociale, la date de création, le
 * code APE et l'état administratif : les redemander au candidat serait lui
 * faire recopier ce qu'on sait déjà, et c'est exactement le genre d'écran qu'on
 * abandonne.
 */

/**
 * Codes APE cohérents avec le nettoyage à domicile.
 *
 * `8121Z` est le nettoyage courant des bâtiments, `9700Z` les activités des
 * ménages employeurs, `8810A` l'aide à domicile. Un autre code n'est **pas un
 * refus** : un auto-entrepreneur cumule souvent plusieurs activités, et le code
 * principal n'est pas toujours celui qu'il exerce le plus. C'est un signal
 * d'attention, tranché par un humain en entretien.
 */
export const APE_ATTENDUS = ["8121Z", "9700Z", "8810A", "8129A", "8130Z"];

/**
 * Ancienneté en deçà de laquelle un établissement est signalé.
 *
 * Trois mois. Pas un rejet non plus — la moitié du vivier vient précisément de
 * créer son auto-entreprise, souvent pour nous. C'est un rappel de vérifier que
 * les autres pièces suivent.
 */
export const ANCIENNETE_SIGNALEE_JOURS = 90;

/** Réponse de l'API, validée par Zod comme toute donnée venue de l'extérieur. */
const reponseSchema = z.object({
  etablissement: z.object({
    siret: z.string(),
    etatAdministratifEtablissement: z.string().optional(),
    dateCreationEtablissement: z.string().nullable().optional(),
    uniteLegale: z.object({
      denominationUniteLegale: z.string().nullable().optional(),
      nomUniteLegale: z.string().nullable().optional(),
      prenom1UniteLegale: z.string().nullable().optional(),
      activitePrincipaleUniteLegale: z.string().nullable().optional(),
      etatAdministratifUniteLegale: z.string().optional(),
    }),
    periodesEtablissement: z
      .array(
        z.object({
          etatAdministratifEtablissement: z.string().nullable().optional(),
          activitePrincipaleEtablissement: z.string().nullable().optional(),
        }),
      )
      .optional(),
  }),
});

export type RefusSirene =
  | "CLE_INVALIDE"
  | "LONGUEUR"
  | "INTROUVABLE"
  | "CESSE"
  | "SERVICE_INDISPONIBLE";

export const MESSAGES_SIRENE: Record<RefusSirene, string> = {
  LONGUEUR: "Un SIRET comporte quatorze chiffres.",
  CLE_INVALIDE:
    "Ce SIRET comporte une erreur de saisie. Vérifiez les chiffres un à un.",
  INTROUVABLE:
    "Ce SIRET n'existe pas dans le répertoire des entreprises. Vérifiez-le sur votre avis de situation.",
  CESSE:
    "Cet établissement est fermé au répertoire des entreprises. Si c'est une erreur, appelez-nous.",
  SERVICE_INDISPONIBLE:
    "Le service de l'INSEE ne répond pas. Nous vérifierons votre SIRET à la main — continuez votre inscription.",
};

export interface EtablissementVerifie {
  siret: string;
  siren: string;
  raisonSociale: string | null;
  codeApe: string | null;
  creeLe: Date | null;
  actif: boolean;
  signaux: SignalAttention[];
}

export type ResultatSirene =
  | { ok: true; etablissement: EtablissementVerifie }
  | { ok: false; refus: RefusSirene };

/**
 * Interroge l'API Sirene.
 *
 * **Une panne de l'INSEE ne ferme pas le funnel.** `SERVICE_INDISPONIBLE` est
 * distinct de `INTROUVABLE` pour cette raison précise : le premier laisse
 * continuer avec une vérification manuelle, le second arrête. Confondre les
 * deux ferait perdre tous les candidats d'une matinée d'indisponibilité.
 */
export async function verifierSiret(
  siret: string,
  options: {
    jeton?: string;
    maintenant?: Date;
    /** Injection pour les tests : évite tout appel réseau. */
    fetcher?: typeof fetch;
  } = {},
): Promise<ResultatSirene> {
  const propre = siret.replace(/\s/g, "");

  const luhn = checkSiret(propre);
  if (!luhn.valid) {
    return { ok: false, refus: luhn.refusal! };
  }

  const jeton = options.jeton;
  if (!jeton) {
    /*
     * Sans jeton, on ne prétend pas avoir vérifié. Le dossier continue et la
     * vérification passe en revue humaine — c'est la direction du dépôt :
     * échouer visiblement plutôt que dégrader en silence.
     */
    return { ok: false, refus: "SERVICE_INDISPONIBLE" };
  }

  const appel = options.fetcher ?? fetch;

  let reponse: Response;
  try {
    reponse = await appel(
      `https://api.insee.fr/api-sirene/3.11/siret/${propre}`,
      {
        headers: {
          "X-INSEE-Api-Key-Integration": jeton,
          Accept: "application/json",
        },
        signal: AbortSignal.timeout(8000),
      },
    );
  } catch {
    return { ok: false, refus: "SERVICE_INDISPONIBLE" };
  }

  if (reponse.status === 404) return { ok: false, refus: "INTROUVABLE" };
  if (!reponse.ok) return { ok: false, refus: "SERVICE_INDISPONIBLE" };

  const analyse = reponseSchema.safeParse(
    await reponse.json().catch(() => null),
  );
  if (!analyse.success) return { ok: false, refus: "SERVICE_INDISPONIBLE" };

  const { etablissement } = analyse.data;
  const derniere = etablissement.periodesEtablissement?.[0];

  const etat =
    derniere?.etatAdministratifEtablissement ??
    etablissement.etatAdministratifEtablissement ??
    "A";
  if (etat !== "A") return { ok: false, refus: "CESSE" };

  const legale = etablissement.uniteLegale;
  const nomPersonne = [legale.prenom1UniteLegale, legale.nomUniteLegale]
    .filter(Boolean)
    .join(" ");
  const raisonSociale =
    legale.denominationUniteLegale ?? (nomPersonne === "" ? null : nomPersonne);

  const codeApe =
    derniere?.activitePrincipaleEtablissement ??
    legale.activitePrincipaleUniteLegale ??
    null;

  const creeLe = etablissement.dateCreationEtablissement
    ? new Date(etablissement.dateCreationEtablissement)
    : null;

  const signaux: SignalAttention[] = [];
  if (codeApe && !APE_ATTENDUS.includes(codeApe.replace(".", ""))) {
    signaux.push("APE_INATTENDU");
  }
  const maintenant = options.maintenant ?? new Date();
  if (
    creeLe &&
    maintenant.getTime() - creeLe.getTime() <
      ANCIENNETE_SIGNALEE_JOURS * 86_400_000
  ) {
    signaux.push("SIRET_RECENT");
  }

  return {
    ok: true,
    etablissement: {
      siret: propre,
      siren: sirenOf(propre),
      raisonSociale,
      codeApe,
      creeLe,
      actif: true,
      signaux,
    },
  };
}

/**
 * Le nom déclaré correspond-il à celui du répertoire ?
 *
 * Comparaison volontairement tolérante : accents, casse, tirets et ordre des
 * mots ne comptent pas. Refuser « Marie-Claire DUPONT » face à « Dupont Marie
 * Claire » ferait échouer des dossiers parfaitement réguliers, et le signal
 * n'est de toute façon pas bloquant.
 */
export function nomsConcordent(declare: string, repertoire: string): boolean {
  const normaliser = (valeur: string) =>
    valeur
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim()
      .split(" ")
      .filter(Boolean)
      .sort()
      .join(" ");

  return normaliser(declare) === normaliser(repertoire);
}
