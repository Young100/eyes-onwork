export interface LegalDocumentVersion {
  version: string;
  lastUpdated: string;
  title: string;
  sections: { title: string; content: string }[];
}

export const LEGAL_TERMS_OF_SERVICE: LegalDocumentVersion = {
  version: 'v1.2',
  lastUpdated: '01 Octobre 2026',
  title: 'Conditions Générales d’Utilisation (CGU) — Service eyes-onwork',
  sections: [
    {
      title: 'Article 1 — Objet & Champ d’Application',
      content: 'Les présentes Conditions Générales d’Utilisation régissent l’accès et l’utilisation de la plateforme logicielle en ligne "eyes-onwork" (le "Service"), éditée pour les professionnels de la création graphique, designers indépendants, directeurs artistiques et studios créatifs. En créant un compte ou en accédant au Service, l’Utilisateur reconnaît avoir pris connaissance des présentes conditions et les accepter sans réserve.'
    },
    {
      title: 'Article 2 — Inscription & Espaces de Travail (Workspaces)',
      content: 'L’accès au Service nécessite la création d’un compte personnel et d’un espace de travail (Workspace). Chaque Utilisateur est seul responsable de la confidentialité de ses identifiants de connexion, de la robustesse de son mot de passe et de toute activité effectuée depuis son compte. Les données créées au sein d’un espace de travail demeurent la propriété exclusive de l’Utilisateur.'
    },
    {
      title: 'Article 3 — Formules d’Abonnement & Droits d’Accès (Entitlements)',
      content: 'eyes-onwork propose une formule Gratuite (Free) assortie de quotas d’usage (nombre de projets actifs, nombre de clients, quota mensuel de devis, espace de stockage) et de mentions techniques, ainsi que des formules payantes (Pro, Studio) débloquant des fonctionnalités étendues (projets illimités, personnalisation de marque, absence de mention technique sur les exports PDF, relances automatiques, statistiques avancées). Les limites applicables sont consultables en temps réel sur la page Abonnement.'
    },
    {
      title: 'Article 4 — Engagements de l’Utilisateur & Contenus Téléversés',
      content: 'L’Utilisateur s’interdit d’utiliser le Service pour stocker ou diffuser des contenus illicites, contrefaisants, diffamatoires ou contenant des programmes informatiques malveillants. Tout fichier exécutable (.exe, .sh, .bat, scripts) est automatiquement rejeté par les systèmes de sécurité de la plateforme.'
    },
    {
      title: 'Article 5 — Liens Clients & Verrouillage des Livrables',
      content: 'Le Service met à disposition des liens sécurisés chiffrés permettant aux clients finaux de consulter leurs devis, factures et maquettes. L’Utilisateur configure librement les modalités de déblocage des livrables finaux haute définition, notamment la condition suspensive du complet paiement des factures émises.'
    },
    {
      title: 'Article 6 — Disponibilité & Maintenance',
      content: 'L’Éditeur s’efforce d’assurer une disponibilité du Service 24h/24 et 7j/7, sous réserve des périodes d’intervention de maintenance programmée et des cas de force majeure.'
    },
    {
      title: 'Article 7 — Résiliation & Suppression du Compte',
      content: 'L’Utilisateur peut demander à tout moment la résiliation de son abonnement et la suppression intégrale de son compte et de ses données conformément à la réglementation en vigueur (délai de réflexion de 7 jours avec journalisation).'
    }
  ]
};

export const LEGAL_PRIVACY_POLICY: LegalDocumentVersion = {
  version: 'v1.2',
  lastUpdated: '01 Octobre 2026',
  title: 'Politique de Confidentialité & Protection des Données Personnelles (RGPD)',
  sections: [
    {
      title: 'Article 1 — Responsable de Traitement & Finalités',
      content: 'Les données à caractère personnel collectées lors de l’inscription et de l’utilisation de eyes-onwork sont traitées pour la gestion des comptes, la facturation des abonnements, la fourniture des outils de création, l’envoi des emails transactionnels de service, et l’assistance technique.'
    },
    {
      title: 'Article 2 — Données Collectées',
      content: 'Sont collectées les données d’identification (nom, prénom, adresse email), les données professionnelles (nom commercial du studio, SIRET, adresse, IBAN), les données de connexion (adresse IP, horodatage, agent utilisateur pour la sécurité des sessions) et les données métier saisies dans l’espace de travail.'
    },
    {
      title: 'Article 3 — Hermétisme Strict des Espaces & Confidentialité',
      content: 'L’architecture multi-utilisateurs garantit une étanchéité absolue entre les espaces de travail. L’administrateur de la plateforme n’a en aucun cas accès au contenu métier des dossiers de vos clients (fichiers sources, briefs créatifs confidentiels, annotations), n’accédant qu’aux métriques agrégées de santé système et d’utilisation globale.'
    },
    {
      title: 'Article 4 — Droits de l’Utilisateur (Accès, Rectification, Effacement, Portabilité)',
      content: 'Conformément au Règlement Général sur la Protection des Données (RGPD), vous disposez d’un droit d’accès, de rectification, de portabilité (export complet des données au format JSON/ZIP en 1 clic) et d’effacement de vos données ("droit à l’oubli").'
    },
    {
      title: 'Article 5 — Traceurs & Cookies',
      content: 'eyes-onwork n’utilise aucun traceur publicitaire intrusif tiers. Seuls les témoins de session strictement nécessaires à l’authentification et à la sécurisation de votre navigation sont déposés.'
    }
  ]
};

export const LEGAL_SUBSCRIPTION_TERMS: LegalDocumentVersion = {
  version: 'v1.2',
  lastUpdated: '01 Octobre 2026',
  title: 'Conditions d’Abonnement, Tarification & Politique de Remboursement',
  sections: [
    {
      title: 'Article 1 — Formules & Périodicité de Facturation',
      content: 'Les abonnements Pro et Studio sont proposés avec tacite reconduction selon la périodicité choisie lors de la souscription : mensuelle, trimestrielle, semestrielle ou annuelle. Les remises applicables aux engagements plurimensuels sont automatiquement déduites du montant facturé.'
    },
    {
      title: 'Article 2 — Essai Gratuit (Free Trial)',
      content: 'Tout nouvel inscrit bénéficie d’une période d’essai gratuit de 14 jours aux fonctionnalités Pro, sans obligation de renseigner un moyen de paiement. À l’issue de cet essai, à défaut de souscription, le compte bascule automatiquement sur la formule Gratuite.'
    },
    {
      title: 'Article 3 — Période de Grâce & Conservation des Données',
      content: 'En cas de rejet de paiement ou de fin d’abonnement, une période de grâce de 7 jours est accordée pour régulariser la situation. Au terme de cette période, aucune donnée n’est supprimée : les projets et clients excédentaires passent en mode consultation et export en lecture seule.'
    },
    {
      title: 'Article 4 — Droit de Rétractation & Remboursement',
      content: 'Pour les professionnels, les abonnements sont sans engagement de durée au-delà de la période facturée. Toute demande d’annulation prend effet au terme de l’échéance en cours. En cas d’erreur de facturation avérée ou d’indisponibilité majeure prolongée imputable au Service, un remboursement prorata temporis peut être accordé par l’administrateur.'
    },
    {
      title: 'Article 5 — Règle de Prudence Juridique & Fiscale',
      content: 'Rappel légal : Chaque utilisateur professionnel demeure responsable de la conformité fiscale de ses propres devis et factures émis auprès de ses clients selon la législation de son pays d’établissement (notamment TVA, mentions obligatoires et conservation comptable).'
    }
  ]
};
