import type { Role } from "@prisma/client";
import { describe, expect, it } from "vitest";

import { PERMISSIONS, ROLE_PERMISSIONS, can, canAll } from "./permissions";

const ALL_ROLES: Role[] = [
  "CLIENT",
  "CLEANER",
  "ORG_MANAGER",
  "ORG_OWNER",
  "PLATFORM_ADMIN",
];

describe("cohérence du modèle d'autorisation", () => {
  it("attribue des capacités à chaque rôle", () => {
    for (const role of ALL_ROLES) {
      expect(ROLE_PERMISSIONS[role].length).toBeGreaterThan(0);
    }
  });

  it("n'accorde que des capacités déclarées", () => {
    for (const role of ALL_ROLES) {
      for (const permission of ROLE_PERMISSIONS[role]) {
        expect(PERMISSIONS).toContain(permission);
      }
    }
  });

  it("ne déclare pas de capacité inutilisée", () => {
    const granted = new Set(
      ALL_ROLES.flatMap((role) => ROLE_PERMISSIONS[role]),
    );
    const orphans = PERMISSIONS.filter(
      (permission) => !granted.has(permission),
    );

    expect(
      orphans,
      `Capacités que personne ne détient : ${orphans.join(", ")}`,
    ).toEqual([]);
  });
});

describe("cloisonnement des rôles", () => {
  it("interdit au client de voir les réservations des autres", () => {
    expect(can("CLIENT", "booking:read:own")).toBe(true);
    expect(can("CLIENT", "booking:read:all")).toBe(false);
  });

  it("interdit à l'intervenant de lire le carnet de clients", () => {
    // Un intervenant n'est pas « au-dessus » d'un client : il voit ses
    // missions, pas l'activité de l'organisation.
    expect(can("CLEANER", "assignment:read:own")).toBe(true);
    expect(can("CLEANER", "booking:read:all")).toBe(false);
    expect(can("CLEANER", "analytics:read")).toBe(false);
    expect(can("CLEANER", "catalog:manage")).toBe(false);
  });

  it("laisse l'intervenant maître de ses disponibilités", () => {
    // Aucun autre rôle ne peut imposer un créneau : l'intervenant est
    // indépendant, et le produit ne doit pas créer de lien de subordination.
    expect(can("CLEANER", "availability:manage:own")).toBe(true);
    for (const role of [
      "ORG_MANAGER",
      "ORG_OWNER",
      "PLATFORM_ADMIN",
    ] as const) {
      expect(can(role, "availability:manage:own")).toBe(false);
    }
  });

  it("réserve la gestion des membres et la facturation au propriétaire", () => {
    expect(can("ORG_MANAGER", "org:members:manage")).toBe(false);
    expect(can("ORG_MANAGER", "payment:refund")).toBe(false);
    expect(can("ORG_OWNER", "org:members:manage")).toBe(true);
    expect(can("ORG_OWNER", "payment:refund")).toBe(true);
  });

  it("permet au gestionnaire de tenir le planning et le catalogue", () => {
    expect(
      canAll("ORG_MANAGER", [
        "catalog:manage",
        "booking:read:all",
        "assignment:manage",
        "cleaner:verify",
      ]),
    ).toBe(true);
  });
});

describe("administration de la plateforme", () => {
  it("n'accorde le franchissement d'organisation qu'à l'administrateur", () => {
    expect(can("PLATFORM_ADMIN", "platform:admin")).toBe(true);
    for (const role of [
      "CLIENT",
      "CLEANER",
      "ORG_MANAGER",
      "ORG_OWNER",
    ] as const) {
      expect(can(role, "platform:admin")).toBe(false);
    }
  });

  it("n'oublie aucune capacité du propriétaire", () => {
    // L'administrateur plateforme doit pouvoir faire tout ce que fait un
    // propriétaire, sans quoi le support serait bloqué sur des cas courants.
    expect(canAll("PLATFORM_ADMIN", ROLE_PERMISSIONS.ORG_OWNER)).toBe(true);
  });
});
