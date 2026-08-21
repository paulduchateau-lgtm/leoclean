-- Les consignes du logement, écrites en répondant à des questions.
--
-- `Address` portait déjà pièces, animaux, matériel, zones interdites et
-- checklist par défaut — et **aucun écran client ne permettait de les
-- remplir** : seul l'écran de mission les lisait. Le modèle existait, la donnée
-- n'avait pas de porte d'entrée.
--
-- Une colonne `Json` et non une table : les réponses n'ont ni cycle de vie
-- propre, ni requête qui les cherche, ni contrainte à faire respecter par la
-- base. Une table par question aurait imposé une migration à chaque question
-- ajoutée au catalogue, ce qui est exactement ce qu'on veut éviter — le
-- questionnaire doit pouvoir bouger sans toucher au schéma.
--
-- La forme est validée à la lecture par `logement/consignes.ts`, qui ignore une
-- réponse dont la question a disparu plutôt que d'échouer : sans quoi retirer
-- une question du catalogue rendrait inaccessibles les logements qui y avaient
-- répondu.
ALTER TABLE "Address"
  ADD COLUMN "consignes" JSONB;
