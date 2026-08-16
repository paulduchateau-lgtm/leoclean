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
 * « Repassage à domicile à <commune> ».
 *
 * Prestation distincte du ménage, avec ses propres contraintes matérielles et
 * ses propres unités — une corbeille, pas des mètres carrés. Publiée sur les
 * six communes où la demande existe réellement, qui ne sont pas les mêmes que
 * pour l'intention « femme de ménage ».
 */

const INTENTION = "repassage";

export function generateStaticParams() {
  return intentionPages(INTENTION).map(({ commune }) => ({
    commune: commune.slug,
  }));
}

export const revalidate = 86_400;
export const dynamicParams = false;

export async function generateMetadata({
  params,
}: PageProps<"/repassage/[commune]">): Promise<Metadata> {
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

export default async function RepassagePage({
  params,
}: PageProps<"/repassage/[commune]">) {
  const { commune: slug } = await params;
  const page = getIntentionPage(INTENTION, slug);

  if (!page) {
    notFound();
  }

  return <IntentionPageView page={page} />;
}
