"use client";

import {
  ArrowLeftIcon,
  CheckIcon,
  ChevronDownIcon,
  Loader2Icon,
  MapPinIcon,
  PencilIcon,
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

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type {
  AddressChoice,
  BookingBackend,
  Frequency,
  QuoteView,
  SlotView,
} from "@/lib/booking/backend";
import { BOOKING_HORIZON_DAYS } from "@/lib/booking/horizon";
import { formatDuration, formatEuros, formatHourlyRate } from "@/lib/pricing";
import { CANCELLATION_TIERS } from "@/lib/pricing/cancellation";
import {
  MINIMUM_BILLABLE_MINUTES,
  PUBLIC_RATES,
} from "@/lib/pricing/public-grid";
import { SITE } from "@/lib/site";

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
 * - **Le prix est visible en permanence**, dans une barre basse qui ne quitte
 *   jamais l'écran. C'est la première source d'inquiétude ; la laisser sans
 *   réponse à l'étape du créneau revenait à demander de choisir un jour sans
 *   savoir ce qu'il coûte.
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
  {
    value: "MONTHLY",
    label: "Une fois par mois",
    hint: "Entretien de fond, tarif régulier",
  },
  {
    value: "ONE_OFF",
    label: "Une seule fois",
    hint: "Sans engagement, tarif ponctuel",
  },
];

/**
 * Types de logement proposés au choix.
 *
 * Personne ne connaît sa surface au mètre près, et la demander au clavier
 * numérique obligeait à effacer une valeur par défaut avant d'en saisir une
 * autre. Ces quatre repères sont ceux de la page tarifs, que les gens
 * reconnaissent. La surface exacte reste accessible, repliée.
 */
const HOUSING_PRESETS: {
  label: string;
  hint: string;
  surfaceSqm: number;
}[] = [
  { label: "Studio ou T2", hint: "Environ 40 m²", surfaceSqm: 40 },
  { label: "T3 ou petite maison", hint: "Environ 70 m²", surfaceSqm: 70 },
  { label: "Maison familiale", hint: "Environ 100 m²", surfaceSqm: 100 },
  { label: "Grande maison", hint: "Environ 140 m²", surfaceSqm: 140 },
];

const STEPS = [
  "adresse",
  "logement",
  "rythme",
  "creneau",
  "recapitulatif",
] as const;

type Step = (typeof STEPS)[number];

/** Titre lu par la personne, et repère de progression. */
const STEP_TITLES: Record<Step, string> = {
  adresse: "Où intervenons-nous ?",
  logement: "Quelle est la taille de votre logement ?",
  rythme: "À quel rythme souhaitez-vous nous voir ?",
  creneau: "Quand voulez-vous que nous venions ?",
  recapitulatif: "Voilà ce qu'on a prévu",
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
const STORAGE_KEY = "leoclean.reservation.v1";
/** Au-delà, la reprise n'a plus de sens : le créneau visé est passé. */
const RESUME_MAX_AGE_MS = 24 * 3_600_000;

/**
 * Le stockage local est une frontière comme une autre : son contenu est
 * modifiable à la main et peut venir d'une version antérieure de l'écran. Il
 * est donc validé, jamais typé par assertion.
 */
const savedStateSchema = z.object({
  savedAt: z.number(),
  step: z.enum(STEPS),
  address: z.object({
    banId: z.string(),
    label: z.string(),
    street: z.string(),
    postalCode: z.string(),
    cityName: z.string(),
    inseeCode: z.string().regex(/^\d{5}$/),
    lat: z.number(),
    lng: z.number(),
    isCovered: z.boolean(),
    isPreciseToHouseNumber: z.boolean(),
  }),
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

    return slotIsPast ? { ...saved, step: "creneau", chosenSlot: null } : saved;
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
}) {
  const [step, setStep] = useState<Step>("adresse");
  /** Renseigné quand une modification part du récapitulatif : on y revient. */
  const [returnToRecap, setReturnToRecap] = useState(false);

  const [address, setAddress] = useState<AddressChoice | null>(null);
  const [surfaceSqm, setSurfaceSqm] = useState<number | null>(null);
  const [housingLabel, setHousingLabel] = useState<string | null>(null);
  const [frequency, setFrequency] = useState<Frequency>("BIWEEKLY");
  const [contact, setContact] = useState<ContactInput>(EMPTY_CONTACT);

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
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<{
    message: string;
    retry?: () => void;
  } | null>(null);
  const [confirmation, setConfirmation] = useState<{
    startAt: string;
    grossAmountCents: number;
  } | null>(null);

  const stored = useSyncExternalStore(
    subscribeToSavedState,
    savedSnapshot,
    () => null,
  );
  const [resumeHandled, setResumeHandled] = useState(false);
  const resumable = resumeHandled ? null : stored;

  const quote = quotes[frequency] ?? null;
  /**
   * Commune d'où l'on vient, quand le tunnel est ouvert depuis une page
   * locale. Elle ne préremplit pas la recherche — on taperait alors le nom de
   * la ville avant le numéro de rue, ce que personne ne fait — mais elle
   * présélectionne la saisie manuelle et donne l'exemple du champ.
   */
  const originCommune =
    communes.find((commune) => commune.slug === defaultCommuneSlug) ?? null;

  /* --- Persistance ------------------------------------------------------ */

  useEffect(() => {
    if (!address || confirmation) return;
    try {
      const state: SavedState = {
        savedAt: Date.now(),
        step,
        address,
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
    address,
    step,
    surfaceSqm,
    housingLabel,
    frequency,
    chosenSlot,
    confirmation,
  ]);

  /* --- Devis ------------------------------------------------------------ */

  /**
   * Demande les quatre devis d'un coup, un par fréquence.
   *
   * Les quatre sont chargés ensemble parce que l'écran suivant montre le prix
   * de chaque rythme : sans cela, il faudrait choisir sans savoir ce que le
   * choix coûte, ou attendre un aller-retour à chaque changement d'avis.
   */
  const loadQuotes = useCallback(
    async (surface: number) => {
      setQuotesPending(true);
      const results = await Promise.all(
        FREQUENCIES.map(async (entry) => ({
          frequency: entry.value,
          result: await backend.getQuote({
            surfaceSqm: surface,
            frequency: entry.value,
            optionSlugs: [],
          }),
        })),
      );

      const failure = results.find((entry) => !entry.result.ok);
      if (failure && !failure.result.ok) {
        setQuotesPending(false);
        setError({
          message: failure.result.error,
          retry: () => void loadQuotes(surface),
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

  /* --- Créneaux --------------------------------------------------------- */

  const loadSlots = useCallback(
    async (
      target: AddressChoice,
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
    if (!address || !quote) return;
    const key = `${address.lat},${address.lng},${quote.durationMinutes}`;
    if (key === attemptedSlotsKey.current) return;
    void loadSlots(address, quote.durationMinutes, key);
  }, [address, quote, loadSlots]);

  /* --- Navigation ------------------------------------------------------- */

  const index = STEPS.indexOf(step);

  function goTo(next: Step) {
    setError(null);
    setStep(next);
  }

  /** Avance d'un écran, ou revient au récapitulatif si l'on en venait. */
  function advance(from: Step) {
    setError(null);
    if (returnToRecap) {
      setReturnToRecap(false);
      setStep("recapitulatif");
      return;
    }
    setStep(STEPS[STEPS.indexOf(from) + 1] ?? "recapitulatif");
  }

  function editFromRecap(target: Step) {
    setReturnToRecap(true);
    goTo(target);
  }

  function goBack() {
    setError(null);
    if (returnToRecap) {
      setReturnToRecap(false);
      setStep("recapitulatif");
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

  function chooseAddress(choice: AddressChoice) {
    setAddress(choice);
    // Une autre adresse change les intervenants joignables et les temps de
    // trajet : les créneaux calculés pour la précédente sont faux.
    invalidateSlots();
    advance("adresse");
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
    advance("creneau");
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
      });
      setSubmitting(false);

      if (result.ok) {
        clearSavedState();
        setConfirmation({
          startAt: result.data.startAt,
          grossAmountCents: result.data.grossAmountCents,
        });
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
    return <Confirmed confirmation={confirmation} address={address} />;
  }

  /* --- Rendu ------------------------------------------------------------ */

  return (
    /* Le conteneur occupe au moins la hauteur de l'écran : sans cela, la barre
       de prix — collante au bas de son parent — se posait au milieu de la page
       sur les étapes courtes au lieu de rester sous le pouce. */
    <div className="flex min-h-[calc(100svh-8rem)] flex-col">
      <FunnelHeader
        index={index}
        title={STEP_TITLES[step]}
        onBack={index > 0 || returnToRecap ? goBack : undefined}
      />

      <div className="mt-6 flex-1 space-y-5 pb-4">
        {resumable && step === "adresse" && !address ? (
          <ResumePrompt
            saved={resumable}
            onResume={() => {
              setAddress(resumable.address);
              setSurfaceSqm(resumable.surfaceSqm);
              setHousingLabel(resumable.housingLabel);
              setFrequency(resumable.frequency);
              setChosenSlot(resumable.chosenSlot);
              if (resumable.surfaceSqm !== null) {
                void loadQuotes(resumable.surfaceSqm);
              }
              setResumeHandled(true);
              goTo(resumable.step);
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
            originCommune={originCommune}
            selected={address}
            onSelect={chooseAddress}
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
            réessai : un squelette perpétuel par-dessus ne dirait rien. */}
        {step === "creneau" && slotsStatus !== "error" ? (
          <SlotStep
            slots={slots}
            fetchedAt={slotsFetchedAt}
            pending={slotsStatus !== "ready"}
            chosen={chosenSlot}
            onChoose={chooseSlot}
          />
        ) : null}

        {/* Après une reprise, le récapitulatif s'affiche avant que les devis
            soient revenus : on montre la forme du contenu attendu plutôt
            qu'un écran vide. */}
        {step === "recapitulatif" && (!quote || !address || !chosenSlot) ? (
          <div className="space-y-3" aria-hidden>
            <div className="h-48 animate-pulse rounded-2xl bg-secondary" />
            <div className="h-32 animate-pulse rounded-2xl bg-secondary" />
          </div>
        ) : null}

        {step === "recapitulatif" && address && quote && chosenSlot ? (
          <RecapStep
            address={address}
            quote={quote}
            frequency={frequency}
            housingLabel={housingLabel}
            surfaceSqm={surfaceSqm}
            startAt={chosenSlot}
            contact={contact}
            onContactChange={setContact}
            onEdit={editFromRecap}
            onSubmit={submit}
            submitting={submitting}
          />
        ) : null}
      </div>

      <PriceBar quote={quote} pending={quotesPending} frequency={frequency} />
    </div>
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
      <div className="flex items-center gap-3">
        {onBack ? (
          <button
            type="button"
            onClick={onBack}
            aria-label="Revenir à l'écran précédent"
            className="-ml-2 flex size-11 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          >
            <ArrowLeftIcon className="size-5" aria-hidden />
          </button>
        ) : null}
        <p className="text-xs tracking-overline text-muted-foreground uppercase">
          Étape {index + 1} sur {STEPS.length}
        </p>
      </div>

      <div
        className="mt-3 flex gap-1.5"
        role="progressbar"
        aria-valuenow={index + 1}
        aria-valuemin={1}
        aria-valuemax={STEPS.length}
        aria-label={`Étape ${index + 1} sur ${STEPS.length}`}
      >
        {STEPS.map((entry, position) => (
          <span
            key={entry}
            className={`h-1.5 flex-1 rounded-full ${
              position <= index ? "bg-primary" : "bg-secondary"
            }`}
          />
        ))}
      </div>

      <h2 className="mt-5 font-heading text-2xl font-semibold tracking-tight text-balance">
        {title}
      </h2>
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
}: {
  quote: QuoteView | null;
  pending: boolean;
  frequency: Frequency;
}) {
  const rhythm = FREQUENCIES.find((entry) => entry.value === frequency);

  return (
    <div className="sticky bottom-0 z-20 -mx-6 mt-2 border-t border-border bg-background/95 px-6 py-3 backdrop-blur">
      {quote ? (
        <div>
          <div className="flex items-baseline justify-between gap-3">
            <p className="font-heading text-2xl font-semibold tabular-nums">
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
            <p className="font-heading text-xl font-semibold">
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
  onResume,
  onDiscard,
}: {
  saved: SavedState;
  onResume: () => void;
  onDiscard: () => void;
}) {
  const when = saved.chosenSlot
    ? ` pour ${dayFormatter.format(new Date(saved.chosenSlot))}`
    : "";

  return (
    <div className="rounded-2xl border border-primary/30 bg-primary/5 p-5">
      <p className="font-medium">
        Vous réserviez un ménage à {saved.address.cityName}
        {when}.
      </p>
      <p className="mt-1 text-sm text-muted-foreground">
        Nous avons gardé vos choix, sans vos coordonnées.
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

/** Une erreur dit ce qui s'est passé et propose d'en sortir. */
function ErrorNotice({
  error,
}: {
  error: { message: string; retry?: () => void };
}) {
  return (
    <div
      role="alert"
      className="rounded-2xl border border-destructive/40 bg-destructive/5 p-5"
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
          className="text-sm font-medium text-primary underline"
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

/** Carte de choix : remplie quand elle est retenue, jamais seulement bordée. */
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
      className={`flex min-h-16 w-full items-center justify-between gap-4 rounded-2xl border p-4 text-left transition-[background-color,border-color,color,transform] duration-150 active:scale-[0.98] disabled:opacity-50 motion-reduce:active:scale-100 ${
        selected
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border bg-card hover:border-primary enabled:active:bg-secondary"
      } ${className}`}
    >
      <span>
        <span className="block font-medium">{title}</span>
        {hint ? (
          <span
            className={`mt-0.5 block text-sm ${
              selected ? "text-primary-foreground/80" : "text-muted-foreground"
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

function AddressStep({
  backend,
  communes,
  defaultQuery,
  originCommune,
  selected,
  onSelect,
}: {
  backend: BookingBackend;
  communes: readonly CommuneOption[];
  defaultQuery: string;
  originCommune: CommuneOption | null;
  selected: AddressChoice | null;
  onSelect: (choice: AddressChoice) => void;
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
    <div className="space-y-4">
      <div>
        <Label htmlFor="address">Votre adresse</Label>
        <p className="mt-1 text-sm text-muted-foreground">
          Commencez à taper, nous la complétons. Elle nous sert à trouver
          l&apos;intervenant le plus proche de chez vous.
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
            className="min-h-12 pl-9"
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
        <p className="rounded-2xl border border-border bg-secondary/40 p-4 text-sm">
          Léo Clean intervient dans seize communes au sud de Bordeaux. Cette
          adresse n&apos;en fait pas partie —{" "}
          <Link href="/menage-a-domicile" className="text-primary underline">
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
              className="h-16 animate-pulse rounded-2xl bg-secondary"
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
                  className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium ${
                    address.isCovered
                      ? "bg-secondary text-secondary-foreground"
                      : "border border-border text-muted-foreground"
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
            className="font-medium text-primary underline"
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
          className="mt-2 min-h-12"
        />
      </div>

      <div>
        <Label htmlFor="manual-commune">Commune</Label>
        <select
          id="manual-commune"
          value={communeSlug}
          onChange={(event) => setCommuneSlug(event.target.value)}
          className="mt-2 min-h-12 w-full rounded-xl border border-input bg-card px-3 text-base"
        >
          {communes.map((entry) => (
            <option key={entry.slug} value={entry.slug}>
              {entry.name} ({entry.postalCode})
            </option>
          ))}
        </select>
        <p className="mt-2 text-sm text-muted-foreground">
          Seules les communes desservies figurent dans cette liste.
        </p>
      </div>

      <div className="flex flex-col gap-3">
        <Button
          type="submit"
          size="lg"
          className="min-h-12 w-full"
          disabled={street.trim().length < 3}
        >
          Décrire mon logement
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
  const matchesPreset = HOUSING_PRESETS.some(
    (preset) => preset.surfaceSqm === surfaceSqm,
  );
  const [custom, setCustom] = useState(surfaceSqm !== null && !matchesPreset);
  const [value, setValue] = useState(String(surfaceSqm ?? 80));

  const parsed = Number(value);
  const valid = Number.isInteger(parsed) && parsed >= 15 && parsed <= 400;

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Nous en déduisons la durée sur place. Elle reste ajustable ensuite —
        nous comptons 25 m² traités par heure.
      </p>

      <div className="grid gap-3">
        {HOUSING_PRESETS.map((preset) => (
          <ChoiceCard
            key={preset.label}
            selected={surfaceSqm === preset.surfaceSqm}
            onClick={() => onChoose(preset.surfaceSqm, preset.label)}
            title={preset.label}
            hint={preset.hint}
          />
        ))}
      </div>

      {/* Repliée par défaut : la surface au mètre près est une précision
          d'appoint, pas le chemin principal. */}
      {custom ? (
        <div className="rounded-2xl border border-border bg-card p-4">
          <Label htmlFor="surface">Surface exacte</Label>
          <div className="mt-3 flex items-center gap-3">
            <Input
              id="surface"
              type="number"
              inputMode="numeric"
              min={15}
              max={400}
              step={5}
              value={value}
              onChange={(event) => setValue(event.target.value)}
              className="min-h-12 w-28"
            />
            <span className="text-muted-foreground">m²</span>
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            La surface habitable, hors garage et cave.
          </p>
          <Button
            type="button"
            size="lg"
            className="mt-4 min-h-12 w-full"
            disabled={!valid}
            onClick={() => onChoose(parsed, null)}
          >
            Choisir mon rythme
          </Button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setCustom(true)}
          className="flex items-center gap-1.5 text-sm text-muted-foreground underline"
        >
          <ChevronDownIcon className="size-4" aria-hidden />
          Je connais ma surface exacte
        </button>
      )}
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
                    <span className="block font-heading text-lg font-semibold tabular-nums">
                      {formatEuros(quote.grossAmountCents)}
                    </span>
                    <span
                      className={`block text-xs ${
                        selected === option.value
                          ? "text-primary-foreground/80"
                          : "text-muted-foreground"
                      }`}
                    >
                      {formatHourlyRate(quote.hourlyRateCents)}
                    </span>
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
        En formule régulière, nous calons les passages suivants avec vous après
        le premier ménage, et nous cherchons à vous envoyer la même personne à
        chaque fois. Vous ne vous engagez sur rien aujourd&apos;hui.
      </p>
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
  onChoose,
}: {
  slots: SlotView[];
  fetchedAt: number | null;
  pending: boolean;
  chosen: string | null;
  onChoose: (start: string) => void;
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
              className="h-18 w-18 shrink-0 animate-pulse rounded-2xl bg-secondary"
            />
          ))}
        </div>
        <div className="grid grid-cols-3 gap-2" aria-hidden>
          {[0, 1, 2, 3, 4, 5].map((cell) => (
            <div
              key={cell}
              className="h-12 animate-pulse rounded-xl bg-secondary"
            />
          ))}
        </div>
      </div>
    );
  }

  if (slots.length === 0) {
    return (
      <div className="rounded-2xl border border-border bg-secondary/40 p-5">
        <p className="font-medium">
          Aucun créneau sur les trois prochaines semaines.
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          Cela arrive dans les communes les plus éloignées. Appelez-nous : nous
          trouvons souvent une solution qui n&apos;apparaît pas ici.
        </p>
        <a
          href={`tel:${SITE.phoneE164}`}
          className="mt-4 inline-flex min-h-12 items-center rounded-xl bg-primary px-5 font-medium text-primary-foreground"
        >
          Appeler le {SITE.phone}
        </a>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Les journées complètes restent visibles, barrées : ce que le planning
          ne peut pas offrir se lit, au lieu de disparaître. */}
      <div className="-mx-6 overflow-x-auto px-6">
        <ul className="flex gap-2 pb-1">
          {days.map((day) => {
            const open = day.slots.length > 0;
            const isActive = active?.key === day.key;
            return (
              <li key={day.key}>
                <button
                  type="button"
                  disabled={!open}
                  onClick={() => setActiveKey(day.key)}
                  aria-pressed={isActive}
                  className={`flex min-h-18 w-18 flex-col items-center justify-center rounded-2xl border px-2 py-2 text-center transition-colors ${
                    isActive
                      ? "border-primary bg-primary text-primary-foreground"
                      : open
                        ? "border-border bg-card hover:border-primary"
                        : "border-border/60 bg-transparent text-muted-foreground line-through"
                  }`}
                >
                  <span className="text-xs capitalize">
                    {chipFormatter.format(day.date).split(" ")[0]}
                  </span>
                  <span className="font-heading text-lg font-semibold tabular-nums">
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
          <h3 className="font-heading font-semibold first-letter:uppercase">
            {dayFormatter.format(active.date)}
          </h3>
          {active.slots.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">
              Complet ce jour-là. Choisissez une autre date ci-dessus.
            </p>
          ) : (
            <ul className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
              {active.slots.map((slot) => (
                <li key={slot.start}>
                  <button
                    type="button"
                    onClick={() => onChoose(slot.start)}
                    className={`min-h-12 w-full rounded-xl border text-sm font-medium tabular-nums transition-[background-color,border-color,transform] duration-150 active:scale-[0.98] motion-reduce:active:scale-100 ${
                      chosen === slot.start
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-card hover:border-primary"
                    }`}
                  >
                    {timeFormatter.format(new Date(slot.start))}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}

      <p className="text-sm text-muted-foreground">
        Annulation gratuite jusqu&apos;à {FREE_CANCELLATION_HOURS} heures avant
        l&apos;intervention.
      </p>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Étape 5 — Récapitulatif et coordonnées                                     */
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
        className="flex min-h-11 shrink-0 items-center gap-1.5 rounded-lg px-2 text-sm font-medium text-primary underline"
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
  housingLabel,
  surfaceSqm,
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
  housingLabel: string | null;
  surfaceSqm: number | null;
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
      <dl className="rounded-2xl border border-border bg-card px-5 py-1">
        <RecapLine
          label="Rendez-vous"
          value={`${dayFormatter.format(start)} à ${hourLabel(start)}`}
          onEdit={() => onEdit("creneau")}
          editLabel="Modifier le créneau"
        />
        <RecapLine
          label="Adresse"
          value={address.label}
          onEdit={() => onEdit("adresse")}
          editLabel="Modifier l'adresse"
        />
        <RecapLine
          label="Logement"
          value={
            housingLabel
              ? `${housingLabel} · ${surfaceSqm} m²`
              : `${surfaceSqm} m²`
          }
          onEdit={() => onEdit("logement")}
          editLabel="Modifier la taille du logement"
        />
        <RecapLine
          label="Rythme"
          value={`${rhythm?.label} · ${formatDuration(quote.durationMinutes)} sur place`}
          onEdit={() => onEdit("rythme")}
          editLabel="Modifier le rythme"
        />
      </dl>

      <div>
        <h3 className="font-heading text-lg font-semibold">
          Comment vous joindre ?
        </h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Votre compte se crée avec ces informations — aucun mot de passe à
          choisir.
        </p>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="firstName">Prénom</Label>
            <Input
              id="firstName"
              required
              autoComplete="given-name"
              value={contact.firstName}
              onChange={(event) => set("firstName")(event.target.value)}
              className="mt-2 min-h-12"
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
              className="mt-2 min-h-12"
            />
          </div>
          <div>
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              required
              autoComplete="email"
              value={contact.email}
              onChange={(event) => set("email")(event.target.value)}
              className="mt-2 min-h-12"
            />
          </div>
          <div>
            <Label htmlFor="phone">Téléphone</Label>
            <Input
              id="phone"
              type="tel"
              required
              autoComplete="tel"
              inputMode="tel"
              placeholder="06 12 34 56 78"
              value={contact.phone}
              onChange={(event) => set("phone")(event.target.value)}
              className="mt-2 min-h-12"
            />
          </div>
        </div>
      </div>

      {/* Repliées : ces deux précisions sont utiles, mais les imposer dans le
          flux principal allongeait l'écran le plus décisif du parcours. */}
      {details ? (
        <div className="space-y-5 rounded-2xl border border-border bg-card p-5">
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
          className="flex items-center gap-1.5 text-sm text-muted-foreground underline"
        >
          <ChevronDownIcon className="size-4" aria-hidden />
          Ajouter l&apos;accès au logement et vos priorités
        </button>
      )}

      <ul className="space-y-2 text-sm text-muted-foreground">
        <li className="flex items-baseline gap-2">
          <CheckIcon
            className="size-4 shrink-0 translate-y-0.5 text-primary"
            aria-hidden
          />
          Rien à payer aujourd&apos;hui : vous réglez après la prestation.
        </li>
        <li className="flex items-baseline gap-2">
          <CheckIcon
            className="size-4 shrink-0 translate-y-0.5 text-primary"
            aria-hidden
          />
          Annulation gratuite jusqu&apos;à {FREE_CANCELLATION_HOURS} heures
          avant.
        </li>
        <li className="flex items-baseline gap-2">
          <CheckIcon
            className="size-4 shrink-0 translate-y-0.5 text-primary"
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
/* Confirmation                                                               */
/* -------------------------------------------------------------------------- */

function Confirmed({
  confirmation,
  address,
}: {
  confirmation: { startAt: string; grossAmountCents: number };
  address: AddressChoice | null;
}) {
  const start = new Date(confirmation.startAt);

  return (
    <div className="rounded-2xl border border-primary/30 bg-primary/5 p-8 text-center">
      <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-primary text-primary-foreground">
        <CheckIcon className="size-6" aria-hidden />
      </span>
      <h2 className="mt-5 font-heading text-2xl font-semibold">
        C&apos;est réservé.
      </h2>
      <p className="mx-auto mt-3 max-w-prose text-muted-foreground">
        Rendez-vous{" "}
        <strong className="text-foreground first-letter:uppercase">
          {dayFormatter.format(start)} à {hourLabel(start)}
        </strong>
        {address ? ` au ${address.label}` : ""}, pour{" "}
        {formatEuros(confirmation.grossAmountCents)}.
      </p>
      <p className="mx-auto mt-4 max-w-prose text-sm text-muted-foreground">
        Nous vous confirmons par email le nom de votre intervenant. Une question
        d&apos;ici là : {SITE.phone}.
      </p>
      <a
        href={`tel:${SITE.phoneE164}`}
        className="mt-6 inline-flex min-h-12 items-center rounded-xl border border-border bg-card px-5 font-medium"
      >
        Appeler le {SITE.phone}
      </a>
    </div>
  );
}
