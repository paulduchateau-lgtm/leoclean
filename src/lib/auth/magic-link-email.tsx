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
      <Preview>Votre lien de connexion à Léo Clean</Preview>
      <Body style={body}>
        <Container style={container}>
          <Heading style={heading}>Léo Clean</Heading>

          <Text style={text}>Bonjour,</Text>
          <Text style={text}>
            Voici votre lien de connexion à Léo Clean. Il est valable{" "}
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
 * feuilles de style externes, et Gmail supprime les balises `<style>`. Les
 * valeurs sont donc recopiées du design system plutôt que référencées — c'est
 * la seule surface du produit où la règle ne peut pas s'appliquer.
 */
const body = {
  /* ink-50 */
  backgroundColor: "#f4f8f6",
  fontFamily:
    "Figtree, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
  margin: 0,
  padding: "32px 0",
};

const container = {
  backgroundColor: "#ffffff",
  /* ink-100 */
  border: "1px solid #eaf0ed",
  /* r-l */
  borderRadius: "20px",
  margin: "0 auto",
  maxWidth: "480px",
  padding: "32px",
};

const heading = {
  /* ink-900 */
  color: "#16261f",
  fontSize: "24px",
  fontWeight: 900,
  letterSpacing: "-0.02em",
  margin: "0 0 24px",
};

const text = {
  /* ink-800 */
  color: "#23352f",
  fontSize: "16px",
  lineHeight: "26px",
  margin: "0 0 12px",
};

/* Mangue pleine et texte encre : le bouton primaire du système, en pilule. */
const button = {
  /* mango-400 */
  backgroundColor: "#ff8243",
  borderRadius: "999px",
  /* ink-900 */
  color: "#16261f",
  display: "inline-block",
  fontSize: "16px",
  fontWeight: 700,
  padding: "15px 24px",
  textDecoration: "none",
};

const muted = {
  /* ink-500 */
  color: "#74857e",
  fontSize: "13px",
  lineHeight: "20px",
  margin: "0 0 8px",
};

const link = {
  /* teal-600 */
  color: "#057c7c",
  fontSize: "13px",
  lineHeight: "20px",
  margin: "0 0 8px",
  wordBreak: "break-all" as const,
};

const rule = {
  /* ink-100 */
  borderColor: "#eaf0ed",
  margin: "28px 0 16px",
};
