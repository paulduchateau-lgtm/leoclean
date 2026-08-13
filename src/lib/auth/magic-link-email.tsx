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

/**
 * Email de connexion par lien magique.
 *
 * Le registre est celui du reste du produit : local, direct, sans jargon. On
 * dit explicitement d'où vient le message et combien de temps le lien reste
 * valable — c'est ce qui distingue un email de connexion légitime d'une
 * tentative d'hameçonnage aux yeux du destinataire.
 */
export interface MagicLinkEmailProps {
  url: string;
  expiresInMinutes: number;
  /** Hôte affiché à l'utilisateur, pour qu'il reconnaisse le service. */
  host: string;
}

export function MagicLinkEmail({
  url,
  expiresInMinutes,
  host,
}: MagicLinkEmailProps) {
  return (
    <Html lang="fr">
      <Head />
      <Preview>Votre lien de connexion à LéoClean</Preview>
      <Body style={body}>
        <Container style={container}>
          <Heading style={heading}>LéoClean</Heading>

          <Text style={text}>Bonjour,</Text>
          <Text style={text}>
            Voici votre lien de connexion à LéoClean. Il est valable{" "}
            {expiresInMinutes} minutes et ne fonctionne qu&apos;une fois.
          </Text>

          <Section style={{ margin: "32px 0" }}>
            <Button style={button} href={url}>
              Me connecter
            </Button>
          </Section>

          <Text style={muted}>
            Si le bouton ne fonctionne pas, copiez cette adresse dans votre
            navigateur :
          </Text>
          <Text style={link}>{url}</Text>

          <Hr style={rule} />

          <Text style={muted}>
            Vous recevez cet email parce qu&apos;une connexion a été demandée
            sur {host}. Si ce n&apos;était pas vous, ignorez ce message : sans
            ce lien, personne ne peut accéder à votre compte.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

/**
 * Les styles sont en ligne : les clients de messagerie ignorent largement les
 * feuilles de style externes, et Gmail supprime les balises `<style>`.
 */
const body = {
  backgroundColor: "#f6f4ee",
  fontFamily:
    "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
  margin: 0,
  padding: "32px 0",
};

const container = {
  backgroundColor: "#ffffff",
  border: "1px solid #e6e1d6",
  borderRadius: "14px",
  margin: "0 auto",
  maxWidth: "480px",
  padding: "32px",
};

const heading = {
  color: "#1f5c4a",
  fontSize: "24px",
  fontWeight: 700,
  margin: "0 0 24px",
};

const text = {
  color: "#26302c",
  fontSize: "16px",
  lineHeight: "24px",
  margin: "0 0 12px",
};

const button = {
  backgroundColor: "#1f5c4a",
  borderRadius: "12px",
  color: "#ffffff",
  display: "inline-block",
  fontSize: "16px",
  fontWeight: 600,
  padding: "14px 24px",
  textDecoration: "none",
};

const muted = {
  color: "#6b736e",
  fontSize: "13px",
  lineHeight: "20px",
  margin: "0 0 8px",
};

const link = {
  color: "#1f5c4a",
  fontSize: "13px",
  lineHeight: "20px",
  margin: "0 0 8px",
  wordBreak: "break-all" as const,
};

const rule = {
  borderColor: "#e6e1d6",
  margin: "28px 0 16px",
};
