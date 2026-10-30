# CRM mixo : le site

Le site de Nathan pour piloter la prospection Le Mixologue. Il reproduit la maquette validée (dossier `maquette/`) et se branche sur la base Supabase `crm-mixo`.

Il ne fait **ni IA, ni envoi d'e-mail**. Il écrit dans la base, et ce sont les services de condor (`~/crm-mixo-pi/`) qui font le travail :

| Dans le site | Dans la base | Sur condor |
|---|---|---|
| Ajouter une boutique, « Compléter avec Claude » | `boutiques`, puis une demande `enrichir` dans `file_claude` | Le veilleur cherche les infos sur le web. |
| « Préparer un e-mail », « Réécrire avec Claude » | Demande `rediger` (consigne préfixée `[premier]`, `[relance_1]`…) ou `reecrire` | Le veilleur rédige un brouillon `a_valider`. |
| « Note rapide » | Demande `note` | Le veilleur met à jour le statut et l'historique. |
| Chat avec Claude | Demande `chat` (la question dans `consigne`) | Le veilleur répond dans `resultat.reponse`. |
| « Envoyer la sélection » | `brouillons.statut` passe de `a_valider` à `valide` | Le facteur envoie, un par un, dans les plafonds de `reglages`. |
| « Mettre les envois en pause » | `reglages.envoi_pause` | Le facteur arrête d'envoyer. |
| Voyant « condor en marche » | lit `services_etat` | Les deux services y écrivent toutes les 30 s environ. |

## Écrans

| Écran | Contenu |
|---|---|
| Ta matinée | Brouillons à relire, réponses, brief du matin. |
| Prospects | Recherche, filtres par pays et statut, ajout d'une boutique. |
| Fiche boutique | Ce que Claude a trouvé et ses sources, échanges, résumé, prochaine action, note. |
| Envois | Coche, aperçu, modification, réécriture, écarter, envoi. |
| Réponses | Toutes les réponses reçues, classées par Claude. |
| Calendrier | Vue du mois : actions prévues (`prochaine_action_le`), e-mails envoyés ou en file, réponses reçues ; actions en retard. |
| Clients | Les clients bloqués (import Odoo et ancien CRM), regroupés par boutique, avec recherche. |
| Claude | Chat en conversations séparées (table `conversations`), message le plus récent en haut. Le message part dans `file_claude` (type `chat`, `conversation_id`) ; le veilleur répond, affiche des fiches en cartes et exécute les actions autorisées (statut, blocage, ajout ou correction de fiche, prochaine action, enrichissement, rédaction), vérifiées par Python. Jamais d'envoi, de validation d'e-mail, de suppression ni de déblocage d'un client. |

Sur téléphone, la navigation passe en bas de l'écran.

## Sécurité

- **Connexion.** Elle se fait par e-mail et mot de passe, avec un compte Supabase. Les tables ne sont ouvertes qu'aux comptes connectés : un visiteur sans compte n'a accès à rien.
- **Clé dans le code.** Le code ne contient que la clé **publique** (`sb_publishable_…`). La clé `service_role` reste sur condor.
- **Inscriptions.** Il faut **désactiver les inscriptions** dans Supabase (*Authentication → Sign In / Providers → Allow new users to sign up* : décoché). Sinon, n'importe qui pourrait créer un compte et voir toute la base.
- **Moteurs de recherche.** Le site est marqué `noindex` (`index.html` et `public/_headers`).
- **Validation des e-mails.** Rien n'est coché par défaut sur l'écran Envois : chaque e-mail validé est un e-mail que Nathan a choisi. La base refuse de toute façon de valider un e-mail vers une boutique bloquée, cliente ou en refus.

## Travailler sur le site

```bash
npm install
npm run dev                         # http://localhost:5173
```

- `http://localhost:5173/?demo` affiche le site avec les données d'exemple de la maquette (fichier `src/demo.js`), sans compte ni base. Ce mode n'existe qu'en développement : il est retiré du site publié.
- `npm run build` produit le site dans `dist/`.

## Mise en ligne (Cloudflare)

Workers & Pages → *Create* → *Import a repository* → `Mixo48/crm-mixo-site`, avec les commandes proposées :

| Réglage | Valeur |
|---|---|
| Build command | `npm run build` |
| Deploy command | `npx wrangler deploy` (lit `wrangler.jsonc` : publie `dist/`) |

Chaque `git push` sur `main` republie le site.

Dans Supabase, *Authentication → URL Configuration* : mettre l'adresse Cloudflare du site comme *Site URL*.

Les variables `VITE_SUPABASE_URL` et `VITE_SUPABASE_CLE` sont facultatives : par défaut, le site utilise le projet `crm-mixo`.
