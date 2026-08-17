"use client";

import { CalendarClockIcon, Loader2Icon } from "lucide-react";
import { useState } from "react";

import { repondreAProposition } from "@/app/(app)/mon-espace/actions";
import { Button } from "@/components/ui/button";
import type { ClientProposalView } from "@/lib/booking/slot-proposal-store";

/**
 * Un intervenant propose une autre heure ; le client tranche.
 *
 * Le bloc n'apparaît que sur une intervention que personne n'a acceptée. C'est
 * la seule situation où le tunnel n'a pas tenu sa promesse — un créneau ferme —
 * et il vaut mieux une proposition nommée qu'un silence suivi d'un appel.
 *
 * **Rien n'est déplacé tant que le client n'a pas répondu.** L'asymétrie est
 * délibérée : déplacer d'office le rendez-vous de quelqu'un parce que personne
 * n'était libre reviendrait à lui faire porter un manque qui n'est pas le
 * sien. Refuser est donc un bouton de même poids qu'accepter.
 */

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

export function PropositionCreneau({
  proposal,
}: {
  proposal: ClientProposalView;
}) {
  const [pending, setPending] = useState(false);
  const [outcome, setOutcome] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const start = new Date(proposal.proposedStart);

  async function answer(accept: boolean) {
    setPending(true);
    setError(null);

    const result = await repondreAProposition({
      proposalId: proposal.id,
      accept,
    });
    setPending(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    if (result.data.accepted) {
      setOutcome(
        `C'est calé : ${dayFormatter.format(start)} à ${timeFormatter.format(start)}, avec ${proposal.cleanerFirstName}.`,
      );
    } else if (result.data.slotLost) {
      // Le cas honnête plutôt que le cas flatteur : l'intervenant s'est engagé
      // ailleurs entre sa proposition et cette réponse, et la réservation est
      // restée à son heure d'origine.
      setOutcome(
        `${proposal.cleanerFirstName} n'est plus libre à cette heure-là. Votre demande reste en cours, à son heure d'origine.`,
      );
    } else {
      setOutcome(
        "Proposition refusée. Votre demande reste en cours, nous continuons à chercher.",
      );
    }
  }

  if (outcome !== null) {
    return (
      <p role="status" className="mt-4 text-sm font-medium text-brand">
        {outcome}
      </p>
    );
  }

  return (
    <div className="mt-4 rounded-xl border-2 border-peach-300 bg-peach-50 p-4">
      <p className="flex items-center gap-2 text-xs tracking-overline uppercase">
        <CalendarClockIcon className="size-4" aria-hidden />
        Autre créneau proposé
      </p>

      <p className="mt-2 text-pretty">
        <strong>{proposal.cleanerFirstName}</strong> peut venir{" "}
        <strong className="first-letter:uppercase">
          {dayFormatter.format(start)} à {timeFormatter.format(start)}
        </strong>
        .
      </p>

      {proposal.message !== null ? (
        <p className="mt-2 text-sm text-pretty text-muted-foreground">
          « {proposal.message} »
        </p>
      ) : null}

      <p className="mt-2 text-sm text-muted-foreground">
        Rien n&apos;est déplacé tant que vous n&apos;avez pas répondu. Le prix
        et la durée ne changent pas.
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        <Button
          type="button"
          disabled={pending}
          onClick={() => void answer(true)}
          className="min-h-11"
        >
          {pending ? (
            <Loader2Icon className="size-4 animate-spin" aria-hidden />
          ) : null}
          Ce créneau me va
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={pending}
          onClick={() => void answer(false)}
          className="min-h-11"
        >
          Non, merci
        </Button>
      </div>

      {error !== null ? (
        <p role="alert" className="mt-3 text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
