import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { IntentionPageView } from "@/components/intention-page";
import {
  fillTemplate,
  getIntentionPage,
  intentionPages,
} from "@/lib/intentions";
import { pageMetadata } from "@/lib/seo/metadata";

/**
 * « Femme de ménage à <commune> ».
 *
 * Intention distincte de `/menage-a-domicile/<commune>` : celle-ci cherche une
 * prestation à acheter, celle-là cherche d'abord à comprendre qui emploie qui.
 * Publiée sur six communes seulement — voir `lib/intentions.ts`.
 */

const INTENTION = "femme-de-menage";

export function generateStaticParams() {
  return intentionPages(INTENTION).map(({ commune }) => ({
    commune: commune.slug,
  }));
}

export const revalidate = 86_400;
export const dynamicParams = false;

export async function generateMetadata({
  params,
}: PageProps<"/femme-de-menage/[commune]">): Promise<Metadata> {
  const { commune: slug } = await params;
  const page = getIntentionPage(INTENTION, slug);

  if (!page) {
    return {};
  }

  const path = `/${INTENTION}/${page.commune.slug}`;
  const title = fillTemplate(page.intention.titleTemplate, page.commune.name);
  const description = fillTemplate(
    page.intention.descriptionTemplate,
    page.commune.name,
  );

  return pageMetadata({
    path,
    title,
    description,
    openGraphDescription: page.local.text,
    // La carte est celle de la commune : voir `opengraph-image.tsx` à côté.
    hasOwnOpenGraphImage: true,
  });
}

export default async function FemmeDeMenagePage({
  params,
}: PageProps<"/femme-de-menage/[commune]">) {
  const { commune: slug } = await params;
  const page = getIntentionPage(INTENTION, slug);

  if (!page) {
    notFound();
  }

  return <IntentionPageView page={page} />;
}
