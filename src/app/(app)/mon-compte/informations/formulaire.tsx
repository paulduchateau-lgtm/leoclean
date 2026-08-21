"use client";

import { Loader2Icon } from "lucide-react";
import { PhoneField } from "@/components/phone-field";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import {
  enregistrerMesInformations,
  retirerMonAdresse,
} from "@/app/(app)/mon-compte/informations/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { InformationsVue } from "@/lib/compte/informations";

/**
 * Nom, téléphone, carnet d'adresses.
 *
 * Les adresses sont **listées, pas éditées** : une adresse porte des
 * coordonnées géocodées, des consignes d'accès et un code de porte chiffré, et
 * la corriger ici produirait un texte qui ne correspond plus à son point
 * géographique. Le moteur calculerait des trajets vers un endroit où personne
 * n'habite. On peut en revanche retirer celles qui n'ont jamais servi.
 */

export function Formulaire({
  informations,
}: {
  informations: InformationsVue;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [nom, setNom] = useState(informations.nom ?? "");
  const [telephone, setTelephone] = useState(informations.telephone ?? "");
  const [erreur, setErreur] = useState<string | null>(null);
  const [succes, setSucces] = useState(false);

  return (
    <div className="mt-8 space-y-10">
      <section className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="nom">Nom</Label>
          <Input
            id="nom"
            autoComplete="name"
            value={nom}
            onChange={(event) => {
              setNom(event.target.value);
              setSucces(false);
            }}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="telephone">Téléphone</Label>
          <PhoneField
            id="telephone"
            value={telephone}
            onValueChange={(valeur) => {
              setTelephone(valeur);
              setSucces(false);
            }}
          />
          <p className="text-sm text-muted-foreground">
            C&apos;est le numéro auquel votre intervenant appelle s&apos;il ne
            trouve pas l&apos;entrée. Écrivez-le comme vous voulez.
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="email">Adresse email</Label>
          <Input id="email" value={informations.email} disabled readOnly />
          {/*
           * On dit pourquoi c'est verrouillé plutôt que de laisser un champ
           * grisé sans explication : un champ qu'on ne peut pas modifier et
           * dont on ignore la raison se lit comme une panne.
           */}
          <p className="text-sm text-pretty text-muted-foreground">
            Elle identifie votre compte et reçoit vos liens de connexion.
            Appelez-nous pour la changer, nous vérifions la nouvelle avant de
            basculer.
          </p>
        </div>

        {erreur ? (
          <p role="alert" className="text-sm text-destructive">
            {erreur}
          </p>
        ) : null}
        {succes ? (
          <p role="status" className="text-sm font-semibold text-brand">
            C&apos;est enregistré.
          </p>
        ) : null}

        <Button
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              setErreur(null);
              const resultat = await enregistrerMesInformations({
                nom,
                telephone: telephone.trim() || null,
              });
              if (!resultat.ok) {
                setErreur(resultat.error);
                return;
              }
              setSucces(true);
              router.refresh();
            })
          }
        >
          {pending ? (
            <Loader2Icon className="animate-spin" aria-hidden />
          ) : null}
          Enregistrer
        </Button>
      </section>

      <section>
        <h2 className="font-heading text-lg font-extrabold">Mes adresses</h2>

        {informations.adresses.length === 0 ? (
          <p className="mt-3 text-muted-foreground">
            Aucune adresse. Vous en ajouterez une à votre prochaine réservation.
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-border border-y border-border">
            {informations.adresses.map((adresse) => (
              <li
                key={adresse.id}
                className="flex flex-wrap items-center justify-between gap-3 py-3"
              >
                <span>
                  <span className="block font-medium">
                    {adresse.libelle ?? adresse.ligne}
                  </span>
                  <span className="block text-sm text-muted-foreground">
                    {adresse.libelle ? `${adresse.ligne} · ` : ""}
                    {adresse.commune}
                  </span>
                </span>

                {adresse.utilisations === 0 ? (
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() =>
                      startTransition(async () => {
                        setErreur(null);
                        const resultat = await retirerMonAdresse({
                          addressId: adresse.id,
                        });
                        if (!resultat.ok) {
                          setErreur(resultat.error);
                          return;
                        }
                        router.refresh();
                      })
                    }
                    className="text-sm text-muted-foreground underline"
                  >
                    Retirer
                  </button>
                ) : (
                  <span className="text-sm text-muted-foreground">
                    {adresse.utilisations} intervention
                    {adresse.utilisations > 1 ? "s" : ""}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}

        <p className="mt-3 text-sm text-pretty text-muted-foreground">
          Une adresse se corrige au moment de réserver, avec ses consignes
          d&apos;accès. Celles qui ont déjà servi restent : vos factures y sont
          rattachées.
        </p>
      </section>
    </div>
  );
}
