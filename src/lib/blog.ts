import { formatEuros, formatHourlyRate } from "./pricing";
import {
  MINIMUM_BILLABLE_MINUTES,
  PUBLIC_RATES,
  STANDARD_SQM_PER_HOUR,
} from "./pricing/public-grid";

/**
 * Articles de conseil.
 *
 * Les pages par commune répondent à une intention géographique — « ménage à
 * Léognan ». Les articles répondent aux intentions qui ne portent pas de nom de
 * ville et qui précèdent l'achat : combien ça coûte, combien de temps ça prend,
 * quel statut choisir, comment se passe un état des lieux. Ce sont ces
 * requêtes-là que les modèles de langage reformulent le plus, et c'est là que
 * citer un chiffre exact vaut mieux que de bien écrire.
 *
 * Trois règles tiennent ce fichier :
 *
 * 1. **Aucun prix n'est écrit en dur.** Les montants sont dérivés de la grille
 *    publique, pour qu'un changement de tarif ne laisse pas un article
 *    mensonger derrière lui.
 * 2. **Toute règle de droit est citée avec sa source.** Un article qui affirme
 *    un plafond fiscal sans référence est invérifiable, donc inutilisable par
 *    un modèle — et risqué pour l'entreprise.
 * 3. **Un article qui suppose la déclaration SAP ne se publie pas avant
 *    elle.** Le drapeau `requiresSapDeclaration` le retire du site tant que
 *    `NEXT_PUBLIC_SAP_DECLARED` est faux : il existe, il est relu, il ne sort
 *    pas.
 */

/** Bloc de contenu. Le rendu n'accepte pas de HTML libre : pas d'injection. */
export type ArticleBlock =
  | { type: "paragraph"; text: string }
  | { type: "heading"; text: string }
  | { type: "list"; items: readonly string[] }
  | {
      type: "table";
      caption: string;
      columns: readonly string[];
      rows: readonly (readonly string[])[];
    }
  /** Encadré : une règle, une source, une conséquence. */
  | { type: "note"; title: string; text: string };

export interface Article {
  slug: string;
  title: string;
  /** Titre de la balise `<title>`, s'il doit différer du titre affiché. */
  metaTitle?: string;
  /** Résumé autonome : c'est lui que reprend un moteur ou un modèle. */
  description: string;
  /** Date de première publication, ISO. */
  publishedAt: string;
  /** Date de dernière révision de fond, ISO. */
  updatedAt: string;
  /**
   * L'article suppose que LéoClean est déclaré organisme de services à la
   * personne. Tant que ce n'est pas le cas, il n'est pas publié.
   */
  requiresSapDeclaration: boolean;
  blocks: readonly ArticleBlock[];
  faq: readonly { question: string; answer: string }[];
  /** Communes vers lesquelles l'article renvoie, pour le maillage interne. */
  relatedCommuneSlugs: readonly string[];
}

const REGULIER = PUBLIC_RATES.find((rate) => rate.key === "REGULIER")!;
const PONCTUEL = PUBLIC_RATES.find((rate) => rate.key === "PONCTUEL")!;

/** Prix TTC d'une intervention, arrondi au centime, depuis la grille publique. */
function priceFor(hourlyRateCents: number, minutes: number): string {
  return formatEuros(Math.round((hourlyRateCents * minutes) / 60));
}

const ARTICLES: readonly Article[] = [
  {
    slug: "prix-menage-a-domicile-sud-bordeaux",
    title: "Combien coûte une femme de ménage dans le sud de Bordeaux ?",
    metaTitle: "Prix d'une femme de ménage dans le sud de Bordeaux (2026)",
    description:
      `Une heure de ménage à domicile coûte ${formatHourlyRate(REGULIER.hourlyRateCents)} en formule régulière ` +
      `et ${formatHourlyRate(PONCTUEL.hourlyRateCents)} en intervention ponctuelle chez LéoClean, dans les seize communes ` +
      `du sud de Bordeaux. Détail des prix, des durées et de ce qui les fait varier.`,
    publishedAt: "2026-08-14",
    updatedAt: "2026-08-14",
    requiresSapDeclaration: false,
    relatedCommuneSlugs: ["leognan", "villenave-d-ornon", "gradignan"],
    blocks: [
      {
        type: "paragraph",
        text:
          `Chez LéoClean, une heure de ménage à domicile est facturée ` +
          `${formatHourlyRate(REGULIER.hourlyRateCents)} TTC en formule régulière et ` +
          `${formatHourlyRate(PONCTUEL.hourlyRateCents)} TTC en intervention ponctuelle, dans les seize ` +
          `communes desservies au sud de Bordeaux. Le tarif ne dépend ni de la commune, ` +
          `ni de la distance depuis Léognan, ni du jour de la semaine.`,
      },
      {
        type: "paragraph",
        text:
          `Ce qui fait varier la facture, ce n'est donc pas le prix de l'heure : ` +
          `c'est le nombre d'heures. Et le nombre d'heures dépend d'abord de la ` +
          `surface à traiter.`,
      },
      { type: "heading", text: "Le prix selon la surface du logement" },
      {
        type: "paragraph",
        text:
          `Nous retenons ${STANDARD_SQM_PER_HOUR} m² traités par heure pour un entretien courant : ` +
          `sols, sanitaires, cuisine, poussières et surfaces. C'est une moyenne ` +
          `observée, pas une promesse — un logement encombré ou un bâti ancien à ` +
          `tomettes descend plutôt vers 20 m² par heure.`,
      },
      {
        type: "table",
        caption:
          "Prix indicatif d'une intervention selon la surface, aux tarifs LéoClean",
        columns: [
          "Surface",
          "Durée estimée",
          "Ménage régulier",
          "Intervention ponctuelle",
        ],
        rows: [
          [
            "50 m²",
            "2 h",
            priceFor(REGULIER.hourlyRateCents, 120),
            priceFor(PONCTUEL.hourlyRateCents, 120),
          ],
          [
            "65 m²",
            "2 h 30",
            priceFor(REGULIER.hourlyRateCents, 150),
            priceFor(PONCTUEL.hourlyRateCents, 150),
          ],
          [
            "80 m²",
            "3 h 30",
            priceFor(REGULIER.hourlyRateCents, 210),
            priceFor(PONCTUEL.hourlyRateCents, 210),
          ],
          [
            "100 m²",
            "4 h",
            priceFor(REGULIER.hourlyRateCents, 240),
            priceFor(PONCTUEL.hourlyRateCents, 240),
          ],
          [
            "130 m²",
            "5 h 30",
            priceFor(REGULIER.hourlyRateCents, 330),
            priceFor(PONCTUEL.hourlyRateCents, 330),
          ],
        ],
      },
      {
        type: "note",
        title: `Minimum de ${MINIMUM_BILLABLE_MINUTES / 60} heures par intervention`,
        text:
          `Aucune intervention n'est facturée moins de ${MINIMUM_BILLABLE_MINUTES / 60} heures. ` +
          `En dessous, le temps de trajet représente une part telle du déplacement ` +
          `que l'intervenant y perdrait — et un service qui fait perdre de l'argent ` +
          `à celui qui l'exécute ne tient pas dans la durée.`,
      },
      { type: "heading", text: "Pourquoi le régulier coûte moins cher" },
      {
        type: "paragraph",
        text:
          `L'écart de ${formatEuros(PONCTUEL.hourlyRateCents - REGULIER.hourlyRateCents)} entre les deux tarifs horaires n'est pas ` +
          `une remise commerciale, c'est un coût réel qui disparaît. Un rendez-vous ` +
          `récurrent occupe un créneau connu à l'avance, s'insère dans une tournée ` +
          `déjà construite, et se fait dans un logement que l'intervenant connaît : ` +
          `il sait où sont les produits et par quoi commencer.`,
      },
      {
        type: "paragraph",
        text:
          `Une intervention ponctuelle, à l'inverse, s'insère dans un planning déjà ` +
          `rempli, impose un déplacement dédié, et démarre par un tour du logement.`,
      },
      { type: "heading", text: "Ce que le tarif comprend" },
      {
        type: "list",
        items: [
          "Le temps passé chez vous, décompté à la minute au-delà du minimum.",
          "Le déplacement de l'intervenant, quelle que soit la commune du territoire.",
          "L'assurance responsabilité civile professionnelle de l'intervenant.",
          "Le remplacement en cas d'absence, sans surcoût et annoncé à l'avance.",
        ],
      },
      {
        type: "paragraph",
        text:
          `Les produits d'entretien ne sont pas compris : ce sont les vôtres. ` +
          `C'est un choix, pas une économie. Vous savez ce qui entre chez vous, ce ` +
          `qui convient à vos sols et ce que vos allergies supportent — et vous ne ` +
          `payez pas une marge sur un flacon de vinaigre blanc.`,
      },
      { type: "heading", text: "Comparaison avec les autres solutions" },
      {
        type: "paragraph",
        text:
          `Trois voies existent pour faire faire son ménage, et elles ne se ` +
          `comparent pas seulement au prix affiché. L'emploi direct est le moins ` +
          `cher à l'heure, mais il fait de vous un employeur : contrat, déclaration ` +
          `mensuelle, congés payés, et procédure de licenciement le jour où ça ` +
          `s'arrête.`,
      },
      {
        type: "table",
        caption:
          "Les trois façons de faire faire son ménage à domicile, et ce qu'elles impliquent",
        columns: ["Solution", "Qui est l'employeur", "Ce que vous gérez"],
        rows: [
          [
            "Emploi direct (CESU déclaratif)",
            "Vous",
            "Contrat, salaire, congés, remplacement, rupture",
          ],
          [
            "Mandataire",
            "Vous",
            "L'organisme recrute et établit les bulletins ; vous restez l'employeur",
          ],
          [
            "Prestataire ou plateforme",
            "L'organisme ou l'intervenant indépendant",
            "Rien : vous achetez une prestation, pas un temps de travail",
          ],
        ],
      },
      {
        type: "paragraph",
        text:
          `LéoClean relève de la troisième colonne : vous réservez une prestation, ` +
          `sans lien de subordination ni obligation d'employeur.`,
      },
    ],
    faq: [
      {
        question: "Le tarif change-t-il selon la commune ?",
        answer: `Non. Le tarif horaire de LéoClean est identique dans les seize communes desservies, de Villenave-d'Ornon à Cabanac-et-Villagrains, quelle que soit la distance depuis Léognan. L'éloignement influence les créneaux proposés, jamais le prix.`,
      },
      {
        question: "Faut-il payer le déplacement de l'intervenant ?",
        answer: `Non, le déplacement est compris dans le tarif horaire. Aucun frais kilométrique n'est facturé, y compris dans les communes les plus éloignées du siège comme Saint-Morillon ou Cabanac-et-Villagrains.`,
      },
      {
        question: "Y a-t-il un supplément le samedi ?",
        answer: `Non. Les interventions du samedi matin, entre 9 h et 13 h, sont facturées au même tarif horaire que celles de la semaine. LéoClean n'intervient pas le dimanche ni les jours fériés.`,
      },
      {
        question: "Quel est le montant minimum d'une intervention ?",
        answer: `Le minimum facturé est de ${MINIMUM_BILLABLE_MINUTES / 60} heures, soit ${priceFor(REGULIER.hourlyRateCents, MINIMUM_BILLABLE_MINUTES)} en formule régulière et ${priceFor(PONCTUEL.hourlyRateCents, MINIMUM_BILLABLE_MINUTES)} en intervention ponctuelle.`,
      },
    ],
  },

  {
    slug: "duree-menage-maison-100m2",
    title:
      "Combien de temps faut-il pour faire le ménage d'une maison de 100 m² ?",
    description:
      "Environ quatre heures pour un entretien courant de 100 m², sur la base de 25 m² traités par heure. Ce qui allonge ce temps, ce qui le raccourcit, et comment estimer le vôtre.",
    publishedAt: "2026-08-14",
    updatedAt: "2026-08-14",
    requiresSapDeclaration: false,
    relatedCommuneSlugs: ["leognan", "saint-selve", "saucats"],
    blocks: [
      {
        type: "paragraph",
        text:
          `Un entretien courant de 100 m² demande environ quatre heures. Ce chiffre ` +
          `vient d'une règle simple, celle que LéoClean applique pour construire ses ` +
          `devis : ${STANDARD_SQM_PER_HOUR} m² traités par heure, sols, sanitaires, cuisine et ` +
          `poussières compris.`,
      },
      {
        type: "paragraph",
        text:
          `C'est une base de départ, pas un verdict. Deux maisons de 100 m² ne ` +
          `demandent pas le même temps, et l'écart peut atteindre une heure et demie.`,
      },
      { type: "heading", text: "Ce qui allonge le temps de ménage" },
      {
        type: "list",
        items: [
          "Le nombre de pièces plutôt que la surface : cinq petites pièces prennent plus longtemps que trois grandes, à surface égale, parce qu'on multiplie les recoins, les plinthes et les changements d'outil.",
          "Les salles d'eau : chacune ajoute vingt à trente minutes, quelle que soit sa taille.",
          "Les sols anciens — tomettes, parquets non vitrifiés, carreaux de ciment — qui se traitent sans excès d'eau et donc plus lentement.",
          "Un étage : l'aspirateur monte, les sols se traitent séparément, comptez trente minutes de plus qu'un plain-pied de même surface.",
          "L'encombrement : chaque objet à déplacer puis reposer est du temps qui ne va pas au nettoyage.",
          "Les animaux, dont les poils imposent un second passage sur les textiles et les bas de murs.",
        ],
      },
      { type: "heading", text: "Ce qui le raccourcit" },
      {
        type: "list",
        items: [
          "La régularité : un logement entretenu toutes les semaines demande moins de temps que le même logement vu une fois par mois.",
          "Un intervenant qui connaît les lieux et n'a plus à chercher où sont les choses.",
          "Des surfaces dégagées avant l'arrivée : c'est le seul geste qui fait vraiment gagner du temps.",
          "Une construction récente, aux surfaces lisses et aux sols continus.",
        ],
      },
      { type: "heading", text: "Estimation par surface" },
      {
        type: "table",
        caption:
          "Durée estimée d'un entretien courant selon la surface, base 25 m² par heure",
        columns: ["Surface", "Durée estimée", "Typologie courante"],
        rows: [
          ["50 m²", "2 h", "T2 ou T3 compact"],
          ["65 m²", "2 h 30", "T3"],
          ["80 m²", "3 h 30", "T4 ou petite maison"],
          ["100 m²", "4 h", "Maison familiale de plain-pied"],
          ["130 m²", "5 h 30", "Maison à étage"],
          ["150 m² et plus", "Deux passages", "Grande maison ou propriété"],
        ],
      },
      {
        type: "note",
        title: "Au-delà de 150 m², nous passons deux fois",
        text:
          `Une intervention de plus de six heures d'affilée se termine moins bien ` +
          `qu'elle ne commence : la fatigue se lit dans le résultat. Au-delà de ` +
          `150 m², LéoClean organise deux passages plutôt qu'une journée entière, ` +
          `pour le même nombre d'heures et le même prix.`,
      },
      { type: "heading", text: "Grand ménage : compter le double" },
      {
        type: "paragraph",
        text:
          `Un grand ménage — intérieur des placards, four, réfrigérateur, vitres, ` +
          `plinthes, radiateurs — ne se compare pas à un entretien courant. Sur ` +
          `100 m², comptez sept à huit heures plutôt que quatre, et prévoyez-le ` +
          `avant un emménagement plutôt qu'après.`,
      },
    ],
    faq: [
      {
        question: "Combien de temps pour le ménage d'un appartement de 65 m² ?",
        answer: `Environ deux heures trente pour un entretien courant, sur la base de ${STANDARD_SQM_PER_HOUR} m² traités par heure. Un T3 avec deux salles d'eau se rapproche plutôt de trois heures.`,
      },
      {
        question: "Peut-on faire le ménage d'une maison en deux heures ?",
        answer: `Deux heures permettent de traiter environ 50 m² en entretien courant, ou de faire l'essentiel — cuisine, sanitaires, sols des pièces de vie — dans un logement plus grand. C'est aussi la durée minimale facturée par LéoClean.`,
      },
      {
        question: "Le repassage est-il compris dans ces durées ?",
        answer: `Non. Les durées indiquées ne couvrent que l'entretien du logement. Le repassage s'ajoute, à raison d'une heure environ pour une corbeille familiale de deux à trois jours.`,
      },
    ],
  },

  {
    slug: "menage-fin-de-bail-etat-des-lieux",
    title: "Ménage de fin de bail : ce qu'un état des lieux peut exiger",
    description:
      "Un logement doit être rendu propre, mais l'usure normale ne peut pas vous être facturée. Ce que dit la loi de 1989, ce qui relève de la vétusté, et combien de temps prévoir pour le ménage de sortie.",
    publishedAt: "2026-08-14",
    updatedAt: "2026-08-14",
    requiresSapDeclaration: false,
    relatedCommuneSlugs: ["gradignan", "villenave-d-ornon", "cadaujac"],
    blocks: [
      {
        type: "paragraph",
        text:
          `Un locataire doit rendre son logement propre. Il n'a pas à le rendre ` +
          `neuf. Toute la difficulté d'un état des lieux de sortie tient dans cet ` +
          `écart, et c'est là que se jouent les retenues sur dépôt de garantie.`,
      },
      { type: "heading", text: "Ce que dit la loi" },
      {
        type: "paragraph",
        text:
          `L'article 7 de la loi n° 89-462 du 6 juillet 1989 oblige le locataire à ` +
          `répondre des dégradations survenues pendant la location, sauf si elles ` +
          `résultent de la vétusté. Autrement dit : ce qui s'est usé par le temps et ` +
          `l'usage normal ne peut pas vous être facturé ; ce qui a été sali ou ` +
          `abîmé, si.`,
      },
      {
        type: "note",
        title: "Une grille de vétusté peut être annexée au bail",
        text:
          `Le décret n° 2016-382 du 30 mars 2016 permet au bailleur et au locataire ` +
          `de convenir d'une grille de vétusté, qui fixe une durée de vie par ` +
          `équipement et un abattement annuel. Si votre bail en comporte une, ` +
          `relisez-la avant l'état des lieux : elle chiffre à votre place ce qui ` +
          `relève de l'usure.`,
      },
      { type: "heading", text: "Les points regardés en premier" },
      {
        type: "paragraph",
        text:
          `Les états des lieux de sortie se ressemblent beaucoup. Six postes ` +
          `concentrent l'essentiel des remarques, et ce sont rarement les sols.`,
      },
      {
        type: "list",
        items: [
          "Le four et les plaques : la graisse cuite est le premier motif de retenue, et le plus long à rattraper.",
          "Le réfrigérateur, dégivré, vidé, joints compris.",
          "La hotte et son filtre, presque toujours oubliés.",
          "Les sanitaires : tartre, joints de douche, arrière des cuvettes.",
          "Les vitres et leurs encadrements, intérieur comme extérieur si accessible.",
          "Les traces derrière les meubles déplacés, qui apparaissent au moment même où on vide le logement.",
        ],
      },
      { type: "heading", text: "Combien de temps prévoir" },
      {
        type: "paragraph",
        text:
          `Un ménage de fin de bail n'est pas un entretien courant : le logement ` +
          `est vide, tout est accessible, et tout est regardé. Comptez le double ` +
          `d'un entretien classique, soit sept à huit heures pour 100 m², et ` +
          `faites-le une fois le logement vidé — jamais avant.`,
      },
      {
        type: "paragraph",
        text:
          `LéoClean traite ces interventions au tarif ponctuel de ` +
          `${formatHourlyRate(PONCTUEL.hourlyRateCents)} TTC. Sur le territoire, la demande se concentre en ` +
          `juin et en septembre, à Gradignan et Villenave-d'Ornon notamment, où la ` +
          `proximité du campus rythme les entrées et les sorties.`,
      },
      { type: "heading", text: "Faire soi-même ou faire faire" },
      {
        type: "paragraph",
        text:
          `Le calcul est simple à poser. Huit heures de ménage de sortie coûtent ` +
          `${priceFor(PONCTUEL.hourlyRateCents, 480)} au tarif ponctuel. Une retenue sur dépôt de garantie ` +
          `pour remise en état dépasse fréquemment ce montant, et se discute après ` +
          `coup, sans que vous ayez la main. Si vous déménagez le même week-end, la ` +
          `question ne se pose déjà plus.`,
      },
    ],
    faq: [
      {
        question:
          "Le propriétaire peut-il retenir le dépôt de garantie pour un logement mal nettoyé ?",
        answer: `Oui, s'il justifie la dépense par un devis ou une facture, et si la saleté constatée dépasse l'usure normale. L'article 22 de la loi du 6 juillet 1989 impose au bailleur de restituer le dépôt sous un mois lorsque l'état des lieux de sortie est conforme à celui d'entrée, deux mois dans le cas contraire.`,
      },
      {
        question: "Faut-il refaire les peintures avant de rendre le logement ?",
        answer: `Non, pas au titre de l'usure normale : des peintures ternies après plusieurs années d'occupation relèvent de la vétusté, pas de la dégradation. Un mur percé, taché ou repeint sans accord relève en revanche de la responsabilité du locataire.`,
      },
      {
        question: "Quand faire le ménage de fin de bail ?",
        answer: `Une fois le logement entièrement vidé, et au plus près de l'état des lieux — idéalement la veille. Nettoyer avant le déménagement revient à nettoyer deux fois : les traces derrière les meubles n'apparaissent qu'une fois ceux-ci enlevés.`,
      },
    ],
  },

  {
    slug: "cesu-mandataire-ou-prestataire",
    title:
      "CESU, mandataire, prestataire : quel statut pour votre femme de ménage ?",
    description:
      "Trois façons de faire faire son ménage à domicile, trois répartitions de responsabilité très différentes. Qui est l'employeur, qui gère les absences, qui porte le risque prud'homal.",
    publishedAt: "2026-08-14",
    updatedAt: "2026-08-14",
    requiresSapDeclaration: false,
    relatedCommuneSlugs: ["leognan", "martillac", "la-brede"],
    blocks: [
      {
        type: "paragraph",
        text:
          `La question paraît administrative. Elle ne l'est pas : elle détermine ` +
          `qui, de vous ou d'un tiers, est l'employeur de la personne qui fait votre ` +
          `ménage — et donc qui gère un arrêt maladie, un congé payé, une rupture.`,
      },
      { type: "heading", text: "L'emploi direct, déclaré au CESU" },
      {
        type: "paragraph",
        text:
          `Vous recrutez vous-même et déclarez le salaire via le Chèque emploi ` +
          `service universel. Le CESU n'est pas un statut : c'est un dispositif de ` +
          `déclaration simplifiée, géré par l'Urssaf, qui calcule les cotisations et ` +
          `édite le bulletin de paie à votre place.`,
      },
      {
        type: "paragraph",
        text:
          `Ce qu'il ne fait pas à votre place : rédiger le contrat de travail, ` +
          `appliquer la convention collective des particuliers employeurs, poser les ` +
          `congés payés, trouver un remplaçant en cas d'absence, et conduire une ` +
          `procédure de licenciement le jour où la relation s'arrête. Vous êtes ` +
          `l'employeur, avec les obligations qui vont avec.`,
      },
      { type: "heading", text: "Le mandataire" },
      {
        type: "paragraph",
        text:
          `Un organisme mandataire recrute pour vous, établit les bulletins de paie ` +
          `et gère l'administratif — mais vous restez juridiquement l'employeur. ` +
          `C'est un intermédiaire de gestion, pas un employeur de substitution. La ` +
          `nuance se paie le jour d'un contentieux : il vous concerne.`,
      },
      { type: "heading", text: "Le prestataire" },
      {
        type: "paragraph",
        text:
          `L'organisme prestataire emploie lui-même ses intervenants et vous vend ` +
          `une prestation. Vous n'êtes l'employeur de personne. Vous n'avez ni ` +
          `contrat de travail à rédiger, ni congés à décompter, ni remplacement à ` +
          `organiser.`,
      },
      {
        type: "paragraph",
        text:
          `Ces trois modes d'intervention — mandataire, mise à disposition, ` +
          `prestataire — sont ceux que l'article L7232-6 du code du travail impose ` +
          `de mentionner dans l'offre de services à la personne.`,
      },
      { type: "heading", text: "Le cas des plateformes" },
      {
        type: "paragraph",
        text:
          `Une plateforme met en relation un particulier et un intervenant ` +
          `indépendant, le plus souvent auto-entrepreneur. Personne n'est salarié : ` +
          `l'intervenant facture sa prestation, la plateforme facture son service de ` +
          `mise en relation et d'organisation. C'est le modèle de LéoClean.`,
      },
      {
        type: "note",
        title: "Ce qui distingue une prestation d'un emploi déguisé",
        text:
          `Un intervenant indépendant choisit ses horaires, ses clients et sa ` +
          `méthode. S'il reçoit des directives, des sanctions et un planning imposé, ` +
          `la relation peut être requalifiée en contrat de travail par le juge : ` +
          `c'est le lien de subordination qui fait l'emploi, pas l'intitulé du ` +
          `contrat. Une plateforme sérieuse s'interdit donc d'imposer un créneau à ` +
          `un intervenant — chez LéoClean, aucun rôle d'administration ne peut ` +
          `inscrire une disponibilité à la place d'un intervenant.`,
      },
      { type: "heading", text: "Comment choisir" },
      {
        type: "table",
        caption: "Répartition des responsabilités selon le mode d'intervention",
        columns: [
          "",
          "Emploi direct",
          "Mandataire",
          "Prestataire ou plateforme",
        ],
        rows: [
          ["Employeur", "Vous", "Vous", "L'organisme ou l'intervenant"],
          ["Recrutement", "Vous", "L'organisme", "L'organisme"],
          ["Bulletins de paie", "Urssaf (CESU)", "L'organisme", "Sans objet"],
          ["Remplacement en cas d'absence", "Vous", "Variable", "L'organisme"],
          ["Risque prud'homal", "Vous", "Vous", "Non"],
          ["Prix horaire", "Le plus bas", "Intermédiaire", "Le plus élevé"],
        ],
      },
      {
        type: "paragraph",
        text:
          `L'emploi direct est le moins cher à l'heure et le plus exigeant à tenir. ` +
          `La prestation coûte davantage et ne vous demande rien. Entre les deux, le ` +
          `mandataire allège la gestion sans transférer la responsabilité — c'est le ` +
          `point qu'on découvre souvent trop tard.`,
      },
    ],
    faq: [
      {
        question: "Le CESU est-il un statut ?",
        answer: `Non. Le Chèque emploi service universel est un dispositif de déclaration simplifiée géré par l'Urssaf : il calcule les cotisations et édite le bulletin de paie. Le statut, lui, reste celui de particulier employeur, avec les obligations correspondantes.`,
      },
      {
        question: "Suis-je l'employeur si je passe par un mandataire ?",
        answer: `Oui. Un organisme mandataire recrute et gère l'administratif pour votre compte, mais le contrat de travail vous lie directement à l'intervenant. En cas de litige prud'homal, c'est vous qui êtes mis en cause.`,
      },
      {
        question: "Faut-il un contrat de travail avec LéoClean ?",
        answer: `Non. LéoClean met en relation des particuliers et des intervenants indépendants : vous réservez une prestation, sans devenir employeur. Aucun contrat de travail, aucun bulletin de paie, aucune procédure de rupture à conduire.`,
      },
    ],
  },

  {
    slug: "credit-impot-menage-a-domicile",
    title: "Crédit d'impôt pour le ménage à domicile : comment ça marche",
    description:
      "Le crédit d'impôt services à la personne rembourse 50 % des sommes versées, dans la limite de 12 000 € de dépenses par an. Conditions, plafonds, avance immédiate : le mécanisme expliqué avec ses textes.",
    publishedAt: "2026-08-14",
    updatedAt: "2026-08-14",
    // Publier cet article avant d'être déclaré organisme de services à la
    // personne laisserait entendre que les prestations LéoClean y ouvrent
    // droit. Tant que la déclaration n'est pas obtenue, il reste hors ligne.
    requiresSapDeclaration: true,
    relatedCommuneSlugs: ["leognan", "cadaujac", "la-brede"],
    blocks: [
      {
        type: "paragraph",
        text:
          `L'article 199 sexdecies du code général des impôts ouvre droit à un ` +
          `crédit d'impôt égal à 50 % des sommes versées pour des services à la ` +
          `personne rendus à votre domicile, dans la limite de 12 000 € de dépenses ` +
          `par an. Le ménage à domicile en fait partie.`,
      },
      {
        type: "paragraph",
        text:
          `Il s'agit d'un crédit d'impôt, non d'une réduction : il vous est versé ` +
          `même si vous n'êtes pas imposable.`,
      },
      { type: "heading", text: "Les plafonds" },
      {
        type: "list",
        items: [
          "12 000 € de dépenses par an, soit 6 000 € de crédit d'impôt.",
          "Majoration de 1 500 € par enfant à charge et par membre du foyer âgé de plus de 65 ans, sans que le plafond majoré puisse dépasser 15 000 €.",
          "20 000 € lorsqu'un membre du foyer est titulaire d'une carte d'invalidité.",
        ],
      },
      {
        type: "note",
        title: "Ce que représente le plafond, concrètement",
        text:
          `12 000 € de dépenses correspondent à environ ${Math.floor(1_200_000 / REGULIER.hourlyRateCents)} heures de ménage ` +
          `par an au tarif régulier de ${formatHourlyRate(REGULIER.hourlyRateCents)}, soit près de huit heures par ` +
          `semaine. La très grande majorité des foyers reste loin du plafond.`,
      },
      { type: "heading", text: "L'avance immédiate" },
      {
        type: "paragraph",
        text:
          `Le crédit d'impôt était historiquement versé l'année suivante, ce qui ` +
          `revenait à avancer la moitié de la dépense pendant douze mois. Le service ` +
          `Avance immédiate de l'Urssaf supprime ce décalage : la déduction est ` +
          `appliquée au moment du paiement, et vous ne réglez que le montant net.`,
      },
      {
        type: "paragraph",
        text:
          `Le service suppose que l'organisme y soit inscrit auprès de l'Urssaf, et ` +
          `que vous ayez activé votre compte particulier. L'activation se fait une ` +
          `fois, en ligne.`,
      },
      { type: "heading", text: "Les conditions à respecter" },
      {
        type: "list",
        items: [
          "La prestation doit être réalisée à votre résidence, principale ou secondaire, située en France.",
          "L'intervenant doit relever d'un organisme déclaré au titre des services à la personne, ou être salarié déclaré du particulier employeur.",
          "Le paiement doit être traçable : virement, carte, chèque. Les espèces n'ouvrent pas droit au crédit d'impôt.",
          "Une attestation fiscale annuelle vous est remise ; c'est elle qui justifie le montant déclaré.",
        ],
      },
      { type: "heading", text: "Comment le déclarer" },
      {
        type: "paragraph",
        text:
          `Les sommes versées se reportent sur la déclaration de revenus, dans la ` +
          `rubrique consacrée aux services à la personne. L'attestation fiscale n'est ` +
          `pas à joindre, mais elle doit être conservée : c'est la pièce demandée en ` +
          `cas de contrôle.`,
      },
    ],
    faq: [
      {
        question:
          "Le crédit d'impôt s'applique-t-il si je ne suis pas imposable ?",
        answer: `Oui. L'article 199 sexdecies du code général des impôts institue un crédit d'impôt, et non une réduction : lorsqu'il excède l'impôt dû, l'excédent est restitué par virement de l'administration fiscale.`,
      },
      {
        question: "Quel est le plafond du crédit d'impôt pour le ménage ?",
        answer: `Les dépenses sont retenues dans la limite de 12 000 € par an, portée à 15 000 € au maximum avec les majorations pour enfants à charge et personnes de plus de 65 ans, et à 20 000 € en cas d'invalidité. Le crédit d'impôt correspond à 50 % de ce montant.`,
      },
      {
        question: "Peut-on cumuler l'avance immédiate et le crédit d'impôt ?",
        answer: `Il ne s'agit pas d'un cumul : l'avance immédiate est une modalité de versement du même crédit d'impôt. Elle en déduit le montant au moment du paiement, au lieu de vous le rembourser l'année suivante.`,
      },
      {
        question: "Le paiement en espèces ouvre-t-il droit au crédit d'impôt ?",
        answer: `Non. Le paiement doit être traçable pour être justifiable : virement, carte bancaire, chèque ou CESU préfinancé. Une prestation réglée en espèces ne peut pas figurer sur l'attestation fiscale.`,
      },
    ],
  },
];

/** Nombre de mots d'un article, pour estimer le temps de lecture. */
function wordCount(article: Article): number {
  const texts = article.blocks.flatMap((block) => {
    switch (block.type) {
      case "paragraph":
        return [block.text];
      case "heading":
        return [block.text];
      case "list":
        return [...block.items];
      case "table":
        return [block.caption, ...block.columns, ...block.rows.flat()];
      case "note":
        return [block.title, block.text];
    }
  });
  const all = [
    ...texts,
    ...article.faq.flatMap((entry) => [entry.question, entry.answer]),
  ].join(" ");
  return all.split(/\s+/).filter(Boolean).length;
}

/** Temps de lecture arrondi à la minute, base 220 mots par minute. */
export function readingMinutes(article: Article): number {
  return Math.max(1, Math.round(wordCount(article) / 220));
}

/**
 * Articles réellement en ligne.
 *
 * Le filtre n'est pas une préférence éditoriale : communiquer sur le crédit
 * d'impôt avant d'être déclaré organisme de services à la personne reviendrait
 * à promettre un avantage fiscal auquel les prestations n'ouvrent pas encore
 * droit.
 */
export function publishedArticles(sapDeclared: boolean): readonly Article[] {
  return ARTICLES.filter(
    (article) => sapDeclared || !article.requiresSapDeclaration,
  );
}

export function getPublishedArticle(
  slug: string,
  sapDeclared: boolean,
): Article | undefined {
  return publishedArticles(sapDeclared).find(
    (article) => article.slug === slug,
  );
}

/** Tous les articles écrits, publiés ou non. Réservé aux tests. */
export const ALL_ARTICLES = ARTICLES;
