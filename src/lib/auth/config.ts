import { PrismaAdapter } from "@auth/prisma-adapter";
import type { Membership } from "@prisma/client";
import NextAuth, { type NextAuthConfig } from "next-auth";
import { encode as encodeJwtParDefaut } from "next-auth/jwt";
import Apple from "next-auth/providers/apple";
import Credentials from "next-auth/providers/credentials";
import Facebook from "next-auth/providers/facebook";
import Google from "next-auth/providers/google";
import Resend from "next-auth/providers/resend";

import { prisma } from "@/lib/db";
import { sendEmail } from "@/lib/email";
import { DEFAULT_EMAIL_SENDER } from "@/lib/email-sender";
import { exigerQuota } from "@/lib/securite/limitation";

import { verifierIdentifiants } from "./identifiants";
import { MagicLinkEmail } from "./magic-link-email";
import {
  DUREE_SESSION_SECONDES,
  creerSessionDeConnexion,
} from "./session-connexion";

/**
 * Authentification.
 *
 * Trois moyens de se connecter : un lien envoyé par email, un fournisseur
 * social, et — depuis le 20 août 2026 — un mot de passe.
 *
 * **Le mot de passe s'ajoute, il ne remplace rien.** Il est facultatif, il ne
 * se définit que depuis une session déjà ouverte, et un compte qui n'en a pas
 * continue de se connecter par lien. La raison d'origine tient toujours : un
 * mot de passe qu'on n'a pas ne peut pas fuir. Ce qu'il apporte est de ne plus
 * réclamer un aller-retour par la boîte mail à chaque connexion, ce qui compte
 * pour un intervenant qui ouvre l'application tous les matins.
 *
 * Il n'y a **aucun parcours « mot de passe oublié »**, et c'est délibéré : le
 * lien magique en tient lieu, et il est déjà à usage unique, expirant et limité
 * en débit. Un second mécanisme de récupération serait une deuxième surface à
 * sécuriser, pas un raccourci.
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
    maxAge: DUREE_SESSION_SECONDES,
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

    /*
     * Connexion par mot de passe.
     *
     * `authorize` ne dit jamais **pourquoi** il refuse : rendre `null` dans
     * tous les cas est ce qui empêche le formulaire de servir à énumérer les
     * comptes. Le message affiché est unique, et il vit dans `identifiants.ts`.
     */
    Credentials({
      id: "mot-de-passe",
      name: "Mot de passe",
      credentials: {
        email: { label: "Adresse email", type: "email" },
        password: { label: "Mot de passe", type: "password" },
      },

      async authorize(entrees) {
        const email = entrees?.email;
        const motDePasse = entrees?.password;
        if (typeof email !== "string" || typeof motDePasse !== "string") {
          return null;
        }

        /*
         * La limitation de débit est **dans `authorize`** et non dans une
         * server action : le point d'entrée réel est la route d'Auth.js, qu'un
         * script appelle directement sans passer par notre formulaire. Un
         * garde-fou posé sur l'écran ne garde rien.
         *
         * Un dépassement rend `null` comme un mot de passe faux : distinguer
         * les deux apprendrait à l'attaquant qu'il a trouvé le bon seuil.
         */
        try {
          await exigerQuota("connexion-mot-de-passe");
        } catch {
          return null;
        }

        const identite = await verifierIdentifiants(email, motDePasse);
        if (!identite) return null;

        return {
          id: identite.id,
          email: identite.email,
          name: identite.name,
        };
      },
    }),

    /*
     * Fournisseurs sociaux.
     *
     * Chacun n'est déclaré que s'il est configuré : sans cela, Auth.js échoue
     * au démarrage, et un développement fraîchement cloné ne démarrerait pas.
     * C'est aussi ce qui fait que l'écran de connexion n'affiche jamais un
     * bouton qui mènerait à une erreur.
     *
     * `allowDangerousEmailAccountLinking` rattache un compte social à un compte
     * existant portant la même adresse. Le nom de l'option dit un vrai risque —
     * un fournisseur qui certifierait mal une adresse ferait entrer chez
     * quelqu'un d'autre — mais Google, Apple et Facebook vérifient tous les
     * trois l'adresse avant de la transmettre. Sans cette option, quelqu'un qui
     * a réservé par lien magique puis revient par Google se retrouverait devant
     * un compte vide, sans ses réservations, et appellerait.
     */
    ...(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET
      ? [
          Google({
            clientId: process.env.AUTH_GOOGLE_ID,
            clientSecret: process.env.AUTH_GOOGLE_SECRET,
            allowDangerousEmailAccountLinking: true,
          }),
        ]
      : []),

    ...(process.env.AUTH_APPLE_ID && process.env.AUTH_APPLE_SECRET
      ? [
          Apple({
            clientId: process.env.AUTH_APPLE_ID,
            clientSecret: process.env.AUTH_APPLE_SECRET,
            allowDangerousEmailAccountLinking: true,
          }),
        ]
      : []),

    ...(process.env.AUTH_FACEBOOK_ID && process.env.AUTH_FACEBOOK_SECRET
      ? [
          Facebook({
            clientId: process.env.AUTH_FACEBOOK_ID,
            clientSecret: process.env.AUTH_FACEBOOK_SECRET,
            allowDangerousEmailAccountLinking: true,
          }),
        ]
      : []),
  ],

  /**
   * Sessions en base **malgré** le fournisseur par mot de passe.
   *
   * C'est le point le plus délicat de ce fichier, et il mérite d'être dit
   * plutôt que découvert : Auth.js n'écrit pas de session en base pour le
   * fournisseur `Credentials`, il bascule sur un jeton signé quelle que soit la
   * stratégie déclarée au-dessus. On intercepte donc l'encodage, et on rend le
   * jeton d'une vraie ligne `Session` à la place du JWT.
   *
   * Le raisonnement complet et la garantie qui en dépend vivent dans
   * `session-connexion.ts`, avec le test qui les tient.
   */
  jwt: {
    async encode(parametres) {
      if (parametres.token?.credentials !== true) {
        return encodeJwtParDefaut(parametres);
      }
      const userId = parametres.token.sub;
      if (!userId) throw new Error("Session sans utilisateur.");
      return creerSessionDeConnexion(userId);
    },
  },

  callbacks: {
    /**
     * Marque les connexions par mot de passe, pour `jwt.encode` ci-dessus.
     *
     * Ce rappel n'est appelé que sur le chemin du jeton signé, c'est-à-dire
     * uniquement pour le fournisseur `Credentials` : les autres passent
     * directement par l'adaptateur.
     */
    async jwt({ token, account }) {
      if (account?.provider === "mot-de-passe") {
        token.credentials = true;
      }
      return token;
    },

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
