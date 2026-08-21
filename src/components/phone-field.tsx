"use client";

import { useState } from "react";

import { Input } from "@/components/ui/input";
import { diagnosticPhone, formatFrenchPhoneAsTyped } from "@/lib/phone";

/**
 * Le champ téléphone, avec sa mise en forme et sa vérification.
 *
 * Six formulaires du dépôt demandent un numéro — rappel, candidature, liste
 * d'attente, inscription intervenant, informations du compte, tunnel. Recopier
 * la même règle six fois, c'est se donner six occasions de la voir diverger, et
 * c'est exactement ce que le dépôt refuse partout ailleurs pour les prix et les
 * durées. La règle vit donc ici, une fois.
 *
 * **Trois comportements, tous destinés à ne pas se battre avec la personne :**
 *
 * - les espaces se posent à la frappe, par paires, forme partielle comprise ;
 * - **on ne reformate que si le curseur est en fin de champ.** Réécrire la
 *   valeur d'un champ contrôlé y replace le curseur à la fin : quelqu'un qui
 *   corrige le troisième chiffre le verrait sauter au bout à chaque touche, et
 *   ne pourrait plus corriger du tout ;
 * - l'erreur n'apparaît **qu'une fois le champ quitté**, puis à chaque frappe.
 *   Reprocher trois chiffres à qui en a tapé trois est hostile ; ne rien dire
 *   avant l'envoi lui fait découvrir la faute après avoir tout rempli.
 *
 * Il fonctionne **contrôlé ou non**, parce que les six formulaires ne se
 * ressemblent pas : ceux qui passent par une server action sont pilotés par
 * leur attribut `name`, le tunnel garde sa valeur dans son propre état pour la
 * porter jusqu'au récapitulatif.
 *
 * `serverError` reste affiché tant que le champ n'a pas été retouché : une
 * erreur remontée par le serveur ne doit pas disparaître au premier clic dans
 * le champ, avant même qu'on ait corrigé quoi que ce soit.
 */
export function PhoneField({
  id,
  name,
  value,
  defaultValue,
  onValueChange,
  serverError = null,
  className,
  errorClassName = "text-sm text-destructive",
  ...rest
}: {
  id: string;
  name?: string;
  /** Fournie, le champ est contrôlé par l'appelant. */
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  /** Erreur rendue par une server action, le cas échéant. */
  serverError?: string | null;
  className?: string;
  errorClassName?: string;
} & Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  "id" | "name" | "value" | "defaultValue" | "onChange" | "type" | "className"
>) {
  const [interne, setInterne] = useState(defaultValue ?? "");
  const [touche, setTouche] = useState(false);

  const controle = value !== undefined;
  const courant = controle ? value : interne;

  const erreurClient = touche ? diagnosticPhone(courant) : null;
  const erreur = erreurClient ?? (touche ? null : serverError);
  const idErreur = `${id}-erreur`;

  return (
    <>
      <Input
        {...rest}
        id={id}
        name={name}
        type="tel"
        inputMode="tel"
        autoComplete="tel"
        value={courant}
        onChange={(event) => {
          const champ = event.target;
          /*
           * `selectionStart` vaut `null` sur certains navigateurs pour un
           * `type="tel"` : on considère alors qu'on est en fin de champ, ce qui
           * est le cas courant — on tape son numéro d'une traite.
           */
          const enFin =
            champ.selectionStart === null ||
            champ.selectionStart === champ.value.length;
          const suivant = enFin
            ? formatFrenchPhoneAsTyped(champ.value)
            : champ.value;

          if (!controle) setInterne(suivant);
          onValueChange?.(suivant);
        }}
        onBlur={() => setTouche(true)}
        aria-invalid={erreur !== null ? true : undefined}
        aria-describedby={erreur !== null ? idErreur : undefined}
        className={className}
      />
      {erreur !== null && (
        <p id={idErreur} role="alert" className={errorClassName}>
          {erreur}
        </p>
      )}
    </>
  );
}
