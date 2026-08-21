/**
 * Les consignes du logement, écrites en répondant à des questions.
 *
 * Module **pur** : le catalogue, la validation et le rendu. Aucune base, aucune
 * horloge. C'est ce qui permet à l'écran client et à l'écran de l'intervenant
 * de partager exactement la même vérité — celui qui écrit et celui qui lit
 * voient les mêmes libellés, ce qui est toute la valeur de la fonctionnalité.
 *
 * **Pourquoi des questions plutôt qu'un champ libre.** Le champ libre existe
 * déjà et il reste : il donne « merci de bien nettoyer », qui ne dit rien.
 * Personne ne pense spontanément à préciser le produit des façades de cuisine
 * — jusqu'au jour où elles sont abîmées. Une question posée est une consigne
 * qu'on n'aurait pas écrite.
 *
 * **Les réponses vivent sur le logement, pas sur la réservation.** Un client
 * garde le même four et les mêmes vitres d'un passage à l'autre ; les
 * rattacher à une réservation obligerait à tout redire à chaque fois, ce qui
 * est précisément ce qu'on veut supprimer. Elles évoluent donc dans le temps,
 * et la date de dernière mise à jour est montrée à l'intervenant : une consigne
 * de l'an dernier ne se lit pas comme une consigne d'hier.
 *
 * **Un rythme est déclaré, jamais calculé.** « Les vitres une fois par mois »
 * s'affiche tel quel : le produit ne sait pas quand elles ont été faites pour
 * la dernière fois — rien ne trace l'exécution tâche par tâche. Afficher
 * « aujourd'hui : vitres » serait une déduction que rien ne soutient, et
 * l'intervenant s'en apercevrait au deuxième passage.
 */

/** Les rythmes proposés, du plus fréquent au plus rare. */
export const RYTHMES = [
  { cle: "chaque-fois", libelle: "À chaque passage" },
  { cle: "une-sur-deux", libelle: "Un passage sur deux" },
  { cle: "mensuel", libelle: "Une fois par mois environ" },
  { cle: "sur-demande", libelle: "Seulement si je le demande" },
  { cle: "jamais", libelle: "Jamais" },
] as const;

export type CleRythme = (typeof RYTHMES)[number]["cle"];

const CLES_RYTHME = RYTHMES.map((rythme) => rythme.cle);

export type TypeQuestion = "oui-non" | "rythme" | "texte";

export interface Question {
  id: string;
  /** La question, telle qu'elle est posée au client. */
  question: string;
  type: TypeQuestion;
  /**
   * Ce que l'intervenant lit en tête de la réponse.
   *
   * Distinct de la question : « Faut-il laver le four ? » se pose au client,
   * mais l'intervenant a besoin de « Four », suivi de la réponse. Lui servir
   * la question entière l'obligerait à la relire pour en extraire la consigne.
   */
  sujet: string;
  /** Une précision facultative, quand la question mérite d'être expliquée. */
  aide?: string;
  /** Exemple de réponse, pour les questions ouvertes. */
  exemple?: string;
}

export interface Rubrique {
  cle: string;
  titre: string;
  /** Ce que la rubrique sert à éviter. Affiché au client, jamais à l'intervenant. */
  intention: string;
  questions: readonly Question[];
}

/**
 * Le questionnaire.
 *
 * **Court, et c'est une contrainte.** Une liste de quarante questions n'est pas
 * une aide, c'est un formulaire administratif : elle serait abandonnée au
 * quart, et une consigne à moitié remplie vaut moins qu'un champ libre honnête.
 * Chaque question retenue répond au même test — un intervenant peut-il mal
 * faire, faute de la réponse ? Si non, elle sort.
 */
export const RUBRIQUES: readonly Rubrique[] = [
  {
    cle: "cuisine",
    titre: "La cuisine",
    intention:
      "C'est la pièce où le mauvais produit laisse une trace définitive.",
    questions: [
      {
        id: "four",
        question: "Faut-il nettoyer l'intérieur du four ?",
        type: "rythme",
        sujet: "Intérieur du four",
        aide: "C'est long : le dire évite qu'on le fasse à la place d'autre chose.",
      },
      {
        id: "facades",
        question: "Quel produit pour les façades de cuisine ?",
        type: "texte",
        sujet: "Façades de cuisine",
        aide: "Bois huilé, laque, inox : chacun a son produit, et le mauvais marque.",
        exemple:
          "Façades en chêne huilé — savon noir dilué, jamais de dégraissant.",
      },
      {
        id: "frigo",
        question: "Faut-il nettoyer l'intérieur du réfrigérateur ?",
        type: "rythme",
        sujet: "Intérieur du réfrigérateur",
      },
    ],
  },
  {
    cle: "vitres",
    titre: "Les vitres et les sols",
    intention: "Deux tâches qu'on fait trop, ou pas assez.",
    questions: [
      {
        id: "vitres",
        question: "À quel rythme faut-il faire les vitres ?",
        type: "rythme",
        sujet: "Vitres",
      },
      {
        id: "sols-fragiles",
        question: "Un sol demande-t-il un traitement particulier ?",
        type: "texte",
        sujet: "Sols",
        aide: "Parquet non vitrifié, tomettes, béton ciré : dites-le une fois.",
        exemple:
          "Parquet du salon non vitrifié : balai et chiffon à peine humide.",
      },
    ],
  },
  {
    cle: "pieces",
    titre: "Les pièces",
    intention:
      "Toutes les pièces ne se font pas à chaque fois, et personne ne le devine.",
    questions: [
      {
        id: "chambre-amis",
        question: "La chambre d'amis, à chaque passage ou sur demande ?",
        type: "rythme",
        sujet: "Chambre d'amis",
      },
      {
        id: "pieces-a-eviter",
        question: "Une pièce dans laquelle il ne faut pas entrer ?",
        type: "texte",
        sujet: "Pièce à ne pas ouvrir",
        aide: "Bureau, chambre d'un enfant qui dort, atelier : la porte reste fermée.",
        exemple: "Le bureau du fond : porte fermée, on n'y entre pas.",
      },
    ],
  },
  {
    cle: "linge",
    titre: "Le linge et les lits",
    intention: "Ce qu'on ose faire, et ce qu'on n'ose pas.",
    questions: [
      {
        id: "draps",
        question: "Faut-il changer les draps ?",
        type: "rythme",
        sujet: "Draps",
        aide: "Si oui, dites où trouver la parure propre dans la question suivante.",
      },
      {
        id: "ou-linge",
        question: "Où trouve-t-on le linge propre et où met-on le sale ?",
        type: "texte",
        sujet: "Linge",
        exemple:
          "Parures dans le placard du couloir, linge sale dans le panier de la salle de bain.",
      },
      {
        id: "repassage",
        question: "Faut-il repasser ?",
        type: "oui-non",
        sujet: "Repassage",
        aide: "Le repassage est une option facturée : cochez seulement si elle est à votre contrat.",
      },
    ],
  },
];

/** Toutes les questions, à plat. */
export const TOUTES_LES_QUESTIONS: readonly Question[] = RUBRIQUES.flatMap(
  (rubrique) => rubrique.questions,
);

export type Reponse =
  | { type: "oui-non"; valeur: boolean }
  | { type: "rythme"; valeur: CleRythme }
  | { type: "texte"; valeur: string };

export interface Consignes {
  /**
   * L'aide est-elle activée ?
   *
   * Séparée des réponses à dessein : la désactiver ne doit rien effacer.
   * Quelqu'un qui coupe l'aide un mois et la remet le suivant retrouve ce
   * qu'il avait écrit — sans quoi il ne la rallumerait jamais.
   */
  actif: boolean;
  reponses: Record<string, Reponse>;
  /** ISO 8601. Écrit par l'appelant, ce module n'ayant pas d'horloge. */
  majAt: string | null;
}

export const CONSIGNES_VIDES: Consignes = {
  actif: false,
  reponses: {},
  majAt: null,
};

/**
 * Relit ce qui vient de la base.
 *
 * Une colonne `Json` n'est pas typée : ce qu'on y a écrit hier peut ne plus
 * correspondre au catalogue d'aujourd'hui. **Une réponse dont la question a
 * disparu est ignorée**, et une réponse dont le type ne correspond plus aussi —
 * plutôt que de faire échouer la lecture, ce qui rendrait un logement
 * inaccessible pour une question retirée du questionnaire.
 */
export function lireLesConsignes(brut: unknown): Consignes {
  if (typeof brut !== "object" || brut === null) return CONSIGNES_VIDES;

  const source = brut as Record<string, unknown>;
  const reponsesBrutes =
    typeof source.reponses === "object" && source.reponses !== null
      ? (source.reponses as Record<string, unknown>)
      : {};

  const reponses: Record<string, Reponse> = {};
  for (const question of TOUTES_LES_QUESTIONS) {
    const valide = validerUneReponse(question, reponsesBrutes[question.id]);
    if (valide !== null) reponses[question.id] = valide;
  }

  return {
    actif: source.actif === true,
    reponses,
    majAt: typeof source.majAt === "string" ? source.majAt : null,
  };
}

/** Une réponse conforme à sa question, ou `null`. */
export function validerUneReponse(
  question: Question,
  brut: unknown,
): Reponse | null {
  if (typeof brut !== "object" || brut === null) return null;
  const source = brut as Record<string, unknown>;
  if (source.type !== question.type) return null;

  switch (question.type) {
    case "oui-non":
      return typeof source.valeur === "boolean"
        ? { type: "oui-non", valeur: source.valeur }
        : null;
    case "rythme":
      return typeof source.valeur === "string" &&
        (CLES_RYTHME as readonly string[]).includes(source.valeur)
        ? { type: "rythme", valeur: source.valeur as CleRythme }
        : null;
    case "texte": {
      if (typeof source.valeur !== "string") return null;
      const valeur = source.valeur.trim();
      // Une réponse vide n'est pas une réponse : on ne la garde pas, sinon le
      // décompte annoncerait une consigne que l'intervenant ne lira pas.
      return valeur.length === 0
        ? null
        : { type: "texte", valeur: valeur.slice(0, LONGUEUR_MAX_TEXTE) };
    }
  }
}

/** Un champ libre plus long qu'un écran n'est plus une consigne. */
export const LONGUEUR_MAX_TEXTE = 280;

/** Combien de questions ont une réponse, sur combien. */
export function progression(consignes: Consignes): {
  repondues: number;
  total: number;
} {
  return {
    repondues: Object.keys(consignes.reponses).length,
    total: TOUTES_LES_QUESTIONS.length,
  };
}

export interface LigneConsigne {
  rubrique: string;
  sujet: string;
  reponse: string;
}

/**
 * Ce que l'intervenant lit, prêt à afficher.
 *
 * **Les réponses « jamais » sont conservées, pas filtrées.** « Vitres :
 * jamais » est une consigne, et c'en est même une précieuse : sans elle,
 * quelqu'un de consciencieux les ferait, prendrait le temps qu'il n'a pas, et
 * s'entendrait dire qu'on ne lui avait rien demandé.
 *
 * Rend une liste vide si l'aide est désactivée : le client a alors choisi que
 * ces réponses ne s'appliquent pas, et les montrer quand même reviendrait à
 * lui retirer l'interrupteur qu'on lui a donné.
 */
export function consignesLisibles(consignes: Consignes): LigneConsigne[] {
  if (!consignes.actif) return [];

  const lignes: LigneConsigne[] = [];
  for (const rubrique of RUBRIQUES) {
    for (const question of rubrique.questions) {
      const reponse = consignes.reponses[question.id];
      if (!reponse) continue;
      lignes.push({
        rubrique: rubrique.titre,
        sujet: question.sujet,
        reponse: formaterUneReponse(reponse),
      });
    }
  }
  return lignes;
}

function formaterUneReponse(reponse: Reponse): string {
  switch (reponse.type) {
    case "oui-non":
      return reponse.valeur ? "Oui" : "Non";
    case "rythme":
      return (
        RYTHMES.find((rythme) => rythme.cle === reponse.valeur)?.libelle ??
        reponse.valeur
      );
    case "texte":
      return reponse.valeur;
  }
}
