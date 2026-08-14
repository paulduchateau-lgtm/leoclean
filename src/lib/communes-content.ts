import { type Commune, getCommuneBySlug } from "./territory";

/**
 * Contenu éditorial des pages locales.
 *
 * Une page par commune ne vaut que si elle dit quelque chose que les quinze
 * autres ne disent pas. Google déclasse les pages satellites — celles produites
 * par substitution d'un nom de ville dans un gabarit — et les modèles de langage
 * ne citent que des phrases porteuses d'un fait vérifiable.
 *
 * D'où cette contrainte de rédaction : **rien ici ne doit pouvoir être écrit
 * pour une autre commune**. Les temps de trajet sont mesurés par calcul
 * d'itinéraire routier, les superficies et populations viennent de l'INSEE via
 * geo.api.gouv.fr, les voies de la Base Adresse Nationale, les monuments et
 * cours d'eau de sources publiques vérifiables. Aucune affirmation n'est
 * décorative, et toute affirmation superlative (« la plus étendue », « la plus
 * proche ») doit rester vraie face aux quinze autres fiches.
 *
 * Les seize communes desservies sont publiées.
 */

export interface CommuneContent {
  slug: string;
  /**
   * Temps de trajet routier depuis Léognan, en minutes, **de mairie à mairie**.
   *
   * Le point de destination est le bourg, pas le centroïde de la commune : sur
   * les communes forestières très étendues — Cestas, Saucats,
   * Cabanac-et-Villagrains — le centroïde tombe en pleine forêt et produit des
   * itinéraires deux fois plus longs que le trajet réel vers le village. Un
   * client comprend « à combien de minutes êtes-vous de chez moi », et il
   * habite le bourg ou ses abords, pas le barycentre géométrique.
   */
  driveMinutesFromLeognan: number;
  /** Distance routière depuis Léognan, en kilomètres, de mairie à mairie. */
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

/** Communes publiées, par population décroissante. */
export const PUBLISHED_COMMUNE_SLUGS = [
  "villenave-d-ornon",
  "gradignan",
  "cestas",
  "leognan",
  "cadaujac",
  "la-brede",
  "saint-selve",
  "martillac",
  "saucats",
  "saint-medard-d-eyrans",
  "castres-gironde",
  "beautiran",
  "cabanac-et-villagrains",
  "saint-morillon",
  "ayguemorte-les-graves",
  "isle-saint-georges",
] as const;

const CONTENT: Record<string, CommuneContent> = {
  "villenave-d-ornon": {
    slug: "villenave-d-ornon",
    driveMinutesFromLeognan: 11,
    driveKmFromLeognan: 7.6,
    intro:
      "LéoClean fait le ménage à domicile à Villenave-d'Ornon, commune de 42 545 habitants située à 11 minutes de route de Léognan. C'est la commune la plus peuplée de notre zone d'intervention.",
    housing:
      "Villenave-d'Ornon s'étend de la Garonne aux coteaux et mêle des quartiers très différents : résidences récentes le long du tramway, maisons de ville anciennes, lotissements pavillonnaires et fermes rénovées. Les appartements y sont plus nombreux que dans le reste de notre zone, et se traitent en général en deux à trois heures.",
    landmarks: [
      "les quartiers desservis par le tramway",
      "le bourg de Villenave et ses maisons de ville",
      "les secteurs résidentiels vers Sarcignan et Chambéry",
    ],
    faq: [
      {
        question: "Intervenez-vous en appartement à Villenave-d'Ornon ?",
        answer:
          "Oui. Villenave-d'Ornon compte davantage d'appartements que le reste de notre zone. Un T3 d'environ 65 m² demande environ trois heures d'entretien, soit 87 € en formule régulière.",
      },
      {
        question:
          "Villenave-d'Ornon fait-elle partie de la Communauté de communes de Montesquieu ?",
        answer:
          "Non. Villenave-d'Ornon appartient à Bordeaux Métropole. LéoClean y intervient néanmoins aux mêmes conditions et aux mêmes tarifs, la commune étant à onze minutes de son siège de Léognan.",
      },
    ],
  },

  gradignan: {
    slug: "gradignan",
    driveMinutesFromLeognan: 12,
    driveKmFromLeognan: 7.0,
    intro:
      "LéoClean fait le ménage à domicile à Gradignan, commune de 26 952 habitants située à 12 minutes de route de Léognan. C'est la deuxième commune la plus peuplée de notre zone d'intervention, et la plus dense après Villenave-d'Ornon.",
    housing:
      "Gradignan est une commune résidentielle boisée, où dominent les maisons individuelles sur terrain arboré, complétées par des résidences et quelques logements étudiants liés à la proximité du campus. Les maisons y sont souvent de 100 à 130 m² : comptez trois heures à trois heures et demie.",
    landmarks: [
      "le centre-ville et le parc de Mandavit",
      "le quartier de Cayac",
      "les secteurs résidentiels vers Malartic",
    ],
    faq: [
      {
        question: "Gradignan fait-elle partie de la zone d'intervention ?",
        answer:
          "Oui, aux mêmes tarifs que les treize communes de la Communauté de communes de Montesquieu, dont Gradignan ne fait pas partie : elle relève de Bordeaux Métropole. Elle est à douze minutes du siège de LéoClean, soit plus près que huit des douze autres communes de cette intercommunalité.",
      },
      {
        question: "Proposez-vous un ménage de fin de bail à Gradignan ?",
        answer:
          "Oui, au tarif de 33 € de l'heure. La demande est fréquente à Gradignan compte tenu de la proximité du campus universitaire, avec des états des lieux concentrés en juin et en septembre.",
      },
    ],
  },

  cestas: {
    slug: "cestas",
    driveMinutesFromLeognan: 11,
    driveKmFromLeognan: 7.9,
    intro:
      "LéoClean fait le ménage à domicile à Cestas, commune de 16 666 habitants dont le bourg est à 11 minutes de route de Léognan. Avec près de 100 km², Cestas est de loin la commune la plus étendue de notre zone d'intervention.",
    housing:
      "Cestas ne forme pas un bourg unique mais plusieurs pôles distants les uns des autres, séparés par la forêt. L'habitat est très majoritairement pavillonnaire, souvent sur de grandes parcelles, avec des surfaces supérieures à la moyenne de notre zone.",
    landmarks: [
      "Cestas-Bourg",
      "le quartier de Gazinet",
      "les secteurs boisés vers Toctoucau",
    ],
    faq: [
      {
        question: "L'étendue de Cestas change-t-elle le tarif ?",
        answer:
          "Non. Le tarif horaire est identique dans les seize communes desservies. En revanche, il faut jusqu'à vingt minutes pour traverser Cestas d'un quartier à l'autre : LéoClean regroupe donc les interventions d'un même secteur sur une même journée.",
      },
      {
        question: "Intervenez-vous à Gazinet et à Toctoucau ?",
        answer:
          "Oui, dans toute la commune de Cestas. Ces quartiers étant éloignés du bourg, les créneaux qui vous sont proposés dépendent de la présence d'un intervenant sur le secteur ce jour-là.",
      },
    ],
  },

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
    driveMinutesFromLeognan: 11,
    driveKmFromLeognan: 7.0,
    intro:
      "LéoClean intervient à Cadaujac, deuxième commune de la Communauté de communes de Montesquieu avec 6 909 habitants, située à 11 minutes de route de Léognan. C'est aussi, avec 449 habitants au kilomètre carré, la commune la plus densément peuplée de cette intercommunalité.",
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
    driveMinutesFromLeognan: 13,
    driveKmFromLeognan: 8.8,
    intro:
      "LéoClean intervient à La Brède, commune de 4 386 habitants située à 13 minutes de route de Léognan. La Brède est le chef-lieu de canton et concentre une partie des services de la Communauté de communes de Montesquieu, dont elle porte le nom du plus illustre habitant : Montesquieu y est né en 1689.",
    housing:
      "Le bâti de La Brède est contrasté : maisons de bourg anciennes autour du centre, lotissements récents en périphérie, et quelques propriétés de caractère. Les maisons anciennes demandent plus de temps — sols en tomettes, hauteurs sous plafond, menuiseries à petits carreaux — et nous les estimons plutôt à 20 m² par heure qu'à 25.",
    landmarks: [
      "le château de La Brède, où naquit Montesquieu",
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
    driveMinutesFromLeognan: 20,
    driveKmFromLeognan: 14.4,
    intro:
      "LéoClean intervient à Saint-Selve, commune de 3 746 habitants située à 20 minutes de route de Léognan. Aucune route directe ne relie les deux bourgs : l'itinéraire passe par La Brède, ce qui allonge le trajet bien au-delà des neuf kilomètres qui les séparent à vol d'oiseau.",
    housing:
      "Saint-Selve est une commune résidentielle étendue, où l'habitat pavillonnaire domine largement, souvent sur de grandes parcelles. Les maisons y sont généralement spacieuses, de 100 à 150 m², avec garage et buanderie : le repassage y est demandé plus souvent qu'ailleurs sur le territoire.",
    landmarks: [
      "le bourg et son église romane",
      "les quartiers résidentiels le long de la D111",
      "les zones boisées en limite de Saint-Morillon",
    ],
    faq: [
      {
        question: "Le détour par La Brède change-t-il le prix à Saint-Selve ?",
        answer:
          "Non. Le tarif est le même que dans les quinze autres communes. En revanche, les créneaux proposés à Saint-Selve tiennent compte du temps de route : LéoClean privilégie les journées où un intervenant est déjà sur le secteur.",
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
    driveKmFromLeognan: 5.2,
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
          "Martillac est à huit minutes du siège de LéoClean, la distance la plus courte de toute la zone. C'est, avec Léognan, la commune où les créneaux se libèrent le plus vite, généralement sous 48 heures.",
      },
    ],
  },

  saucats: {
    slug: "saucats",
    driveMinutesFromLeognan: 10,
    driveKmFromLeognan: 9.1,
    intro:
      "LéoClean intervient à Saucats, commune de 3 548 habitants dont le bourg est à 10 minutes de route de Léognan. Avec 89 km² pour 3 548 habitants, Saucats est la deuxième commune la plus étendue du territoire après Cestas, et l'une des plus faiblement peuplées au kilomètre carré.",
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

  "saint-medard-d-eyrans": {
    slug: "saint-medard-d-eyrans",
    driveMinutesFromLeognan: 12,
    driveKmFromLeognan: 8.3,
    intro:
      "LéoClean intervient à Saint-Médard-d'Eyrans, commune de 3 409 habitants située à 12 minutes de route de Léognan. La commune partage avec Léognan l'appellation viticole Pessac-Léognan, et sa halte TER met le centre de Bordeaux à une vingtaine de minutes.",
    housing:
      "Saint-Médard-d'Eyrans s'est bâtie en hameaux avant de devenir périurbaine : entre 1858 et 1888, neuf croix de mission y ont été érigées, une par hameau, et ce semis d'origine se lit encore dans le parcellaire. Aux fermes et maisons anciennes se sont ajoutés des lotissements récents autour de la halte ferroviaire, habités par des ménages qui travaillent à Bordeaux — d'où une forte demande de créneaux en journée, en l'absence des occupants.",
    landmarks: [
      "la halte TER sur la ligne Bordeaux-Saint-Jean – Sète",
      "le domaine d'Eyran et son vignoble en Pessac-Léognan",
      "les châteaux Lamothe et de La Prade",
      "la vallée du Saucats, en limite nord de la commune",
    ],
    faq: [
      {
        question:
          "Pouvez-vous intervenir en notre absence à Saint-Médard-d'Eyrans ?",
        answer:
          "Oui, c'est le cas le plus fréquent dans la commune, où beaucoup de ménages prennent le TER pour Bordeaux. Les modalités d'accès — clé confiée, boîte à clés, code — sont convenues à la réservation, et l'intervenant vous confirme chaque passage.",
      },
      {
        question:
          "Le tarif est-il le même qu'à Léognan, à huit kilomètres de là ?",
        answer:
          "Oui. Les deux communes partagent l'appellation Pessac-Léognan mais aussi la même grille : 29 € de l'heure en formule régulière, 33 € de l'heure en ponctuel, dans les seize communes desservies.",
      },
    ],
  },

  "castres-gironde": {
    slug: "castres-gironde",
    driveMinutesFromLeognan: 18,
    driveKmFromLeognan: 15.4,
    intro:
      "LéoClean intervient à Castres-Gironde, commune de 2 695 habitants située à 18 minutes de route de Léognan, sur la rive gauche de la Garonne. Il s'agit bien de la commune girondine, appelée localement Castres-sur-Gironde, et non de la ville de Castres dans le Tarn.",
    housing:
      "Sur ses 7 km², Castres-Gironde est boisée pour moitié et plantée de vignes AOC Graves pour un tiers, exploitées par une dizaine de châteaux : l'habitat se concentre donc sur une bande étroite le long de la D1113, l'ancienne route nationale 113. Cette proximité de la route a une conséquence très concrète sur le ménage — les appuis de fenêtre et les vitrages côté rue s'encrassent nettement plus vite que dans les communes forestières du territoire.",
    landmarks: [
      "l'église romane Saint-Martin, dont l'abside est classée depuis 1913",
      "la rue du Vieux Port, mémoire du port fluvial sur la Garonne",
      "la D1113, ancienne route nationale 113",
      "les châteaux viticoles de l'appellation Graves",
    ],
    faq: [
      {
        question: "Le nettoyage des vitres est-il facturé en supplément ?",
        answer:
          "Non, il est décompté du temps d'intervention comme le reste. À Castres-Gironde, les logements donnant sur la D1113 demandent en général trente minutes de plus par passage pour les vitrages et les appuis de fenêtre.",
      },
      {
        question: "Quelle est la gare la plus proche de Castres-Gironde ?",
        answer:
          "Celle de Beautiran, à moins d'un kilomètre par la route vers le nord-ouest, sur la ligne Bordeaux-Saint-Jean – Sète. La commune n'a pas de halte sur son propre territoire.",
      },
    ],
  },

  beautiran: {
    slug: "beautiran",
    driveMinutesFromLeognan: 18,
    driveKmFromLeognan: 15.5,
    intro:
      "LéoClean intervient à Beautiran, commune de 2 488 habitants située à 18 minutes de route de Léognan, au confluent de la Garonne et du Gat Mort. Avec près de 400 habitants au kilomètre carré sur à peine 6,3 km², c'est l'une des communes les plus resserrées du territoire.",
    housing:
      "Beautiran tient dans 6 km² et s'organise autour de sa gare, ouverte en 1855 sur la ligne Bordeaux-Saint-Jean – Sète. Le bourg ancien, resserré, est complété par des lotissements aux noms bien identifiés — Domaine de Calens, Domaine des Acacias — construits pour des ménages qui font la navette vers Bordeaux. Les logements y sont plus compacts qu'ailleurs sur le territoire : deux heures à deux heures et demie suffisent souvent, contre trois pour une maison de Léognan.",
    landmarks: [
      "la gare de Beautiran, sur la ligne Bordeaux-Saint-Jean – Sète",
      "le château de Couloumey, inscrit aux monuments historiques depuis 2002",
      "l'église Saint-Michel et son clocher ovoïde couvert d'écailles",
      "le confluent du Gat Mort et de la Garonne",
    ],
    faq: [
      {
        question: "Deux heures suffisent-elles pour un logement à Beautiran ?",
        answer:
          "Souvent, oui. Deux heures correspondent à environ 50 m² d'entretien courant, soit 58 € en formule régulière — un format adapté aux maisons de bourg et aux logements de lotissement de la commune. Deux heures sont par ailleurs le minimum facturé.",
      },
      {
        question: "Intervenez-vous avant ou après un trajet en train ?",
        answer:
          "Les interventions sont programmées entre 8 h et 19 h, indépendamment des horaires de la gare. Si vous partez tôt, l'accès se fait par clé confiée ou par code, convenu à la réservation.",
      },
    ],
  },

  "cabanac-et-villagrains": {
    slug: "cabanac-et-villagrains",
    driveMinutesFromLeognan: 19,
    driveKmFromLeognan: 16.6,
    intro:
      "LéoClean intervient à Cabanac-et-Villagrains, commune de 2 400 habitants dont la mairie est à 19 minutes de route de Léognan. La commune est née en 1811 de la réunion de deux villages distincts, Cabanac au nord et Villagrains à 5,6 kilomètres au sud-ouest, encore séparés aujourd'hui par la forêt.",
    housing:
      "Avec 69 km² pour 2 400 habitants, Cabanac-et-Villagrains est la commune la moins densément peuplée du territoire, devant Saucats : 35 habitants au kilomètre carré, contre 386 à Castres-Gironde. L'habitat est fait de maisons sur grands terrains et de hameaux dispersés dans la pinède, dont l'exploitation fait vivre la commune depuis le XVIIIe siècle. La conséquence pratique est constante : aiguilles de pin sur les terrasses, résine sur les menuiseries extérieures, et des trajets d'une adresse à l'autre qui dépassent parfois dix minutes à l'intérieur même de la commune.",
    landmarks: [
      "le bourg de Cabanac, où se trouve la mairie",
      "le village de Villagrains, à 5,6 km au sud-ouest",
      "les deux églises néo-gothiques, orientées chœur à l'ouest contrairement à l'usage",
      "la forêt de pins maritimes, en lisière des Landes de Gascogne",
    ],
    faq: [
      {
        question: "Intervenez-vous à Villagrains comme à Cabanac ?",
        answer:
          "Oui, dans les deux villages, au même tarif. Les 5,6 kilomètres qui les séparent sont pris en compte dans la construction des tournées : les interventions d'un même village sont regroupées sur une même demi-journée.",
      },
      {
        question: "Le ménage comprend-il l'entretien de la terrasse ?",
        answer:
          "Non, l'entretien courant porte sur l'intérieur du logement. Le balayage et le nettoyage d'une terrasse — souvent demandés ici en raison des aiguilles de pin — relèvent de l'option grand ménage, qui ajoute quarante-cinq minutes.",
      },
    ],
  },

  "saint-morillon": {
    slug: "saint-morillon",
    driveMinutesFromLeognan: 21,
    driveKmFromLeognan: 13.5,
    intro:
      "LéoClean intervient à Saint-Morillon, commune de 1 834 habitants située dans le vignoble des Graves, sur le Gat Mort. C'est la commune la plus longue à rejoindre depuis Léognan : 21 minutes pour seulement 13,5 kilomètres, faute d'axe direct entre les deux bourgs.",
    housing:
      "Saint-Morillon compte 90 habitants au kilomètre carré, à mi-chemin entre les communes de bourg de la vallée de la Garonne et les communes forestières du sud du territoire. L'habitat se répartit entre un centre resserré autour de l'église Saint-Maurille et des maisons isolées entre vignes et bois. Le bâti ancien y est bien représenté, avec les contraintes qui vont avec : tomettes, plinthes moulurées et escaliers en bois, qui demandent un traitement à part et allongent l'intervention.",
    landmarks: [
      "l'église Saint-Maurille, des XIe-XIIe siècles, inscrite aux monuments historiques",
      "le château de Bel Air, inscrit aux monuments historiques depuis 1986",
      "la nécropole du Graveyron, au confluent du Gat Mort et du ruisseau de Mitaud",
      "les parcelles de l'appellation Graves",
    ],
    faq: [
      {
        question:
          "L'éloignement de Saint-Morillon limite-t-il les créneaux disponibles ?",
        answer:
          "Il les concentre plutôt qu'il ne les limite. Saint-Morillon étant la commune la plus longue à rejoindre, LéoClean y programme les interventions sur des journées dédiées au sud du territoire, partagées avec Saint-Selve et Cabanac-et-Villagrains. Le tarif, lui, reste identique.",
      },
      {
        question: "Entretenez-vous les sols anciens et les parquets ?",
        answer:
          "Oui. Tomettes, parquets et carreaux de ciment sont traités avec des produits adaptés et sans excès d'eau. Signalez-les à la réservation : nous ajoutons le temps nécessaire plutôt que de les traiter à la va-vite.",
      },
    ],
  },

  "ayguemorte-les-graves": {
    slug: "ayguemorte-les-graves",
    driveMinutesFromLeognan: 16,
    driveKmFromLeognan: 11.2,
    intro:
      "LéoClean intervient à Ayguemorte-les-Graves, commune de 1 425 habitants située à 16 minutes de route de Léognan, sur le Saucats. Son nom vient du latin aqua mortua, « eau stagnante » : la commune est en partie bâtie sur des terrains alluvionnaires et fait l'objet d'un plan de prévention du risque inondation.",
    housing:
      "Ayguemorte-les-Graves tient dans 6,3 km² et compte 225 habitants au kilomètre carré. Le sol humide n'est pas une anecdote toponymique : au XIXe siècle, l'église romane a dû être remplacée parce que l'instabilité des terrains marécageux l'avait rendue insalubre. Dans les logements de plain-pied du bourg, cela se traduit chaque hiver par de la condensation sur les vitrages, des traces au bas des murs et des joints qui noircissent — trois points que nos intervenants traitent en priorité entre novembre et mars.",
    landmarks: [
      "l'église Saint-Clément-de-Coma, bâtie au XIXe siècle sur des terrains alluvionnaires",
      "le cours du Saucats, avant sa confluence avec la Garonne",
      "l'échangeur n° 1.1 de l'A62, dit « de La Brède », situé sur la commune",
      "les allées pavillonnaires du Clos des Cerisiers",
    ],
    faq: [
      {
        question: "Traitez-vous les moisissures et la condensation ?",
        answer:
          "Le nettoyage des joints, des appuis de fenêtre et des bas de murs fait partie de l'entretien courant, et c'est une demande fréquente à Ayguemorte-les-Graves en hiver. En revanche, un traitement d'humidité structurelle relève d'une entreprise du bâtiment, pas d'un service de ménage : nous vous le disons plutôt que de nettoyer un problème qui reviendra.",
      },
      {
        question: "La commune est-elle facile d'accès depuis l'autoroute ?",
        answer:
          "Oui, l'échangeur n° 1.1 de l'A62, dit « de La Brède », se trouve sur le territoire communal. Pour LéoClean, l'itinéraire depuis Léognan passe toutefois par la route départementale : 16 minutes pour 11,2 kilomètres.",
      },
    ],
  },

  "isle-saint-georges": {
    slug: "isle-saint-georges",
    driveMinutesFromLeognan: 18,
    driveKmFromLeognan: 12.4,
    intro:
      "LéoClean intervient à Isle-Saint-Georges, commune de 502 habitants située à 18 minutes de route de Léognan, au confluent de la Garonne et du Saucats. C'est la plus petite commune de notre zone d'intervention, en population comme en superficie : 4,4 km².",
    housing:
      "Isle-Saint-Georges est un bourg compact posé dans les palus de la Garonne, sur un site occupé depuis le VIIIe siècle avant notre ère : le gué en faisait un carrefour de la voie antique vers Burdigala. Le bâti se lit dans les noms de rues relevés à la Base Adresse Nationale — rue du Lavoir, rue du Puits, rue du Port, rue des Gravettes. Ce sont pour l'essentiel des maisons de bourg mitoyennes, avec des pièces de taille modeste et souvent un étage : le ménage y prend deux à deux heures et demie, escalier compris.",
    landmarks: [
      "le confluent de la Garonne et du Saucats",
      "le site archéologique protohistorique et gallo-romain du gué",
      "l'église Saint-Georges, construite en 1852",
      "les rues du Lavoir, du Puits et du Port, dans le bourg",
    ],
    faq: [
      {
        question:
          "Avec 502 habitants, disposez-vous vraiment d'un intervenant à Isle-Saint-Georges ?",
        answer:
          "Oui. Isle-Saint-Georges est desservie sur les mêmes journées qu'Ayguemorte-les-Graves et Beautiran, ses voisines immédiates : c'est ce regroupement qui rend le service viable dans une commune de cette taille, et qui permet d'y proposer un intervenant attitré comme ailleurs.",
      },
      {
        question: "Comment se passe le ménage dans une maison à étage ?",
        answer:
          "L'escalier, les paliers et les chambres à l'étage sont compris dans l'entretien courant. Comptez environ trente minutes de plus qu'un logement de plain-pied de même surface, l'aspirateur devant être monté et les sols traités séparément.",
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
