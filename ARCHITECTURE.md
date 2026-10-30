# Architecture eyes-onwork

## Collections Firestore & Champs Clés
- `users`: uid, email, displayName, emailVerified, termsAcceptedVersion, onboardingCompleted
- `workspaces`: id, ownerId, name, planId, status, maxProjects, maxClients, storageUsedBytes
- `projects`: id, workspaceId, clientId, title, type, step, budget, paidAmount, shareToken, clientLinkActive, deliverablesLocked
- `clients`: id, workspaceId, name, email, phone, company, address, taxNumber, totalBilled
- `quotes`: id, workspaceId, projectId, clientId, number, date, items, subtotal, taxAmount, total, depositPercent, status
- `invoices`: id, workspaceId, projectId, quoteId, number, type (deposit|balance|standard), total, paidAmount, status
- `catalog_services`: id, workspaceId, name, category, unitPriceCents, currency, status, deliverables
- `catalog_packs`: id, workspaceId, name, pricingMode, fixedPriceCents, items, currency
- `mockups`: id, projectId, roundNumber, versions, status (pending|changes_requested|approved)
- `notifications`: id, workspaceId, title, message, date, read, link

## Fichiers Principaux
- `server.ts` : API Express, middlewares sécurité, proxy SMTP Gmail, vérification OTP & logs
- `emailService.ts` : Moteur Nodemailer, templates HTML/texte, rate-limiting & codes à 6 chiffres
- `src/App.tsx` : Routeur de vues, barrières d'accès (Auth, OTP, CGU, Onboarding), portail client
- `src/context/AppContext.tsx` : État global, multi-tenant, synchronisation Firestore et fallback
- `src/config/firebase.ts` : Initialisation Firebase SDK (Auth, Firestore, Storage)
- `src/utils/pricingEngine.ts` : Conversions monétaires, calculs HT/TVA/TTC, numérotation chronologique
- `src/utils/formatUtils.ts` : Formateur `formatMontant` sans décimales parasites pour devises zéro-décimale
- `firestore.rules` : Règles de sécurité Firestore avec isolation multi-tenant et immutabilité

## Conventions Centrales
- **Montants entiers** : Stockage en plus petite unité (centimes EUR ou 1 FCFA = 1 unité, sans virgule flottante).
- **Formatage `formatMontant`** : Formatage unique et propre selon la devise active (symbole, séparateurs, arrondis).
- **Isolation `workspaceId`** : Présent sur tout document pour cloisonner strictement les studios.

## Règles de Sécurité (1 ligne par règle)
- `users` : Lecture/écriture limitée à l'utilisateur connecté sur son propre document.
- `workspaces` : Accès réservé aux membres du workspace via contrôle strict d'appartenance.
- `projects` : Lecture/écriture autorisée uniquement au propriétaire du workspace associé.
- `clients` : Cloisonnement strict au sein du workspace de rattachement.
- `quotes` : Modification interdite dès que le statut passe à `accepted` (scellement juridique).
- `invoices` : Inaltérabilité totale garantie une fois la facture marquée `paid` (conformité fiscale).
- `deliverables` : Fichiers sources HD bloqués au téléchargement tant que `paidAmount < budget`.
- `clientPortal` : Accès invité restreint par jeton cryptographique aléatoire de 48 caractères.
- `storage` : Blocage strict des extensions exécutables (.exe, .sh, .php) et limite à 50 Mo.
- `antiXSS` : Neutralisation systématique de toutes les entrées utilisateurs via échappement HTML.
