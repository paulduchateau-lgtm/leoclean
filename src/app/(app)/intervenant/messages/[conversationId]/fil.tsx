"use client";

import { Loader2Icon, SendIcon } from "lucide-react";
import { useState, useTransition } from "react";

import { repondreAuClient } from "@/app/(app)/intervenant/messages/actions";
import type { MessageVue } from "@/lib/messagerie/vocabulaire";

/**
 * Le fil et sa zone de réponse.
 *
 * Le message envoyé est ajouté localement plutôt que d'attendre un
 * rechargement : sur un téléphone, dans la rue, entre deux missions, une
 * seconde d'attente sur un envoi fait appuyer deux fois.
 */

const HEURE = new Intl.DateTimeFormat("fr-FR", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Paris",
});

const JOUR = new Intl.DateTimeFormat("fr-FR", {
  weekday: "long",
  day: "numeric",
  month: "long",
  timeZone: "Europe/Paris",
});

export function Fil({
  conversationId,
  messages: initiaux,
}: {
  conversationId: string;
  messages: MessageVue[];
}) {
  const [messages, setMessages] = useState(initiaux);
  const [corps, setCorps] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  /*
   * Les séparateurs de jour sont calculés avant le rendu plutôt qu'en
   * accumulant une variable dans le `map` : muter pendant le rendu produit un
   * résultat différent au second passage, et React en fait plusieurs.
   */
  const lignes = messages.map((message, index) => {
    const jour = JOUR.format(new Date(message.createdAt));
    const precedent =
      index === 0
        ? null
        : JOUR.format(new Date(messages[index - 1]!.createdAt));
    return { message, jour, nouveauJour: jour !== precedent };
  });

  return (
    <>
      <ol className="mt-6 flex-1 space-y-3">
        {messages.length === 0 ? (
          <li className="rounded-xl border border-border bg-secondary/40 p-5 text-muted-foreground">
            Rien encore. Vous pouvez écrire le premier.
          </li>
        ) : null}

        {lignes.map(({ message, jour, nouveauJour }) => {
          return (
            <li key={message.id}>
              {nouveauJour ? (
                <p className="my-4 text-center text-xs text-muted-foreground first-letter:uppercase">
                  {jour}
                </p>
              ) : null}
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-2.5 ${
                  message.deMoi
                    ? "ml-auto bg-primary text-primary-foreground"
                    : "bg-secondary"
                }`}
              >
                <p className="text-pretty whitespace-pre-wrap">
                  {message.body}
                </p>
                <p
                  className={`mt-1 font-mono text-xs ${
                    message.deMoi
                      ? "text-primary-foreground/70"
                      : "text-muted-foreground"
                  }`}
                >
                  {HEURE.format(new Date(message.createdAt))}
                </p>
              </div>
            </li>
          );
        })}
      </ol>

      {erreur ? (
        <p role="alert" className="mt-3 text-sm text-destructive">
          {erreur}
        </p>
      ) : null}

      <form
        className="mt-6 flex items-end gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          const texte = corps.trim();
          if (!texte) return;

          startTransition(async () => {
            setErreur(null);
            const resultat = await repondreAuClient({
              conversationId,
              corps: texte,
            });
            if (!resultat.ok) {
              setErreur(resultat.error);
              return;
            }
            setMessages((actuels) => [...actuels, resultat.data]);
            setCorps("");
          });
        }}
      >
        <label className="flex-1">
          <span className="sr-only">Votre message</span>
          <textarea
            value={corps}
            onChange={(event) => setCorps(event.target.value)}
            rows={2}
            maxLength={4000}
            placeholder="Écrire…"
            className="w-full rounded-2xl border border-input bg-background p-3 text-base"
          />
        </label>
        <button
          type="submit"
          disabled={pending || corps.trim().length === 0}
          className="grid size-13 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground disabled:opacity-50"
        >
          {pending ? (
            <Loader2Icon className="size-5 animate-spin" aria-hidden />
          ) : (
            <SendIcon className="size-5" aria-hidden />
          )}
          <span className="sr-only">Envoyer</span>
        </button>
      </form>
    </>
  );
}
