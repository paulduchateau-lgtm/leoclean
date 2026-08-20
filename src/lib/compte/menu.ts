/**
 * Le sommaire de « Mon compte ».
 *
 * Module **pur**. Il rend la liste des entrées visibles à partir de ce qui est
 * réellement disponible, et rien d'autre — c'est toute sa raison d'être.
 *
 * **Une entrée qui mène à une fonction inexistante est pire que son absence.**
 * Elle se clique, elle déçoit, et elle apprend à ne plus faire confiance au
 * menu. Le corpus de référence en compte plusieurs qui n'ont pas d'équivalent
 * ici — carte cadeau, compte URSSAF pour l'avance immédiate — et elles ne sont
 * pas reprises : les copier reviendrait à promettre le service d'un autre.
 *
 * Les attestations fiscales suivent la même règle par un autre chemin :
 * `fiscal.ts` est le seul endroit où se décide ce que le site a le droit de
 * dire du crédit d'impôt, et tant que la déclaration SAP n'est pas obtenue,
 * l'entrée n'existe pas. Ce module ne décide donc rien à ce sujet, il lit.
 */

export interface EntreeCompte {
  id: string;
  libelle: string;
  /** Une ligne d'explication, quand le libellé seul est ambigu. */
  detail?: string;
  href: string;
  /** `lien` navigue, `action` déclenche un geste sur place. */
  nature?: "lien" | "action";
}

export interface GroupeCompte {
  titre: string;
  entrees: EntreeCompte[];
}

export interface ContexteCompte {
  /** `canShowTaxCredit()` — jamais recalculé ici. */
  attestationsFiscales: boolean;
  /** La personne a-t-elle au moins un abonnement, actif ou en pause ? */
  abonnement: boolean;
  /** Un compte de gestion voit l'entrée d'administration. */
  administrateurPlateforme: boolean;
  /** Un intervenant a son propre espace, et il n'est pas client. */
  intervenant: boolean;
}

export function composerLeMenu(contexte: ContexteCompte): GroupeCompte[] {
  const leoClean: EntreeCompte[] = [
    {
      id: "parrainage",
      libelle: "Parrainage",
      detail: "Votre code, vos filleuls, ce que ça vous rapporte",
      href: "/mon-espace/parrainage",
    },
  ];

  if (contexte.intervenant) {
    leoClean.push({
      id: "cooptation",
      libelle: "Coopter un collègue",
      detail: "5 % de son chiffre d'affaires pendant douze mois",
      href: "/intervenant/cooptation",
    });
  }

  const parametres: EntreeCompte[] = [
    {
      id: "paiement",
      libelle: "Moyens de paiement",
      detail: "Votre carte, débitée après chaque ménage",
      href: "/mon-espace/paiement",
    },
    {
      id: "informations",
      libelle: "Informations personnelles",
      detail: "Nom, téléphone, adresses",
      href: "/mon-compte/informations",
    },
    {
      id: "connexion",
      libelle: "Connexion et sécurité",
      detail: "Mot de passe, comptes liés, appareils connectés",
      href: "/mon-compte/connexion",
    },
  ];

  if (contexte.abonnement) {
    parametres.push({
      id: "abonnement",
      libelle: "Mon abonnement",
      detail: "Mettre en pause, reprendre, arrêter",
      href: "/mon-espace/abonnement",
    });
  }

  if (contexte.attestationsFiscales) {
    parametres.push({
      id: "attestations",
      libelle: "Attestations fiscales",
      detail: "À joindre à votre déclaration de revenus",
      href: "/mon-compte/attestations",
    });
  }

  parametres.push({
    id: "donnees",
    libelle: "Mes données personnelles",
    detail: "En obtenir une copie, ou supprimer mon compte",
    href: "/mon-compte/mes-donnees",
  });

  const assistance: EntreeCompte[] = [
    {
      id: "aide",
      libelle: "Questions fréquentes",
      detail: "Tarifs, annulation, ce qui est fourni",
      href: "/#questions",
    },
    {
      id: "contact",
      libelle: "Nous contacter",
      detail: "Téléphone, WhatsApp, email — quelqu'un décroche",
      href: "/etre-rappele",
    },
  ];

  const groupes: GroupeCompte[] = [
    { titre: "Léo Clean", entrees: leoClean },
    { titre: "Paramètres", entrees: parametres },
    { titre: "Assistance", entrees: assistance },
  ];

  if (contexte.administrateurPlateforme) {
    groupes.push({
      titre: "Plateforme",
      entrees: [
        {
          id: "administration",
          libelle: "Le travail du jour",
          href: "/administration",
        },
      ],
    });
  }

  return groupes;
}

/** Toutes les destinations du menu, pour les tests de non-régression. */
export function destinations(groupes: GroupeCompte[]): string[] {
  return groupes.flatMap((groupe) =>
    groupe.entrees.map((entree) => entree.href),
  );
}
