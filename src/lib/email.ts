import { render } from "@react-email/render";
import type { ReactElement } from "react";
import { Resend } from "resend";

/**
 * Envoi d'emails transactionnels.
 *
 * En l'absence de clé Resend — donc en développement — le message n'est pas
 * perdu : il est écrit dans la console avec son contenu texte. C'est ce qui
 * permet de dérouler tout le parcours de connexion sans configurer de service
 * externe, et de voir immédiatement ce que reçoit réellement l'utilisateur.
 */

export interface SendEmailOptions {
  to: string;
  subject: string;
  react: ReactElement;
  /** Repli texte, obligatoire : certains clients n'affichent pas le HTML. */
  text: string;
}

let client: Resend | undefined;

function getClient(): Resend | undefined {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return undefined;
  }
  client ??= new Resend(apiKey);
  return client;
}

export async function sendEmail({
  to,
  subject,
  react,
  text,
}: SendEmailOptions): Promise<void> {
  const resend = getClient();
  const from = process.env.EMAIL_FROM ?? "LéoClean <bonjour@leoclean.fr>";

  if (!resend) {
    // Pas de `catch` silencieux ici : l'absence de clé est un mode de
    // fonctionnement assumé en développement, pas une erreur avalée.
    console.info(
      [
        "",
        "─".repeat(72),
        `Email non envoyé (RESEND_API_KEY absente) — destinataire : ${to}`,
        `Objet : ${subject}`,
        "─".repeat(72),
        text,
        "─".repeat(72),
        "",
      ].join("\n"),
    );
    return;
  }

  const html = await render(react);
  const result = await resend.emails.send({ from, to, subject, html, text });

  if (result.error) {
    throw new Error(
      `Échec de l'envoi de l'email « ${subject} » à ${to} : ${result.error.message}`,
    );
  }
}
