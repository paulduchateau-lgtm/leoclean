import { PrismaAdapter } from "@auth/prisma-adapter";
import type { Membership } from "@prisma/client";
import NextAuth, { type NextAuthConfig } from "next-auth";
import Google from "next-auth/providers/google";
import Resend from "next-auth/providers/resend";

import { prisma } from "@/lib/db";
import { sendEmail } from "@/lib/email";
import { DEFAULT_EMAIL_SENDER } from "@/lib/email-sender";

import { MagicLinkEmail } from "./magic-link-email";

/**
 * Authentification.
 *
 * Deux moyens de se connecter : un lien envoyé par email, et Google. Aucun mot
 * de passe — il n'y en a donc aucun à fuir, à réinitialiser, ni à stocker.
 *
 * Les sessions sont conservées en base plutôt que dans un jeton signé : une
 * session doit pouvoir être révoquée immédiatement, par exemple lorsqu'un
 * intervenant est suspendu ou qu'un compte est supprimé au titre du RGPD.
 */

/** Durée de validité d'un lien de connexion. */
const MAGIC_LINK_MINUTES = 15;

export interface SessionMembership {
  organizationId: string;
  organizationSlug: string;
  organizationName: string;
  role: Membership["role"];
}

export const authConfig: NextAuthConfig = {
  adapter: PrismaAdapter(prisma),

  session: {
    strategy: "database",
    // Trente jours : un client qui réserve un ménage par mois ne doit pas
    // avoir à se reconnecter à chaque fois.
    maxAge: 30 * 24 * 60 * 60,
  },

  pages: {
    signIn: "/connexion",
    verifyRequest: "/connexion/verification",
    error: "/connexion/erreur",
  },

  providers: [
    Resend({
      // `sendVerificationRequest` remplace intégralement l'envoi par défaut :
      // le message part par notre couche email, avec notre gabarit React Email
      // et le repli console lorsque aucune clé n'est configurée.
      apiKey: process.env.RESEND_API_KEY,
      from: process.env.EMAIL_FROM ?? DEFAULT_EMAIL_SENDER,
      maxAge: MAGIC_LINK_MINUTES * 60,

      async sendVerificationRequest({ identifier, url }) {
        const host = new URL(url).host;
        await sendEmail({
          to: identifier,
          subject: "Votre lien de connexion à Léo Clean",
          react: MagicLinkEmail({
            url,
            expiresInMinutes: MAGIC_LINK_MINUTES,
            host,
          }),
          text: [
            "Bonjour,",
            "",
            `Voici votre lien de connexion à Léo Clean. Il est valable ${MAGIC_LINK_MINUTES} minutes et ne fonctionne qu'une fois.`,
            "",
            url,
            "",
            `Vous recevez cet email parce qu'une connexion a été demandée sur ${host}.`,
            "Si ce n'était pas vous, ignorez ce message.",
          ].join("\n"),
        });
      },
    }),

    // Le fournisseur Google n'est déclaré que s'il est configuré : sans cela,
    // Auth.js échoue au démarrage en développement.
    ...(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET
      ? [
          Google({
            clientId: process.env.AUTH_GOOGLE_ID,
            clientSecret: process.env.AUTH_GOOGLE_SECRET,
            allowDangerousEmailAccountLinking: true,
          }),
        ]
      : []),
  ],

  callbacks: {
    /**
     * La session transporte les appartenances de l'utilisateur.
     *
     * Elles servent à l'affichage — quelle organisation, quel menu — et à un
     * premier filtrage. Elles ne font jamais autorité : toute lecture de
     * donnée métier revérifie l'appartenance côté serveur, parce qu'une
     * session peut avoir été émise avant qu'un rôle ne change.
     */
    async session({ session, user }) {
      const memberships = await prisma.membership.findMany({
        where: { userId: user.id, status: "ACTIVE" },
        select: {
          organizationId: true,
          role: true,
          organization: { select: { slug: true, name: true } },
        },
        orderBy: { createdAt: "asc" },
      });

      session.user.id = user.id;
      session.user.memberships = memberships.map((membership) => ({
        organizationId: membership.organizationId,
        organizationSlug: membership.organization.slug,
        organizationName: membership.organization.name,
        role: membership.role,
      }));

      return session;
    },
  },

  events: {
    /**
     * Une adresse email inconnue crée un compte, mais aucune appartenance :
     * un compte sans organisation ne voit rien. Le rattachement se fait
     * explicitement, à la première réservation ou par invitation.
     */
    async createUser({ user }) {
      if (user.id) {
        await prisma.auditLog.create({
          data: {
            actorUserId: user.id,
            action: "user.created",
            entityType: "User",
            entityId: user.id,
          },
        });
      }
    },
  },

  trustHost: true,
};

export const { handlers, auth, signIn, signOut } = NextAuth(authConfig);
