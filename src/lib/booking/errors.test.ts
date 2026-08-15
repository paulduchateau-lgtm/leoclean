import { describe, expect, it } from "vitest";

import {
  DEADLOCK_CODE,
  EXCLUSION_VIOLATION_CODE,
  isConcurrentSlotWrite,
  isExclusionViolation,
} from "@/lib/booking/errors";

/**
 * Reconnaissance des refus de la base.
 *
 * Ce n'est pas une subtilité : c'est ce qui décide si le client lit « ce
 * créneau vient d'être réservé » ou « une erreur est survenue ». Le code natif
 * a changé de place à chaque version de Prisma, d'où des formes multiples,
 * toutes rencontrées pour de vrai.
 */

/** Forme rendue par Prisma 7 avec l'adaptateur `pg` : le code est enfoui. */
const prisma7 = (code: string) => ({
  name: "PrismaClientKnownRequestError",
  code: "P2039",
  message: "\nInvalid `tx.assignment.create()` invocation\nDatabase error. ",
  meta: {
    modelName: "Assignment",
    driverAdapterError: {
      name: "DriverAdapterError",
      message: "deadlock detected",
      cause: { kind: "postgres", code, originalCode: code },
    },
  },
});

describe("refus de la base sur un créneau", () => {
  it("reconnaît la contrainte d'exclusion, où que le code se trouve", () => {
    expect(isExclusionViolation({ code: EXCLUSION_VIOLATION_CODE })).toBe(true);
    expect(
      isExclusionViolation({ meta: { code: EXCLUSION_VIOLATION_CODE } }),
    ).toBe(true);
    expect(
      isExclusionViolation({
        message: `violation de contrainte ${EXCLUSION_VIOLATION_CODE}`,
      }),
    ).toBe(true);
    expect(isExclusionViolation(prisma7(EXCLUSION_VIOLATION_CODE))).toBe(true);
  });

  it("reconnaît l'interblocage, que la version précédente laissait passer", () => {
    // C'est le cas réellement observé sous deux réservations simultanées : la
    // base sacrifie une transaction avec 40P01, et non 23P01.
    expect(isConcurrentSlotWrite(prisma7(DEADLOCK_CODE))).toBe(true);
    expect(isConcurrentSlotWrite({ code: DEADLOCK_CODE })).toBe(true);
    // L'interblocage n'est pas une violation d'exclusion pour autant.
    expect(isExclusionViolation(prisma7(DEADLOCK_CODE))).toBe(false);
  });

  it("ne confond pas un refus de créneau avec une autre panne", () => {
    expect(isConcurrentSlotWrite(new Error("connexion perdue"))).toBe(false);
    expect(isConcurrentSlotWrite({ code: "23505" })).toBe(false);
    expect(isConcurrentSlotWrite(null)).toBe(false);
    expect(isConcurrentSlotWrite(undefined)).toBe(false);
    expect(isConcurrentSlotWrite("23P01")).toBe(false);
  });

  it("ne boucle pas sur une erreur qui se référence elle-même", () => {
    const looping: Record<string, unknown> = { code: "P2039" };
    looping.cause = looping;
    expect(isConcurrentSlotWrite(looping)).toBe(false);
  });
});
