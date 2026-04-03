# Chafer Chafer — Guide Administrateur

> Bot Discord de guilde DOFUS
> Développé par **Marpeap** de chez **Marpeap Digitals** — [marpeap.com](https://marpeap.com)

---

## Table des matières

1. [Configuration initiale](#1-configuration-initiale)
2. [Système de permissions](#2-système-de-permissions)
3. [Panneaux (interface boutons)](#3-panneaux)
4. [Inscription des membres](#4-inscription-des-membres)
5. [Activités & LFG](#5-activités--lfg)
6. [Métiers & Craft](#6-métiers--craft)
7. [Récompenses](#7-récompenses)
8. [Almanax](#8-almanax)
9. [Encyclopédie Dofus](#9-encyclopédie-dofus)
10. [Forum / Demandes](#10-forum--demandes)
11. [Classements & Résumé](#11-classements--résumé)
12. [Donjons](#12-suivi-des-donjons)
13. [Outils (XP & Chasse)](#13-outils-xp--chasse-au-trésor)
14. [Feature Flags](#14-feature-flags)
15. [Tâches automatiques (Cron)](#15-tâches-automatiques)
16. [Exports](#16-exports-csv)
17. [Commandes slash complètes](#17-liste-des-commandes-slash)

---

## 1. Configuration initiale

### Étape 1 — Poster le panneau principal

```
/panneau principal
```

Cela poste un message permanent avec tous les boutons d'interaction pour les membres. **À poster dans le salon que tous les membres voient** (ex: `#bot` ou `#commandes`).

### Étape 2 — Configurer les salons

```
/panneau config
```

Puis cliquer sur **Configurer salons**. Tu dois assigner :

| Salon | Rôle | Obligatoire ? |
|-------|------|:---:|
| **Salon des sorties** | Les activités y sont postées | Oui |
| **Salon almanax** | L'almanax quotidien y est posté chaque matin | Oui |
| **Salon métiers** | Les demandes de craft y sont postées | Oui |
| **Forum demandes** | Les demandes d'aide/questions y sont postées | Recommandé |
| **Salon logs bot** | Journal d'activité du bot | Recommandé |
| **Salon officiers** | Les demandes d'inscription y arrivent pour validation | **Obligatoire** |
| **Salon annonces** | Le résumé hebdomadaire y est posté | Recommandé |

### Étape 3 — Configurer les rôles

Dans le même panneau config, cliquer sur **Configurer rôles**. Associe chaque niveau à un rôle Discord de ton serveur :

| Niveau | Rôle à associer | Utilité |
|--------|----------------|---------|
| **Admin** | Ton rôle de chef de guilde | Accès total (config, flags, exports) |
| **Officier** | Rôle de tes bras droits | Créer sorties, valider membres, récompenses |
| **Vétéran** | Rôle de confiance (optionnel) | Pas de fonction spéciale pour l'instant |
| **Membre** | Le rôle donné à l'inscription | Attribué automatiquement à la validation |

> **Important :** Le rôle du bot "Chafer Chafer" doit être **au-dessus** de tous ces rôles dans la hiérarchie Discord (Paramètres serveur → Rôles), sinon il ne pourra pas attribuer le rôle Membre.

### Étape 4 — Vérifier les permissions Discord du bot

Le bot a besoin de ces permissions sur ton serveur :
- Envoyer des messages
- Intégrer des liens (embeds)
- Gérer les rôles
- Créer des fils (pour le forum)
- Lire l'historique des messages

---

## 2. Système de permissions

Le bot a **4 niveaux de permission**, du plus bas au plus haut :

| Niveau | Qui ? | Ce qu'il peut faire |
|--------|-------|-------------------|
| **Membre** (0) | Tout membre validé | Utiliser les boutons, s'inscrire aux sorties, métiers, etc. |
| **Vétéran** (1) | Membres de confiance | Même chose (extensible à l'avenir) |
| **Officier** (2) | Bras droits | Créer/annuler sorties, valider inscriptions, créer récompenses, voir profils |
| **Admin** (3) | Chef de guilde | Tout : configuration, feature flags, exports, notes, warns |

Le propriétaire du serveur Discord est **toujours Admin**, même sans rôle configuré.

---

## 3. Panneaux

Les panneaux sont des messages interactifs avec des boutons. Il y en a **4** :

### Panneau Principal (`/panneau principal`)
Message **public** permanent — pour tous les membres.

| Ligne | Boutons |
|-------|---------|
| Adhésion & Profil | 💀 Devenir Chafer · 👤 Mon Profil · 🪙 Mes Récompenses |
| Activités | ⚔️ Créer sortie · 👥 Chercher groupe · ⏰ Sorties à venir · 🚀 Dispo glandeur |
| Métiers & Craft | 🔨 Mon métier · 🔍 Chercher artisan · 📦 Demande craft · 💼 Ma dispo |
| Outils & Infos | 📅 Almanax · 🔍 Bonus · 📅 Semaine · 📖 Encyclopédie · 📜 Forum |

### Panneau Outils (`/panneau outils`)
Réponse **éphémère** (visible uniquement par celui qui tape la commande).

| Ligne | Boutons |
|-------|---------|
| Classements | 🏆 Top Sorties · 🏆 Top Crafts · 🏆 Top Récompenses · 🔥 Résumé guilde |
| Donjons | ✅ Donjon fait · 📖 Ma progression · 👥 Qui l'a fait ? |
| Calculateurs | ⭐ XP Perso · ⭐ XP Métier · 🗺️ Chasse au trésor |
| Almanax+ | 🔔 Mes alertes · 📅 Almanax date |

### Panneau Officier (`/panneau officier`)
Réponse **éphémère** — officiers et admins uniquement.

| Ligne | Boutons |
|-------|---------|
| Création | ⚔️ Créer sortie · 🏆 Créer récompense |
| Membres | 👥 Liste membres · 📜 Historique |
| Actions sur un membre | 👤 Profil membre · 📝 Ajouter note · ⚠️ Avertissement |

### Panneau Config (`/panneau config`)
Réponse **éphémère** — admins uniquement.

| Ligne | Boutons |
|-------|---------|
| Configuration | 📺 Salons · 👥 Rôles · 🚩 Feature flags · ✅ Ping |
| Exports | 📤 Membres · 📤 Activités · 📤 Récompenses · 📤 Audit |

---

## 4. Inscription des membres

### Flow complet

```
Utilisateur clique "Devenir Chafer"
        ↓
  Formulaire : pseudo, classe, niveau, orientation, présentation
        ↓
  Profil créé en statut "en attente"
        ↓
  Demande envoyée dans le salon officiers avec boutons Valider / Refuser
        ↓
  Un officier clique "Valider"
        ↓
  → Rôle Membre attribué automatiquement
  → DM de bienvenue envoyé au joueur
  → Le joueur peut utiliser toutes les fonctions du bot
```

**Si un officier refuse** : le joueur reçoit un DM de refus et peut re-postuler plus tard.

### Profil

Chaque membre validé a un profil avec :
- Nom de personnage
- Classe
- Niveau
- Orientation (PvM / PvP / Les deux)
- Présentation (optionnelle)
- Métiers niveau 200 (renseigné via les métiers)
- Disponibilité artisan (toggle)

Le bouton **Mon Profil** permet de consulter et modifier ses infos.

---

## 5. Activités & LFG

### Sorties (activités planifiées)

**Créer une sortie** (officier+) :
1. Cliquer sur "Créer sortie" → choisir le type (donjon, koli, songe, quête, farm, PvP, autre)
2. Remplir le formulaire : titre, date/heure, description, slots de rôles (ex: `2T,2H,4D`)
3. La sortie est postée dans le salon des sorties avec des boutons d'inscription

**S'inscrire** :
- ✅ **Présent** — confirme la participation
- 🤔 **Peut-être** — inscrit en liste d'attente
- ❌ **Indisponible** — signale qu'on ne peut pas venir
- Les joueurs peuvent préciser leur rôle (Tank, Heal, DPS)

**Gérer une sortie** (officier+) :
- `/sortie annuler <id>` — annule la sortie
- `/sortie cloturer <id>` — clôture la sortie (termine l'événement)

### LFG (Chercher groupe)

Appel rapide pour trouver du monde **maintenant** :
1. Cliquer "Chercher groupe" → choisir le type
2. Remplir un formulaire simplifié
3. Message posté avec boutons "Partant" / "Je lead" / "Pas ce soir"
4. Expire automatiquement après un certain temps

---

## 6. Métiers & Craft

### Inscrire un métier

Bouton **Mon métier** → formulaire avec nom du métier, niveau (1-200), note optionnelle.

23 métiers reconnus : Bijoutier, Bricoleur, Cordonnier, Costumier, Forgeur de Boucliers/Dagues/Épées/Haches/Marteaux/Pelles/Baguettes, Sculpteur d'Arcs/Bâtons, Tailleur, Alchimiste, Boulanger, Boucher, Poissonnier, Paysan, Bûcheron, Mineur, Pêcheur, Chasseur.

### Chercher un artisan

Bouton **Chercher artisan** → saisir le métier recherché → le bot affiche les artisans disponibles et les mentionne.

### Demande de craft

Bouton **Demande craft** → formulaire avec métier, nom de l'objet, quantité, description. La demande est postée dans le salon métiers avec des boutons pour qu'un artisan la prenne en charge.

### Disponibilité

- **Ma dispo** : toggle ta disponibilité artisan (disponible / indisponible)
- **Dispo glandeur** : indique que tu es disponible pour aider (affiché dans les recherches d'artisans)

---

## 7. Récompenses

Système de récompenses pour les membres méritants.

### Flow

```
Officier crée une récompense (titre, montant, destinataire)
        ↓
  Récompense en statut "pending"
        ↓
  Le destinataire peut la réclamer (bouton "Réclamer")
        ↓
  Statut → "claimed"
        ↓
  L'officier confirme le paiement (bouton "Payer")
        ↓
  Statut → "paid" (terminé)
```

**Statuts possibles :**
| Statut | Signification |
|--------|--------------|
| pending | Créée, en attente |
| claimable | Disponible à réclamer |
| claimed | Réclamée par le destinataire |
| paid | Payée par l'officier |
| cancelled | Annulée |

**Récompenses liées aux sorties :** Si une sortie a une récompense définie, l'officier peut la "libérer" après la sortie — cela crée automatiquement une récompense pour chaque participant confirmé.

---

## 8. Almanax

### Almanax du jour
- Bouton **Almanax** sur le panneau → affiche l'almanax du jour (bonus, offrande, quête)
- Posté **automatiquement chaque matin à 6h00** dans le salon almanax configuré

### Almanax de la semaine
- Bouton **Semaine** → les 7 prochains jours en un coup d'œil

### Recherche de bonus
- Bouton **Bonus** → saisir un type de bonus (ex: "Prospection") → le bot trouve le prochain jour avec ce bonus dans les 60 prochains jours

### Almanax à une date
- Panneau Outils → **Almanax date** → saisir une date (AAAA-MM-JJ)

### Alertes bonus
- Panneau Outils → **Mes alertes** → saisir un type de bonus
- Tu seras **mentionné** dans le message almanax du matin quand ce bonus sera actif
- Maximum 10 alertes par personne
- Cliquer à nouveau sur le même bonus = supprimer l'alerte (toggle)

---

## 9. Encyclopédie Dofus

Bouton **Encyclopédie** → saisir le nom d'un objet → le bot recherche dans l'API DofusDude et affiche :
- Image de l'objet
- Statistiques / effets
- Recette de craft (si applicable)
- Lien vers la fiche complète

Fonctionne pour : équipements, ressources, montures, consommables, objets de quête, cosmétiques, panoplies.

Aussi disponible en slash : `/dofus chercher/equip/ressource/monture/consommable/quete/cosmetique/panoplie`

---

## 10. Forum / Demandes

Bouton **Forum** → formulaire avec titre, description et tag.

**Tags disponibles :** aide, donjon, craft, koli, songes, recrutement_groupe, question, guilde

Un **fil de discussion** est automatiquement créé dans le forum Discord configuré, avec le tag correspondant. Les membres peuvent répondre directement dans le fil.

---

## 11. Classements & Résumé

Accessible via le **Panneau Outils** ou `/classement` :

| Classement | Ce qu'il mesure |
|-----------|----------------|
| **Top Sorties** | Nombre de participations confirmées aux sorties (ce mois) |
| **Top Crafts** | Nombre de crafts complétés en tant qu'artisan (ce mois) |
| **Top Récompenses** | Nombre de récompenses reçues (ce mois) |
| **Résumé guilde** | Vue d'ensemble hebdo : sorties, participants, crafts, nouveaux membres, MVP |

Le slash `/classement` permet de choisir la période : semaine, mois, trimestre, ou depuis toujours.

### Résumé hebdomadaire automatique

Chaque **dimanche à 20h00** (heure de Paris), un résumé est posté automatiquement dans le salon annonces (ou sorties en fallback). Il est ignoré si aucune activité n'a eu lieu dans la semaine.

---

## 12. Suivi des donjons

Permet à chaque membre de tracker sa progression sur les **55+ donjons** de Dofus.

| Bouton / Commande | Action |
|-------------------|--------|
| **Donjon fait** | Marquer un donjon comme complété |
| **Ma progression** | Voir ta checklist avec barre de progression par catégorie |
| **Qui l'a fait ?** | Voir qui dans la guilde a fait un donjon précis |

Catégories : Incarnam, Astrub, Amakna, Wabbit, Pandala, Otomaï, Moon, Frigost, Dimensions, Endgame.

La commande slash `/donjon fait <nom>` a l'**autocomplétion** des noms de donjons (plus pratique que le bouton pour les noms exacts).

---

## 13. Outils (XP & Chasse au trésor)

### Calculateur XP

- **XP Perso** : calcule l'XP nécessaire entre deux niveaux personnage (1-200)
- **XP Métier** : calcule l'XP nécessaire entre deux niveaux métier (1-200) + estimation du nombre de crafts

### Chasse au trésor

- Saisir la **position (X, Y)** et la **direction** (haut/bas/gauche/droite)
- Le bot interroge dofus-map.com et affiche les **indices les plus proches**, triés par distance

---

## 14. Feature Flags

Chaque module peut être **activé/désactivé** par guilde via le panneau config → **Feature flags**.

| Flag | Module contrôlé |
|------|----------------|
| `members_enabled` | Inscription des membres |
| `scheduled_activities_enabled` | Sorties planifiées |
| `quick_calls_enabled` | Appels rapides (LFG) |
| `almanax_daily_enabled` | Almanax quotidien |
| `encyclopedia_enabled` | Encyclopédie Dofus |
| `professions_enabled` | Métiers & Craft |
| `rewards_enabled` | Récompenses |
| `forum_requests_enabled` | Forum / Demandes |

Par défaut, **tous les modules sont activés**. Désactiver un flag empêche l'utilisation des boutons ET des commandes slash correspondantes.

---

## 15. Tâches automatiques

| Tâche | Fréquence | Action |
|-------|-----------|--------|
| **Almanax quotidien** | Chaque jour à 6h00 | Poste l'almanax + mentionne les alertes bonus |
| **Résumé hebdomadaire** | Dimanche à 20h00 | Poste le résumé de la semaine |
| **Vérification rappels** | Toutes les 5 min | Envoie les rappels de sorties à venir |
| **Expiration LFG** | Toutes les 10 min | Expire les appels rapides trop anciens |
| **Nettoyage recherches** | Toutes les 10 min | Nettoie le cache des recherches |
| **Reset disponibilité** | Toutes les 3h | Réinitialise les disponibilités expirées |

Toutes les heures sont en fuseau **Europe/Paris**.

---

## 16. Exports CSV

Disponibles via le panneau config (admin uniquement) :

| Export | Contenu | Période |
|--------|---------|---------|
| **Membres** | Tous les membres approuvés (pseudo, classe, niveau, etc.) | Tout |
| **Activités** | Toutes les sorties avec nombre d'inscrits | 30 derniers jours |
| **Récompenses** | Toutes les récompenses avec statut | Tout |
| **Audit** | Journal d'audit (qui a fait quoi) | 7 derniers jours |

Les fichiers sont en CSV avec séparateur `;` (compatible Excel FR direct).

---

## 17. Liste des commandes slash

### Commandes pour tous les membres

| Commande | Description |
|----------|------------|
| `/almanax today` | Almanax du jour |
| `/almanax date <date>` | Almanax à une date (AAAA-MM-JJ) |
| `/almanax bonus <type>` | Prochain bonus de ce type |
| `/almanax semaine` | Almanax des 7 prochains jours |
| `/almanax alerte <type>` | S'abonner/se désabonner d'un bonus |
| `/dofus chercher <nom>` | Rechercher un objet |
| `/dofus equip/ressource/monture/...` | Recherche par catégorie |
| `/lfg` | Chercher un groupe |
| `/metier inscrire` | Inscrire un métier |
| `/metier chercher <profession>` | Chercher un artisan |
| `/metier dispo` | Toggle disponibilité |
| `/metier liste` | Lister tes métiers |
| `/craft demande` | Demander un craft |
| `/recompense liste` | Voir tes récompenses |
| `/demande creer` | Créer une demande forum |
| `/classement activites/crafts/recompenses` | Classements (+ option période) |
| `/classement resume` | Résumé hebdomadaire |
| `/donjon fait <nom>` | Marquer un donjon complété |
| `/donjon retirer <nom>` | Retirer un donjon |
| `/donjon progression` | Voir ta progression |
| `/donjon guilde <nom>` | Qui a fait ce donjon ? |
| `/xp personnage <actuel> <cible>` | XP nécessaire (personnage) |
| `/xp metier <actuel> <cible>` | XP nécessaire (métier) |
| `/chasse <x> <y> <direction>` | Chasse au trésor |
| `/panneau outils` | Ouvrir le panneau outils |

### Commandes officier+

| Commande | Description |
|----------|------------|
| `/sortie creer` | Créer une sortie |
| `/sortie annuler <id>` | Annuler une sortie |
| `/sortie cloturer <id>` | Clôturer une sortie |
| `/recompense creer` | Créer une récompense |
| `/recompense payer <id>` | Confirmer le paiement |
| `/recompense annuler <id>` | Annuler une récompense |
| `/admin membres` | Lister les membres |
| `/admin profil <utilisateur>` | Voir un profil détaillé |
| `/admin historique <utilisateur>` | Historique d'audit d'un membre |
| `/panneau officier` | Ouvrir le panneau officier |

### Commandes admin

| Commande | Description |
|----------|------------|
| `/config salons/roles/flags` | Configuration du bot |
| `/admin note <utilisateur> <texte>` | Ajouter une note |
| `/admin warn <utilisateur> <raison>` | Avertir un membre (+ DM) |
| `/export membres/activites/recompenses/audit` | Exporter en CSV |
| `/panneau principal` | Poster le panneau principal |
| `/panneau config` | Ouvrir le panneau config |
| `/ping` | Vérifier l'état du bot |

---

## Checklist de mise en service

- [ ] Poster le panneau principal dans un salon visible (`/panneau principal`)
- [ ] Configurer les salons (`/panneau config` → Salons)
- [ ] Configurer les rôles (`/panneau config` → Rôles)
- [ ] Vérifier que le rôle du bot est au-dessus des rôles membres dans la hiérarchie
- [ ] Tester l'inscription d'un membre (Devenir Chafer → valider dans salon officiers)
- [ ] Tester la création d'une sortie
- [ ] Vérifier que l'almanax se poste le lendemain matin à 6h00

---

*Chafer Chafer — Développé par Marpeap de chez Marpeap Digitals · [marpeap.com](https://marpeap.com)*
