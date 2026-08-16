import { type Commune, getCommuneBySlug } from "./territory";

/**
 * Intentions secondaires.
 *
 * « Ménage à domicile à Léognan » et « femme de ménage à Léognan » ne sont pas
 * la même requête. La première cherche une prestation à acheter ; la seconde
 * cherche d'abord à savoir comment on s'y prend — qui on emploie, comment on
 * déclare, à quoi on s'expose. « Repassage à Léognan » cherche encore autre
 * chose : une prestation distincte, avec ses propres contraintes matérielles.
 *
 * D'où ces deux familles de pages, séparées des pages communes. Elles n'ont de
 * légitimité que si elles répondent réellement à une autre question : une page
 * qui reformulerait la page commune serait une page satellite, et serait
 * traitée comme telle.
 *
 * Deux garde-fous s'appliquent :
 *
 * 1. **Le déploiement est restreint.** Ces pages n'existent que là où
 *    l'intention a un volume plausible — six communes, pas seize — et les deux
 *    intentions ne couvrent pas les mêmes : le repassage se demande là où il y
 *    a des buanderies et des familles, pas là où il y a du passage.
 * 2. **Chaque commune a son propre paragraphe.** Le corps commun explique
 *    l'intention ; le paragraphe local dit ce qui, dans cette commune-là, la
 *    rend différente. Un test refuse les doublons.
 */

export type IntentionSlug = "femme-de-menage" | "repassage";

export interface IntentionLocal {
  /**
   * Ce que l'intention a de particulier dans cette commune.
   *
   * Une suite de paragraphes, comme les sections communes : c'est la part de
   * la page qui n'existe que pour ce lieu, et elle doit peser assez lourd
   * pour que la page ne soit pas une variante de sa voisine. Le relevé du
   * 16 août 2026 la voulait au-dessus du tiers — voir
   * `docs/AUDIT-DUPLICATION.md`.
   */
  paragraphs: readonly string[];
  faq: readonly { question: string; answer: string }[];
}

export interface Intention {
  slug: IntentionSlug;
  /** Titre de page, `{commune}` remplacé au rendu. */
  titleTemplate: string;
  descriptionTemplate: string;
  /** Chapeau commun : ce que l'intention veut dire, indépendamment du lieu. */
  lede: string;
  sections: readonly { heading: string; paragraphs: readonly string[] }[];
  /** Questions communes à l'intention, quelle que soit la commune. */
  sharedFaq: readonly { question: string; answer: string }[];
  /** Communes où la page est publiée, par population décroissante. */
  communes: Record<string, IntentionLocal>;
}

const INTENTIONS: readonly Intention[] = [
  {
    slug: "femme-de-menage",
    titleTemplate: "Femme de ménage à {commune} : comment en trouver une",
    descriptionTemplate:
      "Trouver une femme de ménage à {commune} : emploi direct, mandataire ou prestation, ce que chaque solution implique. Léo Clean intervient à {commune} à partir de 29 €/h, sans lien d'employeur.",
    lede: "« Femme de ménage » est le mot que tout le monde emploie, et le métier est très majoritairement exercé par des femmes. Il recouvre pourtant trois situations juridiques différentes, qui n'engagent pas du tout la même chose de votre part. Savoir laquelle vous cherchez évite la plupart des mauvaises surprises.",
    sections: [
      {
        heading: "Employer ou faire appel : ce n'est pas la même chose",
        paragraphs: [
          "Recruter quelqu'un directement et le déclarer au CESU fait de vous un employeur. Vous rédigez un contrat, vous appliquez la convention collective des particuliers employeurs, vous décomptez des congés payés, et vous conduisez une procédure de licenciement le jour où la relation s'arrête. C'est la solution la moins chère à l'heure, et la plus exigeante à tenir.",
          "Passer par un organisme mandataire allège la gestion sans transférer la responsabilité : l'organisme recrute et édite les bulletins de paie, mais le contrat de travail vous lie toujours directement à la personne. C'est le point qu'on découvre souvent au mauvais moment.",
          "Réserver une prestation, enfin, ne fait de vous l'employeur de personne. C'est le modèle de Léo Clean : des intervenants indépendants, qui choisissent leurs clients et leurs horaires, et à qui vous achetez un travail fait — pas un temps de travail.",
        ],
      },
      {
        heading: "Ce qu'il faut vérifier avant de confier ses clés",
        paragraphs: [
          "Trois vérifications suffisent, et elles se font en une conversation : la personne est-elle déclarée, est-elle assurée en responsabilité civile professionnelle, et que se passe-t-il si elle est absente un mardi de février.",
          "La dernière question est celle qui départage vraiment. Un intervenant seul, quel que soit son sérieux, ne peut pas se remplacer lui-même. Un organisme le peut — encore faut-il qu'il s'y engage, et qu'il vous prévienne à l'avance plutôt que le matin même.",
        ],
      },
      {
        heading: "Le même intervenant, à chaque passage",
        paragraphs: [
          "Une femme de ménage qu'on retrouve chaque semaine finit par connaître la maison : où sont les produits, quel sol supporte quoi, ce qu'il ne faut pas déplacer. Ce savoir-là ne se transmet pas dans une fiche de mission, et c'est lui qui fait la différence entre un logement nettoyé et un logement entretenu.",
          "C'est pourquoi une formule régulière chez Léo Clean est attribuée à un intervenant attitré, et non au premier disponible. En cas d'absence, un remplaçant est proposé et annoncé à l'avance.",
        ],
      },
    ],
    sharedFaq: [
      {
        question: "Faut-il déclarer une femme de ménage ?",
        answer:
          "Oui, dès lors qu'elle est employée directement : le travail dissimulé expose l'employeur à des sanctions pénales et à un rappel de cotisations. Lorsque vous réservez une prestation auprès d'un organisme ou d'un intervenant indépendant, vous n'êtes pas l'employeur et n'avez aucune déclaration à faire.",
      },
      {
        question: "Dit-on encore « femme de ménage » ?",
        answer:
          "C'est le terme d'usage, et celui que les clients emploient. Les intitulés officiels parlent d'agent d'entretien ou d'assistant ménager, et le métier reste exercé à plus de 90 % par des femmes. Léo Clean recrute sans distinction de genre.",
      },
    ],
    communes: {
      leognan: {
        paragraphs: [
          "Léognan est la commune où vivent la plupart des intervenants Léo Clean, et cela change concrètement trois choses. Les délais y sont les plus courts du territoire : une première intervention se cale souvent sous quarante-huit heures, là où il faut compter davantage aux extrémités de la zone. Les annulations y sont rares, parce qu'un trajet de cinq minutes ne se heurte ni aux embouteillages de la rocade ni à un imprévu de garde d'enfant. Et l'intervenant qui vient chez vous est souvent quelqu'un que vous croisez au marché du mercredi : ce n'est pas un argument sentimental, c'est ce qui fait qu'on prévient la veille au lieu de ne pas venir.",
          "Le bâti de Léognan pèse aussi sur ce qu'on attend d'une femme de ménage. La commune mêle un bourg ancien, des lotissements pavillonnaires des années 1980 et 1990, et de grandes propriétés de l'appellation Pessac-Léognan. Les lotissements dominent en nombre : maisons de 90 à 140 m² sur un niveau ou deux, avec un garage et une véranda que personne ne compte dans la surface habitable et qui prennent pourtant une demi-heure. Les propriétés viticoles, elles, posent une autre question — des volumes qu'on ne traite pas en une intervention, et une saisonnalité qui culmine autour des vendanges, quand la maison reçoit.",
          "Une dernière particularité, propre à une commune de dix mille six cent soixante-dix habitants où tout le monde se connaît : la discrétion se demande explicitement. Nos intervenants ne commentent jamais un intérieur, et c'est une consigne écrite, pas une politesse.",
        ],
        faq: [
          {
            question:
              "Peut-on rencontrer l'intervenant avant la première intervention ?",
            answer:
              "Oui, et c'est fréquent à Léognan compte tenu des distances. Une visite de dix minutes suffit à faire le tour du logement, à convenir des priorités et des modalités d'accès. Elle n'est pas facturée.",
          },
          {
            question: "Quel est le délai pour une première venue à Léognan ?",
            answer:
              "C'est la commune la plus rapide du territoire, parce que la plupart des intervenants Léo Clean y habitent : comptez généralement quarante-huit heures pour un premier créneau, contre trois à cinq jours aux extrémités de la zone.",
          },
          {
            question:
              "Intervenez-vous dans les propriétés viticoles de Pessac-Léognan ?",
            answer:
              "Oui, sur la partie habitation. Au-delà de 400 m², nous organisons deux passages plutôt qu'une intervention unique : six heures d'affilée sont intenables et le travail s'en ressent. Appelez-nous au 06 84 36 38 62, ces logements se chiffrent mieux de vive voix.",
          },
        ],
      },
      gradignan: {
        paragraphs: [
          "À Gradignan, deux demandes coexistent sans se ressembler, et la première question que nous posons est de savoir dans laquelle vous vous reconnaissez. Les familles installées dans les maisons boisées du secteur — Cayac, les abords du parc de Mandavit, les rues résidentielles vers Malartic — cherchent un entretien hebdomadaire qui dure des années, avec la même personne. Les logements étudiants proches du campus cherchent l'inverse : un ménage de sortie, en juin ou en septembre, une fois pour toutes. Le premier appelle un intervenant attitré et un tarif régulier ; le second une intervention ponctuelle, dont la date est connue trois mois à l'avance mais jamais réservée avant la dernière semaine.",
          "Le caractère boisé de la commune n'est pas qu'un agrément : il ajoute du travail. Les maisons de Gradignan sont majoritairement de 100 à 130 m² sur terrain arboré, et l'entretien y demande trois heures à trois heures et demie. Les feuilles entrent avec les chaussures d'octobre à décembre, le pollen des pins se dépose en avril sur les rebords et les vitres, et les terrasses en bois demandent un passage à part que nous chiffrons séparément plutôt que de le glisser dans une heure déjà prise.",
          "Avec 26 952 habitants, Gradignan est la deuxième commune la plus peuplée de notre zone et la plus dense après Villenave-d'Ornon. Le vivier d'intervenants y est donc large, mais les créneaux du milieu de matinée en semaine — ceux que cherchent les foyers où personne n'est là dans la journée — sont les premiers pris.",
        ],
        faq: [
          {
            question: "Intervenez-vous dans les logements étudiants ?",
            answer:
              "Oui, essentiellement pour des ménages de fin de bail, au tarif ponctuel de 33 € de l'heure. Un studio ou un T1 se traite en deux heures, la durée minimale facturée. À Gradignan, ces demandes se concentrent en juin et en septembre : réservez dix jours à l'avance sur ces deux mois.",
          },
          {
            question:
              "Le jardin arboré change-t-il la durée d'un ménage à Gradignan ?",
            answer:
              "À l'intérieur, oui, d'environ une demi-heure en automne et au printemps : feuilles rapportées sur les sols, pollen de pin sur les rebords et les vitres. L'entretien de la terrasse et des abords est une prestation distincte, que nous chiffrons à part plutôt que de la prendre sur une heure déjà réservée.",
          },
          {
            question:
              "Trouve-t-on facilement un créneau du matin à Gradignan ?",
            answer:
              "C'est la deuxième commune la plus peuplée du territoire, donc celle où nous avons le plus d'intervenants après Léognan et Villenave-d'Ornon. Les créneaux de 9 h à 12 h en semaine partent néanmoins les premiers : comptez une semaine d'avance pour en obtenir un régulier.",
          },
        ],
      },
      "villenave-d-ornon": {
        paragraphs: [
          "Villenave-d'Ornon est la commune du territoire où la demande est la plus forte et la rotation la plus rapide. Avec 42 545 habitants, c'est la plus peuplée de notre zone, et celle où la part d'appartements dépasse nettement le reste du secteur. Cela joue dans les deux sens : le vivier d'intervenants y est le plus large après Léognan, mais les meilleurs créneaux — ceux du milieu de matinée, quand le logement est vide — partent en quelques jours.",
          "La commune s'étend de la Garonne aux coteaux et mêle des quartiers qui n'ont presque rien en commun. Le long de la ligne C du tramway, les résidences récentes abritent surtout des locataires, souvent seuls ou en couple, qui déménagent tous les deux ou trois ans : la demande y est faite d'appartements de 50 à 80 m² traités en deux à trois heures, et de ménages de fin de bail. Le bourg ancien et ses maisons de ville posent l'inverse — des surfaces plus grandes, des sols mêlés, et des foyers installés pour longtemps. Les secteurs résidentiels vers Sarcignan et Chambéry relèvent du pavillonnaire classique, avec des demandes hebdomadaires régulières.",
          "Dire « je cherche une femme de ménage à Villenave-d'Ornon » ne suffit donc pas à nous permettre de vous proposer quelqu'un : c'est le quartier qui détermine le trajet de l'intervenant, et le trajet qui détermine si un créneau tient. Le code postal 33140 couvre onze kilomètres du nord au sud.",
        ],
        faq: [
          {
            question:
              "Combien de temps pour trouver quelqu'un à Villenave-d'Ornon ?",
            answer:
              "C'est la commune où Léo Clean dispose du plus grand nombre d'intervenants après Léognan. Une première intervention est généralement programmée sous 48 à 72 heures, y compris en appartement.",
          },
          {
            question:
              "Combien coûte un ménage d'appartement à Villenave-d'Ornon ?",
            answer:
              "Un appartement de 60 m² demande environ deux heures et demie, soit 72,50 € en formule régulière à 29 € de l'heure et 82,50 € en intervention ponctuelle à 33 €. C'est la configuration la plus fréquente le long du tramway.",
          },
          {
            question: "Le quartier compte-t-il pour être servi rapidement ?",
            answer:
              "Oui, plus qu'ailleurs : Villenave-d'Ornon s'étend de la Garonne aux coteaux sur onze kilomètres. Nous attribuons en priorité un intervenant du même secteur que vous — corridor du tramway, bourg, ou Sarcignan et Chambéry — parce que c'est ce qui rend un créneau du matin tenable.",
          },
        ],
      },
    },
  },

  {
    slug: "repassage",
    titleTemplate: "Repassage à domicile à {commune}",
    descriptionTemplate:
      "Repassage à domicile à {commune} : en option d'un ménage ou en prestation seule, à partir de 29 €/h, minimum 2 heures. Votre linge reste chez vous.",
    lede: "Le repassage se compte en corbeilles, pas en mètres carrés. Une corbeille familiale de deux à trois jours représente environ une heure de travail — chemises, draps et linge délicat compris, qui prennent chacun beaucoup plus de temps qu'un tee-shirt.",
    sections: [
      {
        heading: "À domicile plutôt qu'en atelier",
        paragraphs: [
          "Léo Clean repasse chez vous. Le linge ne quitte pas la maison, ne se mélange pas à celui d'autres foyers, et ne se perd pas. Vous n'avez rien à déposer ni à récupérer, et vous voyez ce qui est fait.",
          "La contrepartie est matérielle : il faut une table et un fer en état de marche, et un endroit où poser ce qui est repassé. C'est le seul équipement que nous ne fournissons pas, pour la même raison que les produits d'entretien — vous savez ce qui convient à votre linge.",
        ],
      },
      {
        heading: "En option d'un ménage, ou seul",
        paragraphs: [
          "Le plus souvent, le repassage s'ajoute à un ménage régulier : une heure de plus sur un créneau déjà réservé, sans déplacement supplémentaire. C'est la formule la plus économique, et celle qui donne la meilleure régularité — le linge ne s'accumule pas.",
          "Le repassage seul est possible, avec le même minimum de deux heures que toute intervention. Il convient aux foyers qui font leur ménage eux-mêmes mais renoncent devant la corbeille, et aux périodes chargées : rentrée, retour de vacances, semaine de réception.",
        ],
      },
      {
        heading: "Ce qui est repassé, et ce qui ne l'est pas",
        paragraphs: [
          "Chemises, chemisiers, pantalons, robes, draps, taies, nappes et serviettes : tout le linge courant du foyer. Le pliage et le rangement dans les armoires font partie de la prestation, si vous le souhaitez.",
          "Les vêtements exigeant un traitement professionnel — costumes structurés, soie fragile, cuir, pièces à repasser sous presse — relèvent d'un pressing, pas d'un repassage à domicile. Nous le disons plutôt que d'abîmer une pièce à laquelle vous tenez.",
        ],
      },
    ],
    sharedFaq: [
      {
        question: "Combien de temps pour une corbeille de repassage ?",
        answer:
          "Comptez environ une heure pour la corbeille d'un foyer de quatre personnes accumulée sur deux à trois jours. Les chemises et le linge de lit sont les postes les plus lents : une chemise demande cinq à sept minutes, un drap housse davantage.",
      },
      {
        question: "Faut-il fournir le fer et la table à repasser ?",
        answer:
          "Oui. Léo Clean repasse à votre domicile, avec votre matériel : une table à repasser et un fer en état de marche sont nécessaires. Une centrale vapeur divise le temps par deux environ sur le linge de lit.",
      },
      {
        question: "Le repassage coûte-t-il plus cher que le ménage ?",
        answer:
          "Non, c'est le même tarif horaire : 29 € de l'heure en formule régulière, 33 € en intervention ponctuelle. Le repassage n'est pas une prestation majorée, c'est une prestation plus lente au kilo.",
      },
    ],
    communes: {
      leognan: {
        paragraphs: [
          "À Léognan, le repassage est presque toujours demandé en complément d'un ménage régulier plutôt que seul, et c'est la formule qui a du sens ici : la plupart de nos intervenants habitent la commune, si bien qu'une heure supplémentaire sur un créneau déjà réservé ne coûte aucun déplacement. Ajouter le repassage à un entretien hebdomadaire revient à passer de trois heures à quatre, au même tarif horaire de 29 € en formule régulière, sans nouveau rendez-vous à caler.",
          "Le bâti de la commune explique le volume. Les maisons de Léognan font le plus souvent 90 à 140 m², avec un cellier ou une buanderie où la corbeille s'accumule à l'abri des regards — donc plus longtemps qu'ailleurs. Une corbeille de foyer de quatre personnes accumulée sur deux à trois jours représente environ une heure ; celle qui attend depuis une semaine en demande deux, et il vaut mieux le savoir avant de réserver deux heures en pensant que ce sera large.",
          "Une demande revient régulièrement dans les propriétés de l'appellation Pessac-Léognan : le linge de table. Nappes et grandes serviettes se repassent lentement et occupent toute la table à repasser, ce qui rend le poste peu compatible avec un créneau serré. Signalez-le à la réservation, que nous prévoyions le temps plutôt que de le prendre sur le reste.",
        ],
        faq: [
          {
            question: "Le repassage est-il facturé au même tarif à Léognan ?",
            answer:
              "Oui, 29 € de l'heure en formule régulière et 33 € en intervention ponctuelle, comme le ménage et comme dans les quinze autres communes desservies. Le repassage n'est pas une prestation à part au tarif : c'est du temps de travail, compté comme le reste.",
          },
          {
            question:
              "Peut-on ajouter le repassage à un ménage déjà réservé à Léognan ?",
            answer:
              "Oui, et c'est la formule la plus fréquente ici : une heure de plus sur un créneau existant, sans déplacement supplémentaire et sans second rendez-vous. Prévenez-nous au 06 84 36 38 62, l'intervenant en est informé avant sa venue.",
          },
          {
            question: "Repassez-vous le linge de table d'une grande maison ?",
            answer:
              "Oui, en le prévoyant : une nappe de banquet occupe la table à repasser à elle seule et demande dix à quinze minutes. Sur les propriétés viticoles de Léognan, nous réservons souvent une intervention distincte avant réception plutôt que d'intégrer ce poste à l'entretien courant.",
          },
        ],
      },
      gradignan: {
        paragraphs: [
          "À Gradignan, le repassage suit le rythme scolaire, et c'est ce qui le distingue des autres communes du territoire. Les maisons de 100 à 130 m² du secteur abritent majoritairement des familles, et la corbeille se remplit du lundi au vendredi : chemises, polos d'école, tenues de sport. Elle se vide mal le week-end, précisément parce que c'est le moment où l'on préfère être ailleurs. Un passage hebdomadaire fixe, en milieu de semaine, empêche l'accumulation bien mieux qu'un rattrapage mensuel — deux heures régulières valent mieux que quatre heures tous les mois, pour le même prix horaire.",
          "La proximité du campus crée une seconde demande, sans rapport avec la première. Les logements étudiants ne génèrent pratiquement pas de repassage pendant l'année ; ils en génèrent au moment du départ, avec le linge de lit et les rideaux d'un état des lieux de sortie. Ce n'est pas la même prestation, et elle se réserve en ponctuel, à 33 € de l'heure.",
          "Deuxième commune la plus peuplée de la zone avec 26 952 habitants, Gradignan est aussi celle où l'on nous demande le plus souvent d'intervenir en l'absence des occupants. Le repassage s'y prête bien : contrairement au ménage, il ne dérange personne et ne demande aucun accès particulier, hors la table, le fer et l'endroit où poser ce qui est fait.",
        ],
        faq: [
          {
            question:
              "Peut-on réserver du repassage seul, sans ménage, à Gradignan ?",
            answer:
              "Oui, avec le même minimum de deux heures que toute intervention Léo Clean. C'est ce que demandent les foyers qui font leur ménage eux-mêmes mais renoncent devant la corbeille. Sur une famille de quatre personnes, deux heures traitent environ deux corbeilles.",
          },
          {
            question: "Un passage hebdomadaire suffit-il pour une famille ?",
            answer:
              "Pour un foyer de quatre personnes à Gradignan, une heure de repassage par semaine tient le rythme sans accumulation. Le rattrapage mensuel coûte le même prix horaire mais se solde par des corbeilles de quatre heures, plus pénibles et moins bien faites.",
          },
          {
            question:
              "Intervenez-vous en notre absence pour le repassage à Gradignan ?",
            answer:
              "Oui, c'est même la demande la plus fréquente ici. Le repassage ne suppose aucun accès particulier : il faut une table, un fer en état de marche et un endroit où poser le linge fait. Les modalités d'entrée se conviennent une fois, à la première réservation.",
          },
        ],
      },
      "villenave-d-ornon": {
        paragraphs: [
          "Villenave-d'Ornon est la commune du territoire où le repassage seul est le plus souvent demandé, et la géographie l'explique. La part d'appartements y dépasse nettement le reste de la zone, en particulier le long de la ligne C du tramway : des logements de 50 à 80 m² où le ménage se fait en deux à trois heures, souvent par les occupants eux-mêmes, mais où la corbeille reste. S'ajoute une population qui travaille à Bordeaux et rentre par le tramway : la chemise repassée y est un besoin hebdomadaire, pas un confort.",
          "L'appartement pose une contrainte que la maison ne pose pas : la place. Il faut pouvoir déplier une table à repasser et poser ce qui est fait, dans un salon ou une chambre où tout est déjà occupé. C'est la première question que nous posons quand une réservation de repassage arrive d'un appartement du corridor du tramway, et elle évite qu'un intervenant découvre sur place qu'il n'a pas d'où travailler.",
          "Avec 42 545 habitants, Villenave-d'Ornon est la commune la plus peuplée de notre zone, et celle où le vivier d'intervenants est le plus large après Léognan. La contrepartie est la même que pour le ménage : les créneaux de fin de journée, ceux qui suivent le retour du tramway, sont les plus demandés et les premiers pris.",
        ],
        faq: [
          {
            question:
              "Faut-il beaucoup de place pour un repassage en appartement ?",
            answer:
              "Il faut de quoi déplier une table à repasser et poser le linge fait — environ deux mètres carrés dégagés. C'est la seule contrainte matérielle, et nous la vérifions à la réservation plutôt que de la découvrir sur place.",
          },
          {
            question:
              "Combien de chemises repasse-t-on en une heure à Villenave-d'Ornon ?",
            answer:
              "Comptez huit à dix chemises par heure, à raison de cinq à sept minutes chacune. Pour cinq chemises par semaine, une heure hebdomadaire suffit largement et laisse de la place pour le linge de lit.",
          },
          {
            question:
              "Peut-on avoir un créneau de repassage en fin de journée ?",
            answer:
              "Oui, jusqu'à 19 h du lundi au vendredi. Ce sont les créneaux les plus demandés à Villenave-d'Ornon, où beaucoup rentrent de Bordeaux par le tramway : réservez une semaine à l'avance pour un rendez-vous régulier après 17 h.",
          },
        ],
      },
    },
  },
];

export interface PublishedIntentionPage {
  intention: Intention;
  commune: Commune;
  local: IntentionLocal;
}

export function getIntention(slug: string): Intention | undefined {
  return INTENTIONS.find((intention) => intention.slug === slug);
}

/** Toutes les pages d'intention publiées, tous slugs confondus. */
export function publishedIntentionPages(): PublishedIntentionPage[] {
  return INTENTIONS.flatMap((intention) =>
    Object.entries(intention.communes).map(([slug, local]) => {
      const commune = getCommuneBySlug(slug);
      if (!commune) {
        throw new Error(
          `L'intention « ${intention.slug} » cible la commune inconnue « ${slug} ».`,
        );
      }
      return { intention, commune, local };
    }),
  );
}

export function getIntentionPage(
  intentionSlug: string,
  communeSlug: string,
): PublishedIntentionPage | undefined {
  const intention = getIntention(intentionSlug);
  const local = intention?.communes[communeSlug];
  const commune = getCommuneBySlug(communeSlug);
  return intention && local && commune
    ? { intention, commune, local }
    : undefined;
}

/** Pages d'une intention donnée, par population décroissante. */
export function intentionPages(
  intentionSlug: IntentionSlug,
): PublishedIntentionPage[] {
  return publishedIntentionPages()
    .filter((page) => page.intention.slug === intentionSlug)
    .sort((a, b) => b.commune.population - a.commune.population);
}

export const ALL_INTENTIONS = INTENTIONS;

/** Remplace `{commune}` dans un gabarit de titre ou de description. */
export function fillTemplate(template: string, communeName: string): string {
  return template.replaceAll("{commune}", communeName);
}
