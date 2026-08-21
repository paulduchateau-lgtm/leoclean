"use client";

import { Loader2Icon, SendIcon } from "lucide-react";
import { useEffect, useRef, useState, useTransition } from "react";

import {
  envoyerAuFil,
  relireLeFil,
} from "@/app/(app)/mon-espace/messages/actions";
import type { MessageVue } from "@/lib/messagerie/vocabulaire";

/**
 * Le fil et sa zone de réponse, côté client.
 *
 * **Le fil se rafraîchit tant qu'il est ouvert.** Une messagerie qui n'affiche
 * la réponse qu'au rechargement n'est pas une messagerie : on écrit, on attend,
 * on recharge, et on finit par téléphoner. Le rafraîchissement s'arrête dès que
 * l'onglet passe à l'arrière-plan — interroger le serveur pour un écran que
 * personne ne regarde coûte de la batterie sans rien apporter — et reprend
 * immédiatement au retour, où l'on veut justement voir ce qu'on a manqué.
 *
 * **C'est un sondage, et il est assumé comme tel** : le poussé véritable
 * demanderait soit de rouvrir l'accès direct à la base — que le dépôt a fermé —
 * soit une connexion longue, que l'hébergement sans serveur tient mal. Entre
 * deux personnes qui échangent quelques messages par jour, trois secondes ne se
 * distinguent pas d'un poussé. Le jour où l'on branchera un vrai canal, c'est
 * cette fonction qu'il remplacera, et elle seule.
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

/** Assez court pour passer pour du direct, assez long pour ne rien coûter. */
const RAFRAICHISSEMENT_MS = 3000;

export function FilClient({
  conversationId,
  interlocuteur,
  messages: initiaux,
}: {
  conversationId: string;
  interlocuteur: string;
  messages: MessageVue[];
}) {
  const [messages, setMessages] = useState(initiaux);
  const [corps, setCorps] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const bas = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    /*
     * `document.hidden` plutôt qu'un compteur d'inactivité : le navigateur sait
     * déjà si l'écran est regardé, et l'événement arrive avant que la minuterie
     * suivante ne parte.
     */
    let minuterie: ReturnType<typeof setInterval> | null = null;

    const relire = async () => {
      const resultat = await relireLeFil({ conversationId });
      if (!resultat.ok) return;
      setMessages((precedents) =>
        /*
         * On ne remplace que si quelque chose a changé : réécrire la même
         * liste ferait clignoter le fil et remonterait le défilement à chaque
         * passage.
         */
        resultat.data.messages.length === precedents.length &&
        resultat.data.messages.at(-1)?.id === precedents.at(-1)?.id
          ? precedents
          : resultat.data.messages,
      );
    };

    const demarrer = () => {
      if (minuterie !== null) return;
      minuterie = setInterval(relire, RAFRAICHISSEMENT_MS);
    };
    const arreter = () => {
      if (minuterie === null) return;
      clearInterval(minuterie);
      minuterie = null;
    };

    const surVisibilite = () => {
      if (document.hidden) {
        arreter();
        return;
      }
      void relire();
      demarrer();
    };

    demarrer();
    document.addEventListener("visibilitychange", surVisibilite);
    return () => {
      arreter();
      document.removeEventListener("visibilitychange", surVisibilite);
    };
  }, [conversationId]);

  /* Le dernier message reste en vue : un fil qui s'allonge hors de l'écran
     oblige à faire défiler pour lire ce qu'on vient de recevoir. */
  useEffect(() => {
    bas.current?.scrollIntoView({ block: "end" });
  }, [messages]);

  const envoyer = () => {
    const texte = corps.trim();
    if (texte.length === 0) return;
    setErreur(null);

    startTransition(async () => {
      const resultat = await envoyerAuFil({ conversationId, corps: texte });
      if (!resultat.ok) {
        setErreur("Le message n'est pas parti. Réessayez.");
        return;
      }
      // Ajouté localement : attendre un aller-retour fait appuyer deux fois.
      setMessages((precedents) => [...precedents, resultat.data.message]);
      setCorps("");
    });
  };

  /*
   * Les séparateurs de jour sont calculés avant le rendu plutôt qu'en
   * accumulant une variable dans le `map` : muter pendant le rendu produit un
   * résultat différent au second passage, et React en fait plusieurs.
   */
  const lignes = messages.map((message, rang) => {
    const jour = JOUR.format(new Date(message.createdAt));
    const precedent =
      rang === 0 ? null : JOUR.format(new Date(messages[rang - 1]!.createdAt));
    return { message, jour, ouvreLeJour: jour !== precedent };
  });

  return (
    <div className="mt-6 flex flex-1 flex-col">
      <div className="flex-1 space-y-3">
        {messages.length === 0 ? (
          <p className="rounded-[var(--r-l)] border border-border bg-secondary/40 p-5 text-sm text-muted-foreground">
            Rien encore. Écrivez-lui : un mot sur l&apos;accès, une précision
            sur une pièce, un changement d&apos;horaire à demander.
          </p>
        ) : null}

        {lignes.map(({ message, jour, ouvreLeJour }) => {
          return (
            <div key={message.id}>
              {ouvreLeJour ? (
                <p className="my-4 text-center text-xs font-semibold text-muted-foreground first-letter:uppercase">
                  {jour}
                </p>
              ) : null}
              <div
                className={`flex ${message.deMoi ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[80%] rounded-[var(--r-l)] px-4 py-2.5 ${
                    message.deMoi
                      ? "bg-teal-100 text-ink-900"
                      : "border border-border bg-card"
                  }`}
                >
                  <p className="text-sm text-pretty whitespace-pre-wrap">
                    {message.body}
                  </p>
                  <p className="mt-1 text-right font-mono text-[11px] text-muted-foreground">
                    {HEURE.format(new Date(message.createdAt))}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
        <div ref={bas} />
      </div>

      <form
        className="sticky bottom-0 mt-6 flex gap-2 bg-background py-3"
        onSubmit={(event) => {
          event.preventDefault();
          envoyer();
        }}
      >
        <label className="sr-only" htmlFor="corps">
          Votre message à {interlocuteur}
        </label>
        <textarea
          id="corps"
          rows={1}
          value={corps}
          onChange={(event) => setCorps(event.target.value)}
          placeholder={`Écrire à ${interlocuteur}…`}
          className="min-h-12 flex-1 resize-none rounded-[var(--r-m)] border-2 border-input bg-card px-4 py-3 text-base outline-none focus-visible:border-teal-600"
        />
        <button
          type="submit"
          disabled={pending || corps.trim().length === 0}
          aria-label="Envoyer"
          className="inline-flex size-12 shrink-0 items-center justify-center rounded-full bg-primary text-ink-900 disabled:opacity-40"
        >
          {pending ? (
            <Loader2Icon className="size-5 animate-spin" aria-hidden />
          ) : (
            <SendIcon className="size-5" aria-hidden />
          )}
        </button>
      </form>

      {erreur ? (
        <p role="alert" className="pb-3 text-sm text-destructive">
          {erreur}
        </p>
      ) : null}
    </div>
  );
}
