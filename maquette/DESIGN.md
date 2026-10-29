# CRM mixo — maquette validée et cahier de design

Maquette validée par Nathan (Le Mixologue) et Jeremy. Ce dossier est la **référence visuelle et fonctionnelle** du site du CRM. Le site doit la reproduire fidèlement, puis la brancher sur la vraie base.

## Contenu du dossier

| Fichier | Écran |
|---|---|
| `ecrans/1-ta-matinee.dc.html` | Accueil « Ta matinée » : chiffres du jour, brouillons à valider, réponses, brief de Claude |
| `ecrans/2-prospects.dc.html` | Liste des boutiques : recherche, filtres pays et statut, cartes, carte « bloquée » |
| `ecrans/3-fiche-boutique.dc.html` | Fiche d'une boutique : infos trouvées, sources, historique, résumé, prochaine action, note rapide |
| `ecrans/4-envoi.dc.html` | Validation et envoi : liste à cocher, aperçu de l'e-mail texte, barre d'envoi |
| `ecrans/5-mobile.dc.html` | Version téléphone de l'accueil, avec barre de navigation en bas |
| `assets/mixo-logo-blanc.png` | Logo officiel Le Mixologue (blanc, à afficher tel quel sur fond sombre) |

Les fichiers `.dc.html` sont des maquettes au format « Design Component » : du HTML avec styles en ligne, plus un bloc `<script type="text/x-dc">` qui contient les **données d'exemple** et la logique d'interface (filtres, sélection). Lis-les comme une référence. Ne réutilise pas le format tel quel dans le site : reproduis le rendu avec la pile technique du projet.

Les boutiques, chiffres, adresses et scores des maquettes sont des **exemples**. Dans le site, tout vient de la base Supabase.

## Identité visuelle

### Couleurs
| Rôle | Valeur |
|---|---|
| Fond de page | `#1A1A1A` |
| Surface (cartes) | `#2E2E2C` |
| Surface secondaire (puces, champs) | `#454542` |
| Contour | `#4A4A47` |
| Texte principal | `#F4F4F1` |
| Texte secondaire | `#A9A9A3` |
| Texte tertiaire | `#D9D9D4` |
| **Accent (vert citron)** | `#C8F56E` |
| Texte sur accent | `#141414` |
| Panneau clair (brief, résumé, aperçu e-mail) | `#EDEDE9`, texte `#141414` |

Couleurs de statut :
| Statut | Fond | Texte |
|---|---|---|
| Intéressé | `#C8F56E` | `#141414` |
| À rappeler | `#F2D46B` | `#141414` |
| Contacté / relancé / question | `#8EEAD9` | `#141414` |
| À contacter / refus | `#454542` | `#F4F4F1` |
| Bloqué / déjà client | `#3A2A29` | `#F0B3AF` |

Score en 5 pastilles, de gauche à droite : `#F0938F`, `#F2A65E`, `#F2D46B`, `#B6E35A`, `#7FD96B`. Pastille vide : `#4A4A47`. Nombre de pastilles allumées : 1 à 5 selon le score (0–100).

### Typographie (Google Fonts)
- **Titres de page** (« TA MATINÉE », « PROSPECTS », « ENVOI », nom de la boutique) : **Unbounded**, graisse 600, en capitales. Une lettre du titre en couleur d'accent (le É de MATINÉE, le O de PROSPECTS, le O d'ENVOI).
- **Tout le reste** : **Urbanist**, graisses 300 à 700.
- Échelle : titre de page 60 px (34 px sur mobile), titre de section 30 px, nom dans une carte 22 px, texte 15–16 px, étiquettes 12–13 px, gros chiffres 52 px.

### Formes et composants
- **Boutons et filtres en pilule** : hauteur 44 px, rayon complet, contour `#4A4A47`. Sélectionné : fond `#F4F4F1`, texte `#141414`.
- **Cartes** : rayon 28 px, padding 22 px, fond `#2E2E2C`. Le bouton flèche ↗ (cercle de 44 px) est posé **dans une encoche** en haut à droite de la carte : le cercle a un anneau de la couleur du fond de page autour de lui, ce qui donne l'effet découpé.
- **Carte mise en avant** : fond accent `#C8F56E`, texte foncé.
- **Puces de source** (Instagram, Annuaire…) : hauteur 28 px, fond `#454542`.
- **Panneaux clairs** (brief de Claude, résumé, aperçu d'e-mail) : rayon 32 px, fond `#EDEDE9`, blocs internes blancs de rayon 20–22 px.
- **Barre d'envoi** : collée en bas de l'écran Envoi, en pilule claire, avec le compteur, l'heure de fin estimée et le bouton accent « Envoyer la sélection ».
- **Icônes** : traits fins de 1,5 px, style ligne, jamais d'émoji.
- Mise en page en flex et grille avec `gap`. Les cartes passent en une colonne sur téléphone.

### Ton des textes
Français, tutoiement pour Nathan dans l'interface (« Ta matinée », « Relis chaque e-mail »). Phrases courtes. Aucun jargon technique visible (on dit « boutique », pas « lead » ; « réponse », pas « inbound »).

## Navigation

Barre en haut sur ordinateur : **Ta matinée · Prospects · Envois · Réponses**. Barre flottante en bas sur téléphone : quatre boutons ronds, mêmes destinations.

## Données et règles à respecter

Le site lit et écrit dans le projet Supabase `crm-mixo` (tables `boutiques`, `blocages`, `echanges`, `brouillons`, `file_claude`, `briefs`, `services_etat`, `reglages`). Voir le document « Mission : les services CRM mixo sur condor » pour la description complète des tables.

- Le site se connecte avec un **compte utilisateur Supabase** (connexion par e-mail), jamais avec la clé `service_role`. Seule la clé publique (`anon` / publishable) est dans le code du site.
- Le site **ne contient aucune IA et aucun mot de passe de messagerie**. Pour toute action intelligente (compléter une fiche, réécrire un e-mail, enregistrer une note), il insère une ligne dans `file_claude` et affiche l'état « en cours » jusqu'au résultat.
- Le bouton « Envoyer la sélection » passe les brouillons cochés de `a_valider` à `valide`. Ce sont les services de condor qui envoient réellement.
- Une boutique `bloque` s'affiche avec la carte « bloquée » (cadenas, raison) et n'a jamais de bouton d'envoi.
- Un indicateur discret affiche l'état des services de condor à partir de `services_etat` (vert si vu il y a moins de 2 minutes, sinon alerte).
- Un interrupteur « Mettre les envois en pause » modifie `reglages.envoi_pause`.
