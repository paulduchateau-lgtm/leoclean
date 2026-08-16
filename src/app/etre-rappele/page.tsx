import type { Metadata } from "next";

import { LeadForm } from "@/components/lead-form";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { ContactChannels } from "@/components/contact-channels";
import { formatHourlyRate } from "@/lib/pricing";
import { PUBLIC_RATES } from "@/lib/pricing/public-grid";
import {
  breadcrumbJsonLd,
  organizationJsonLd,
  serializeJsonLd,
} from "@/lib/seo/json-ld";
import { COMMUNES } from "@/lib/territory";

export const metadata: Metadata = {
  title: "Être rappelé",
  description:
    "Laissez votre numéro, nous vous rappelons dans la journée pour organiser votre ménage à domicile au sud de Bordeaux.",
  alternates: { canonical: "/etre-rappele" },
};

export default function EtreRappelePage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: serializeJsonLd([
            organizationJsonLd(),
            breadcrumbJsonLd([
              { name: "Accueil", path: "/" },
              { name: "Être rappelé", path: "/etre-rappele" },
            ]),
          ]),
        }}
      />

      <SiteHeader />

      <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-12">
        <h1 className="text-3xl font-black tracking-tight sm:text-4xl">
          Être rappelé
        </h1>
        <p className="mt-4 max-w-prose text-lg text-pretty text-muted-foreground">
          Laissez votre numéro : nous vous rappelons dans la journée pour
          comprendre votre besoin et vous proposer un créneau. À partir de{" "}
          {formatHourlyRate(PUBLIC_RATES[0]!.hourlyRateCents)}, dans{" "}
          {COMMUNES.length} communes du sud de Bordeaux.
        </p>

        <div className="mt-10">
          <LeadForm sourcePath="/etre-rappele" />
        </div>

        <div className="mt-12 border-t border-border pt-8">
          <p className="mb-5 text-center text-sm text-muted-foreground">
            Vous préférez nous joindre directement ?
          </p>
          <ContactChannels />
        </div>
      </main>

      <SiteFooter />
    </>
  );
}
