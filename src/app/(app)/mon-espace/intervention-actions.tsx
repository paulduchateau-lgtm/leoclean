"use client";

import { Loader2Icon, MessageCircleIcon, SendIcon, XIcon } from "lucide-react";
import { useState } from "react";

import {
  annulerIntervention,
  envoyerMessage,
  listerMessages,
} from "@/app/(app)/mon-espace/actions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { BookingMessageView } from "@/lib/booking/client-space";
import { formatEuros } from "@/lib/pricing";

/**
 * Annuler une intervention, et écrire à son intervenant.
 *
 * Les deux gestes vivent dans le même composant parce qu'ils s'adressent au
 * même moment : quelque chose a changé chez le client, et il doit choisir
 * entre prévenir et annuler. Les séparer sur deux écrans obligerait à revenir
 * en arrière pour comparer le coût de l'un avec l'utilité de l'autre.
 *
 * **Le montant est affiché avant la confirmation, jamais après.** Il est
 * calculé côté serveur au moment de l'annulation, mais celui qu'on montre ici
 * vient du même barème et de la même heure de départ : découvrir des frais
 * après avoir cliqué est exactement ce qu'on reproche aux services qu'on
 * remplace. La confirmation en deux temps existe pour cette raison, pas pour
 * ralentir.
 */

const timeFormatter = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Paris",
});

export function InterventionActions({
  bookingId,
  cancellable,
  feeCents,
  refusalMessage,
  hasCleaner,
}: {
  bookingId: string;
  cancellable: boolean;
  /** Ce que l'annulation coûterait maintenant, selon le barème des CGU. */
  feeCents: number;
  /** Renseigné quand l'annulation en autonomie n'est pas possible. */
  refusalMessage: string | null;
  hasCleaner: boolean;
}) {
  const [panel, setPanel] = useState<"none" | "cancel" | "chat">("none");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [reason, setReason] = useState("");
  const [cancelled, setCancelled] = useState<string | null>(null);

  const [messages, setMessages] = useState<BookingMessageView[] | null>(null);
  const [draft, setDraft] = useState("");

  async function openChat() {
    setPanel("chat");
    setError(null);
    if (messages !== null) return;

    setPending(true);
    const result = await listerMessages({ bookingId });
    setPending(false);
    if (result.ok) setMessages(result.data);
    else setError(result.error);
  }

  async function send() {
    const body = draft.trim();
    if (body === "") return;

    setPending(true);
    setError(null);
    const result = await envoyerMessage({ bookingId, body });
    setPending(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }
    setMessages((current) => [...(current ?? []), result.data]);
    setDraft("");
  }

  async function confirmCancel() {
    setPending(true);
    setError(null);
    const result = await annulerIntervention({
      bookingId,
      reason: reason.trim() || undefined,
    });
    setPending(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }
    setCancelled(
      result.data.feeCents === 0
        ? "Intervention annulée. Rien ne vous est facturé."
        : `Intervention annulée. ${formatEuros(result.data.feeCents)} restent dus au titre du barème (${result.data.tierLabel}).`,
    );
    setPanel("none");
  }

  if (cancelled !== null) {
    return (
      <p role="status" className="mt-4 text-sm font-medium text-brand">
        {cancelled}
      </p>
    );
  }

  return (
    <div className="mt-4">
      <div className="flex flex-wrap gap-2">
        {hasCleaner ? (
          <button
            type="button"
            onClick={() => void openChat()}
            className="inline-flex min-h-11 items-center gap-2 rounded-full border-2 border-border bg-card px-5 text-sm font-bold transition-colors hover:border-mint-400 hover:bg-mint-50"
          >
            <MessageCircleIcon className="size-4" aria-hidden />
            Écrire à mon intervenant
          </button>
        ) : null}

        <button
          type="button"
          onClick={() =>
            setPanel((current) => (current === "cancel" ? "none" : "cancel"))
          }
          className="inline-flex min-h-11 items-center gap-2 rounded-full border-2 border-border bg-card px-5 text-sm font-bold text-muted-foreground transition-colors hover:border-destructive/50"
        >
          <XIcon className="size-4" aria-hidden />
          Annuler
        </button>
      </div>

      {panel === "cancel" ? (
        <div className="mt-3 rounded-xl border border-border bg-secondary/40 p-4">
          {!cancellable ? (
            <p className="text-sm text-pretty text-muted-foreground">
              {refusalMessage}
            </p>
          ) : (
            <>
              <p className="text-sm text-pretty">
                {feeCents === 0 ? (
                  <>
                    L&apos;annulation est <strong>gratuite</strong> à cette
                    heure-ci.
                  </>
                ) : (
                  <>
                    À cette heure-ci, le barème retient{" "}
                    <strong>{formatEuros(feeCents)}</strong>.
                  </>
                )}{" "}
                Votre intervenant est prévenu et le créneau est libéré
                immédiatement.
              </p>

              <label
                htmlFor={`reason-${bookingId}`}
                className="mt-4 block text-sm font-medium"
              >
                Un mot pour votre intervenant{" "}
                <span className="font-normal text-muted-foreground">
                  (facultatif)
                </span>
              </label>
              <Textarea
                id={`reason-${bookingId}`}
                rows={2}
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                className="mt-2"
              />

              <div className="mt-4 flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="destructive"
                  disabled={pending}
                  onClick={() => void confirmCancel()}
                  className="min-h-11"
                >
                  {pending ? (
                    <Loader2Icon className="size-4 animate-spin" aria-hidden />
                  ) : null}
                  Confirmer l&apos;annulation
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setPanel("none")}
                  className="min-h-11"
                >
                  Garder mon rendez-vous
                </Button>
              </div>
            </>
          )}
        </div>
      ) : null}

      {panel === "chat" ? (
        <div className="mt-3 rounded-xl border border-border bg-secondary/40 p-4">
          {pending && messages === null ? (
            <p className="text-sm text-muted-foreground">Chargement…</p>
          ) : (
            <ul className="max-h-64 space-y-2 overflow-y-auto">
              {(messages ?? []).length === 0 ? (
                <li className="text-sm text-muted-foreground">
                  Aucun message pour l&apos;instant. Un code d&apos;entrée, un
                  chien qui aboie, une pièce à ne pas faire : c&apos;est ici.
                </li>
              ) : (
                (messages ?? []).map((message) => (
                  <li
                    key={message.id}
                    className={`max-w-[85%] rounded-[var(--r-m)] px-3 py-2 text-sm ${
                      message.fromMe
                        ? "ml-auto bg-primary text-primary-foreground"
                        : "bg-card"
                    }`}
                  >
                    <p className="text-pretty">{message.body}</p>
                    <p
                      className={`mt-1 text-xs ${
                        message.fromMe
                          ? "text-primary-foreground/70"
                          : "text-muted-foreground"
                      }`}
                    >
                      {timeFormatter.format(new Date(message.createdAt))}
                    </p>
                  </li>
                ))
              )}
            </ul>
          )}

          <div className="mt-3 flex items-end gap-2">
            <Textarea
              rows={2}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="Votre message"
              aria-label="Votre message"
              className="flex-1"
            />
            <Button
              type="button"
              size="icon"
              disabled={pending || draft.trim() === ""}
              onClick={() => void send()}
              aria-label="Envoyer"
              className="min-h-11"
            >
              {pending ? (
                <Loader2Icon className="size-4 animate-spin" aria-hidden />
              ) : (
                <SendIcon className="size-4" aria-hidden />
              )}
            </Button>
          </div>
        </div>
      ) : null}

      {error !== null ? (
        <p role="alert" className="mt-3 text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
