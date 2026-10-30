/**
 * Dictionnaire centralisé des chaînes de l'interface eyes-onwork.
 * Permet une gestion propre des libellés et prépare l'ajout futur de l'anglais (en)
 * sans modifier le code des composants.
 */

export type SupportedLanguage = 'fr' | 'en';

export interface AppTranslations {
  nav: {
    dashboard: string;
    projects: string;
    clients: string;
    billing: string;
    calendar: string;
    reminders: string;
    catalog: string;
    stats: string;
    systemHealth: string;
    settings: string;
    helpCenter: string;
    publicLeadLink: string;
  };
  actions: {
    save: string;
    cancel: string;
    delete: string;
    edit: string;
    confirm: string;
    download: string;
    send: string;
    search: string;
    filter: string;
    close: string;
    newProject: string;
    newClient: string;
    newQuote: string;
    newInvoice: string;
    recordPayment: string;
  };
  steps: {
    demande_recue: string;
    cadrage: string;
    devis_envoye: string;
    devis_valide: string;
    acompte_recu: string;
    creation: string;
    retours_client: string;
    validation_finale: string;
    facture_solde: string;
    solde_regle: string;
    livraison: string;
    cloture: string;
  };
  statuses: {
    draft: string;
    sent: string;
    accepted: string;
    refused: string;
    paid: string;
    partially_paid: string;
    overdue: string;
  };
  security: {
    linkSecured: string;
    lockedDeliverables: string;
    unlockedDeliverables: string;
    immutableQuoteNotice: string;
    immutableInvoiceNotice: string;
  };
}

export const TRANSLATIONS: Record<SupportedLanguage, AppTranslations> = {
  fr: {
    nav: {
      dashboard: 'Tableau de bord',
      projects: 'Projets créatifs',
      clients: 'Clients',
      billing: 'Facturation & Devis',
      calendar: 'Planning & Calendrier',
      reminders: 'À relancer',
      catalog: 'Catalogue & Modèles',
      stats: 'Statistiques & Marge',
      systemHealth: 'État du système',
      settings: 'Paramètres du studio',
      helpCenter: 'Centre d’aide & Guide',
      publicLeadLink: 'Lien & QR code public'
    },
    actions: {
      save: 'Enregistrer',
      cancel: 'Annuler',
      delete: 'Supprimer',
      edit: 'Modifier',
      confirm: 'Confirmer',
      download: 'Télécharger',
      send: 'Envoyer',
      search: 'Rechercher...',
      filter: 'Filtrer',
      close: 'Fermer',
      newProject: 'Nouveau projet',
      newClient: 'Ajouter un client',
      newQuote: 'Créer un devis',
      newInvoice: 'Créer une facture',
      recordPayment: 'Encaisser un règlement'
    },
    steps: {
      demande_recue: '1. Demande reçue',
      cadrage: '2. Cadrage du brief',
      devis_envoye: '3. Devis envoyé',
      devis_valide: '4. Devis accepté',
      acompte_recu: '5. Acompte perçu',
      creation: '6. Création en cours',
      retours_client: '7. Retours client',
      validation_finale: '8. Maquette approuvée',
      facture_solde: '9. Facture de solde',
      solde_regle: '10. Solde réglé',
      livraison: '11. Livrables finaux',
      cloture: '12. Projet clôturé'
    },
    statuses: {
      draft: 'Brouillon',
      sent: 'Envoyé',
      accepted: 'Accepté & Signé',
      refused: 'Refusé',
      paid: 'Payé intégralement',
      partially_paid: 'Acompte perçu',
      overdue: 'En retard'
    },
    security: {
      linkSecured: 'Accès sécurisé par jeton unique chiffré',
      lockedDeliverables: 'Livrables finaux verrouillés jusqu’au règlement complet du solde',
      unlockedDeliverables: 'Solde réglé : Fichiers sources et exports d’impression débloqués',
      immutableQuoteNotice: 'Ce devis est juridiquement validé et scellé.',
      immutableInvoiceNotice: 'Facture acquittée : document comptable inaltérable.'
    }
  },
  en: {
    nav: {
      dashboard: 'Dashboard',
      projects: 'Creative Projects',
      clients: 'Clients',
      billing: 'Quotes & Invoices',
      calendar: 'Schedule & Calendar',
      reminders: 'Follow-ups',
      catalog: 'Catalog & Templates',
      stats: 'Statistics & Margins',
      systemHealth: 'System Health',
      settings: 'Studio Settings',
      helpCenter: 'Help Center & Guide',
      publicLeadLink: 'Public Link & QR Code'
    },
    actions: {
      save: 'Save',
      cancel: 'Cancel',
      delete: 'Delete',
      edit: 'Edit',
      confirm: 'Confirm',
      download: 'Download',
      send: 'Send',
      search: 'Search...',
      filter: 'Filter',
      close: 'Close',
      newProject: 'New Project',
      newClient: 'Add Client',
      newQuote: 'Create Quote',
      newInvoice: 'Create Invoice',
      recordPayment: 'Record Payment'
    },
    steps: {
      demande_recue: '1. Request Received',
      cadrage: '2. Brief Scoping',
      devis_envoye: '3. Quote Sent',
      devis_valide: '4. Quote Accepted',
      acompte_recu: '5. Deposit Received',
      creation: '6. Design in Progress',
      retours_client: '7. Client Feedback',
      validation_finale: '8. Design Approved',
      facture_solde: '9. Final Invoice',
      solde_regle: '10. Balance Paid',
      livraison: '11. Final Delivery',
      cloture: '12. Project Closed'
    },
    statuses: {
      draft: 'Draft',
      sent: 'Sent',
      accepted: 'Accepted & Signed',
      refused: 'Declined',
      paid: 'Fully Paid',
      partially_paid: 'Deposit Paid',
      overdue: 'Overdue'
    },
    security: {
      linkSecured: 'Access protected via unique encrypted session token',
      lockedDeliverables: 'Final deliverables locked until balance is fully settled',
      unlockedDeliverables: 'Balance settled: High-resolution print files and source exports unlocked',
      immutableQuoteNotice: 'This quote is legally signed and locked.',
      immutableInvoiceNotice: 'Paid invoice: Unalterable accounting record.'
    }
  }
};

/**
 * Fonction d'accès aux traductions (actuellement par défaut en français 'fr')
 */
export function t<K extends keyof AppTranslations>(
  section: K,
  key: keyof AppTranslations[K],
  lang: SupportedLanguage = 'fr'
): string {
  const dictionary = TRANSLATIONS[lang] || TRANSLATIONS.fr;
  const sec = dictionary[section];
  if (sec && key in sec) {
    return (sec as any)[key];
  }
  return String(key);
}
