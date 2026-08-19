"use client";

import { Loader2Icon } from "lucide-react";
import { useState, useTransition } from "react";

import { rejoindreLaListe } from "@/app/zones-desservies/actions";
import { Button } from "@/components/ui/button";

/**
 * « On n'est pas encore chez vous. »
 *
 * Le seul endroit du produit où quelqu'un hors zone laisse une trace. Sans lui,
 * ces gens repartent sans que personne sache qu'ils sont venus — et l'ouverture
 * d'une commune se décide à l'intuition.
 *
 * **On ne promet aucune date.** Léo Clean ouvre une commune quand elle y a
 * quelqu'un à moins de vingt minutes, ce qui ne se décide pas à l'avance :
 * annoncer « bientôt » serait la seule chose qu'on aurait à se reprocher le
 * jour où ce serait faux.
 */
export function ListeAttente({
  sourcePath,
  className,
}: {
  sourcePath?: string;
  className?: string;
}) {
  const [pending, startTransition] = useTransition();
  const [envoye, setEnvoye] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [kind, setKind] = useState<"CLIENT" | "CLEANER">("CLIENT");
  /* Lu une seule fois, à la construction : `useRef(Date.now())` appellerait
     l'horloge pendant le rendu, ce qui est impur et ce que React interdit. */
  const [affiche] = useState(() => Date.now());

  if (envoye) {
    return (
      <div
        role="status"
        className={`rounded-2xl border border-success/40 bg-success/10 p-6 ${className ?? ""}`}
      >
        <p className="font-semibold">C&apos;est noté.</p>
        <p className="mt-1 text-muted-foreground">
          On vous écrit le jour où quelqu&apos;un travaille à moins de vingt
          minutes de chez vous. Pas avant, et sans rien vous envoyer d&apos;autre
          entre-temps.
        </p>
      </div>
    );
  }

  return (
    <form
      className={`rounded-2xl border border-border bg-card p-6 ${className ?? ""}`}
      onSubmit={(event) => {
        event.preventDefault();
        const donnees = new FormData(event.currentTarget);
        setErreur(null);

        startTransition(async () => {
          const resultat = await rejoindreLaListe({
            kind,
            email: String(donnees.get("email") ?? ""),
            phone: String(donnees.get("phone") ?? ""),
            communeName: String(donnees.get("communeName") ?? ""),
            postalCode: String(donnees.get("postalCode") ?? ""),
            website: String(donnees.get("website") ?? ""),
            renderedAt: affiche,
            sourcePath,
          });

          if (!resultat.ok) {
            setErreur(resultat.error);
            return;
          }
          setEnvoye(true);
        });
      }}
    >
      <h2 className="font-heading text-xl font-extrabold">
        Vous n&apos;êtes pas dans la liste ?
      </h2>
      <p className="mt-2 max-w-prose text-muted-foreground">
        Dites-nous où vous êtes. On ouvre une commune quand quelqu&apos;un y
        travaille à moins de vingt minutes — c&apos;est ce qui rend tenable
        « toujours la même personne », et c&apos;est pour ça qu&apos;on
        n&apos;annonce pas de date.
      </p>

      <fieldset className="mt-5">
        <legend className="text-sm font-medium">Vous êtes</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {(
            [
              ["CLIENT", "Je cherche un ménage"],
              ["CLEANER", "Je cherche des missions"],
            ] as const
          ).map(([valeur, libelle]) => (
            <button
              key={valeur}
              type="button"
              aria-pressed={kind === valeur}
              onClick={() => setKind(valeur)}
              className={`min-h-11 rounded-full border px-4 text-base ${
                kind === valeur
                  ? "border-brand bg-brand text-ink-950"
                  : "border-input bg-background"
              }`}
            >
              {libelle}
            </button>
          ))}
        </div>
      </fieldset>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Votre commune</span>
          <input
            name="communeName"
            required
            maxLength={80}
            autoComplete="address-level2"
            placeholder="Pessac"
            className="min-h-13 rounded-xl border border-input bg-background px-3 text-base"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">
            Code postal <span className="text-muted-foreground">(facultatif)</span>
          </span>
          <input
            name="postalCode"
            inputMode="numeric"
            maxLength={5}
            autoComplete="postal-code"
            className="min-h-13 rounded-xl border border-input bg-background px-3 text-base"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Email</span>
          <input
            name="email"
            type="email"
            maxLength={200}
            autoComplete="email"
            className="min-h-13 rounded-xl border border-input bg-background px-3 text-base"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">
            ou téléphone
          </span>
          <input
            name="phone"
            type="tel"
            maxLength={30}
            autoComplete="tel"
            className="min-h-13 rounded-xl border border-input bg-background px-3 text-base"
          />
        </label>
      </div>

      {/* Champ piège : invisible pour un humain, rempli par un robot. */}
      <div aria-hidden="true" className="absolute -left-[9999px]">
        <label>
          Ne rien écrire ici
          <input name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>

      {erreur ? (
        <p role="alert" className="mt-4 text-sm text-destructive">
          {erreur}
        </p>
      ) : null}

      <Button type="submit" size="lg" disabled={pending} className="mt-5">
        {pending ? (
          <Loader2Icon className="animate-spin" aria-hidden="true" />
        ) : null}
        Prévenez-moi
      </Button>
    </form>
  );
}
