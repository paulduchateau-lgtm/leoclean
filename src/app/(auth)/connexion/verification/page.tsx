import { MailCheckIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Vérifiez votre boîte mail",
  robots: { index: false, follow: false },
};

export default function VerifyRequestPage() {
  return (
    <div className="text-center">
      <MailCheckIcon className="mx-auto mb-4 size-9 text-brand" aria-hidden />
      <h1 className="text-2xl font-black tracking-tight">
        Vérifiez votre boîte mail
      </h1>
      <p className="mt-3 text-sm text-muted-foreground">
        Nous venons de vous envoyer un lien de connexion. Il est valable 15
        minutes et ne fonctionne qu&apos;une seule fois.
      </p>
      <p className="mt-6 text-sm text-muted-foreground">
        Rien reçu ? Pensez à regarder dans vos indésirables, puis{" "}
        <Link href="/connexion" className="text-brand underline">
          demandez un nouveau lien
        </Link>
        .
      </p>
    </div>
  );
}
