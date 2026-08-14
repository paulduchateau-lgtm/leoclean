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
  /** Ce que l'intention a de particulier dans cette commune. Unique. */
  text: string;
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
      "Trouver une femme de ménage à {commune} : emploi direct, mandataire ou prestation, ce que chaque solution implique. LéoClean intervient à {commune} à partir de 29 €/h, sans lien d'employeur.",
    lede: "« Femme de ménage » est le mot que tout le monde emploie, et le métier est très majoritairement exercé par des femmes. Il recouvre pourtant trois situations juridiques différentes, qui n'engagent pas du tout la même chose de votre part. Savoir laquelle vous cherchez évite la plupart des mauvaises surprises.",
    sections: [
      {
        heading: "Employer ou faire appel : ce n'est pas la même chose",
        paragraphs: [
          "Recruter quelqu'un directement et le déclarer au CESU fait de vous un employeur. Vous rédigez un contrat, vous appliquez la convention collective des particuliers employeurs, vous décomptez des congés payés, et vous conduisez une procédure de licenciement le jour où la relation s'arrête. C'est la solution la moins chère à l'heure, et la plus exigeante à tenir.",
          "Passer par un organisme mandataire allège la gestion sans transférer la responsabilité : l'organisme recrute et édite les bulletins de paie, mais le contrat de travail vous lie toujours directement à la personne. C'est le point qu'on découvre souvent au mauvais moment.",
          "Réserver une prestation, enfin, ne fait de vous l'employeur de personne. C'est le modèle de LéoClean : des intervenants indépendants, qui choisissent leurs clients et leurs horaires, et à qui vous achetez un travail fait — pas un temps de travail.",
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
          "C'est pourquoi une formule régulière chez LéoClean est attribuée à un intervenant attitré, et non au premier disponible. En cas d'absence, un remplaçant est proposé et annoncé à l'avance.",
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
          "C'est le terme d'usage, et celui que les clients emploient. Les intitulés officiels parlent d'agent d'entretien ou d'assistant ménager, et le métier reste exercé à plus de 90 % par des femmes. LéoClean recrute sans distinction de genre.",
      },
    ],
    communes: {
      "villenave-d-ornon": {
        text: "Villenave-d'Ornon est la commune du territoire où la demande est la plus forte et la rotation la plus rapide : 42 545 habitants, une part d'appartements bien supérieure au reste de la zone, et des locataires qui changent souvent de logement. Cela joue dans les deux sens — le vivier d'intervenants y est le plus large, mais les meilleurs créneaux, ceux du milieu de matinée, partent vite.",
        faq: [
          {
            question:
              "Combien de temps pour trouver quelqu'un à Villenave-d'Ornon ?",
            answer:
              "C'est la commune où LéoClean dispose du plus grand nombre d'intervenants après Léognan. Une première intervention est généralement programmée sous 48 à 72 heures, y compris en appartement.",
          },
        ],
      },
      gradignan: {
        text: "À Gradignan, deux demandes coexistent sans se ressembler. Les familles installées dans les maisons boisées du secteur cherchent un entretien hebdomadaire durable, sur plusieurs années. Les logements étudiants proches du campus cherchent un ménage de sortie, en juin ou en septembre, une fois pour toutes. Le premier appelle un intervenant attitré, le second une intervention ponctuelle.",
        faq: [
          {
            question: "Intervenez-vous dans les logements étudiants ?",
            answer:
              "Oui, essentiellement pour des ménages de fin de bail, au tarif ponctuel de 33 € de l'heure. Un studio ou un T1 se traite en deux heures, la durée minimale facturée.",
          },
        ],
      },
      cestas: {
        text: "Cestas pose un problème que les autres communes ne posent pas : ses quartiers sont si distants les uns des autres — Cestas-Bourg, Gazinet, Toctoucau — qu'un intervenant qui habite l'un d'eux n'est pas nécessairement proche de vous. Chercher « une femme de ménage à Cestas » sans préciser le secteur revient à chercher dans 100 km². C'est la première question que nous posons au téléphone.",
        faq: [
          {
            question: "Vos intervenants habitent-ils Cestas ?",
            answer:
              "Une partie oui, et c'est ce qui rend la commune tenable malgré son étendue. Nous attribuons en priorité un intervenant du même secteur que vous — Bourg, Gazinet ou Toctoucau — plutôt qu'un intervenant de la commune au sens large.",
          },
        ],
      },
      leognan: {
        text: "Léognan est la commune où vivent la plupart des intervenants LéoClean, ce qui change concrètement deux choses : les délais y sont les plus courts du territoire, et l'intervenant qui vient chez vous est souvent quelqu'un que vous croisez au marché. Ce n'est pas un argument sentimental — c'est ce qui explique qu'un rendez-vous soit rarement annulé ici.",
        faq: [
          {
            question:
              "Peut-on rencontrer l'intervenant avant la première intervention ?",
            answer:
              "Oui, et c'est fréquent à Léognan compte tenu des distances. Une visite de dix minutes suffit à faire le tour du logement, à convenir des priorités et des modalités d'accès.",
          },
        ],
      },
      cadaujac: {
        text: "Cadaujac est une commune de familles et de maisons de plain-pied, souvent construites depuis moins de vingt ans. La demande y est très majoritairement régulière — un passage par semaine ou tous les quinze jours, aux mêmes horaires — plutôt que ponctuelle. C'est le profil sur lequel un intervenant attitré prend tout son sens : au bout de trois mois, il n'a plus besoin de consignes.",
        faq: [
          {
            question: "Peut-on fixer un jour et une heure fixes à Cadaujac ?",
            answer:
              "Oui, c'est le principe de la formule régulière : un créneau réservé, le même chaque semaine ou toutes les deux semaines, avec le même intervenant. C'est aussi ce qui permet le tarif de 29 € de l'heure plutôt que 33 €.",
          },
        ],
      },
      "la-brede": {
        text: "À La Brède, le bâti ancien du bourg change ce qu'on attend d'un intervenant. Tomettes, parquets non vitrifiés, menuiseries à petits carreaux, hauteurs sous plafond : ce sont des surfaces qui se dégradent si on les traite comme du carrelage récent. Chercher une femme de ménage à La Brède, c'est souvent chercher quelqu'un qui a déjà travaillé dans ce type de maison.",
        faq: [
          {
            question: "Vos intervenants savent-ils traiter les sols anciens ?",
            answer:
              "Oui, et nous le vérifions à l'entretien de recrutement. Tomettes, parquets et carreaux de ciment se nettoient sans excès d'eau et avec des produits neutres ; signalez-les à la réservation pour que nous vous attribuions un intervenant à l'aise avec ce bâti.",
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
          "LéoClean repasse chez vous. Le linge ne quitte pas la maison, ne se mélange pas à celui d'autres foyers, et ne se perd pas. Vous n'avez rien à déposer ni à récupérer, et vous voyez ce qui est fait.",
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
          "Oui. LéoClean repasse à votre domicile, avec votre matériel : une table à repasser et un fer en état de marche sont nécessaires. Une centrale vapeur divise le temps par deux environ sur le linge de lit.",
      },
      {
        question: "Le repassage coûte-t-il plus cher que le ménage ?",
        answer:
          "Non, c'est le même tarif horaire : 29 € de l'heure en formule régulière, 33 € en intervention ponctuelle. Le repassage n'est pas une prestation majorée, c'est une prestation plus lente au kilo.",
      },
    ],
    communes: {
      "villenave-d-ornon": {
        text: "En appartement, le repassage pose une question de place avant de poser une question de temps : il faut déplier une table, et de quoi suspendre ce qui sort du fer. À Villenave-d'Ornon, où les appartements sont plus nombreux qu'ailleurs sur le territoire, nous convenons de cet emplacement dès la première intervention plutôt que de le chercher chaque fois.",
        faq: [
          {
            question: "Peut-on repasser dans un petit appartement ?",
            answer:
              "Oui, dès lors qu'une table à repasser peut être dépliée et qu'un point de suspension existe — tringle, porte, portant. C'est le cas dans la quasi-totalité des logements où nous intervenons à Villenave-d'Ornon.",
          },
        ],
      },
      gradignan: {
        text: "Gradignan est une commune de familles avec enfants scolarisés, et le rythme du repassage y suit celui de l'école : les corbeilles gonflent le week-end et se vident en début de semaine. Les créneaux du lundi et du mardi matin y sont, de loin, les plus demandés pour cette prestation.",
        faq: [
          {
            question: "Quel jour réserver le repassage à Gradignan ?",
            answer:
              "Le lundi et le mardi matin sont les créneaux les plus demandés, la corbeille du week-end étant alors au plus haut. Ce sont aussi les premiers à partir : mieux vaut réserver un créneau récurrent qu'appeler chaque semaine.",
          },
        ],
      },
      leognan: {
        text: "À Léognan, le repassage est presque toujours pris en option d'un ménage régulier plutôt qu'en prestation seule : les intervenants y sont déjà sur place chaque semaine, et une heure de plus sur un créneau existant coûte moins cher qu'un déplacement dédié de deux heures.",
        faq: [
          {
            question:
              "Vaut-il mieux ajouter le repassage au ménage ou le réserver seul ?",
            answer:
              "L'ajouter, dans presque tous les cas. Une heure de repassage greffée sur un ménage existant coûte 29 € ; une prestation seule impose le minimum de deux heures, soit 58 €, pour la même corbeille.",
          },
        ],
      },
      cadaujac: {
        text: "Les maisons de Cadaujac, majoritairement récentes et de plain-pied, disposent presque toujours d'un cellier ou d'une buanderie. Le repassage s'y fait sur place, à côté du sèche-linge, sans traverser la maison avec une pile de linge propre — un détail qui fait gagner un quart d'heure sur une corbeille familiale.",
        faq: [
          {
            question: "Où le repassage est-il effectué dans la maison ?",
            answer:
              "Là où le linge se trouve : buanderie, cellier ou pièce de vie, selon ce qui est le plus pratique chez vous. C'est convenu à la première intervention et ne change plus ensuite.",
          },
        ],
      },
      "saint-selve": {
        text: "Saint-Selve est la commune où le repassage est le plus souvent demandé sur le territoire. Les maisons y sont spacieuses, de 100 à 150 m², presque toutes équipées d'une buanderie, et les foyers y sont plutôt familiaux — trois conditions qui font une corbeille conséquente chaque semaine.",
        faq: [
          {
            question:
              "Peut-on réserver deux heures de repassage seul à Saint-Selve ?",
            answer:
              "Oui, c'est le format le plus courant dans la commune. Deux heures correspondent à la durée minimale d'intervention et couvrent largement une corbeille familiale hebdomadaire, pliage compris.",
          },
        ],
      },
      martillac: {
        text: "Martillac compte une forte proportion de jeunes ménages actifs, dont le linge s'accumule pendant la semaine faute de temps le soir. La demande y porte moins sur le volume que sur la régularité : une heure toutes les semaines, greffée sur un entretien courant, plutôt qu'un rattrapage mensuel de quatre heures.",
        faq: [
          {
            question:
              "Le repassage peut-il se faire pendant nos heures de bureau ?",
            answer:
              "Oui, comme le ménage : c'est le cas le plus fréquent à Martillac. L'accès se fait par clé confiée ou par code, convenu à la réservation, et le linge repassé est rangé ou laissé sur cintres selon votre consigne.",
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
