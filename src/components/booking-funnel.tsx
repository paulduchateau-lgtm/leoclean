"use client";

import {
  CalendarPlusIcon,
  CheckIcon,
  ChevronDownIcon,
  Loader2Icon,
  MapPinIcon,
  PencilIcon,
  ReceiptTextIcon,
  RotateCcwIcon,
} from "lucide-react";
import Link from "next/link";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { z } from "zod";

import { ContactSheet } from "@/components/contact-sheet";
import { InstallPrompt } from "@/components/install-prompt";
import { Button } from "@/components/ui/button";
import { CHAMP_DOUX_SHADCN, EnTeteTunnel } from "@/components/tunnel/ecran";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type {
  AddressChoice,
  CleanerCardView,
  ConfirmationView,
  BookingBackend,
  Frequency,
  KnownAddress,
  KnownClient,
  QuoteView,
  SlotView,
} from "@/lib/booking/backend";
import { BOOKING_HORIZON_DAYS } from "@/lib/booking/horizon";
import { bookingCalendarFilename } from "@/lib/booking/ics";
import { canShowTaxCredit } from "@/lib/fiscal";
import { PhoneField } from "@/components/phone-field";
import { diagnosticPhone, formatFrenchPhone } from "@/lib/phone";
import { formatDuration, formatEuros, formatHourlyRate } from "@/lib/pricing";
import { CANCELLATION_TIERS } from "@/lib/pricing/cancellation";
import {
  MAX_DURATION_MINUTES,
  SLOT_GRANULARITY_MINUTES,
  estimateDuration,
  suggestedSurfaceFor,
  surfaceForDuration,
  wholeHourChoices,
} from "@/lib/pricing/duration";
import {
  MINIMUM_BILLABLE_MINUTES,
  PUBLIC_RATES,
  STANDARD_SQM_PER_HOUR,
  STANDARD_SQM_PER_HOUR_AFFICHE,
} from "@/lib/pricing/public-grid";
import { SITE } from "@/lib/site";
import { useTracageTunnel } from "@/components/tunnel-tracage";

/**
 * Tunnel de réservation.
 *
 * Cinq écrans, **une décision par écran** : où, quelle taille, quel rythme,
 * quand, puis vérifier et donner ses coordonnées. Le découpage n'est pas une
 * préférence de mise en page — un écran qui pose deux questions oblige à
 * arbitrer entre elles avant de répondre à l'une, et c'est là que le parcours
 * se perd.
 *
 * Trois principes gouvernent le reste :
 *
 * - **Le prix est visible en permanence** — barre basse sur mobile,
 *   récapitulatif collant à droite sur desktop, jamais les deux à la fois.
 *   C'est la première source d'inquiétude ; la laisser sans réponse à l'étape
 *   du créneau revenait à demander de choisir un jour sans savoir ce qu'il
 *   coûte.
 * - **Choisir, c'est avancer.** Sur les écrans à une seule question, appuyer
 *   sur une réponse passe à la suite : un bouton de confirmation qui suit un
 *   choix unique n'ajoute qu'un geste et une hésitation. Les écrans qui
 *   demandent une saisie — adresse manuelle, surface libre, coordonnées —
 *   gardent, eux, une action primaire unique, ancrée en bas.
 * - **Revenir ne détruit rien.** Tout l'état vit ici, dans le composant
 *   parent, y compris les coordonnées : dans la version précédente, revenir
 *   changer de créneau vidait les six champs déjà remplis, parce qu'ils
 *   vivaient dans l'écran démonté.
 *
 * Aucun montant n'est calculé dans ce fichier, jamais. Chaque changement de
 * surface redemande les devis au backend, qui est le seul à savoir ce qu'il
 * facturera.
 */

/* -------------------------------------------------------------------------- */
/* Données d'écran                                                            */
/* -------------------------------------------------------------------------- */

const FREQUENCIES: {
  value: Frequency;
  label: string;
  hint: string;
}[] = [
  {
    value: "WEEKLY",
    label: "Chaque semaine",
    hint: "Tarif régulier, intervenant attitré",
  },
  {
    value: "BIWEEKLY",
    label: "Tous les quinze jours",
    hint: "La formule la plus demandée",
  },
  /* « Une fois par mois » a été retiré du tunnel : à ce rythme, l'entretien
     courant n'en est plus un, la durée nécessaire dérive vers le grand ménage
     et la promesse d'intervenant attitré ne tient plus. La valeur reste dans
     l'énumération et en base — des réservations existantes la portent — mais
     elle ne se vend plus ici. */
  {
    value: "ONE_OFF",
    label: "Une seule fois",
    hint: "Sans engagement, tarif ponctuel",
  },
];

/**
 * Nombre maximal de créneaux de repli.
 *
 * Quatre suffisent à couvrir le risque réel — un créneau pris entre
 * l'affichage et la confirmation — et au-delà, cocher des heures devient une
 * tâche à part entière au milieu d'un tunnel qu'on cherche à raccourcir.
 */
const MAX_ALTERNATE_SLOTS = 4;

/** Rythme par défaut, celui que le plus grand nombre retient. */
const DEFAULT_FREQUENCY: Frequency = "BIWEEKLY";

/**
 * Ramène un rythme à ceux que le tunnel propose encore.
 *
 * « Une fois par mois » a été retiré, mais il subsiste dans deux endroits que
 * nous ne contrôlons pas : le dernier choix d'un client qui l'avait retenu, et
 * un parcours interrompu enregistré dans le navigateur. Restaurer une valeur
 * qui n'a plus de carte laisserait un écran sans sélection et une barre de
 * prix vide, sans que rien n'explique pourquoi.
 */
function offeredFrequency(candidate: Frequency | undefined): Frequency {
  return candidate !== undefined &&
    FREQUENCIES.some((entry) => entry.value === candidate)
    ? candidate
    : DEFAULT_FREQUENCY;
}

/**
 * Types de logement proposés au choix.
 *
 * Personne ne connaît sa surface au mètre près, et la demander au clavier
 * numérique obligeait à effacer une valeur par défaut avant d'en saisir une
 * autre.
 *
 * **L'écran a été retourné.** On demandait une taille de logement pour en
 * déduire une durée ; on demande désormais une durée et on indique le logement
 * qu'elle couvre habituellement. Personne ne connaît sa surface au mètre près,
 * alors que tout le monde sait dire « deux heures, ça devrait suffire » — et
 * c'est la durée, non la surface, qui détermine le prix, la place occupée dans
 * la tournée et donc la faisabilité du créneau. Demander directement la
 * grandeur qui décide de tout supprime une conversion que le client faisait à
 * l'aveugle.
 *
 * Le reste de la chaîne continue de parler en surface : `surfaceForDuration`
 * fait le pont, et un test vérifie que l'aller-retour retombe exactement sur
 * la durée choisie.
 */
const DURATION_SERVICE = {
  sqmPerHour: STANDARD_SQM_PER_HOUR,
  minDurationMinutes: MINIMUM_BILLABLE_MINUTES,
};

const WHOLE_HOUR_CHOICES = wholeHourChoices(DURATION_SERVICE);

/**
 * Les six écrans, dans l'ordre.
 *
 * **L'adresse est demandée d'emblée.** Le tunnel ouvrait auparavant sur une
 * liste de seize communes, qui répondait à « intervenez-vous chez moi ? » sans
 * qu'on ait rien à saisir. C'était moins coûteux à donner qu'une adresse, mais
 * cela demandait de se reconnaître dans un référentiel administratif — de
 * savoir que Cadaujac n'est pas Cestas, de trouver son nom parmi seize — pour
 * finir par redemander l'adresse au dernier écran. Une seule saisie remplace
 * les deux : on tape son adresse, la complétion la reconnaît, et la couverture
 * se prononce sur le même geste. Le code postal reste une entrée valable, la
 * Base Adresse Nationale le comprenant aussi bien qu'un nom de rue.
 *
 * Ce que ce déplacement coûte, et qu'il faut assumer : l'ordre du tunnel
 * obéissait à la règle **« plus une information coûte à donner, plus tard on
 * la demande »**, et l'adresse exacte est ce qu'on donne le moins volontiers à
 * un service qu'on n'a pas essayé. Elle passe donc devant le prix. Deux choses
 * en limitent le prix : elle n'est demandée qu'une fois au lieu de deux, et la
 * barre basse annonce le tarif d'entrée dès cet écran — la question « combien
 * ça coûte » reçoit une réponse avant la première frappe. Les coordonnées,
 * elles, ne bougent pas : elles restent au cinquième écran, après le prix et
 * le créneau.
 *
 * Deuxième conséquence, technique : les créneaux sont désormais cherchés
 * depuis l'adresse réelle du premier écran au dernier, jamais depuis le centre
 * de la commune. `COMMUNE_TRAVEL_MARGIN_MINUTES` ne sert donc plus au tunnel —
 * elle reste dans le moteur, qui accepte toujours une recherche imprécise, et
 * les créneaux proposés sont d'autant plus justes.
 *
 * Le prix n'a pas d'écran à lui : il apparaît au troisième, celui du rythme,
 * qui porte les formules avec leur montant et leur durée — un écran qui ne
 * ferait que l'annoncer coûterait un geste sans rien apprendre.
 */
const STEPS = [
  "adresse",
  "logement",
  "rythme",
  "creneau",
  "coordonnees",
  "recap",
] as const;

type Step = (typeof STEPS)[number];

/** Titre lu par la personne, et repère de progression. */
const STEP_TITLES: Record<Step, string> = {
  adresse: "À quelle adresse venons-nous ?",
  logement: "De combien de temps avez-vous besoin ?",
  rythme: "À quel rythme souhaitez-vous nous voir ?",
  creneau: "Quand voulez-vous que nous venions ?",
  coordonnees: "Comment vous joindre ?",
  recap: "Vérifions votre réservation",
};

const dayFormatter = new Intl.DateTimeFormat("fr-FR", {
  weekday: "long",
  day: "numeric",
  month: "long",
  timeZone: "Europe/Paris",
});
const chipFormatter = new Intl.DateTimeFormat("fr-FR", {
  weekday: "short",
  day: "numeric",
  timeZone: "Europe/Paris",
});
const monthFormatter = new Intl.DateTimeFormat("fr-FR", {
  month: "short",
  timeZone: "Europe/Paris",
});
const timeFormatter = new Intl.DateTimeFormat("fr-FR", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Paris",
});

/** Heure telle qu'on la dit : « 9 h », « 9 h 30 ». */
function hourLabel(date: Date): string {
  const parts = timeFormatter.formatToParts(date);
  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? "0");
  const minute = parts.find((part) => part.type === "minute")?.value ?? "00";
  return minute === "00" ? `${hour} h` : `${hour} h ${minute}`;
}
/** Clé de journée civile française, stable et comparable. */
const dayKeyFormatter = new Intl.DateTimeFormat("fr-CA", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  timeZone: "Europe/Paris",
});

/** Annulation gratuite : le palier le plus lointain du barème des CGU. */
const FREE_CANCELLATION_HOURS = CANCELLATION_TIERS[0]!.fromHoursBefore;
/**
 * Ligne de réassurance, sous le bouton de chaque écran.
 *
 * Les deux objections qui font abandonner un tunnel de réservation sont « vais-je
 * être débité maintenant ? » et « suis-je engagé ? ». Elles se lèvent en une
 * ligne, et cette ligne doit être sous le pouce au moment du geste, pas dans un
 * bloc de réassurance en bas de page que personne n'atteint.
 */
const REASSURANCE = `Rien à payer aujourd'hui · Annulation gratuite jusqu'à ${FREE_CANCELLATION_HOURS} h avant`;

/** Commune desservie, telle que la page serveur la transmet. */
export interface CommuneOption {
  slug: string;
  name: string;
  postalCode: string;
  insee: string;
  lat: number;
  lng: number;
}

interface ContactInput {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  accessNotes: string;
  clientNotes: string;
}

/**
 * Libellé de durée correspondant à une surface reprise d'ailleurs.
 *
 * Une surface peut venir de l'URL ou du dernier choix d'un client connu : on
 * lui redonne le libellé de la durée qu'elle produit, pour que le récapitulatif
 * parle la même langue que l'écran de choix.
 */
function presetLabelFor(surfaceSqm: number | undefined): string | null {
  if (surfaceSqm === undefined) return null;
  const { durationMinutes } = estimateDuration({
    surfaceSqm,
    service: DURATION_SERVICE,
  });
  return WHOLE_HOUR_CHOICES.includes(durationMinutes)
    ? formatDuration(durationMinutes)
    : null;
}

const EMPTY_CONTACT: ContactInput = {
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  accessNotes: "",
  clientNotes: "",
};

/* -------------------------------------------------------------------------- */
/* Reprise de parcours                                                        */
/* -------------------------------------------------------------------------- */

/**
 * État conservé d'une visite à l'autre.
 *
 * **Les coordonnées n'y figurent pas.** Un nom, un email et un téléphone
 * laissés dans le stockage d'un navigateur possiblement partagé sont des
 * données personnelles au repos que personne n'a demandé à y laisser ; le
 * bénéfice — éviter de retaper quatre champs dans le cas rare d'un
 * rechargement à la dernière étape — ne le justifie pas.
 */
const STORAGE_KEY = "leoclean:booking:v1";
/**
 * Sept jours. Au-delà, ce qui a été choisi ne décrit plus le besoin de
 * quelqu'un : les tarifs ont pu bouger, et l'envie aussi. Un créneau dont
 * l'heure est passée est de toute façon écarté à la lecture, quelle que soit
 * l'ancienneté de l'enregistrement.
 */
const RESUME_MAX_AGE_MS = 7 * 24 * 3_600_000;

/**
 * Le stockage local est une frontière comme une autre : son contenu est
 * modifiable à la main et peut venir d'une version antérieure de l'écran. Il
 * est donc validé, jamais typé par assertion.
 */
const savedStateSchema = z.object({
  savedAt: z.number(),
  step: z.enum(STEPS),
  /**
   * La commune, et rien de plus précis.
   *
   * Une adresse de domicile est une donnée personnelle, et la laisser au repos
   * dans le stockage d'un navigateur possiblement partagé n'est justifié par
   * rien. Seul un slug de notre référentiel y va, comme celui qui voyage déjà
   * dans l'URL des pages communes.
   *
   * Conséquence assumée du déplacement de l'adresse en tête : **reprendre un
   * parcours interrompu demande de retaper son adresse.** Le reste est
   * restauré — durée, rythme, créneau — et l'écran de reprise y ramène
   * directement une fois l'adresse redonnée. C'est le prix d'un stockage qui
   * ne garde rien d'identifiant, et il est moins cher que l'inverse.
   */
  communeSlug: z.string().max(60),
  surfaceSqm: z.number().int().min(15).max(400).nullable(),
  housingLabel: z.string().nullable(),
  frequency: z.enum(["ONE_OFF", "WEEKLY", "BIWEEKLY", "MONTHLY"]),
  chosenSlot: z.iso.datetime().nullable(),
});

type SavedState = z.infer<typeof savedStateSchema>;

function readSavedState(): SavedState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;

    const parsed = savedStateSchema.safeParse(JSON.parse(raw));
    if (!parsed.success) return null;

    const saved = parsed.data;
    if (Date.now() - saved.savedAt > RESUME_MAX_AGE_MS) return null;

    // Un créneau dont l'heure est passée ne se reprend pas : on garde le reste
    // du parcours et on renvoie au choix de l'heure.
    const slotIsPast =
      saved.chosenSlot !== null &&
      new Date(saved.chosenSlot).getTime() < Date.now();

    // Un écran qui suit le créneau n'a plus de sens sans lui : on ne renvoie
    // jamais en avant de l'étape que l'on vient d'invalider.
    if (slotIsPast) {
      return { ...saved, step: "creneau", chosenSlot: null };
    }
    return saved;
  } catch {
    // Un stockage illisible — quota, mode privé, JSON tronqué — ne doit pas
    // empêcher de réserver. On repart de zéro, sans rien signaler.
    return null;
  }
}

function clearSavedState() {
  cachedSaved = null;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Le stockage peut être refusé ; il n'y a rien à rattraper.
  }
}

/**
 * Lecture du stockage, une seule fois et sous une identité stable.
 *
 * `useSyncExternalStore` est le bon outil ici, plutôt qu'un effet qui poserait
 * l'état au montage : le rendu serveur ne voit pas le stockage, le client si,
 * et c'est précisément l'écart que ce hook sait franchir sans provoquer
 * d'erreur d'hydratation. Il exige en revanche un instantané référentiellement
 * stable — d'où la mémoïsation, sans laquelle chaque lecture rendrait un
 * nouvel objet et boucler ait indéfiniment.
 */
let cachedSaved: SavedState | null | undefined;

function savedSnapshot(): SavedState | null {
  if (cachedSaved === undefined) {
    cachedSaved = readSavedState();
  }
  return cachedSaved;
}

/** Le stockage n'émet rien : il n'y a rien à écouter, donc rien à résilier. */
function subscribeToSavedState(): () => void {
  return () => {};
}

/* -------------------------------------------------------------------------- */
/* Tunnel                                                                     */
/* -------------------------------------------------------------------------- */

export function BookingFunnel({
  backend,
  communes,
  defaultQuery = "",
  defaultCommuneSlug,
  defaultSurfaceSqm,
  defaultStep,
  knownClient = null,
}: {
  /**
   * Les quatre opérations dont le tunnel a besoin. En production ce sont les
   * server actions ; sur la vitrine statique, un calcul dans le navigateur.
   * L'écran ne fait pas la différence, et c'est le but.
   */
  backend: BookingBackend;
  /**
   * Communes desservies, pour la saisie manuelle. Transmises par le serveur
   * plutôt qu'importées ici : le référentiel complet n'a pas à voyager dans le
   * bundle client pour six champs par commune.
   */
  communes: readonly CommuneOption[];
  /** Adresse pré-remplie, depuis une page commune par exemple. */
  defaultQuery?: string;
  /** Commune d'arrivée, présélectionnée en saisie manuelle. */
  defaultCommuneSlug?: string;
  /** Surface reprise de l'URL, pour qu'un lien partagé rouvre au bon endroit. */
  defaultSurfaceSqm?: number;
  /** Écran repris de l'URL. Ramené à ce que les choix connus rendent atteignable. */
  defaultStep?: string;
  /**
   * Ce que la plateforme sait déjà du visiteur, lu côté serveur sur sa
   * session. `null` pour un anonyme comme pour un compte qui n'a jamais
   * réservé : le tunnel se comporte alors exactement comme avant.
   */
  knownClient?: KnownClient | null;
}) {
  /**
   * Commune d'arrivée, quand le tunnel est ouvert depuis une page locale.
   *
   * Elle ne vaut plus réponse au premier écran — l'adresse exacte s'y demande
   * désormais, et une commune n'en est pas une. Elle sert trois choses moins
   * visibles mais réelles : le repère de la saisie manuelle, l'exemple du
   * champ, et surtout le préchargement des créneaux depuis le centre de la
   * commune pendant qu'on tape son adresse — de sorte que l'écran des heures
   * est le plus souvent déjà prêt quand on y arrive.
   */
  const originCommune =
    communes.find((entry) => entry.slug === defaultCommuneSlug) ?? null;

  const [commune, setCommune] = useState<CommuneOption | null>(originCommune);

  /**
   * Le tunnel ouvre toujours sur l'adresse, et il n'y a rien à en déduire.
   *
   * L'URL ne porte jamais d'adresse et n'en portera pas : une barre d'adresse
   * se partage, s'enregistre en favori et se retrouve dans les journaux d'un
   * serveur. Aucun lien, aucun rechargement, aucune reprise ne peut donc
   * franchir le premier écran sans qu'on ait saisi quelque chose.
   *
   * Ce que l'URL et le stockage savent n'est pas perdu pour autant : l'écran
   * à rejoindre est mis de côté et rejoint **dès l'adresse donnée**, sans
   * refaire les écrans déjà remplis. Il est ramené à ce que les choix connus
   * rendent atteignable — sans surface, on ne dépasse pas le deuxième écran,
   * une URL bricolée à la main n'ouvrant pas un écran de créneaux qui n'a ni
   * durée à chercher ni prix à afficher.
   */
  const [step, setStep] = useState<Step>("adresse");

  const [pendingStep, setPendingStep] = useState<Step | null>(
    defaultSurfaceSqm === undefined
      ? null
      : defaultStep === "rythme"
        ? "rythme"
        : null,
  );

  /* Mesure du parcours : voir `tunnel-tracage.ts`. Sans cookie, sans identité. */
  useTracageTunnel(backend, step);
  /** Renseigné quand une modification part du récapitulatif : on y revient. */
  const [returnToRecap, setReturnToRecap] = useState(false);

  const [address, setAddress] = useState<AddressChoice | null>(null);
  /*
   * Un client qui revient retrouve son dernier choix déjà posé : il confirme
   * au lieu de saisir. Rien n'est verrouillé pour autant — un logement peut
   * changer, et les deux écrans restent des questions.
   */
  const [surfaceSqm, setSurfaceSqm] = useState<number | null>(
    defaultSurfaceSqm ?? knownClient?.lastChoice?.surfaceSqm ?? null,
  );
  const [housingLabel, setHousingLabel] = useState<string | null>(
    presetLabelFor(defaultSurfaceSqm ?? knownClient?.lastChoice?.surfaceSqm),
  );
  const [frequency, setFrequency] = useState<Frequency>(
    offeredFrequency(knownClient?.lastChoice?.frequency),
  );
  const [contact, setContact] = useState<ContactInput>(
    knownClient
      ? {
          ...EMPTY_CONTACT,
          firstName: knownClient.firstName,
          lastName: knownClient.lastName,
          email: knownClient.email,
          phone: knownClient.phone,
        }
      : EMPTY_CONTACT,
  );

  const [quotes, setQuotes] = useState<Partial<Record<Frequency, QuoteView>>>(
    {},
  );
  const [quotesPending, setQuotesPending] = useState(false);

  const [slots, setSlots] = useState<SlotView[]>([]);
  const [slotsFetchedAt, setSlotsFetchedAt] = useState<number | null>(null);
  const [slotsStatus, setSlotsStatus] = useState<
    "idle" | "loading" | "ready" | "error"
  >("idle");
  /**
   * Dernière combinaison adresse + durée pour laquelle une recherche a été
   * lancée, quel qu'en soit le résultat. C'est une référence et non un état :
   * un échec doit interrompre la boucle de préchargement, alors qu'un état
   * relancerait l'effet indéfiniment.
   */
  const attemptedSlotsKey = useRef<string | null>(null);

  const [chosenSlot, setChosenSlot] = useState<string | null>(null);
  const [alternateSlots, setAlternateSlots] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<{
    message: string;
    retry?: () => void;
  } | null>(null);
  const [confirmation, setConfirmation] = useState<ConfirmationView | null>(
    null,
  );

  const stored = useSyncExternalStore(
    subscribeToSavedState,
    savedSnapshot,
    () => null,
  );
  const [resumeHandled, setResumeHandled] = useState(false);
  const resumable = resumeHandled ? null : stored;

  const quote = quotes[frequency] ?? null;

  /**
   * Point de recherche des créneaux, et ce qu'il vaut.
   *
   * Tant que l'adresse exacte n'est pas connue — c'est-à-dire pendant les
   * quatre premiers écrans — on cherche depuis le centre de la commune. Le
   * moteur s'y donne une marge de trajet, si bien que les heures proposées
   * restent tenables à l'adresse réelle.
   */
  const destination = address
    ? { lat: address.lat, lng: address.lng, inseeCode: address.inseeCode }
    : commune
      ? { lat: commune.lat, lng: commune.lng, inseeCode: commune.insee }
      : null;
  const precision = address ? "adresse" : "commune";

  /* --- Persistance ------------------------------------------------------ */

  /*
   * On n'enregistre qu'un parcours **commencé**.
   *
   * La commune est désormais déduite de l'adresse, et non plus choisie au
   * premier écran : sans cette garde, arriver sur `/reserver?commune=cestas`
   * depuis une page locale suffirait à écrire un parcours à reprendre alors
   * que rien n'a été décidé — et le bandeau de reprise s'afficherait en
   * accueil pour une visite. La durée est le premier vrai choix.
   */
  useEffect(() => {
    if (!commune || surfaceSqm === null || confirmation) return;
    try {
      const state: SavedState = {
        savedAt: Date.now(),
        step,
        communeSlug: commune.slug,
        surfaceSqm,
        housingLabel,
        frequency,
        chosenSlot,
      };
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Stockage refusé : le parcours reste utilisable, simplement sans
      // reprise. Rien à signaler à l'utilisateur, qui n'a rien demandé.
    }
  }, [
    commune,
    step,
    surfaceSqm,
    housingLabel,
    frequency,
    chosenSlot,
    confirmation,
  ]);

  /**
   * L'URL dit où l'on en est.
   *
   * Elle sert deux choses qu'un état en mémoire ne sait pas faire : un lien
   * partagé rouvre le tunnel au même endroit, et un rechargement de page ne
   * ramène pas au premier écran. Seuls y voyagent la commune, la surface et
   * l'écran — jamais un nom, un téléphone ni une adresse, qui n'ont rien à
   * faire dans une barre d'adresse, un historique ou un journal de serveur.
   *
   * `replaceState` et non `pushState` : les entrées d'historique sont posées
   * par la navigation entre écrans, plus haut. En ajouter une seconde ici
   * ferait reculer le bouton Retour d'un demi-écran.
   */
  useEffect(() => {
    const url = new URL(window.location.href);
    const before = url.search;

    if (commune) url.searchParams.set("commune", commune.slug);
    else url.searchParams.delete("commune");

    if (surfaceSqm !== null) {
      url.searchParams.set("surface", String(surfaceSqm));
    } else {
      // Un paramètre qui ne décrit plus rien est pire qu'absent : il rouvrirait
      // le tunnel sur un choix que la personne vient de défaire.
      url.searchParams.delete("surface");
    }
    url.searchParams.set("step", step);

    if (url.search !== before) {
      window.history.replaceState(window.history.state, "", url);
    }
  }, [commune, surfaceSqm, step]);

  /* --- Historique du navigateur ----------------------------------------- */

  /**
   * Chaque écran est une entrée d'historique.
   *
   * Sans cela, le retour arrière — bouton du navigateur, geste de balayage sur
   * iOS, touche Retour d'Android — faisait sortir du tunnel depuis n'importe
   * quelle étape. C'est le geste le plus employé sur mobile, et le seul dont
   * l'effet était de tout perdre : cinq écrans remplis, une sortie sèche vers
   * la page d'où l'on venait.
   *
   * L'état React ne bouge pas, puisque le composant n'est jamais démonté : ce
   * qui est écrit dans l'historique n'est que le nom de l'écran. Rien d'autre
   * n'y va, et surtout aucune donnée personnelle — l'entrée d'historique
   * survit à l'onglet.
   *
   * L'entrée d'arrivée est corrigée plutôt qu'ajoutée : sans cela, revenir
   * depuis le deuxième écran quitterait la page au lieu de revenir au premier.
   */
  const stepPushedByHistory = useRef(false);
  /** Entrées d'historique ajoutées par le tunnel, et donc reprenables. */
  const ownHistoryEntries = useRef(0);

  useEffect(() => {
    const state = window.history.state as { leocleanStep?: string } | null;
    if (state?.leocleanStep) return;
    window.history.replaceState({ ...state, leocleanStep: step }, "");
    // Volontairement au montage seulement : la suite est gérée plus bas.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    // Le retour arrière a déjà positionné l'écran : le réécrire ajouterait une
    // entrée en avant, et le bouton Retour ferait du surplace.
    if (stepPushedByHistory.current) {
      stepPushedByHistory.current = false;
      return;
    }
    const state = window.history.state as { leocleanStep?: string } | null;
    if (state?.leocleanStep === step) return;
    window.history.pushState({ ...state, leocleanStep: step }, "");
    ownHistoryEntries.current += 1;
  }, [step]);

  useEffect(() => {
    function onPopState(event: PopStateEvent) {
      const target = (event.state as { leocleanStep?: string } | null)
        ?.leocleanStep;
      // Une entrée qui ne vient pas du tunnel appartient à la page précédente :
      // on laisse le navigateur faire, c'est bien une sortie.
      if (!target || !(STEPS as readonly string[]).includes(target)) return;
      stepPushedByHistory.current = true;
      ownHistoryEntries.current = Math.max(0, ownHistoryEntries.current - 1);
      setError(null);
      // Un retour arrière est un retour, pas la fin d'une modification lancée
      // depuis le récapitulatif : l'entrée précédente est déjà la bonne.
      setReturnToRecap(false);
      setStep(target as Step);
    }

    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  /* --- Devis ------------------------------------------------------------ */

  /**
   * Demande les quatre devis d'un coup, un par fréquence.
   *
   * Les quatre sont chargés ensemble parce que l'écran suivant montre le prix
   * de chaque rythme : sans cela, il faudrait choisir sans savoir ce que le
   * choix coûte, ou attendre un aller-retour à chaque changement d'avis.
   */
  const loadQuotes = useCallback(
    async (surface: number, startAt?: string) => {
      setQuotesPending(true);
      const results = await Promise.all(
        FREQUENCIES.map(async (entry) => ({
          frequency: entry.value,
          result: await backend.getQuote({
            surfaceSqm: surface,
            frequency: entry.value,
            optionSlugs: [],
            ...(startAt ? { startAt } : {}),
          }),
        })),
      );

      const failure = results.find((entry) => !entry.result.ok);
      if (failure && !failure.result.ok) {
        setQuotesPending(false);
        setError({
          message: failure.result.error,
          retry: () => void loadQuotes(surface, startAt),
        });
        return;
      }

      const next: Partial<Record<Frequency, QuoteView>> = {};
      for (const entry of results) {
        if (entry.result.ok) next[entry.frequency] = entry.result.data;
      }
      setQuotes(next);
      setQuotesPending(false);
      setError(null);
    },
    [backend],
  );

  /**
   * Pour un client qui revient, le devis part avant même la première question.
   *
   * Son dernier logement est connu, donc son prix aussi : il l'a sous les yeux
   * dès l'écran de l'adresse, au lieu d'attendre le troisième. S'il change de
   * logement, `chooseHousing` redemandera — d'où un effet qui ne dépend que
   * de la surface initiale, `loadQuotes` étant par ailleurs stable.
   */
  const initialSurfaceSqm =
    defaultSurfaceSqm ?? knownClient?.lastChoice?.surfaceSqm ?? null;
  useEffect(() => {
    if (initialSurfaceSqm === null) return;
    void loadQuotes(initialSurfaceSqm);
  }, [initialSurfaceSqm, loadQuotes]);

  /* --- Créneaux --------------------------------------------------------- */

  const loadSlots = useCallback(
    async (
      target: {
        lat: number;
        lng: number;
        inseeCode: string;
        precision: "adresse" | "commune";
      },
      durationMinutes: number,
      key: string,
    ): Promise<void> => {
      attemptedSlotsKey.current = key;
      setSlotsStatus("loading");

      const result = await backend.getSlots({
        lat: target.lat,
        lng: target.lng,
        inseeCode: target.inseeCode,
        durationMinutes,
        precision: target.precision,
      });

      if (!result.ok) {
        setSlotsStatus("error");
        setError({
          message: result.error,
          retry: () => void loadSlots(target, durationMinutes, key),
        });
        return;
      }

      setSlots(result.data);
      setSlotsFetchedAt(Date.now());
      setSlotsStatus("ready");
      setError(null);
    },
    [backend],
  );

  /**
   * Préchargement des créneaux dès que le devis est connu.
   *
   * La recherche interroge le moteur de disponibilité sur trois semaines : la
   * lancer au moment où l'écran s'affiche imposait une attente de plusieurs
   * secondes devant une page vide. Elle part maintenant pendant que la
   * personne choisit son rythme, si bien que l'écran suivant est le plus
   * souvent déjà prêt.
   *
   * La durée ne dépend pas de la fréquence — seul le tarif horaire en dépend —
   * donc changer de rythme n'invalide pas les créneaux déjà chargés.
   */
  useEffect(() => {
    if (!destination || !quote) return;
    const key = `${destination.lat},${destination.lng},${quote.durationMinutes}`;
    if (key === attemptedSlotsKey.current) return;
    void loadSlots({ ...destination, precision }, quote.durationMinutes, key);
    // `destination` est recalculé à chaque rendu : c'est la clé qui décide, et
    // elle ne change que si le point ou la durée changent.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    destination?.lat,
    destination?.lng,
    destination?.inseeCode,
    precision,
    quote,
    loadSlots,
  ]);

  /* --- Navigation ------------------------------------------------------- */

  const index = STEPS.indexOf(step);

  function goTo(next: Step) {
    setError(null);
    setStep(next);
  }

  /**
   * Avance d'un écran, ou revient au récapitulatif si l'on en venait.
   *
   * Le récapitulatif occupe le dernier écran, où l'on a enfin tout ce qu'il
   * faut pour le montrer.
   */
  const LAST_STEP: Step = STEPS[STEPS.length - 1]!;

  function advance(from: Step) {
    setError(null);
    if (returnToRecap) {
      setReturnToRecap(false);
      setStep(LAST_STEP);
      return;
    }
    setStep(STEPS[STEPS.indexOf(from) + 1] ?? LAST_STEP);
  }

  function editFromRecap(target: Step) {
    setReturnToRecap(true);
    goTo(target);
  }

  /**
   * Retour d'un écran.
   *
   * Il passe par l'historique quand le tunnel y a laissé une entrée : la
   * flèche de l'écran et le retour du navigateur doivent défaire la même
   * chose, sans quoi l'un empile ce que l'autre dépile. Le compteur garantit
   * qu'on ne fait jamais reculer le navigateur au-delà de nos propres entrées
   * — ce qui reviendrait à quitter le site sur un bouton qui promet le
   * contraire.
   */
  function goBack() {
    if (ownHistoryEntries.current > 0) {
      window.history.back();
      return;
    }
    setError(null);
    if (returnToRecap) {
      setReturnToRecap(false);
      setStep(LAST_STEP);
      return;
    }
    setStep(STEPS[Math.max(0, index - 1)]!);
  }

  /* --- Choix ------------------------------------------------------------ */

  /** Les créneaux chargés ne valent plus : on les oublie et on rechargera. */
  function invalidateSlots() {
    attemptedSlotsKey.current = null;
    setSlots([]);
    setSlotsStatus("idle");
    setChosenSlot(null);
  }

  /**
   * Adresse exacte, au premier écran.
   *
   * Trois choses en découlent, dans cet ordre :
   *
   * - **La commune s'en déduit**, par le code INSEE — seul identifiant fiable
   *   de couverture. Elle n'est plus une réponse mais une conséquence, et
   *   c'est elle qui part dans le stockage et dans l'URL, jamais la rue.
   * - **Les créneaux ne sont pas jetés** quand l'adresse change depuis le
   *   récapitulatif. La clé de recherche porte le point : l'effet relance de
   *   lui-même une recherche sur la nouvelle adresse. Effacer l'heure retenue
   *   obligerait à rechoisir au moment de confirmer, ce qui est le pire
   *   endroit pour faire recommencer quelqu'un — et `createBooking` réévalue
   *   de toute façon le créneau sur l'adresse réelle, en essayant les replis
   *   si le premier ne tient plus.
   * - **On rejoint l'écran mis de côté**, s'il y en a un : c'est ce qui rend
   *   une reprise ou un lien partagé utiles malgré une adresse qui ne voyage
   *   nulle part.
   */
  function chooseAddress(choice: AddressChoice) {
    setAddress(choice);
    setError(null);

    const resolved =
      communes.find((entry) => entry.insee === choice.inseeCode) ?? null;
    if (resolved) setCommune(resolved);

    /* Un écran mis de côté qui serait celui-ci n'en est pas un : c'est le
       cas d'un parcours interrompu pendant qu'on corrigeait son adresse. On
       avance normalement, sinon le geste ne ferait rien. */
    if (!returnToRecap && pendingStep && pendingStep !== "adresse") {
      const target = pendingStep;
      setPendingStep(null);
      goTo(target);
      return;
    }
    setPendingStep(null);
    advance("adresse");
  }

  /**
   * Adresse reprise du carnet du client.
   *
   * Ses consignes d'accès reviennent avec elle : le digicode d'un logement ne
   * change pas d'une réservation à l'autre, et le redemander est exactement ce
   * qu'on cherche à supprimer. Une saisie en cours n'est jamais écrasée.
   */
  function chooseKnownAddress(known: KnownAddress) {
    if (known.accessNotes && contact.accessNotes === "") {
      setContact((current) => ({
        ...current,
        accessNotes: known.accessNotes ?? "",
      }));
    }
    chooseAddress({
      banId: known.banId,
      label: known.label,
      street: known.street,
      postalCode: known.postalCode,
      cityName: known.cityName,
      inseeCode: known.inseeCode,
      lat: known.lat,
      lng: known.lng,
      isCovered: true,
      isPreciseToHouseNumber: true,
    });
  }

  function chooseHousing(surface: number, label: string | null) {
    setSurfaceSqm(surface);
    setHousingLabel(label);
    // La durée change, donc les créneaux : les garder afficherait des heures
    // calculées pour une autre mission.
    invalidateSlots();
    void loadQuotes(surface);
    advance("logement");
  }

  function chooseFrequency(next: Frequency) {
    setFrequency(next);
    advance("rythme");
  }

  function chooseSlot(start: string) {
    setChosenSlot(start);
    // Un créneau ne peut pas être à la fois le préféré et son propre repli :
    // le serveur écarterait le doublon, mais l'écran l'aurait montré coché
    // deux fois.
    setAlternateSlots((current) => current.filter((entry) => entry !== start));

    /*
     * Le devis est refait avec l'heure retenue, et c'est le seul moment où il
     * peut l'être : les majorations — samedi, dimanche, férié, dernière minute
     * — dépendent du créneau. Sans ce second appel, le récapitulatif affichait
     * le prix d'un jour ordinaire tandis que `confirmBooking`, qui recalcule
     * côté serveur, prélevait le prix majoré. Le client voyait 84 € et payait
     * 92,40 €.
     *
     * Les quatre rythmes sont refaits ensemble, comme au premier chargement :
     * revenir en arrière pour changer de rythme doit montrer des prix qui
     * tiennent compte du créneau déjà choisi.
     */
    if (surfaceSqm !== null) void loadQuotes(surfaceSqm, start);
  }

  function toggleAlternateSlot(start: string) {
    setAlternateSlots((current) =>
      current.includes(start)
        ? current.filter((entry) => entry !== start)
        : current.length >= MAX_ALTERNATE_SLOTS
          ? current
          : [...current, start],
    );
  }

  function submit() {
    if (!address || !quote || !chosenSlot || surfaceSqm === null) return;

    setSubmitting(true);
    void (async () => {
      const result = await backend.confirmBooking({
        firstName: contact.firstName,
        lastName: contact.lastName,
        email: contact.email,
        phone: contact.phone,
        accessNotes: contact.accessNotes || undefined,
        clientNotes: contact.clientNotes || undefined,
        banId: address.banId,
        street: address.street,
        postalCode: address.postalCode,
        cityName: address.cityName,
        inseeCode: address.inseeCode,
        lat: address.lat,
        lng: address.lng,
        surfaceSqm,
        frequency,
        optionSlugs: [],
        startAt: chosenSlot,
        alternateStarts: alternateSlots,
      });
      setSubmitting(false);

      if (result.ok) {
        clearSavedState();
        setConfirmation(result.data);
        return;
      }

      if (result.code === "BUSINESS") {
        // Un créneau pris entre-temps : on renvoie à la liste plutôt que de
        // laisser réessayer sur une heure morte. Les coordonnées saisies
        // restent en place, elles vivent dans ce composant.
        invalidateSlots();
        setStep("creneau");
        setError({ message: result.error });
        return;
      }

      // Une erreur de saisie sans le nom du champ fautif ne dit rien
      // d'actionnable : on remonte les messages précis que l'action renvoie.
      const details = Object.values(result.fieldErrors ?? {})
        .map((messages) => messages[0])
        .filter((message): message is string => Boolean(message));

      setError({
        message: details.length > 0 ? details.join(" ") : result.error,
        retry: details.length > 0 ? undefined : submit,
      });
    })();
  }

  if (confirmation) {
    return <Confirmed confirmation={confirmation} />;
  }

  /* --- Rendu ------------------------------------------------------------ */

  /*
   * Le récapitulatif collant n'accompagne pas le dernier écran : celui-ci
   * porte déjà son propre récapitulatif, ligne à ligne — deux résumés côte à
   * côte se contrediraient au premier oubli de synchronisation.
   */
  const showAside = step !== "recap";

  return (
    <div>
      {/* La bande de progression court sur toute la largeur, au-dessus des
          deux colonnes — comme sur le prototype. */}
      <FunnelHeader
        index={index}
        title={STEP_TITLES[step]}
        onBack={index > 0 || returnToRecap ? goBack : undefined}
      />

      {/* En desktop, deux colonnes : le tunnel garde sa largeur de lecture et
          le récapitulatif collant occupe la droite — c'est lui qui porte le
          prix, la barre basse restant l'affaire du mobile. */}
      <div
        className={
          showAside
            ? "lg:grid lg:grid-cols-[1.5fr_0.9fr] lg:items-start lg:gap-10"
            : undefined
        }
      >
        {/* Le conteneur occupe au moins la hauteur de l'écran : sans cela, la
            barre de prix — collante au bas de son parent — se posait au milieu
            de la page sur les étapes courtes au lieu de rester sous le
            pouce.
            `min-w-0` — sans lui, une colonne de grille prend la largeur de son
            contenu, et la bande de jours défilante pousse le récapitulatif
            hors de l'écran : le piège que le prototype documente. */}
        <div className="flex min-h-[calc(100svh-11rem)] min-w-0 flex-col">
          {/* Le même titre que le tunnel de candidature : la famille des
              titres, en 3xl, adoucie à 700 par les tokens de graisse. */}
          <h2 className="mt-6 font-heading text-3xl font-extrabold text-balance">
            {STEP_TITLES[step]}
          </h2>

          <div className="mt-5 flex-1 space-y-5 pb-4">
            {/* La reprise se propose tant qu'on n'a rien décidé de neuf : au-delà
            du deuxième écran, elle défaire ait un parcours en cours. */}
            {resumable && index <= 1 ? (
              <ResumePrompt
                saved={resumable}
                communeName={
                  communes.find((entry) => entry.slug === resumable.communeSlug)
                    ?.name ?? null
                }
                onResume={() => {
                  const saved = communes.find(
                    (entry) => entry.slug === resumable.communeSlug,
                  );
                  if (saved) setCommune(saved);
                  setSurfaceSqm(resumable.surfaceSqm);
                  setHousingLabel(resumable.housingLabel);
                  setFrequency(offeredFrequency(resumable.frequency));
                  setChosenSlot(resumable.chosenSlot);
                  // Les replis ne sont pas enregistrés : ils décrivent un état du
                  // planning qui a une semaine, et le proposer à nouveau ferait
                  // réserver sur des heures qui n'existent plus.
                  setAlternateSlots([]);
                  if (resumable.surfaceSqm !== null) {
                    void loadQuotes(resumable.surfaceSqm);
                  }
                  setResumeHandled(true);
                  /* L'adresse n'est jamais enregistrée : on la redemande, et
                     l'écran où l'on en était est rejoint dès qu'elle est
                     donnée. Une reprise qui rouvrirait directement le choix du
                     créneau chercherait des heures sans savoir où aller. */
                  setPendingStep(resumable.step);
                  goTo("adresse");
                }}
                onDiscard={() => {
                  clearSavedState();
                  setResumeHandled(true);
                }}
              />
            ) : null}

            {error ? <ErrorNotice error={error} /> : null}

            {step === "adresse" ? (
              <AddressStep
                backend={backend}
                communes={communes}
                defaultQuery={defaultQuery}
                originCommune={commune ?? originCommune}
                savedAddresses={knownClient?.addresses ?? []}
                selected={address}
                onSelect={chooseAddress}
                onSelectSaved={chooseKnownAddress}
              />
            ) : null}

            {step === "logement" ? (
              <HousingStep surfaceSqm={surfaceSqm} onChoose={chooseHousing} />
            ) : null}

            {step === "rythme" ? (
              <FrequencyStep
                quotes={quotes}
                pending={quotesPending}
                selected={frequency}
                onChoose={chooseFrequency}
              />
            ) : null}

            {/* En cas d'échec, l'encart d'erreur porte déjà le message et le
            réessai : un squelette perpétuel par-dessus ne dirait rien.
            Sans devis non plus il n'y a rien à attendre — la recherche de
            créneaux a besoin d'une durée, donc d'un devis, et le squelette
            promettait un contenu qui ne pouvait pas arriver. */}
            {step === "creneau" &&
            slotsStatus !== "error" &&
            (quote !== null || quotesPending) ? (
              <SlotStep
                slots={slots}
                fetchedAt={slotsFetchedAt}
                pending={slotsStatus !== "ready"}
                chosen={chosenSlot}
                alternates={alternateSlots}
                onChoose={chooseSlot}
                onToggleAlternate={toggleAlternateSlot}
                onContinue={() => advance("creneau")}
              />
            ) : null}

            {step === "coordonnees" ? (
              <ContactStep
                contact={contact}
                onContactChange={setContact}
                onContinue={() => advance("coordonnees")}
                known={knownClient !== null}
              />
            ) : null}

            {/* Dernier écran : le récapitulatif, une fois qu'on a tout ce
            qu'il faut pour le montrer. Le devis se refait sur le créneau
            retenu — majorations comprises — et il peut n'être pas encore
            revenu. */}
            {step === "recap" && (!address || !quote || !chosenSlot) ? (
              <div className="space-y-3" aria-hidden>
                <div className="h-48 animate-pulse rounded-xl bg-secondary" />
                <div className="h-32 animate-pulse rounded-xl bg-secondary" />
              </div>
            ) : null}

            {step === "recap" && address && quote && chosenSlot ? (
              <RecapStep
                address={address}
                quote={quote}
                frequency={frequency}
                startAt={chosenSlot}
                contact={contact}
                onContactChange={setContact}
                onEdit={editFromRecap}
                onSubmit={submit}
                submitting={submitting}
              />
            ) : null}

            {/* Sur chaque écran, une sortie vers quelqu'un. Certaines demandes se
            règlent en deux minutes au téléphone et jamais dans un
            formulaire — une grande maison, un accès compliqué. */}
            <TalkToSomeone communeName={commune?.name} />
          </div>

          <PriceBar
            quote={quote}
            pending={quotesPending}
            frequency={frequency}
            className={showAside ? "lg:hidden" : undefined}
          />
        </div>

        {showAside ? (
          <RecapAside
            step={step}
            address={address}
            surfaceSqm={surfaceSqm}
            quote={quote}
            frequency={frequency}
            chosenSlot={chosenSlot}
            alternateCount={alternateSlots.length}
            onEdit={goTo}
          />
        ) : null}
      </div>
    </div>
  );
}

/**
 * Récapitulatif collant, à droite du tunnel en desktop.
 *
 * Chaque ligne renvoie à son écran : corriger un choix ne demande pas de
 * remonter le parcours à l'aveugle. Une ligne n'apparaît que lorsque son
 * information existe — un tiret serait une promesse de formulaire, pas un
 * résumé — et « Modifier » ne se propose pas sur l'écran où l'on est déjà.
 *
 * Le prix y vit en permanence, comme dans la barre basse du mobile : même
 * règle, un vrai prix d'entrée tant que la durée n'est pas connue, jamais un
 * montant inventé.
 */
function RecapAside({
  step,
  address,
  surfaceSqm,
  quote,
  frequency,
  chosenSlot,
  alternateCount,
  onEdit,
}: {
  step: Step;
  address: AddressChoice | null;
  surfaceSqm: number | null;
  quote: QuoteView | null;
  frequency: Frequency;
  chosenSlot: string | null;
  alternateCount: number;
  onEdit: (step: Step) => void;
}) {
  const rhythm = FREQUENCIES.find((entry) => entry.value === frequency);

  const durationMinutes =
    quote?.durationMinutes ??
    (surfaceSqm !== null
      ? estimateDuration({ surfaceSqm, service: DURATION_SERVICE })
          .durationMinutes
      : null);

  const lines: {
    label: string;
    value: string;
    target: Step;
  }[] = [
    ...(address
      ? [{ label: "Adresse", value: address.label, target: "adresse" as Step }]
      : []),
    ...(durationMinutes !== null
      ? [
          {
            label: "Durée",
            value: `${formatDuration(durationMinutes)} · idéal pour ${suggestedSurfaceFor(
              durationMinutes,
              DURATION_SERVICE,
            )} m²`,
            target: "logement" as Step,
          },
        ]
      : []),
    // Le rythme n'a de sens qu'une fois la durée posée : avant, il n'est
    // qu'une présélection que la personne n'a pas encore vue.
    ...(durationMinutes !== null && rhythm
      ? [{ label: "Rythme", value: rhythm.label, target: "rythme" as Step }]
      : []),
    ...(chosenSlot !== null
      ? [
          {
            label: "Créneau",
            value: `${dayFormatter.format(new Date(chosenSlot))} à ${hourLabel(
              new Date(chosenSlot),
            )}`,
            target: "creneau" as Step,
          },
          {
            label: "Replis",
            value:
              alternateCount > 0
                ? `${alternateCount} créneau${alternateCount > 1 ? "x" : ""}`
                : "aucun",
            target: "creneau" as Step,
          },
        ]
      : []),
  ];

  return (
    <aside
      aria-label="Votre demande"
      className="sticky top-6 mt-6 hidden overflow-hidden rounded-[var(--r-l)] border border-border bg-card shadow-md lg:block"
    >
      <div className="flex items-center gap-2.5 border-b border-border-subtle px-5 py-4">
        <ReceiptTextIcon className="size-5 text-brand" aria-hidden />
        <p className="font-extrabold">Votre demande</p>
      </div>

      {lines.length > 0 ? (
        <dl className="space-y-3 px-5 py-4 text-sm">
          {lines.map((line) => (
            <div
              key={line.label}
              className="flex items-start justify-between gap-3"
            >
              <dt className="shrink-0 text-muted-foreground">{line.label}</dt>
              <dd className="text-right font-semibold">
                {line.value}
                {step !== line.target ? (
                  <button
                    type="button"
                    onClick={() => onEdit(line.target)}
                    className="ml-auto block text-xs font-semibold text-brand underline underline-offset-2"
                  >
                    Modifier
                    <span className="sr-only">
                      {" "}
                      — {line.label.toLowerCase()}
                    </span>
                  </button>
                ) : null}
              </dd>
            </div>
          ))}
        </dl>
      ) : (
        <p className="px-5 py-4 text-sm text-muted-foreground">
          Vos choix s&apos;affichent ici au fil du parcours.
        </p>
      )}

      <div className="bg-cream-50 px-5 py-4">
        {quote ? (
          <>
            {/* Le prix se décompose, comme sur le prototype : la prestation,
                l'absence de frais ajoutés, puis le total — c'est la ligne
                « aucun » qui porte l'argument. */}
            <dl className="space-y-1.5 text-sm">
              <div className="flex items-baseline justify-between gap-3">
                <dt>Ménage {formatDuration(quote.durationMinutes)}</dt>
                <dd className="font-semibold tabular-nums">
                  {formatEuros(quote.grossAmountCents)}
                </dd>
              </div>
              <div className="flex items-baseline justify-between gap-3 text-muted-foreground">
                <dt>Frais de service</dt>
                <dd>aucun</dd>
              </div>
            </dl>
            <div className="mt-3 flex items-baseline justify-between gap-3 border-t border-cream-200 pt-3">
              <p className="font-extrabold">Par intervention</p>
              <p className="text-2xl font-black tabular-nums">
                {formatEuros(quote.grossAmountCents)}
              </p>
            </div>
            <p className="mt-0.5 text-right text-sm text-muted-foreground tabular-nums">
              {formatDuration(quote.durationMinutes)} ·{" "}
              {formatHourlyRate(quote.hourlyRateCents)}
            </p>
          </>
        ) : (
          <div className="flex items-baseline justify-between gap-3">
            <p className="font-extrabold">
              À partir de {formatHourlyRate(PUBLIC_RATES[0]!.hourlyRateCents)}
            </p>
            <p className="text-sm text-muted-foreground">
              minimum {MINIMUM_BILLABLE_MINUTES / 60} h
            </p>
          </div>
        )}
        {/* La note reprend la réassurance de la barre basse — le
            fonctionnement d'aujourd'hui, sans promettre une mécanique de
            carte qui n'existe pas encore. */}
        <p className="mt-3 rounded-[var(--r-s)] bg-pineapple-50 px-3 py-2 text-xs text-pretty text-ink-700">
          {REASSURANCE}
        </p>
      </div>
    </aside>
  );
}

/* -------------------------------------------------------------------------- */
/* Cadre                                                                      */
/* -------------------------------------------------------------------------- */

/**
 * En-tête du tunnel : retour et progression, rien d'autre.
 *
 * Un seul modèle de navigation à la fois — dans le tunnel, il n'y a ni menu ni
 * liens de contenu, qui ne serviraient qu'à en sortir.
 *
 * **La progression est une barre, et c'est un remplacement, pas un réglage.**
 * Elle était une bande de six pastilles nommées, larges de 640 pixels, qui
 * défilait horizontalement sur un écran de 375 : la moitié des étapes était
 * hors du champ, et il fallait pousser du doigt pour savoir où l'on en était.
 * Le décompte n'est pas perdu — il est le nom accessible de la barre — mais il
 * n'occupe plus une ligne de titre à lui seul. `EnTeteTunnel` est la même
 * pièce que celle du tunnel de candidature : c'est la seule façon d'obtenir
 * que les deux parcours se ressemblent encore dans six mois.
 *
 * Les pastilles n'étaient de toute façon pas cliquables — corriger un choix
 * passe par le récapitulatif, qui dit ce qu'on va modifier.
 */
function FunnelHeader({
  index,
  title,
  onBack,
}: {
  index: number;
  title: string;
  onBack?: () => void;
}) {
  return (
    <div>
      <EnTeteTunnel etape={index + 1} total={STEPS.length} onRetour={onBack} />

      {/*
        Le changement d'écran est annoncé aux lecteurs d'écran.
        Le tunnel ne navigue pas : c'est le même document dont le contenu est
        remplacé, si bien que rien n'est lu quand on passe d'une étape à la
        suivante — quelqu'un qui n'y voit pas se retrouve devant un formulaire
        qui a changé sans prévenir. `polite` plutôt qu'`assertive` : l'annonce
        attend la fin de ce qui est en cours de lecture, elle ne la coupe pas.
      */}
      <p aria-live="polite" className="sr-only">
        Étape {index + 1} sur {STEPS.length} : {title}
      </p>
    </div>
  );
}

/**
 * Barre de prix, présente à toutes les étapes.
 *
 * Tant que la taille du logement n'est pas connue, aucun total n'existe : on
 * annonce alors le prix d'entrée de la grille publique, qui est un vrai prix,
 * plutôt qu'un espace vide ou un montant inventé.
 */
function PriceBar({
  quote,
  pending,
  frequency,
  className,
}: {
  quote: QuoteView | null;
  pending: boolean;
  frequency: Frequency;
  /** `lg:hidden` quand le récapitulatif collant porte déjà le prix. */
  className?: string;
}) {
  const rhythm = FREQUENCIES.find((entry) => entry.value === frequency);

  return (
    <div
      className={`sticky bottom-0 z-20 -mx-6 mt-2 border-t border-border bg-background/95 px-6 py-3 backdrop-blur ${className ?? ""}`}
    >
      {quote ? (
        <div>
          <div className="flex items-baseline justify-between gap-3">
            <p className="text-2xl font-black tabular-nums">
              {formatEuros(quote.grossAmountCents)}
            </p>
            <p className="shrink-0 text-sm text-muted-foreground tabular-nums">
              {formatHourlyRate(quote.hourlyRateCents)}
            </p>
          </div>
          <p className="text-sm text-pretty text-muted-foreground">
            par intervention de {formatDuration(quote.durationMinutes)}
            <span className="sr-only"> — {rhythm?.label.toLowerCase()}</span>
          </p>
        </div>
      ) : pending ? (
        <div className="space-y-2" aria-hidden>
          <div className="h-7 w-32 animate-pulse rounded-md bg-secondary" />
          <div className="h-4 w-44 animate-pulse rounded-md bg-secondary" />
        </div>
      ) : (
        <div className="flex items-baseline justify-between gap-4">
          <div>
            <p className="text-xl font-extrabold">
              À partir de {formatHourlyRate(PUBLIC_RATES[0]!.hourlyRateCents)}
            </p>
            <p className="text-sm text-pretty text-muted-foreground">
              Minimum {MINIMUM_BILLABLE_MINUTES / 60} heures · votre prix à
              l&apos;étape suivante
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

function ResumePrompt({
  saved,
  communeName,
  onResume,
  onDiscard,
}: {
  saved: SavedState;
  /** Nom de la commune enregistrée, résolu depuis le référentiel. */
  communeName: string | null;
  onResume: () => void;
  onDiscard: () => void;
}) {
  const when = saved.chosenSlot
    ? ` pour ${dayFormatter.format(new Date(saved.chosenSlot))}`
    : "";
  const position = STEPS.indexOf(saved.step) + 1;

  return (
    <div className="rounded-xl border border-teal-200 bg-teal-50 p-5">
      <p className="font-medium">
        Reprendre ma réservation — étape {position} sur {STEPS.length}
      </p>
      <p className="mt-1 text-sm text-muted-foreground">
        {communeName ? `Un ménage à ${communeName}${when}. ` : ""}
        Nous avons gardé vos choix, sans vos coordonnées ni votre adresse.
      </p>
      <div className="mt-4 flex flex-wrap gap-3">
        <Button onClick={onResume} className="min-h-11">
          Reprendre où j&apos;en étais
        </Button>
        <Button variant="ghost" onClick={onDiscard} className="min-h-11">
          <RotateCcwIcon aria-hidden />
          Recommencer
        </Button>
      </div>
    </div>
  );
}

/**
 * Sortie vers un humain, présente à chaque écran.
 *
 * Discrète mais jamais absente : certaines demandes se règlent en deux minutes
 * au téléphone et jamais dans un formulaire — une grande maison, un accès
 * compliqué, une date qui n'apparaît pas. Le panneau reprend les trois canaux
 * du reste du produit.
 */
function TalkToSomeone({ communeName }: { communeName?: string }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <p className="pt-2 text-center text-sm">
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-haspopup="dialog"
          className="min-h-11 px-2 text-muted-foreground underline decoration-border underline-offset-4 hover:text-brand"
        >
          Vous préférez en parler ?
        </button>
      </p>
      <ContactSheet
        open={open}
        onOpenChange={setOpen}
        communeName={communeName}
      />
    </>
  );
}

/**
 * Ligne de réassurance, posée sous le bouton d'un écran.
 *
 * Elle répond aux deux questions qui font fermer l'onglet, et elle les répond
 * là où le geste se fait — pas dans un bloc de bas de page.
 */
function Reassurance({ className = "" }: { className?: string }) {
  return (
    <p className={`text-center text-sm text-muted-foreground ${className}`}>
      {REASSURANCE}
    </p>
  );
}

/** Une erreur dit ce qui s'est passé et propose d'en sortir. */
function ErrorNotice({
  error,
}: {
  error: { message: string; retry?: () => void };
}) {
  return (
    <div
      role="alert"
      className="rounded-xl border border-destructive/40 bg-destructive/5 p-5"
    >
      <p className="text-sm">{error.message}</p>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        {error.retry ? (
          <Button
            variant="outline"
            onClick={error.retry}
            className="min-h-11 bg-card"
          >
            Réessayer
          </Button>
        ) : null}
        <a
          href={`tel:${SITE.phoneE164}`}
          className="text-sm font-medium text-brand underline"
        >
          Ou appelez-nous au {SITE.phone}
        </a>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Étape 1 — Adresse                                                          */
/* -------------------------------------------------------------------------- */

/*
 * Carte de choix — le `selectable` du design system.
 *
 * Retenue, elle prend la bordure sarcelle, le fond sarcelle très clair et un halo :
 * trois signaux plutôt qu'un, pour que le choix se voie sans dépendre de la
 * seule couleur. Le texte reste encre, donc lisible dans tous les états.
 */
function ChoiceCard({
  selected,
  disabled,
  onClick,
  title,
  hint,
  aside,
  className = "",
}: {
  selected?: boolean;
  disabled?: boolean;
  onClick: () => void;
  title: string;
  hint?: string;
  aside?: React.ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      aria-pressed={selected}
      className={`flex min-h-16 w-full items-center justify-between gap-4 rounded-lg border-2 p-4.5 text-left transition-[background-color,border-color,box-shadow,transform] duration-200 ease-brand active:scale-[0.98] disabled:opacity-50 motion-reduce:active:scale-100 ${
        selected
          ? "border-teal-500 bg-teal-50 ring-3 ring-teal-100"
          : "border-border bg-card hover:border-teal-300 enabled:hover:bg-teal-50"
      } ${className}`}
    >
      <span>
        <span className="block font-semibold">{title}</span>
        {hint ? (
          <span
            className={`mt-0.5 block text-sm ${
              selected ? "text-teal-800" : "text-muted-foreground"
            }`}
          >
            {hint}
          </span>
        ) : null}
      </span>
      {aside}
    </button>
  );
}

/**
 * Premier écran : l'adresse, et la réponse à « intervenez-vous chez moi ? ».
 *
 * Une seule saisie fait trois choses que le tunnel demandait auparavant en
 * deux écrans : elle dit où l'on va, elle dit si c'est desservi — chaque
 * résultat porte sa pastille, et un résultat hors zone n'est pas cliquable —
 * et elle donne le point exact depuis lequel les créneaux seront cherchés.
 *
 * La complétion reste **un confort, pas une dépendance**. La Base Adresse
 * Nationale est un service public qui limite son débit et renvoie parfois
 * 503 ; quand elle ne rend rien, la saisie manuelle prend le relais, et sa
 * commune se choisit dans notre référentiel — ce qui rend structurellement
 * impossible d'engager un parcours hors zone. C'est ce chemin-là que teste le
 * parcours de bout en bout, précisément pour ne pas dépendre d'un tiers.
 */
function AddressStep({
  backend,
  communes,
  defaultQuery,
  originCommune,
  savedAddresses,
  selected,
  onSelect,
  onSelectSaved,
}: {
  backend: BookingBackend;
  communes: readonly CommuneOption[];
  defaultQuery: string;
  originCommune: CommuneOption | null;
  savedAddresses: readonly KnownAddress[];
  selected: AddressChoice | null;
  onSelect: (choice: AddressChoice) => void;
  onSelectSaved: (address: KnownAddress) => void;
}) {
  const [query, setQuery] = useState(selected?.label ?? defaultQuery);
  const [results, setResults] = useState<AddressChoice[]>([]);
  const [searching, setSearching] = useState(false);
  const [manual, setManual] = useState(false);
  const [searchFailed, setSearchFailed] = useState(false);
  const latestQuery = useRef(query);

  useEffect(() => {
    latestQuery.current = query;
    if (query.trim().length < 3) {
      // Rien à faire : les résultats précédents sont simplement masqués au
      // rendu. Les effacer ici déclencherait un rendu en cascade pour un état
      // que l'on sait déjà dériver.
      return;
    }

    // Anti-rebond : la BAN est appelée une fois la frappe stabilisée, pas à
    // chaque caractère. Le service est gratuit, mais le rythme de frappe n'est
    // pas un rythme de requêtes raisonnable.
    const timer = setTimeout(async () => {
      setSearching(true);
      const result = await backend.searchAddress({ query });
      // Une réponse arrivée après que la saisie a changé est périmée :
      // l'appliquer ferait clignoter des résultats sans rapport.
      if (latestQuery.current === query) {
        const found = result.ok ? result.data : [];
        setResults(found);
        // Une recherche qui ne rend rien sur une saisie sérieuse signale soit
        // une adresse introuvable, soit un service indisponible. Dans les deux
        // cas, la sortie est la même : proposer la saisie manuelle.
        setSearchFailed(found.length === 0);
        setSearching(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [backend, query]);

  const visible = query.trim().length >= 3 ? results : [];
  const outsideOnly =
    visible.length > 0 && visible.every((address) => !address.isCovered);

  if (manual) {
    return (
      <ManualAddress
        communes={communes}
        defaultCommuneSlug={originCommune?.slug}
        onCancel={() => setManual(false)}
        onSelect={onSelect}
      />
    );
  }

  return (
    <div className="space-y-5">
      {/* Une adresse déjà employée se choisit d'un geste : c'est la question
          la plus coûteuse du tunnel, et la seule dont on connaisse déjà la
          réponse pour un client qui revient. */}
      {savedAddresses.length > 0 ? (
        <div>
          <p className="text-sm font-medium">Vos adresses</p>
          <ul className="mt-3 space-y-2">
            {savedAddresses.map((saved) => (
              <li key={`${saved.street}-${saved.inseeCode}`}>
                <ChoiceCard
                  onClick={() => onSelectSaved(saved)}
                  title={saved.label}
                  hint={
                    saved.accessNotes
                      ? "Consignes d'accès conservées"
                      : undefined
                  }
                />
              </li>
            ))}
          </ul>
          <p className="mt-4 text-sm text-muted-foreground">
            Ou indiquez une autre adresse.
          </p>
        </div>
      ) : null}

      <div>
        <Label htmlFor="address">Votre adresse</Label>
        <p className="mt-1 text-sm text-muted-foreground">
          Commencez à taper — le code postal marche aussi — nous la complétons.
          Elle sert à savoir si nous venons chez vous et à calculer le trajet de
          l&apos;intervenant, à rien d&apos;autre.
        </p>
        <div className="relative mt-3">
          <MapPinIcon
            className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            id="address"
            value={query}
            autoComplete="street-address"
            onChange={(event) => setQuery(event.target.value)}
            placeholder={`12 rue des Vignes, ${originCommune?.name ?? "Léognan"}`}
            className={`${CHAMP_DOUX_SHADCN} pl-10`}
          />
          {searching ? (
            <Loader2Icon
              className="absolute top-1/2 right-3 size-4 -translate-y-1/2 animate-spin text-muted-foreground"
              aria-label="Recherche en cours"
            />
          ) : null}
        </div>
      </div>

      {outsideOnly ? (
        <p className="rounded-xl border border-border bg-secondary/40 p-4 text-sm">
          Léo Clean intervient dans seize communes au sud de Bordeaux. Cette
          adresse n&apos;en fait pas partie —{" "}
          <Link href="/menage-a-domicile" className="text-brand underline">
            voir la liste des communes
          </Link>
          .
        </p>
      ) : null}

      {/* Squelettes à la forme des résultats attendus : la liste ne surgit pas
          d'un vide, elle se précise. */}
      {searching && visible.length === 0 ? (
        <ul className="space-y-2" aria-hidden>
          {[0, 1, 2].map((line) => (
            <li
              key={line}
              className="h-16 animate-pulse rounded-xl bg-secondary"
            />
          ))}
        </ul>
      ) : null}

      <ul className="space-y-2">
        {visible.map((address) => (
          <li key={address.banId}>
            <ChoiceCard
              disabled={!address.isCovered}
              onClick={() => onSelect(address)}
              title={address.label}
              hint={
                address.isPreciseToHouseNumber
                  ? undefined
                  : "Précisez le numéro pour que l'intervenant trouve"
              }
              aside={
                <span
                  className={`shrink-0 rounded-full px-3 py-1 text-xs font-bold ${
                    address.isCovered
                      ? "bg-teal-100 text-teal-800"
                      : "border-[1.5px] border-border text-muted-foreground"
                  }`}
                >
                  {address.isCovered ? "Desservie" : "Hors zone"}
                </span>
              }
            />
          </li>
        ))}
      </ul>

      {/* La saisie assistée est un confort, pas une dépendance : si la Base
          Adresse Nationale ne répond pas, ou si l'adresse est trop récente
          pour y figurer, la réservation doit rester possible. */}
      {searchFailed && !searching ? (
        <p className="text-sm text-muted-foreground">
          Aucune adresse trouvée.{" "}
          <button
            type="button"
            onClick={() => setManual(true)}
            className="font-medium text-brand underline"
          >
            Saisir mon adresse manuellement
          </button>
        </p>
      ) : (
        <button
          type="button"
          onClick={() => setManual(true)}
          className="text-sm text-muted-foreground underline"
        >
          Saisir mon adresse manuellement
        </button>
      )}

      {/* Le premier écran porte la réassurance, comme les autres : c'est là
          que quelqu'un décide s'il continue. */}
      <Reassurance />
    </div>
  );
}

/**
 * Saisie manuelle de l'adresse.
 *
 * La commune est choisie dans notre propre référentiel : c'est lui qui porte
 * le code INSEE, seul identifiant fiable de couverture, et il rend impossible
 * la saisie d'une commune hors zone.
 *
 * Les coordonnées retenues sont celles du centre de la commune. C'est une
 * approximation, et elle a une conséquence assumée : les temps de trajet
 * calculés seront moins justes que pour une adresse géocodée, donc les
 * créneaux proposés un peu plus prudents. Mieux vaut cela qu'une réservation
 * impossible.
 */
function ManualAddress({
  communes,
  defaultCommuneSlug,
  onCancel,
  onSelect,
}: {
  communes: readonly CommuneOption[];
  defaultCommuneSlug?: string;
  onCancel: () => void;
  onSelect: (choice: AddressChoice) => void;
}) {
  const [street, setStreet] = useState("");
  const [communeSlug, setCommuneSlug] = useState(
    defaultCommuneSlug ?? communes[0]?.slug ?? "",
  );

  const commune = communes.find((entry) => entry.slug === communeSlug);

  return (
    <form
      className="space-y-5"
      onSubmit={(event) => {
        event.preventDefault();
        if (!commune) return;
        onSelect({
          banId: "",
          label: `${street}, ${commune.postalCode} ${commune.name}`,
          street,
          postalCode: commune.postalCode,
          cityName: commune.name,
          inseeCode: commune.insee,
          lat: commune.lat,
          lng: commune.lng,
          isCovered: true,
          isPreciseToHouseNumber: false,
        });
      }}
    >
      <div>
        <Label htmlFor="manual-street">Numéro et rue</Label>
        <Input
          id="manual-street"
          required
          minLength={3}
          autoComplete="street-address"
          value={street}
          onChange={(event) => setStreet(event.target.value)}
          placeholder="12 rue des Vignes"
          className={`mt-2 ${CHAMP_DOUX_SHADCN}`}
        />
      </div>

      <div>
        <Label htmlFor="manual-commune">Commune</Label>
        <select
          id="manual-commune"
          value={communeSlug}
          onChange={(event) => setCommuneSlug(event.target.value)}
          className={`mt-2 ${CHAMP_DOUX_SHADCN} w-full`}
        >
          {communes.map((entry) => (
            <option key={entry.slug} value={entry.slug}>
              {entry.name} ({entry.postalCode})
            </option>
          ))}
        </select>
        <p className="mt-2 text-sm text-muted-foreground">
          Seules les communes desservies figurent dans cette liste : il est
          impossible d&apos;engager un parcours hors zone.
        </p>
      </div>

      <div className="flex flex-col gap-3">
        <Button
          type="submit"
          size="lg"
          className="min-h-12 w-full"
          disabled={street.trim().length < 3}
        >
          Valider mon adresse
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={onCancel}
          className="min-h-11"
        >
          Rechercher mon adresse plutôt
        </Button>
      </div>
    </form>
  );
}

/* -------------------------------------------------------------------------- */
/* Étape 2 — Logement                                                         */
/* -------------------------------------------------------------------------- */

function HousingStep({
  surfaceSqm,
  onChoose,
}: {
  surfaceSqm: number | null;
  onChoose: (surface: number, label: string | null) => void;
}) {
  const chosenMinutes =
    surfaceSqm === null
      ? null
      : estimateDuration({ surfaceSqm, service: DURATION_SERVICE })
          .durationMinutes;

  /**
   * Le curseur au pas de 30 minutes, synchronisé avec les cartes : glisser ne
   * fait qu'ajuster la valeur, c'est le bouton qui engage — un curseur qui
   * ferait avancer l'écran à chaque cran serait inutilisable au pouce.
   */
  const [sliderMinutes, setSliderMinutes] = useState(chosenMinutes ?? 180);

  /** Une durée choisie devient la surface qui la produit, à l'unité près. */
  function chooseDuration(minutes: number, fromPreset: boolean) {
    onChoose(
      surfaceForDuration(minutes, DURATION_SERVICE),
      fromPreset ? formatDuration(minutes) : null,
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        À titre indicatif, un intervenant traite environ{" "}
        {STANDARD_SQM_PER_HOUR_AFFICHE} m² à l&apos;heure. Choisissez une durée
        : elle reste ajustable avec l&apos;intervenant.
      </p>

      <div className="grid gap-3 sm:grid-cols-2">
        {WHOLE_HOUR_CHOICES.map((minutes) => (
          <ChoiceCard
            key={minutes}
            selected={chosenMinutes === minutes}
            onClick={() => chooseDuration(minutes, true)}
            title={formatDuration(minutes)}
            hint={`Idéal pour ${suggestedSurfaceFor(minutes, DURATION_SERVICE)} m²`}
          />
        ))}
      </div>

      {/* Le curseur remplace l'ancien champ « minutes » : la demi-heure
          d'appoint se règle au pouce, entre les mêmes bornes que la grille. */}
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="flex items-baseline justify-between gap-4">
          <Label htmlFor="duration-slider">
            Ajuster par pas de {SLOT_GRANULARITY_MINUTES} minutes
          </Label>
          <span className="font-display text-xl font-extrabold tabular-nums">
            {formatDuration(sliderMinutes)}
          </span>
        </div>
        <input
          id="duration-slider"
          type="range"
          className="range-slider mt-4"
          min={MINIMUM_BILLABLE_MINUTES}
          max={MAX_DURATION_MINUTES}
          step={SLOT_GRANULARITY_MINUTES}
          value={sliderMinutes}
          onChange={(event) => setSliderMinutes(Number(event.target.value))}
          aria-label="Durée de l'intervention, par pas de 30 minutes"
        />
        <div
          className="mt-2 flex justify-between font-mono text-xs text-muted-foreground"
          aria-hidden
        >
          {WHOLE_HOUR_CHOICES.map((minutes) => (
            <span key={minutes}>{formatDuration(minutes)}</span>
          ))}
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          Idéal pour {suggestedSurfaceFor(sliderMinutes, DURATION_SERVICE)} m²
          environ. Au-delà de {formatDuration(MAX_DURATION_MINUTES)}, il vaut
          mieux deux passages qu&apos;une journée intenable : appelez-nous.
        </p>
        <Button
          type="button"
          size="lg"
          className="mt-4 min-h-12 w-full"
          onClick={() => chooseDuration(sliderMinutes, false)}
        >
          Choisir mon rythme
        </Button>
      </div>

      <Reassurance />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Étape 3 — Rythme                                                           */
/* -------------------------------------------------------------------------- */

/**
 * Choix du rythme.
 *
 * Chaque carte porte le prix de son propre rythme : c'est la seule façon de
 * décider en connaissance de cause, l'écart entre régulier et ponctuel étant
 * de quatre euros de l'heure. Les quatre montants viennent du serveur, comme
 * tous les autres.
 *
 * Le libellé ne promet pas un abonnement : la plateforme n'en crée pas encore.
 * Il décrit un tarif, et la note ci-dessous dit comment les passages suivants
 * se calent — c'est-à-dire ce qui se passe réellement aujourd'hui.
 */
function FrequencyStep({
  quotes,
  pending,
  selected,
  onChoose,
}: {
  quotes: Partial<Record<Frequency, QuoteView>>;
  pending: boolean;
  selected: Frequency;
  onChoose: (frequency: Frequency) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="grid gap-3">
        {FREQUENCIES.map((option) => {
          const quote = quotes[option.value];
          return (
            <ChoiceCard
              key={option.value}
              selected={selected === option.value}
              onClick={() => onChoose(option.value)}
              title={option.label}
              hint={option.hint}
              aside={
                quote ? (
                  <span className="shrink-0 text-right">
                    <span className="block text-lg font-extrabold tabular-nums">
                      {formatEuros(quote.grossAmountCents)}
                    </span>
                    {/* Un montant sans unité se lit comme un prix mensuel :
                        sur un écran qui propose « chaque semaine » et « tous
                        les quinze jours », l'ambiguïté n'est pas théorique. */}
                    <span
                      className={`block text-xs ${
                        selected === option.value
                          ? "text-teal-800"
                          : "text-muted-foreground"
                      }`}
                    >
                      par session · {formatHourlyRate(quote.hourlyRateCents)}
                    </span>
                    {/* La mention fiscale est tranchée dans `fiscal.ts` et
                        nulle part ailleurs : tant que la déclaration SAP n'est
                        pas obtenue, rien de ce qui touche au crédit d'impôt ne
                        s'affiche, pas même « avant ». */}
                    {canShowTaxCredit() ? (
                      <span
                        className={`block text-xs ${
                          selected === option.value
                            ? "text-teal-800"
                            : "text-muted-foreground"
                        }`}
                      >
                        avant crédit d&apos;impôt
                      </span>
                    ) : null}
                  </span>
                ) : pending ? (
                  <span
                    className="h-10 w-20 shrink-0 animate-pulse rounded-md bg-secondary"
                    aria-hidden
                  />
                ) : null
              }
            />
          );
        })}
      </div>

      <p className="text-sm text-muted-foreground">
        Aucun abonnement à résilier : vous arrêtez quand vous voulez. En formule
        régulière, nous calons les passages suivants avec vous après le premier
        ménage, et nous cherchons à vous envoyer la même personne à chaque fois.
      </p>

      {/* Dire pourquoi un rythme manque vaut mieux que le laisser chercher. */}
      <p className="text-xs text-muted-foreground">
        « Une fois par mois » n&apos;est pas proposé : à ce rythme,
        l&apos;entretien courant n&apos;en est plus un et la promesse d&apos;un
        intervenant attitré ne tient plus.
      </p>

      <Reassurance />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Étape 4 — Créneau                                                          */
/* -------------------------------------------------------------------------- */

interface CalendarDay {
  key: string;
  date: Date;
  slots: SlotView[];
}

/**
 * Calendrier de l'horizon de réservation, journées vides comprises.
 *
 * Les journées sans disponibilité sont conservées et barrées plutôt que
 * retirées : une liste où ne subsistent que trois dates donne l'impression
 * d'un service vide, alors qu'elle décrit un planning rempli.
 */
function buildCalendar(fromMs: number, slots: SlotView[]): CalendarDay[] {
  const byDay = new Map<string, SlotView[]>();
  for (const slot of slots) {
    const key = dayKeyFormatter.format(new Date(slot.start));
    byDay.set(key, [...(byDay.get(key) ?? []), slot]);
  }

  const days: CalendarDay[] = [];
  const seen = new Set<string>();
  // On itère au-delà de l'horizon : un changement d'heure fait tomber deux
  // itérations sur la même journée civile, et la dernière manquerait.
  for (let i = 0; i < BOOKING_HORIZON_DAYS + 2; i++) {
    if (days.length >= BOOKING_HORIZON_DAYS) break;
    const date = new Date(fromMs + i * 86_400_000);
    const key = dayKeyFormatter.format(date);
    if (seen.has(key)) continue;
    seen.add(key);
    days.push({ key, date, slots: byDay.get(key) ?? [] });
  }
  return days;
}

function SlotStep({
  slots,
  fetchedAt,
  pending,
  chosen,
  alternates,
  onChoose,
  onToggleAlternate,
  onContinue,
}: {
  slots: SlotView[];
  fetchedAt: number | null;
  pending: boolean;
  chosen: string | null;
  alternates: string[];
  onChoose: (start: string) => void;
  onToggleAlternate: (start: string) => void;
  onContinue: () => void;
}) {
  const days = useMemo(
    () => (fetchedAt === null ? [] : buildCalendar(fetchedAt, slots)),
    [fetchedAt, slots],
  );

  const firstOpen = days.find((day) => day.slots.length > 0)?.key ?? null;
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const active =
    days.find((day) => day.key === (activeKey ?? firstOpen)) ?? null;

  if (pending) {
    return (
      <div className="space-y-5" aria-live="polite">
        <p className="sr-only">Recherche des créneaux disponibles…</p>
        <div className="flex gap-2 overflow-hidden" aria-hidden>
          {[0, 1, 2, 3, 4].map((chip) => (
            <div
              key={chip}
              className="h-18 w-18 shrink-0 animate-pulse rounded-xl bg-secondary"
            />
          ))}
        </div>
        <div className="grid grid-cols-3 gap-2" aria-hidden>
          {[0, 1, 2, 3, 4, 5].map((cell) => (
            <div
              key={cell}
              className="h-12 animate-pulse rounded-lg bg-secondary"
            />
          ))}
        </div>
      </div>
    );
  }

  if (slots.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-secondary/40 p-5">
        <p className="font-medium">
          Aucun créneau sur les trois prochaines semaines.
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          Cela arrive dans les communes les plus éloignées. Appelez-nous : nous
          trouvons souvent une solution qui n&apos;apparaît pas ici.
        </p>
        <a
          href={`tel:${SITE.phoneE164}`}
          className="mt-4 inline-flex min-h-12 items-center rounded-full bg-primary px-6 font-bold text-primary-foreground shadow-xs transition-all duration-200 ease-brand hover:-translate-y-px hover:bg-pineapple-400 hover:shadow-action"
        >
          Appeler le {SITE.phone}
        </a>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <p className="text-sm text-muted-foreground">
        Choisissez l&apos;heure qui vous arrange le mieux, puis celles qui vous
        iraient aussi.
      </p>

      {/* Le calendrier vit dans sa carte, comme sur le prototype : la bande
          de jours, la grille d'heures et la légende forment un seul objet. */}
      <div className="space-y-4 rounded-[var(--r-l)] border border-border bg-card p-5">
        {/* Les journées complètes restent visibles, barrées : ce que le planning
          ne peut pas offrir se lit, au lieu de disparaître. */}
        {/* Le bandeau s'accroche : un défilement horizontal libre laisse une
          date coupée en deux au bord de l'écran, et on ne sait plus quel jour
          on lit. */}
        <div className="-mx-5 snap-x snap-mandatory overflow-x-auto px-5">
          <ul className="flex gap-2 pb-1">
            {days.map((day) => {
              const open = day.slots.length > 0;
              const isActive = active?.key === day.key;
              return (
                <li key={day.key} className="snap-start">
                  <button
                    type="button"
                    disabled={!open}
                    onClick={() => setActiveKey(day.key)}
                    aria-pressed={isActive}
                    className={`flex min-h-18 w-18 flex-col items-center justify-center rounded-lg border-2 px-2 py-2 text-center transition-[background-color,border-color] duration-200 ease-brand ${
                      isActive
                        ? "border-ink-900 bg-ink-900 text-white"
                        : open
                          ? "border-border bg-card hover:border-teal-300 hover:bg-teal-50"
                          : "border-border-subtle bg-muted text-ink-300 line-through"
                    }`}
                  >
                    <span className="text-xs capitalize">
                      {chipFormatter.format(day.date).split(" ")[0]}
                    </span>
                    <span className="text-lg font-extrabold tabular-nums">
                      {day.date.getDate()}
                    </span>
                    <span className="text-[0.65rem] uppercase">
                      {monthFormatter.format(day.date).replace(".", "")}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>

        {active ? (
          <div>
            <h3 className="font-extrabold first-letter:uppercase">
              {dayFormatter.format(active.date)}
            </h3>
            {active.slots.length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">
                Complet ce jour-là. Choisissez une autre date ci-dessus.
              </p>
            ) : (
              <ul className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
                {active.slots.map((slot) => {
                  const preferred = chosen === slot.start;
                  const alternate = alternates.includes(slot.start);
                  const full = alternates.length >= MAX_ALTERNATE_SLOTS;

                  return (
                    <li key={slot.start}>
                      <button
                        type="button"
                        /* Le premier choix désigne le créneau préféré. Les
                         suivants ajoutent des replis — sauf sur le préféré
                         lui-même, qu'un second appui libérerait sans qu'on
                         sache lequel prend sa place. */
                        disabled={
                          !preferred &&
                          chosen !== null &&
                          alternate === false &&
                          full
                        }
                        onClick={() => {
                          // Une impulsion de dix millisecondes : le geste se
                          // confirme dans la main. Absente sur iOS, sans
                          // conséquence — c'est un ajout, pas un signal dont
                          // dépend la compréhension.
                          navigator.vibrate?.(10);
                          if (chosen === null || preferred)
                            onChoose(slot.start);
                          else onToggleAlternate(slot.start);
                        }}
                        aria-pressed={preferred || alternate}
                        className={`min-h-12 w-full rounded-md border-2 text-sm font-bold tabular-nums transition-[background-color,border-color,transform] duration-200 ease-brand active:scale-[0.98] disabled:opacity-40 motion-reduce:active:scale-100 ${
                          preferred
                            ? "border-ink-900 bg-ink-900 text-white"
                            : alternate
                              ? "border-teal-400 bg-teal-50 text-teal-800"
                              : "border-border bg-card hover:border-teal-300 hover:bg-teal-50"
                        }`}
                      >
                        {timeFormatter.format(new Date(slot.start))}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        ) : null}

        {/* La légende dit ce que les couleurs disent : personne ne devine
          qu'encre veut dire « préféré » et sarcelle « repli ». */}
        <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <li className="flex items-center gap-1.5">
            <span
              className="inline-block size-3.5 rounded-xs bg-ink-900"
              aria-hidden
            />
            Votre préféré
          </li>
          <li className="flex items-center gap-1.5">
            <span
              className="inline-block size-3.5 rounded-xs border-2 border-teal-400 bg-teal-50"
              aria-hidden
            />
            Repli accepté
          </li>
          <li className="flex items-center gap-1.5">
            <span
              className="inline-block size-3.5 rounded-xs border border-border bg-muted"
              aria-hidden
            />
            Déjà pris
          </li>
        </ul>
      </div>

      {chosen !== null ? (
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-sm">
            <span className="font-semibold">Créneau préféré</span> :{" "}
            <span className="font-bold tabular-nums">
              {dayFormatter.format(new Date(chosen))} à{" "}
              {timeFormatter.format(new Date(chosen))}
            </span>
          </p>

          {/* Le repli n'est pas un confort. Entre l'affichage de la liste et
              la confirmation, une autre réservation peut prendre la place :
              la lecture des disponibilités ne voit pas les transactions en
              cours, seule l'écriture les rencontre. Sans second choix, ce
              client-là recommence tout son parcours. */}
          <p className="mt-2 text-sm text-muted-foreground">
            {alternates.length === 0
              ? "Touchez d'autres heures pour dire lesquelles vous iraient aussi. Si votre créneau part entre-temps, nous prenons l'un de ceux-là plutôt que de tout vous faire recommencer."
              : `${alternates.length} créneau${alternates.length > 1 ? "x" : ""} de repli. Nous ne les utilisons que si votre préféré n'est plus libre.`}
          </p>

          {alternates.length > 0 ? (
            <ul className="mt-3 flex flex-wrap gap-2">
              {[...alternates].sort().map((start) => (
                <li key={start}>
                  <button
                    type="button"
                    onClick={() => onToggleAlternate(start)}
                    className="inline-flex min-h-11 items-center gap-2 rounded-full border border-teal-400 bg-teal-50 px-3 text-sm font-medium text-teal-800"
                  >
                    {dayFormatter.format(new Date(start)).split(" ")[0]}{" "}
                    {timeFormatter.format(new Date(start))}
                    <span aria-hidden>×</span>
                    <span className="sr-only">Retirer ce créneau de repli</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}

          {/* Le bouton annonce l'écran suivant plutôt que « Continuer », qui
              ne dit pas vers quoi. */}
          <Button
            type="button"
            size="lg"
            className="mt-4 min-h-12 w-full"
            onClick={onContinue}
          >
            Saisir mes coordonnées
          </Button>
        </div>
      ) : null}

      <Reassurance />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Étape 6 — Récapitulatif                                                    */
/* -------------------------------------------------------------------------- */

function RecapLine({
  label,
  value,
  onEdit,
  editLabel,
}: {
  label: string;
  value: string;
  onEdit: () => void;
  editLabel: string;
}) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-border/60 py-3 last:border-0">
      <div className="min-w-0">
        <dt className="text-xs text-muted-foreground">{label}</dt>
        <dd className="mt-0.5 font-medium text-pretty">{value}</dd>
      </div>
      <button
        type="button"
        onClick={onEdit}
        aria-label={editLabel}
        className="flex min-h-11 shrink-0 items-center gap-1.5 rounded-lg px-2 text-sm font-medium text-brand underline"
      >
        <PencilIcon className="size-3.5" aria-hidden />
        Modifier
      </button>
    </div>
  );
}

function RecapStep({
  address,
  quote,
  frequency,
  startAt,
  contact,
  onContactChange,
  onEdit,
  onSubmit,
  submitting,
}: {
  address: AddressChoice;
  quote: QuoteView;
  frequency: Frequency;
  startAt: string;
  contact: ContactInput;
  onContactChange: (contact: ContactInput) => void;
  onEdit: (step: Step) => void;
  onSubmit: () => void;
  submitting: boolean;
}) {
  const [details, setDetails] = useState(
    contact.accessNotes !== "" || contact.clientNotes !== "",
  );

  const rhythm = FREQUENCIES.find((entry) => entry.value === frequency);
  const start = new Date(startAt);

  const set = (key: keyof ContactInput) => (value: string) =>
    onContactChange({ ...contact, [key]: value });

  return (
    <form
      className="space-y-6"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
    >
      <p className="text-sm text-muted-foreground">
        Dernière étape : vérifions ensemble. Nous recalculons le trajet sur
        votre adresse exacte avant de proposer la mission.
      </p>

      <dl className="rounded-xl border border-border bg-card px-5 py-1">
        <RecapLine
          label="Rendez-vous"
          value={`${dayFormatter.format(start)} à ${hourLabel(start)}`}
          onEdit={() => onEdit("creneau")}
          editLabel="Modifier le créneau"
        />
        {/* L'adresse se modifie comme les autres lignes, en revenant à son
            écran : c'est le premier, et il porte déjà la complétion, les
            adresses enregistrées et la saisie manuelle. La rouvrir ici en
            aurait fait une seconde recherche d'adresse à maintenir. */}
        <RecapLine
          label="Adresse"
          value={address.label}
          onEdit={() => onEdit("adresse")}
          editLabel="Modifier l'adresse"
        />
        {/* La durée affichée est celle du devis, pas celle qu'on recalculerait
            depuis la surface : c'est la première qui sera facturée. */}
        <RecapLine
          label="Durée"
          value={`${formatDuration(quote.durationMinutes)} · idéal pour ${suggestedSurfaceFor(
            quote.durationMinutes,
            DURATION_SERVICE,
          )} m²`}
          onEdit={() => onEdit("logement")}
          editLabel="Modifier la durée"
        />
        <RecapLine
          label="Rythme"
          value={`${rhythm?.label} · ${formatDuration(quote.durationMinutes)} sur place`}
          onEdit={() => onEdit("rythme")}
          editLabel="Modifier le rythme"
        />
        <RecapLine
          label="Vous"
          value={`${contact.firstName} ${contact.lastName} · ${formatFrenchPhone(contact.phone)} · ${contact.email}`}
          onEdit={() => onEdit("coordonnees")}
          editLabel="Modifier mes coordonnées"
        />
      </dl>

      {/* Repliées : ces deux précisions sont utiles, mais les imposer dans le
          flux principal allongeait l'écran le plus décisif du parcours. */}
      {details ? (
        <div className="space-y-5 rounded-xl border border-border bg-card p-5">
          <div>
            <Label htmlFor="accessNotes">Comment entrer chez vous ?</Label>
            <p className="mt-1 text-sm text-muted-foreground">
              Étage, digicode, où sont les clés, présence d&apos;un animal.
            </p>
            <Textarea
              id="accessNotes"
              rows={3}
              value={contact.accessNotes}
              onChange={(event) => set("accessNotes")(event.target.value)}
              className="mt-2"
            />
          </div>
          <div>
            <Label htmlFor="clientNotes">Priorités pour la première fois</Label>
            <Textarea
              id="clientNotes"
              rows={3}
              value={contact.clientNotes}
              onChange={(event) => set("clientNotes")(event.target.value)}
              className="mt-2"
            />
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setDetails(true)}
          className="flex min-h-11 items-center gap-1.5 text-sm text-muted-foreground underline"
        >
          <ChevronDownIcon className="size-4" aria-hidden />
          Ajouter l&apos;accès au logement et vos priorités
        </button>
      )}

      {/* Ce que la demande devient : la diffusion par lots, dite avant le
          geste qui engage — personne ne doit découvrir après coup que le
          rendez-vous dépend d'une acceptation. */}
      <div className="rounded-xl bg-cream-50 p-5">
        <p className="font-extrabold">Ce que nous faisons de votre demande</p>
        <p className="mt-1.5 text-sm text-pretty text-muted-foreground">
          Elle part chez les cinq intervenants qui habitent le plus près de chez
          vous. Le premier qui accepte l&apos;emporte, et vous êtes prévenu sous
          24 h. Sans acceptation, la recherche s&apos;élargit puis s&apos;arrête
          au bout d&apos;une semaine — et nous vous écrivons.
        </p>
      </div>

      <ul className="space-y-2 text-sm text-muted-foreground">
        <li className="flex items-baseline gap-2">
          <CheckIcon
            className="size-4 shrink-0 translate-y-0.5 text-brand"
            aria-hidden
          />
          Rien à payer aujourd&apos;hui : vous réglez après la prestation.
        </li>
        <li className="flex items-baseline gap-2">
          <CheckIcon
            className="size-4 shrink-0 translate-y-0.5 text-brand"
            aria-hidden
          />
          Annulation gratuite jusqu&apos;à {FREE_CANCELLATION_HOURS} heures
          avant.
        </li>
        <li className="flex items-baseline gap-2">
          <CheckIcon
            className="size-4 shrink-0 translate-y-0.5 text-brand"
            aria-hidden
          />
          Intervenant vérifié : SIRET, assurance et identité contrôlés.
        </li>
      </ul>

      {/* Le bouton reste actionnable : un bouton grisé sans explication est
          une impasse. Les champs manquants sont signalés par le navigateur,
          à l'endroit exact où ils manquent. */}
      <Button
        type="submit"
        size="lg"
        className="min-h-12 w-full"
        disabled={submitting}
      >
        {submitting ? (
          <>
            <Loader2Icon className="animate-spin" aria-hidden />
            Nous réservons votre créneau…
          </>
        ) : (
          `Réserver ${dayFormatter.format(start)} à ${hourLabel(start)}`
        )}
      </Button>
    </form>
  );
}

/* -------------------------------------------------------------------------- */
/* Étape 5 — Coordonnées                                                      */
/* -------------------------------------------------------------------------- */

/**
 * Les coordonnées, une fois le prix connu et le créneau retenu.
 *
 * Elles arrivent au cinquième écran et non au premier : quelqu'un qui a vu son
 * prix, choisi son jour et son heure a déjà décidé. Les lui demander avant
 * revient à faire payer l'information la plus chère du parcours pour un
 * service qu'on n'a pas encore chiffré.
 *
 * Un compte se crée avec ces valeurs, sans mot de passe : c'est ce qui permet
 * de ne pas mettre d'écran d'inscription sur le chemin.
 */
function ContactStep({
  contact,
  onContactChange,
  onContinue,
  known,
}: {
  contact: ContactInput;
  onContactChange: (contact: ContactInput) => void;
  onContinue: () => void;
  /** Le visiteur est connecté et a déjà réservé : ses coordonnées sont là. */
  known: boolean;
}) {
  const set = (key: keyof ContactInput) => (value: string) =>
    onContactChange({ ...contact, [key]: value });

  return (
    <form
      className="space-y-5"
      onSubmit={(event) => {
        event.preventDefault();
        /*
         * Le garde de sortie : `required` ne vérifie que la présence, et un
         * numéro à neuf chiffres la satisfait. `PhoneField` affiche déjà
         * l'erreur ; ce qu'on empêche ici est de partir sur une réservation
         * qu'on ne pourra pas confirmer par téléphone.
         */
        if (diagnosticPhone(contact.phone) !== null) return;
        onContinue();
      }}
    >
      <p className="text-sm text-muted-foreground">
        {known
          ? "Ces coordonnées sont celles de votre compte. Corrigez-les si besoin."
          : "Votre compte se crée à la réservation. Rien à retenir : la connexion se fait par un lien envoyé par email."}
      </p>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="firstName">Prénom</Label>
          <Input
            id="firstName"
            required
            autoComplete="given-name"
            value={contact.firstName}
            onChange={(event) => set("firstName")(event.target.value)}
            className={`mt-2 ${CHAMP_DOUX_SHADCN}`}
          />
        </div>
        <div>
          <Label htmlFor="lastName">Nom</Label>
          <Input
            id="lastName"
            required
            autoComplete="family-name"
            value={contact.lastName}
            onChange={(event) => set("lastName")(event.target.value)}
            className={`mt-2 ${CHAMP_DOUX_SHADCN}`}
          />
        </div>
        <div>
          <Label htmlFor="phone">Téléphone</Label>
          <PhoneField
            id="phone"
            required
            placeholder="06 12 34 56 78"
            value={contact.phone}
            onValueChange={set("phone")}
            className={`mt-2 ${CHAMP_DOUX_SHADCN}`}
          />
        </div>
        <div>
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            required
            autoComplete="email"
            inputMode="email"
            value={contact.email}
            onChange={(event) => set("email")(event.target.value)}
            className={`mt-2 ${CHAMP_DOUX_SHADCN}`}
          />
        </div>
      </div>

      {/* Le bouton annonce l'écran suivant plutôt que « Continuer ». */}
      <Button type="submit" size="lg" className="min-h-12 w-full">
        Voir mon récapitulatif
      </Button>
      <Reassurance />
    </form>
  );
}

/* -------------------------------------------------------------------------- */
/* Confirmation                                                               */
/* -------------------------------------------------------------------------- */

/**
 * L'intervenant, montré plutôt qu'annoncé.
 *
 * « Le même intervenant, chaque semaine » est la promesse centrale du service,
 * et elle n'était incarnée nulle part : on repartait avec une heure et un
 * prix. Un prénom, une commune et une ancienneté suffisent à en faire
 * quelqu'un — ce qui compte quand on fait entrer une personne chez soi.
 *
 * Faute de photo, les initiales dans une pastille du système. La note n'est
 * affichée que s'il existe des avis réels : « 0 sur 5 » serait faux et injuste
 * pour quelqu'un qui vient d'arriver.
 */
function IntervenantCard({ cleaner }: { cleaner: CleanerCardView | null }) {
  if (!cleaner) {
    return (
      <div className="rounded-xl border border-border bg-card p-5 text-left">
        {/*
         * **« Le créneau est bloqué » était faux, et c'était le pire des
         * deux.** Une proposition ne réserve rien — ni en base, ni dans le
         * moteur — précisément pour qu'un intervenant puisse recevoir deux
         * offres et choisir. Promettre un créneau tenu, c'est promettre ce
         * qu'aucune ligne du produit ne tient.
         *
         * On dit donc le mécanisme réel : la mission part aux plus proches de
         * chez vous, le premier qui accepte l'emporte, et si personne n'est
         * libre à cette heure-là c'est vous qui tranchez l'heure suivante.
         * C'est exactement ce que font `diffusion.ts` et `SlotProposal`.
         */}
        <p className="font-medium">
          Maintenant, on vous trouve quelqu&apos;un.
        </p>
        <p className="mt-1.5 text-sm text-pretty text-muted-foreground">
          Votre mission part aux intervenants les plus proches de chez vous. Le
          premier qui l&apos;accepte la prend, et vous recevez son prénom — sous
          24 heures.
        </p>
        <p className="mt-2 text-sm text-pretty text-muted-foreground">
          Si personne n&apos;est libre à cette heure-là, on vous propose une
          autre heure. Rien ne bouge sans votre accord.
        </p>
      </div>
    );
  }

  const seniority =
    cleaner.seniorityMonths >= 12
      ? `${Math.floor(cleaner.seniorityMonths / 12)} an${
          cleaner.seniorityMonths >= 24 ? "s" : ""
        } avec nous`
      : cleaner.seniorityMonths >= 1
        ? `${cleaner.seniorityMonths} mois avec nous`
        : "Vient de nous rejoindre";

  return (
    <div className="flex items-center gap-4 rounded-xl border border-border bg-card p-5 text-left">
      <span
        aria-hidden
        className="flex size-14 shrink-0 items-center justify-center rounded-full bg-teal-100 text-lg font-black text-teal-800"
      >
        {cleaner.firstName.slice(0, 2).toUpperCase()}
      </span>
      <div className="min-w-0">
        <p className="text-xs tracking-overline text-muted-foreground uppercase">
          Vous serez suivi par
        </p>
        <p className="mt-0.5 font-extrabold">{cleaner.firstName}</p>
        <p className="text-sm text-pretty text-muted-foreground">
          {cleaner.communeName ? `Habite ${cleaner.communeName} · ` : ""}
          {seniority}
          {cleaner.ratingAverage !== null
            ? ` · ${cleaner.ratingAverage.toFixed(1)}/5 sur ${cleaner.ratingCount} avis`
            : ""}
        </p>
      </div>
    </div>
  );
}

/**
 * Bouton d'ajout au calendrier.
 *
 * Le fichier vient du serveur, jamais du navigateur : c'est la même règle que
 * pour le prix — ce qui engage se compose là où la réservation est écrite. Le
 * navigateur n'a plus qu'à le présenter au téléchargement.
 *
 * Un rendez-vous absent de l'agenda est un rendez-vous oublié, et une absence
 * coûte 100 % du prix au titre du barème des CGU : ce bouton est autant de la
 * prévention d'annulation qu'un confort.
 */
function AddToCalendar({ confirmation }: { confirmation: ConfirmationView }) {
  /*
   * Le fichier voyage dans un `data:` plutôt que dans un `blob:`.
   *
   * Un lien restant un lien : il se garde en favori, s'ouvre dans un nouvel
   * onglet, s'appuie longuement sur mobile. Une URL d'objet aurait exigé de la
   * créer dans un effet et de la révoquer au démontage — un cycle de vie à
   * tenir pour un fichier d'un kilo-octet.
   */
  const href = `data:text/calendar;charset=utf-8,${encodeURIComponent(
    confirmation.calendar,
  )}`;

  return (
    <a
      href={href}
      download={bookingCalendarFilename(new Date(confirmation.startAt))}
      className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full border-2 border-border bg-card px-6 font-bold shadow-xs transition-colors duration-200 ease-brand hover:border-teal-300 hover:bg-teal-50"
    >
      <CalendarPlusIcon className="size-4" aria-hidden />
      Ajouter à mon calendrier
    </a>
  );
}

function Confirmed({ confirmation }: { confirmation: ConfirmationView }) {
  const start = new Date(confirmation.startAt);

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-teal-200 bg-teal-50 p-8 text-center">
        <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-primary text-primary-foreground">
          <CheckIcon className="size-6" aria-hidden />
        </span>
        {/*
         * **« C'est réservé » promettait ce que le produit ne fait pas.**
         * Depuis la diffusion par lots, sortir du tunnel crée une demande
         * proposée à cinq intervenants : aucun n'a accepté, et la formule
         * laissait croire que quelqu'un viendrait. Le titre dit donc ce qui
         * vient d'être fait — la demande est prise — et ce qui commence :
         * la recherche.
         */}
        <h2 className="mt-5 text-2xl font-black">C&apos;est noté.</h2>
        <p className="mx-auto mt-3 max-w-prose text-muted-foreground">
          Votre demande est enregistrée pour le{" "}
          <strong className="text-foreground">
            {dayFormatter.format(start)} à {hourLabel(start)}
          </strong>{" "}
          au {confirmation.addressLabel}, pour{" "}
          {formatEuros(confirmation.grossAmountCents)}.
        </p>

        {/* L'heure retenue n'est pas celle qu'on venait de choisir : le dire
            ici est la seule occasion de le faire lire. Découverte le jour
            venu, la différence vaudrait un rendez-vous manqué — et la
            réservation reste ferme, sur une heure que le client avait
            lui-même déclarée acceptable. */}
        {confirmation.usedAlternate ? (
          <p className="mx-auto mt-4 max-w-prose rounded-lg bg-pineapple-100 px-4 py-3 text-sm">
            Votre créneau préféré n&apos;était plus tenable pendant que vous
            remplissiez le formulaire. Nous avons retenu l&apos;un de ceux que
            vous aviez acceptés — c&apos;est bien l&apos;heure ci-dessus que
            nous cherchons à pourvoir.
          </p>
        ) : null}
      </div>

      {/* L'espace client s'ouvre par un lien, pas par une session ouverte
          d'office : réserver ne prouve pas qu'on possède l'adresse saisie, et
          une session accordée sur parole laisserait entrer chez quelqu'un
          d'autre. Le lien est parti seul, il n'y a rien à demander. */}
      {confirmation.accessLinkSent ? (
        <div className="rounded-xl border border-border bg-card p-5">
          <h3 className="font-extrabold">Votre espace est prêt</h3>
          <p className="mt-1.5 text-sm text-pretty text-muted-foreground">
            Un lien de connexion vient de partir vers{" "}
            <strong className="text-foreground">
              {confirmation.accessLinkEmail}
            </strong>
            . Vous y retrouverez cette intervention, pourrez écrire à votre
            intervenant, enregistrer votre carte et annuler si besoin.
          </p>
          {/* La carte n'est pas exigée ici, et c'est délibéré : la
              préautorisation part vingt-quatre heures avant la mission, pas à
              la réservation. Demander une carte pour obtenir une date est le
              meilleur moyen de perdre quelqu'un qui n'a pas encore essayé le
              service — et le tunnel a déjà atteint sa cible de gestes. */}
          <Link
            href="/mon-espace"
            className="mt-4 inline-flex min-h-11 items-center rounded-full border-2 border-border bg-card px-5 text-sm font-bold transition-colors hover:border-teal-300 hover:bg-teal-50"
          >
            Ouvrir mon espace
          </Link>
        </div>
      ) : null}

      <IntervenantCard cleaner={confirmation.cleaner} />

      <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
        <AddToCalendar confirmation={confirmation} />
        <a
          href={`tel:${SITE.phoneE164}`}
          className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full border-2 border-border bg-card px-6 font-bold shadow-xs transition-colors duration-200 ease-brand hover:border-teal-300 hover:bg-teal-50"
        >
          Appeler le {SITE.phone}
        </a>
      </div>

      {/* C'est ici, et nulle part avant : proposer d'installer une
          application à quelqu'un qui vient d'arriver revient à demander un
          engagement avant d'avoir rendu le moindre service. */}
      <InstallPrompt />

      <p className="text-center text-sm text-muted-foreground">
        {/* L'email qui part est « demande reçue », pas une confirmation :
            `messages.ts` s'interdit de confirmer avant qu'un intervenant ait
            accepté, et cette ligne était le dernier endroit du parcours à
            promettre le contraire. */}
        Un récapitulatif part maintenant par email. Pour modifier ou annuler,
        répondez-y ou appelez-nous — c&apos;est gratuit jusqu&apos;à{" "}
        {FREE_CANCELLATION_HOURS} heures avant.
      </p>
    </div>
  );
}
