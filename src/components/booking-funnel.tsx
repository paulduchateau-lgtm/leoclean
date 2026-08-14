"use client";

import { CheckIcon, Loader2Icon, MapPinIcon } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type {
  AddressChoice,
  BookingBackend,
  Frequency,
  QuoteView,
} from "@/lib/booking/backend";
import { formatDuration, formatEuros } from "@/lib/pricing";
import { MINIMUM_BILLABLE_MINUTES } from "@/lib/pricing/public-grid";
import { SITE } from "@/lib/site";

/**
 * Tunnel de réservation.
 *
 * Quatre étapes, une par décision : où, quoi, quand, qui. L'ordre n'est pas
 * indifférent — l'adresse vient en premier parce que c'est elle qui détermine
 * si Léo Clean peut répondre, et l'apprendre à la fin après avoir tout saisi
 * serait la pire expérience possible.
 *
 * Le prix apparaît dès la deuxième étape et ne bouge plus. Aucun montant n'est
 * calculé ici : chaque changement de surface ou de fréquence redemande le devis
 * au serveur, qui est le seul à savoir ce qu'il facturera. Un prix calculé dans
 * le navigateur finit toujours par diverger de celui qu'on enregistre.
 */

const FREQUENCIES: { value: Frequency; label: string; hint: string }[] = [
  {
    value: "WEEKLY",
    label: "Chaque semaine",
    hint: "Le même intervenant, le même créneau",
  },
  {
    value: "BIWEEKLY",
    label: "Tous les quinze jours",
    hint: "La formule la plus demandée",
  },
  { value: "MONTHLY", label: "Une fois par mois", hint: "Entretien de fond" },
  {
    value: "ONE_OFF",
    label: "Une seule fois",
    hint: "Sans engagement, tarif ponctuel",
  },
];

const STEPS = ["Adresse", "Logement", "Créneau", "Coordonnées"] as const;

const dayFormatter = new Intl.DateTimeFormat("fr-FR", {
  weekday: "long",
  day: "numeric",
  month: "long",
  timeZone: "Europe/Paris",
});
const timeFormatter = new Intl.DateTimeFormat("fr-FR", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Paris",
});

/** Commune desservie, telle que la page serveur la transmet. */
export interface CommuneOption {
  slug: string;
  name: string;
  postalCode: string;
  insee: string;
  lat: number;
  lng: number;
}

export function BookingFunnel({
  backend,
  communes,
  defaultQuery = "",
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
}) {
  const [step, setStep] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const [address, setAddress] = useState<AddressChoice | null>(null);
  const [surfaceSqm, setSurfaceSqm] = useState(80);
  const [frequency, setFrequency] = useState<Frequency>("BIWEEKLY");
  const [quote, setQuote] = useState<QuoteView | null>(null);
  const [slots, setSlots] = useState<{ start: string; end: string }[]>([]);
  const [chosenSlot, setChosenSlot] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<{
    bookingId: string;
    startAt: string;
    grossAmountCents: number;
  } | null>(null);

  const [pending, startTransition] = useTransition();

  function goTo(next: number) {
    setError(null);
    setStep(next);
  }

  /**
   * Demande le devis au backend.
   *
   * Aucun montant n'est calculé dans cet écran, jamais : un prix calculé au
   * fil du rendu finirait par diverger de celui qu'on enregistre, et c'est le
   * genre d'écart qu'on ne découvre qu'à la facture.
   */
  function refreshQuote(nextSurface: number, nextFrequency: Frequency) {
    setSurfaceSqm(nextSurface);
    setFrequency(nextFrequency);
    // Le devis change la durée, donc les créneaux : les garder afficherait des
    // heures calculées pour une autre mission.
    setSlots([]);
    setChosenSlot(null);

    startTransition(async () => {
      const result = await backend.getQuote({
        surfaceSqm: nextSurface,
        frequency: nextFrequency,
        optionSlugs: [],
      });
      if (result.ok) {
        setQuote(result.data);
        setError(null);
      } else {
        setError(result.error);
      }
    });
  }

  if (confirmation) {
    return <Confirmed confirmation={confirmation} address={address} />;
  }

  return (
    <div className="space-y-8">
      <Steps current={step} />

      {error ? (
        <p
          role="alert"
          className="rounded-xl border border-destructive/40 bg-destructive/5 p-4 text-sm"
        >
          {error}
        </p>
      ) : null}

      {step === 0 ? (
        <AddressStep
          backend={backend}
          communes={communes}
          defaultQuery={defaultQuery}
          selected={address}
          onSelect={(choice) => {
            setAddress(choice);
            // Le devis est demandé en même temps qu'on change d'étape : voir
            // un prix immédiatement est ce qui décide de la suite du parcours,
            // et l'attendre après un clic supplémentaire le ferait perdre.
            refreshQuote(surfaceSqm, frequency);
            goTo(1);
          }}
        />
      ) : null}

      {step === 1 ? (
        <HousingStep
          surfaceSqm={surfaceSqm}
          frequency={frequency}
          quote={quote}
          pending={pending}
          onChange={refreshQuote}
          onBack={() => goTo(0)}
          onNext={() => {
            if (!quote || !address) return;
            startTransition(async () => {
              const result = await backend.getSlots({
                lat: address.lat,
                lng: address.lng,
                inseeCode: address.inseeCode,
                durationMinutes: quote.durationMinutes,
              });
              if (result.ok) {
                setSlots(result.data);
                goTo(2);
              } else {
                setError(result.error);
              }
            });
          }}
        />
      ) : null}

      {step === 2 ? (
        <SlotStep
          slots={slots}
          chosen={chosenSlot}
          onChoose={(start) => {
            setChosenSlot(start);
            goTo(3);
          }}
          onBack={() => goTo(1)}
        />
      ) : null}

      {step === 3 && address && quote && chosenSlot ? (
        <ContactStep
          address={address}
          quote={quote}
          startAt={chosenSlot}
          pending={pending}
          onBack={() => goTo(2)}
          onSubmit={(contact) => {
            startTransition(async () => {
              const result = await backend.confirmBooking({
                ...contact,
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
              if (result.ok) {
                setConfirmation({
                  bookingId: result.data.bookingId,
                  startAt: result.data.startAt,
                  grossAmountCents: result.data.grossAmountCents,
                });
              } else {
                setError(result.error);
                // Un créneau pris entre-temps : on renvoie à la liste plutôt
                // que de laisser le client réessayer sur une heure morte.
                if (result.code === "BUSINESS") {
                  setChosenSlot(null);
                  setStep(2);
                }
              }
            });
          }}
        />
      ) : null}
    </div>
  );
}

function Steps({ current }: { current: number }) {
  return (
    <ol className="flex flex-wrap gap-x-2 gap-y-1 text-sm">
      {STEPS.map((label, index) => (
        <li key={label} className="flex items-center gap-2">
          <span
            className={
              index < current
                ? "flex size-6 items-center justify-center rounded-full bg-primary text-primary-foreground"
                : index === current
                  ? "flex size-6 items-center justify-center rounded-full border-2 border-primary font-medium"
                  : "flex size-6 items-center justify-center rounded-full border border-border text-muted-foreground"
            }
            aria-hidden
          >
            {index < current ? <CheckIcon className="size-3.5" /> : index + 1}
          </span>
          <span
            className={
              index === current ? "font-medium" : "text-muted-foreground"
            }
            aria-current={index === current ? "step" : undefined}
          >
            {label}
          </span>
          {index < STEPS.length - 1 ? (
            <span className="text-muted-foreground" aria-hidden>
              ›
            </span>
          ) : null}
        </li>
      ))}
    </ol>
  );
}

function AddressStep({
  backend,
  communes,
  defaultQuery,
  selected,
  onSelect,
}: {
  backend: BookingBackend;
  communes: readonly CommuneOption[];
  defaultQuery: string;
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
        onCancel={() => setManual(false)}
        onSelect={onSelect}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor="address">Où intervenons-nous ?</Label>
        <p className="mt-1 text-sm text-muted-foreground">
          Commencez à taper votre adresse, nous la complétons.
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
            placeholder="12 rue des Vignes, Léognan"
            className="pl-9"
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
          <Link href="/menage-a-domicile" className="text-primary underline">
            voir la liste des communes
          </Link>
          .
        </p>
      ) : null}

      <ul className="space-y-2">
        {visible.map((address) => (
          <li key={address.banId}>
            <button
              type="button"
              disabled={!address.isCovered}
              onClick={() => onSelect(address)}
              className="flex w-full items-start justify-between gap-4 rounded-xl border border-border bg-card p-4 text-left transition-colors enabled:hover:border-primary disabled:opacity-50"
            >
              <span>
                <span className="block font-medium">{address.label}</span>
                {!address.isPreciseToHouseNumber ? (
                  <span className="mt-0.5 block text-sm text-muted-foreground">
                    Précisez le numéro pour que l&apos;intervenant trouve
                  </span>
                ) : null}
              </span>
              {address.isCovered ? (
                <Badge variant="secondary">Desservie</Badge>
              ) : (
                <Badge variant="outline">Hors zone</Badge>
              )}
            </button>
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
            className="text-primary underline"
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
  onCancel,
  onSelect,
}: {
  communes: readonly CommuneOption[];
  onCancel: () => void;
  onSelect: (choice: AddressChoice) => void;
}) {
  const [street, setStreet] = useState("");
  const [communeSlug, setCommuneSlug] = useState(communes[0]?.slug ?? "");

  const commune = communes.find((entry) => entry.slug === communeSlug);

  return (
    <form
      className="space-y-4"
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
          className="mt-2"
        />
      </div>

      <div>
        <Label htmlFor="manual-commune">Commune</Label>
        <select
          id="manual-commune"
          value={communeSlug}
          onChange={(event) => setCommuneSlug(event.target.value)}
          className="mt-2 h-10 w-full rounded-lg border border-input bg-transparent px-3 text-sm"
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

      <div className="flex gap-3">
        <Button type="button" variant="outline" onClick={onCancel}>
          Rechercher plutôt
        </Button>
        <Button type="submit" disabled={street.trim().length < 3}>
          Continuer
        </Button>
      </div>
    </form>
  );
}

function HousingStep({
  surfaceSqm,
  frequency,
  quote,
  pending,
  onChange,
  onBack,
  onNext,
}: {
  surfaceSqm: number;
  frequency: Frequency;
  quote: QuoteView | null;
  pending: boolean;
  onChange: (surface: number, frequency: Frequency) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  return (
    <div className="space-y-6">
      <div>
        <Label htmlFor="surface">Surface à entretenir</Label>
        <div className="mt-3 flex items-center gap-3">
          <Input
            id="surface"
            type="number"
            inputMode="numeric"
            min={15}
            max={400}
            step={5}
            value={surfaceSqm}
            onChange={(event) =>
              onChange(Number(event.target.value) || 0, frequency)
            }
            className="w-28"
          />
          <span className="text-muted-foreground">m²</span>
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          La surface habitable, hors garage et cave.
        </p>
      </div>

      <fieldset>
        <legend className="text-sm font-medium">À quelle fréquence ?</legend>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {FREQUENCIES.map((option) => (
            <label
              key={option.value}
              className={`cursor-pointer rounded-xl border p-4 transition-colors ${
                frequency === option.value
                  ? "border-primary bg-primary/5"
                  : "border-border bg-card hover:border-primary/50"
              }`}
            >
              <input
                type="radio"
                name="frequency"
                value={option.value}
                checked={frequency === option.value}
                onChange={() => onChange(surfaceSqm, option.value)}
                className="sr-only"
              />
              <span className="block font-medium">{option.label}</span>
              <span className="mt-1 block text-sm text-muted-foreground">
                {option.hint}
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <QuoteSummary quote={quote} pending={pending} />

      <div className="flex gap-3">
        <Button variant="outline" onClick={onBack}>
          Retour
        </Button>
        <Button onClick={onNext} disabled={!quote || pending}>
          {pending ? "Recherche des créneaux…" : "Voir les créneaux"}
        </Button>
      </div>
    </div>
  );
}

function QuoteSummary({
  quote,
  pending,
}: {
  quote: QuoteView | null;
  pending: boolean;
}) {
  if (!quote) {
    return (
      <p className="text-sm text-muted-foreground">
        {pending
          ? "Calcul du devis…"
          : "Indiquez une surface pour voir le prix."}
      </p>
    );
  }

  return (
    <dl className="grid grid-cols-2 gap-4 rounded-xl border border-border bg-card p-5 sm:grid-cols-3">
      <div>
        <dt className="text-xs text-muted-foreground">Durée estimée</dt>
        <dd className="mt-1 font-heading text-xl font-semibold">
          {formatDuration(quote.durationMinutes)}
        </dd>
      </div>
      <div>
        <dt className="text-xs text-muted-foreground">Tarif horaire</dt>
        <dd className="mt-1 font-heading text-xl font-semibold">
          {formatEuros(quote.hourlyRateCents)}
        </dd>
      </div>
      <div>
        <dt className="text-xs text-muted-foreground">Par intervention</dt>
        <dd className="mt-1 font-heading text-xl font-semibold text-primary">
          {formatEuros(quote.grossAmountCents)}
        </dd>
      </div>
      <p className="col-span-full text-sm text-muted-foreground">
        Minimum {MINIMUM_BILLABLE_MINUTES / 60} heures par intervention. Prix
        TTC, sans frais de déplacement.
      </p>
    </dl>
  );
}

function SlotStep({
  slots,
  chosen,
  onChoose,
  onBack,
}: {
  slots: { start: string; end: string }[];
  chosen: string | null;
  onChoose: (start: string) => void;
  onBack: () => void;
}) {
  // Les créneaux arrivent à plat et se lisent par journée : personne ne
  // choisit « le 17 à 14 h » dans une liste de soixante lignes.
  const days = useMemo(() => {
    const grouped = new Map<string, { start: string; end: string }[]>();
    for (const slot of slots) {
      const key = dayFormatter.format(new Date(slot.start));
      grouped.set(key, [...(grouped.get(key) ?? []), slot]);
    }
    return [...grouped.entries()];
  }, [slots]);

  return (
    <div className="space-y-6">
      {days.length === 0 ? (
        <div className="rounded-xl border border-border bg-secondary/40 p-5">
          <p className="font-medium">
            Aucun créneau sur les trois prochaines semaines.
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            Cela arrive dans les communes les plus éloignées. Appelez-nous au{" "}
            <a href={`tel:${SITE.phoneE164}`} className="text-primary">
              {SITE.phone}
            </a>{" "}
            : nous trouvons souvent une solution qui n&apos;apparaît pas ici.
          </p>
        </div>
      ) : (
        days.map(([day, daySlots]) => (
          <div key={day}>
            <h3 className="font-heading font-semibold first-letter:uppercase">
              {day}
            </h3>
            <ul className="mt-3 flex flex-wrap gap-2">
              {daySlots.map((slot) => (
                <li key={slot.start}>
                  <button
                    type="button"
                    onClick={() => onChoose(slot.start)}
                    className={`rounded-lg border px-4 py-2 text-sm transition-colors ${
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
          </div>
        ))
      )}

      <Button variant="outline" onClick={onBack}>
        Retour
      </Button>
    </div>
  );
}

interface ContactInput {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  accessNotes?: string;
  clientNotes?: string;
}

function ContactStep({
  address,
  quote,
  startAt,
  pending,
  onBack,
  onSubmit,
}: {
  address: AddressChoice;
  quote: QuoteView;
  startAt: string;
  pending: boolean;
  onBack: () => void;
  onSubmit: (contact: ContactInput) => void;
}) {
  const [contact, setContact] = useState<ContactInput>({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
  });

  const set = (key: keyof ContactInput) => (value: string) =>
    setContact((current) => ({ ...current, [key]: value }));

  return (
    <form
      className="space-y-6"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit(contact);
      }}
    >
      <div className="rounded-xl border border-border bg-secondary/40 p-5">
        <p className="font-heading font-semibold first-letter:uppercase">
          {dayFormatter.format(new Date(startAt))} à{" "}
          {timeFormatter.format(new Date(startAt))}
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          {address.label} · {formatDuration(quote.durationMinutes)} ·{" "}
          {formatEuros(quote.grossAmountCents)}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="firstName">Prénom</Label>
          <Input
            id="firstName"
            required
            autoComplete="given-name"
            value={contact.firstName}
            onChange={(event) => set("firstName")(event.target.value)}
            className="mt-2"
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
            className="mt-2"
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
            className="mt-2"
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
            className="mt-2"
          />
        </div>
      </div>

      <div>
        <Label htmlFor="accessNotes">Comment entrer chez vous ?</Label>
        <p className="mt-1 text-sm text-muted-foreground">
          Étage, digicode, où sont les clés, présence d&apos;un animal.
        </p>
        <Textarea
          id="accessNotes"
          rows={3}
          value={contact.accessNotes ?? ""}
          onChange={(event) => set("accessNotes")(event.target.value)}
          className="mt-2"
        />
      </div>

      <div>
        <Label htmlFor="clientNotes">Priorités pour la première fois</Label>
        <Textarea
          id="clientNotes"
          rows={3}
          value={contact.clientNotes ?? ""}
          onChange={(event) => set("clientNotes")(event.target.value)}
          className="mt-2"
        />
      </div>

      <p className="text-sm text-muted-foreground">
        Aucun paiement maintenant. Vous réglez après la prestation.
      </p>

      <div className="flex gap-3">
        <Button type="button" variant="outline" onClick={onBack}>
          Retour
        </Button>
        <Button type="submit" disabled={pending}>
          {pending ? "Réservation…" : "Réserver"}
        </Button>
      </div>
    </form>
  );
}

function Confirmed({
  confirmation,
  address,
}: {
  confirmation: {
    bookingId: string;
    startAt: string;
    grossAmountCents: number;
  };
  address: AddressChoice | null;
}) {
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
        <strong className="text-foreground">
          {dayFormatter.format(new Date(confirmation.startAt))} à{" "}
          {timeFormatter.format(new Date(confirmation.startAt))}
        </strong>
        {address ? ` au ${address.label}` : ""}, pour{" "}
        {formatEuros(confirmation.grossAmountCents)}.
      </p>
      <p className="mx-auto mt-4 max-w-prose text-sm text-muted-foreground">
        Nous vous confirmons par email le nom de votre intervenant. Une question
        d&apos;ici là : {SITE.phone}.
      </p>
    </div>
  );
}
