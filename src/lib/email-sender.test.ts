import { describe, expect, it } from "vitest";

import {
  DEFAULT_EMAIL_SENDER,
  addressOfSender,
  isEmailSender,
} from "@/lib/email-sender";

describe("expéditeur des emails", () => {
  it("accepte une adresse seule", () => {
    expect(addressOfSender("menage@leoclean.fr")).toBe("menage@leoclean.fr");
  });

  it("accepte un nom affiché suivi de l'adresse", () => {
    expect(addressOfSender("Léo Clean <menage@leoclean.fr>")).toBe(
      "menage@leoclean.fr",
    );
    expect(addressOfSender("  Léo Clean  < menage@leoclean.fr >  ")).toBe(
      "menage@leoclean.fr",
    );
  });

  it("accepte sa propre valeur par défaut", () => {
    // C'était le défaut : `email.ts` employait une valeur que le schéma de
    // `env.ts` refusait, et cela ne se voyait qu'au démarrage.
    expect(isEmailSender(DEFAULT_EMAIL_SENDER)).toBe(true);
  });

  it("refuse ce qui n'est pas un expéditeur", () => {
    expect(isEmailSender("")).toBe(false);
    expect(isEmailSender("Léo Clean")).toBe(false);
    expect(isEmailSender("Léo Clean <pas-une-adresse>")).toBe(false);
    expect(isEmailSender("<>")).toBe(false);
    expect(isEmailSender("a@b.fr, c@d.fr")).toBe(false);
  });
});
