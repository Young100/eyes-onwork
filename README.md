# 🎨 EYES-ONWORK — Système d'Exploitation pour Graphistes & Studios Indépendants

**eyes-onwork** est une application web tout-en-un conçue pour les directeurs artistiques, designers graphiques et studios indépendants. Elle gère l'intégralité du cycle de vie des projets de création : prospection, cadrage, devisage, facturation conforme, validation de maquettes avec annotations visuelles, verrouillage sécurisé des livrables anti-impayés, et portail client sécurisé.

---

## 📋 Table des Matières

1. [Architecture & Stack Technique](#1-architecture--stack-technique)
2. [Environnements & Séparation Prod / Dev](#2-environnements--séparation-prod--dev)
3. [Variables d'Environnement Exhaustives](#3-variables-denvironnement-exhaustives)
4. [Installation & Lancement Local](#4-installation--lancement-local)
5. [Domaine Personnalisé & HTTPS (Guide Pas-à-Pas)](#5-domaine-personnalisé--https)
6. [IP Sortante Statique (Egress Proxy)](#6-ip-sortante-statique)
7. [Sauvegardes Automatiques & Procédure de Restauration](#7-sauvegardes-automatiques--restauration)
8. [Alertes de Budget & Quotas GCP / Firebase](#8-alertes-de-budget--quotas)
9. [Sécurité, Règles d'Accès & Chiffrement](#9-sécurité-règles-daccès--chiffrement)
10. [Guide Utilisateur : Parcours Complet d'un Projet](#10-guide-utilisateur-parcours-complet-dun-projet)
11. [Limites Connues & Feuille de Route](#11-limites-connues--feuille-de-route)
12. [Évolution Architecture Multi-Comptes & Rôles](#12-évolution-architecture-multi-comptes--rôles)

---

## 1. Architecture & Stack Technique

- **Frontend** : React 19, TypeScript, Tailwind CSS v4, Motion (animations fluides), Lucide Icons, jsPDF & html2canvas (moteur de génération de devis/factures PDF pixel-perfect côté client).
- **Backend / Serveur API** : Node.js avec Express et TypeScript (`server.ts`), montage des middlewares Vite en développement.
- **Moteur d'Emailing Transactionnel** : Nodemailer configuré avec transport direct Gmail SMTP (`smtp.gmail.com`, port 465 SSL/TLS).
- **Persistance & Base de Données** : Firebase Firestore (avec `firestore.rules` scellées) et Firebase Storage (`storage.rules` anti-exécutables).
- **Mode Résilient / Déconnexion** : Fallback automatique en mémoire locale / `localStorage` pour une expérience fluide même sans connexion Internet immédiate.

---

## 2. Environnements & Séparation Prod / Dev

Pour garantir une étanchéité absolue entre la phase de test et la production :

| Composant | Environnement Développement / Test | Environnement Production |
| :--- | :--- | :--- |
| **Projet Firebase** | `eyes-onwork-dev` | `eyes-onwork-prod` |
| **Base Firestore** | `(default)` de test avec émulateur local | Instance dédiée Cloud Firestore en production |
| **Données de démo** | Actives au premier lancement pour prise en main | Supprimées en 1 clic via le bouton « Purger données démo » |
| **URL App** | `localhost:3000` ou sous-domaine Cloud Run Dev | Nom de domaine propriétaire en HTTPS (`studio.votre-domaine.com`) |
| **SMTP Email** | Mode simulé sécurisé ou boîte test | Compte Gmail Pro avec mot de passe d'application dédié |

---

## 3. Variables d'Environnement Exhaustives

Créez un fichier `.env` à la racine (fondé sur `.env.example`) :

```env
# ==============================================================================
# CONFIGURATION SERVEUR ET APPLICATION
# ==============================================================================
PORT=3000
NODE_ENV=production

# ==============================================================================
# EMAILING TRANSACTIONNEL (NODEMAILER & GMAIL SMTP)
# ==============================================================================
# Adresse Gmail émettrice pour l'envoi des confirmations et notifications
GMAIL_USER=votre-adresse-pro@gmail.com

# Mot de passe d'application Google (16 caractères généré depuis myaccount.google.com -> Sécurité)
# Note : N'utilisez JAMAIS votre mot de passe habituel de boîte Gmail.
GMAIL_APP_PASSWORD=abcd efgh ijkl mnop

# Boîte de réception du graphiste qui reçoit les alertes de nouveaux briefs et paiements
ADMIN_EMAIL=votre-adresse-pro@gmail.com

# ==============================================================================
# SÉCURITÉ & CORS
# ==============================================================================
# Domaine autorisé pour les requêtes API (ex: https://studio.votredomaine.fr)
APP_ORIGIN=https://studio.votredomaine.fr
```

### Description détaillée de chaque variable :
- `PORT` : Port d'écoute du serveur Node.js (défaut : `3000`).
- `NODE_ENV` : `development` pour activer les logs détaillés et Vite HMR, `production` pour optimiser le bundle et activer les en-têtes de cache stricts.
- `GMAIL_USER` : Compte Google utilisé pour authentifier la connexion SMTP vers `smtp.gmail.com:465`.
- `GMAIL_APP_PASSWORD` : Clé d'application 2FA dédiée délivrée par Google pour contourner les blocages "Less Secure Apps".
- `ADMIN_EMAIL` : Adresse email destinataire des récapitulatifs de commandes, signatures de devis et avis clients.
- `APP_ORIGIN` : Origine stricte autorisée pour le partage de ressources cross-origin (CORS).

---

## 4. Installation & Lancement Local

### Prérequis
- Node.js 20+ ou 22+
- npm ou bun

### Commandes
```bash
# 1. Cloner le projet et installer les dépendances
git clone <url-du-depot>
cd eyes-onwork
npm install

# 2. Configurer les variables d'environnement
cp .env.example .env
# Renseigner GMAIL_USER et GMAIL_APP_PASSWORD

# 3. Lancer la suite de tests automatisés (28 tests financiers + 18 tests de règles de sécurité)
npm test

# 4. Lancer l'environnement de développement
npm run dev

# 5. Compiler pour la production
npm run build
```

---

## 5. Domaine Personnalisé & HTTPS

### Étape 1 : Réserver votre nom de domaine
Réservez votre nom de domaine auprès d'un bureau d'enregistrement certifié (OVH, Gandi, Cloudflare, Namecheap, Google Domains / Squarespace).

### Étape 2 : Configurer le mappage DNS
Dans la console de déploiement (Cloud Run, Vercel ou VPS Nginx) :
1. Ajoutez le domaine personnalisé : `studio.votredomaine.fr` ou `votredomaine.fr`.
2. Créez un enregistrement DNS de type **CNAME** :
   - **Hôte** : `studio`
   - **Valeur** : `ghs.googlehosted.com.` (pour Google Cloud) ou le pointeur fourni par votre hébergeur.
3. Pour un domaine apex (`votredomaine.fr`), ajoutez les enregistrements **A** et **AAAA** fournis.

### Étape 3 : Certificat SSL / TLS automatique
- Cloud Run, Cloudflare et Firebase Hosting délivrent et renouvellent automatiquement un certificat SSL Let's Encrypt / Google Trust Services sans intervention manuelle.
- Les requêtes HTTP sont redirigées automatiquement vers **HTTPS** (port 443) avec l'en-tête `Strict-Transport-Security` (HSTS).

---

## 6. IP Sortante Statique (Egress Proxy)

Si un prestataire externe (banque, passerelle SMS, API d'un client grand compte) exige une liste blanche d'adresses IP fixes pour autoriser vos appels API :

1. **Créer une IP externe réservée dans Google Cloud VPC** :
   ```bash
   gcloud compute addresses create eyes-onwork-static-ip --region=europe-west3
   ```
2. **Créer une passerelle Cloud NAT** reliée à un routeur Cloud Router :
   ```bash
   gcloud compute routers create nat-router --network=default --region=europe-west3
   gcloud compute routers nats create nat-config \
       --router=nat-router \
       --nat-all-subnet-ip-ranges \
       --nat-external-ip-pool=eyes-onwork-static-ip \
       --region=europe-west3
   ```
3. **Connecter Cloud Run via un connecteur VPC Serverless** :
   - Créez un Serverless VPC Access Connector.
   - Configurez le service Cloud Run pour router tout le trafic sortant (`--vpc-egress=all-traffic`) via ce connecteur.
   - Toutes vos requêtes sortantes proviendront désormais de l'adresse IP statique réservée.

---

## 7. Sauvegardes Automatiques & Restauration

### Sauvegardes Quotidiennes Automatiques de Firestore
1. Créez un bucket Cloud Storage dédié : `gs://eyes-onwork-backups-europe/`.
2. Configurez un job **Cloud Scheduler** quotidien (tous les soirs à 02h00) :
   ```bash
   gcloud scheduler jobs create http firestore-daily-backup \
       --schedule="0 2 * * *" \
       --uri="https://firestore.googleapis.com/v1/projects/eyes-onwork-prod/databases/(default):exportDocuments" \
       --http-method=POST \
       --message-body='{"outputUriPrefix":"gs://eyes-onwork-backups-europe"}' \
       --oauth-service-account-email=backup-runner@eyes-onwork-prod.iam.gserviceaccount.com
   ```
3. Activez la rétention d'objets (30 jours) sur le bucket pour automatiser le nettoyage des vieilles sauvegardes.

### Procédure de Restauration
En cas de sinistre ou d'erreur humaine :
```bash
gcloud firestore import gs://eyes-onwork-backups-europe/[DOSSIER_TIMESTAMP]/
```

---

## 8. Alertes de Budget & Quotas

Pour éviter toute surprise de facturation :
1. Dans la console Google Cloud / Firebase Billing :
   - Créez un **Budget d'Alerte** fixé par exemple à **25 € / mois**.
   - Seuils d'alerte configurés : **50%** (12,50 €), **75%** (18,75 €), **90%** (22,50 €), et **100%** (25,00 €).
2. Configurez l'envoi immédiat d'un email d'alerte et d'une notification push sur smartphone.
3. Plafonds de quotas programmés :
   - Limite de 50 000 lectures Firestore par jour (palliée par le cache React).
   - Règle de limitation de requêtes (Rate Limiting) sur l'API `/api/email/*` : 10 emails max par minute et par IP pour bloquer le spam.

---

## 9. Sécurité, Règles d'Accès & Chiffrement

- **Règles Firestore (`firestore.rules`)** :
  - Principe du moindre privilège : chaque graphiste n'accède qu'à ses propres données (`resource.data.ownerId == request.auth.uid`).
  - Immutabilité juridique : les devis au statut `accepted` et les factures au statut `paid` sont verrouillés contre toute modification.
  - Verrouillage des livrables : les fichiers sources vectoriels et exports HD ne sont débloqués que si `paidAmount >= budget` ou sur déblocage explicite du graphiste.
- **Règles Storage (`storage.rules`)** :
  - Blocage strict de tous les fichiers exécutables (`.exe`, `.sh`, `.php`, `.bat`, `.cmd`, `.jar`, `.msi`, `.html`).
  - Plafond de taille à 50 Mo par fichier.
- **Anti-XSS & Neutralisation** :
  - Tout texte saisi par le client ou le graphiste est échappé via `escapeHtml()` avant injection dans le DOM ou dans les templates d'emails.
- **Jetons des Liens Clients** :
  - Chaîne alphanumérique aléatoire cryptographiquement forte de 48 caractères (`crypto.randomUUID()` / CSPRNG).
  - Révocable en un clic (`clientLinkActive = false`).
  - Zéro donnée confidentielle ou financière dans l'URL.

---

## 10. Guide Utilisateur : Parcours Complet d'un Projet

```
Demande Publique  ──►  Cadrage & Devis  ──►  Signature & Acompte  ──►  Création Maquettes
        │                                                                     │
Clôture & Avis 5★ ◄──  Livrables HD ◄── Solde Réglé ◄── Validation Finale ◄───┘
```

1. **Demande & Briefing** : Le prospect remplit le formulaire public ou le graphiste crée le dossier client.
2. **Émission du Devis** : Élaboration des lignes de prestations, choix du taux de TVA (0%, 5.5%, 10%, 20%, 18% UEMOA) et pourcentage d'acompte (30% à 50%).
3. **Acceptation & Acompte** : Le client valide le devis via son lien sécurisé. Dès réception de l'acompte, le statut passe en `acompte_recu` et la facture d'acompte est générée.
4. **Présentation des Maquettes** : Téléversement des ébauches dans l'espace partagé. Le client annote directement les visuels dans la limite des 3 révisions contractuelles.
5. **Validation Finale** : Le client valide la maquette définitive (BAT numérique).
6. **Règlement du Solde** : Émission de la facture de solde. Les livrables restent scellés avec un cadenas de protection tant que le solde n'est pas encaissé.
7. **Déblocage & Livraison** : Dès enregistrement du paiement, le cadenas s'ouvre : le client télécharge l'archive ZIP contenant les logos HD et fichiers vectoriels sources.
8. **Clôture & Avis Client** : Le client note la collaboration et laisse un témoignage 5 étoiles intégré aux statistiques du studio.

---

## 11. Limites Connues & Feuille de Route

### Limites Connues
1. **Génération PDF sur très grands écrans** : Le rendu `html2canvas` peut nécessiter 1 à 2 secondes sur les factures dépassant 20 lignes détaillées.
2. **Quota d'envoi Gmail SMTP** : Gmail standard plafonne l'envoi à environ 500 emails / jour (largement suffisant pour un studio individuel, mais nécessitera un relais dédié si l'activité dépasse 100 devis par jour).

### Améliorations Futures Recommandées
- [x] Assistant d'onboarding en 5 étapes avec préconfiguration pays et monnaie.
- [x] Outil d'état de santé du système (`SystemHealthView`) pour superviser la connexion SMTP et la base.
- [ ] Export comptable automatisé au format FEC (Fichier des Écritures Comptables) pour l'expert-comptable.
- [ ] Mode hors-ligne PWA complet avec Service Worker pour consultation des fiches clients en déplacement.

---

## 12. Évolution Architecture Multi-Comptes & Rôles

### Compatibilité de l'Architecture Actuelle
L'architecture actuelle a été pensée **nativement** pour le multi-tenant et la séparation par rôles :
- Chaque document Firestore possède déjà un attribut `ownerId` identifiant le graphiste propriétaire.
- Les helpers de sécurité Firestore isolent déjà les collections par `isResourceOwner()`.

### Modifications Requises pour Déployer un Mode Multi-Comptes Étendu :
1. **Attribution des Rôles dans Firebase Custom Claims** :
   ```typescript
   // roles: 'owner' | 'collaborator' | 'client'
   await admin.auth().setCustomUserClaims(uid, { role: 'collaborator', studioId: 'studio_123' });
   ```
2. **Table de Droits d'Accès Projet** :
   - Ajouter un tableau `collaborators: [{ userId: string, canEdit: boolean }]` sur chaque projet.
   - Les collaborateurs voient uniquement les projets qui leur sont expressément assignés, sans avoir accès à la trésorerie globale du studio.
3. **Hermétisme Multi-Agences (Tenants)** :
   - Aucune modification de structure de base nécessaire : le filtrage par `ownerId` ou `studioId` assure l'étanchéité stricte entre deux graphistes concurrents hébergés sur la même plateforme.

---

*Développé avec excellence pour Abdoulaye Graphic.*
