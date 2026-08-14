import { type Commune, getCommuneBySlug } from "./territory";

/**
 * Contenu éditorial des pages locales.
 *
 * Une page par commune ne vaut que si elle dit quelque chose que les douze
 * autres ne disent pas. Google déclasse les pages satellites — celles produites
 * par substitution d'un nom de ville dans un gabarit — et les modèles de langage
 * ne citent que des phrases porteuses d'un fait vérifiable.
 *
 * D'où cette contrainte de rédaction : **rien ici ne doit pouvoir être écrit
 * pour une autre commune**. Les temps de trajet sont mesurés par calcul
 * d'itinéraire routier depuis Léognan, les voies proviennent de la Base Adresse
 * Nationale, les populations de l'INSEE. Aucune affirmation n'est décorative.
 *
 * Le déploiement est progressif : six communes d'abord, celles qui rassemblent
 * 69 % de la population du territoire. Publier treize pages minces vaut moins
 * que six pages denses, et l'ordre de publication suit l'audience réelle.
 */

export interface CommuneContent {
  slug: string;
  /** Temps de trajet routier depuis Léognan, en minutes. Mesuré, non estimé. */
  driveMinutesFromLeognan: number;
  /** Distance routière depuis Léognan, en kilomètres. */
  driveKmFromLeognan: number;
  /**
   * Paragraphe d'ouverture. Factuel, autonome, citable hors contexte : c'est la
   * phrase qu'un modèle de langage reprend pour répondre à « qui fait du ménage
   * à <commune> ? ».
   */
  intro: string;
  /** Ce qui caractérise l'habitat, et ce que ça change au ménage. */
  housing: string;
  /** Repères géographiques locaux, pour ancrer la page dans le territoire. */
  landmarks: readonly string[];
  /** Questions réellement posées, avec des réponses vérifiables. */
  faq: readonly { question: string; answer: string }[];
}

/**
 * Communes publiées à ce stade, par population décroissante.
 * Les sept autres suivront, une fois leur contenu écrit avec la même exigence.
 */
export const PUBLISHED_COMMUNE_SLUGS = [
  "leognan",
  "cadaujac",
  "la-brede",
  "saint-selve",
  "martillac",
  "saucats",
] as const;

const CONTENT: Record<string, CommuneContent> = {
  leognan: {
    slug: "leognan",
    driveMinutesFromLeognan: 0,
    driveKmFromLeognan: 0,
    intro:
      "LéoClean a son siège à Léognan, commune de 10 670 habitants et la plus peuplée de la Communauté de communes de Montesquieu. C'est ici que vivent la plupart de nos intervenants, et c'est la commune où nos délais d'intervention sont les plus courts.",
    housing:
      "Léognan mêle un bourg ancien, des lotissements pavillonnaires des années 1980 et 1990, et de grandes propriétés viticoles de l'appellation Pessac-Léognan. La majorité des logements sont des maisons individuelles avec jardin, souvent de 90 à 140 m² : comptez trois heures à trois heures et demie pour un entretien complet.",
    landmarks: [
      "le centre-bourg et la place Joane",
      "les domaines de l'appellation Pessac-Léognan",
      "les lotissements le long de la route de Saucats",
    ],
    faq: [
      {
        question: "Sous quel délai peut-on avoir un ménage à Léognan ?",
        answer:
          "Léognan est la commune où LéoClean dispose du plus grand nombre d'intervenants disponibles. Une première intervention peut généralement être programmée sous 48 à 72 heures.",
      },
      {
        question: "Intervenez-vous dans les propriétés viticoles ?",
        answer:
          "Oui, pour l'entretien des habitations. Les grandes surfaces au-delà de 150 m² sont organisées sur deux passages plutôt qu'une seule intervention, afin que le travail reste soigné de bout en bout.",
      },
    ],
  },

  cadaujac: {
    slug: "cadaujac",
    driveMinutesFromLeognan: 14,
    driveKmFromLeognan: 9.1,
    intro:
      "LéoClean intervient à Cadaujac, deuxième commune du territoire avec 6 909 habitants, située à 14 minutes de route de Léognan. Cadaujac est la seule commune de notre zone à porter le code postal 33140.",
    housing:
      "Cadaujac s'étire entre la route de Toulouse et les bords de Garonne. L'habitat y est majoritairement pavillonnaire, avec une forte proportion de familles et de maisons de plain-pied. La commune a beaucoup construit ces vingt dernières années : nombre de logements sont récents, faciles à entretenir, et se traitent en deux heures et demie à trois heures.",
    landmarks: [
      "les bords de Garonne",
      "le centre-bourg autour de l'église Saint-Pierre",
      "les quartiers pavillonnaires proches de la gare",
    ],
    faq: [
      {
        question: "Le même intervenant vient-il à chaque fois à Cadaujac ?",
        answer:
          "Oui. Sur un abonnement hebdomadaire ou bimensuel, LéoClean attribue un intervenant attitré, que vous retrouvez à chaque passage. En cas d'absence, un remplaçant est proposé et vous en êtes informé à l'avance.",
      },
      {
        question: "Cadaujac est-il couvert aux mêmes tarifs que Léognan ?",
        answer:
          "Oui. Le tarif est identique dans les treize communes de la Communauté de communes de Montesquieu : 29 € de l'heure en formule régulière, 33 € de l'heure pour une intervention ponctuelle.",
      },
    ],
  },

  "la-brede": {
    slug: "la-brede",
    driveMinutesFromLeognan: 17,
    driveKmFromLeognan: 14.1,
    intro:
      "LéoClean intervient à La Brède, commune de 4 386 habitants située à 17 minutes de route de Léognan. La Brède est connue pour le château où naquit Montesquieu, et concentre une partie des services de la Communauté de communes.",
    housing:
      "Le bâti de La Brède est contrasté : maisons de bourg anciennes autour du centre, lotissements récents en périphérie, et quelques propriétés de caractère. Les maisons anciennes demandent plus de temps — sols en tomettes, hauteurs sous plafond, menuiseries à petits carreaux — et nous les estimons plutôt à 20 m² par heure qu'à 25.",
    landmarks: [
      "le château de La Brède",
      "le centre-bourg et ses maisons de pierre",
      "les lotissements en direction de Saucats",
    ],
    faq: [
      {
        question: "Nettoyez-vous les vitres à petits carreaux ?",
        answer:
          "Oui, c'est une option courante à La Brède compte tenu du bâti ancien. Elle ajoute trente minutes à l'intervention et se règle au même tarif horaire, sans supplément.",
      },
      {
        question: "Peut-on réserver un ménage ponctuel avant une réception ?",
        answer:
          "Oui. Une intervention ponctuelle se réserve au tarif de 33 € de l'heure, avec un minimum de deux heures, et sans engagement.",
      },
    ],
  },

  "saint-selve": {
    slug: "saint-selve",
    driveMinutesFromLeognan: 25,
    driveKmFromLeognan: 17.8,
    intro:
      "LéoClean intervient à Saint-Selve, commune de 3 746 habitants située à 25 minutes de route de Léognan. C'est la commune la plus éloignée de notre siège, ce qui rend le regroupement des interventions particulièrement utile.",
    housing:
      "Saint-Selve est une commune résidentielle étendue, où l'habitat pavillonnaire domine largement, souvent sur de grandes parcelles. Les maisons y sont généralement spacieuses, de 100 à 150 m², avec garage et buanderie : le repassage y est demandé plus souvent qu'ailleurs sur le territoire.",
    landmarks: [
      "le bourg et son église romane",
      "les quartiers résidentiels le long de la D111",
      "les zones boisées en limite de Saint-Morillon",
    ],
    faq: [
      {
        question: "L'éloignement change-t-il le prix à Saint-Selve ?",
        answer:
          "Non. Le tarif est le même que dans les douze autres communes. En revanche, les créneaux proposés à Saint-Selve tiennent compte du temps de route : LéoClean privilégie les journées où un intervenant est déjà sur le secteur.",
      },
      {
        question: "Proposez-vous le repassage à domicile ?",
        answer:
          "Oui, en option d'un ménage — elle ajoute une heure — ou en prestation seule, avec un minimum de deux heures.",
      },
    ],
  },

  martillac: {
    slug: "martillac",
    driveMinutesFromLeognan: 8,
    driveKmFromLeognan: 5.8,
    intro:
      "LéoClean intervient à Martillac, commune de 3 659 habitants située à 8 minutes de route de Léognan. C'est la commune la plus proche de notre siège, et celle où nous pouvons proposer les créneaux les plus souples.",
    housing:
      "Martillac associe un bourg viticole, des lotissements récents et le parc d'activités de Bordeaux Technowest. L'habitat est essentiellement pavillonnaire, avec une part notable de jeunes ménages actifs : les demandes portent surtout sur des entretiens hebdomadaires de deux à trois heures, programmés en journée.",
    landmarks: [
      "le bourg et les domaines viticoles",
      "le parc d'activités de Martillac",
      "les lotissements en direction de Léognan",
    ],
    faq: [
      {
        question: "Peut-on avoir un ménage pendant les heures de bureau ?",
        answer:
          "Oui, et c'est même le cas le plus fréquent à Martillac. La remise des clés ou un code d'accès est convenu à la réservation, et l'intervenant vous confirme son passage.",
      },
      {
        question: "Quel est le délai d'intervention à Martillac ?",
        answer:
          "Martillac est à huit minutes du siège de LéoClean. C'est, avec Léognan, la commune où les créneaux se libèrent le plus vite, généralement sous 48 heures.",
      },
    ],
  },

  saucats: {
    slug: "saucats",
    driveMinutesFromLeognan: 14,
    driveKmFromLeognan: 12.2,
    intro:
      "LéoClean intervient à Saucats, commune de 3 548 habitants située à 14 minutes de route de Léognan. Saucats est la commune la plus étendue du territoire, ce qui allonge les trajets entre deux adresses d'un même bourg.",
    housing:
      "Saucats est une commune forestière à l'habitat dispersé : maisons individuelles sur grands terrains, hameaux éloignés du bourg, quelques constructions récentes en lotissement. Les surfaces y sont souvent supérieures à la moyenne du territoire, et le nettoyage des terrasses et abords est une demande fréquente.",
    landmarks: [
      "la réserve naturelle géologique de Saucats–La Brède",
      "le bourg et la place Voltaire",
      "les hameaux dispersés dans la forêt",
    ],
    faq: [
      {
        question: "Intervenez-vous dans les hameaux éloignés du bourg ?",
        answer:
          "Oui, dans toute la commune. Saucats étant très étendue, LéoClean regroupe autant que possible les interventions d'un même secteur sur une même journée, ce qui permet de proposer davantage de créneaux.",
      },
      {
        question: "Le nettoyage de la terrasse est-il compris ?",
        answer:
          "Il s'agit d'une option du grand ménage, qui ajoute quarante-cinq minutes. Elle n'est pas comprise dans l'entretien courant, lequel porte sur l'intérieur du logement.",
      },
    ],
  },
};

export interface PublishedCommune {
  commune: Commune;
  content: CommuneContent;
}

/** Communes disposant d'une page publiée, dans l'ordre de publication. */
export function publishedCommunes(): PublishedCommune[] {
  return PUBLISHED_COMMUNE_SLUGS.map((slug) => {
    const commune = getCommuneBySlug(slug);
    const content = CONTENT[slug];
    if (!commune || !content) {
      throw new Error(
        `La commune « ${slug} » est déclarée publiée mais son contenu est introuvable.`,
      );
    }
    return { commune, content };
  });
}

export function getPublishedCommune(
  slug: string,
): PublishedCommune | undefined {
  const commune = getCommuneBySlug(slug);
  const content = CONTENT[slug];
  return commune && content ? { commune, content } : undefined;
}

/** Une commune couverte mais dont la page n'est pas encore écrite. */
export function isCoveredButUnpublished(slug: string): boolean {
  return getCommuneBySlug(slug) !== undefined && CONTENT[slug] === undefined;
}
