import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Section,
  Text,
} from "@react-email/components";

import type { Message } from "./messages";

/**
 * Gabarit unique des emails transactionnels.
 *
 * Un seul, pour huit messages. Le contenu vit dans `messages.ts`, qui est pur :
 * huit fichiers de gabarit auraient huit occasions de diverger sur la couleur
 * d'un bouton, et surtout huit endroits où réécrire une phrase.
 *
 * **Les couleurs sont recopiées, pas référencées.** C'est la deuxième surface
 * du dépôt dans ce cas, après `magic-link-email.tsx` et pour la même raison :
 * un client de messagerie ne lit pas de feuille de styles, et ne connaît pas
 * les variables CSS. Chaque valeur porte le nom de son jeton en commentaire.
 */

export function EmailTransactionnel({ message }: { message: Message }) {
  return (
    <Html lang="fr">
      <Head />
      <Preview>{message.apercu}</Preview>
      <Body style={body}>
        <Container style={container}>
          <Heading style={heading}>Léo Clean</Heading>

          {message.paragraphes.map((paragraphe, index) => (
            <Text key={index} style={text}>
              {paragraphe}
            </Text>
          ))}

          {message.action ? (
            <Section style={{ margin: "32px 0" }}>
              <Button style={button} href={message.action.url}>
                {message.action.libelle}
              </Button>
            </Section>
          ) : null}

          <Hr style={rule} />
          <Text style={muted}>
            Léo Clean — ménage à domicile au sud de Bordeaux.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

/* --- Styles. Les valeurs viennent du design system, recopiées faute de CSS. */

/** bg */
const body = {
  backgroundColor: "#F7F9F8",
  fontFamily:
    "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  padding: "24px 0",
};

/** ink-0 */
const container = {
  backgroundColor: "#FFFFFF",
  borderRadius: "20px",
  margin: "0 auto",
  maxWidth: "560px",
  padding: "40px",
};

/** ink-950 */
const heading = {
  color: "#0B1B16",
  fontSize: "22px",
  fontWeight: 900 as const,
  letterSpacing: "-0.01em",
  margin: "0 0 24px",
};

/** ink-800 */
const text = {
  color: "#1F3A31",
  fontSize: "15px",
  lineHeight: "24px",
  margin: "0 0 16px",
};

/** mango-400 sur ink-950 : la mangue pleine ne porte jamais de blanc. */
const button = {
  backgroundColor: "#FF8243",
  borderRadius: "999px",
  color: "#0B1B16",
  display: "inline-block",
  fontSize: "15px",
  fontWeight: 800 as const,
  padding: "14px 28px",
  textDecoration: "none",
};

/** ink-100 */
const rule = { borderColor: "#E3EBE7", margin: "32px 0 16px" };

/** ink-500 */
const muted = { color: "#6B8078", fontSize: "13px", lineHeight: "20px" };
