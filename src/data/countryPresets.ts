/**
 * Presets de configuration fiscale et légale par pays pour eyes-onwork.
 * Permet au graphiste de changer de pays et de préremplir instantanément :
 * - Devise (€, FCFA, CHF, CAD)
 * - Taux de TVA standard
 * - Fuseau horaire & format de date
 * - Modèles de mentions légales conformes au droit local
 */

export interface CountryPreset {
  code: string;
  name: string;
  flag: string;
  currency: string;
  currencySymbol: string;
  isZeroDecimal: boolean;
  defaultVatRate: number;
  vatName: string;
  timeZone: string;
  locale: string;
  legalNoticeTemplate: string;
  invoiceConditionsTemplate: string;
}

export const COUNTRY_PRESETS: Record<string, CountryPreset> = {
  FR: {
    code: 'FR',
    name: 'France',
    flag: '🇫🇷',
    currency: 'EUR',
    currencySymbol: '€',
    isZeroDecimal: false,
    defaultVatRate: 20,
    vatName: 'TVA (20 %)',
    timeZone: 'Europe/Paris',
    locale: 'fr-FR',
    legalNoticeTemplate: 'Dispensé d’immatriculation au RCS et au RM (ou n° SIRET / RCS indiqué ci-dessus). TVA intracommunautaire selon régime. Règlement sous 30 jours nets. Pénalités de retard : 3 fois le taux d’intérêt légal en vigueur + indemnité forfaitaire de 40 € pour frais de recouvrement (art. L. 441-10 du Code de commerce).',
    invoiceConditionsTemplate: 'Acompte de 50 % exigible avant démarrage des créations. Cession des droits patrimoniaux d’auteur (reproduction et représentation) transférée uniquement après encaissement complet du solde.'
  },
  CI: {
    code: 'CI',
    name: 'Côte d’Ivoire',
    flag: '🇨🇮',
    currency: 'FCFA',
    currencySymbol: 'FCFA',
    isZeroDecimal: true,
    defaultVatRate: 18,
    vatName: 'TVA (18 %)',
    timeZone: 'Africa/Abidjan',
    locale: 'fr-CI',
    legalNoticeTemplate: 'Entreprise individuelle / Studio créatif immatriculé au RCCM d’Abidjan. Régime fiscal selon statut (TVA 18 % ou régime synthétique). Règlement sous 15 à 30 jours nets. Droit applicable : Actes uniformes OHADA.',
    invoiceConditionsTemplate: 'Acompte de 50 % requis au lancement du projet (virement bancaire ou Mobile Money). Les fichiers sources et livrables d’impression haute définition sont débloqués après règlement intégral du solde.'
  },
  SN: {
    code: 'SN',
    name: 'Sénégal',
    flag: '🇸🇳',
    currency: 'FCFA',
    currencySymbol: 'FCFA',
    isZeroDecimal: true,
    defaultVatRate: 18,
    vatName: 'TVA (18 %)',
    timeZone: 'Africa/Dakar',
    locale: 'fr-SN',
    legalNoticeTemplate: 'Studio de design graphique immatriculé au NINEA et au RCCM de Dakar. Régime fiscal UEMOA / OHADA. Règlement net sous 30 jours.',
    invoiceConditionsTemplate: 'Acompte de démarrage de 50 % requis avant recherches graphiques. Solde dû à la livraison finale des maquettes validées.'
  },
  CM: {
    code: 'CM',
    name: 'Cameroun',
    flag: '🇨🇲',
    currency: 'FCFA',
    currencySymbol: 'FCFA',
    isZeroDecimal: true,
    defaultVatRate: 19.25,
    vatName: 'TVA (19,25 %)',
    timeZone: 'Africa/Douala',
    locale: 'fr-CM',
    legalNoticeTemplate: 'Studio de création graphique enregistré au Registre du Commerce et du Crédit Mobilier (RCCM) de Douala / Yaoundé. Conformité CEMAC / OHADA.',
    invoiceConditionsTemplate: 'Acompte de 50 % exigé avant toute réalisation. Propriété des créations transmise à la livraison finale et paiement intégral.'
  },
  BE: {
    code: 'BE',
    name: 'Belgique',
    flag: '🇧🇪',
    currency: 'EUR',
    currencySymbol: '€',
    isZeroDecimal: false,
    defaultVatRate: 21,
    vatName: 'TVA (21 %)',
    timeZone: 'Europe/Brussels',
    locale: 'fr-BE',
    legalNoticeTemplate: 'Immatriculé à la Banque-Carrefour des Entreprises (BCE). TVA intracommunautaire BE. Échéance de paiement : 30 jours. Tout retard entraînera de plein droit un intérêt de 10 % l’an et une indemnité forfaitaire de 10 %.',
    invoiceConditionsTemplate: 'Acompte de 50 % à la commande. Droits de propriété intellectuelle cédés sous condition résolutoire de complet paiement.'
  },
  CH: {
    code: 'CH',
    name: 'Suisse',
    flag: '🇨🇭',
    currency: 'CHF',
    currencySymbol: 'CHF',
    isZeroDecimal: false,
    defaultVatRate: 8.1,
    vatName: 'TVA (8,1 %)',
    timeZone: 'Europe/Zurich',
    locale: 'fr-CH',
    legalNoticeTemplate: 'Studio graphique indépendant enregistré au Registre du commerce (n° IDE / CHE). Taux TVA normal suisse de 8,1 % (ou non assujetti si CA < 100 000 CHF). Paiement net à 30 jours.',
    invoiceConditionsTemplate: 'Acompte de 50 % avant le début des travaux de création. Les fichiers sources définitifs sont remis à la réception du solde.'
  },
  CA: {
    code: 'CA',
    name: 'Canada (Québec)',
    flag: '🇨🇦',
    currency: 'CAD',
    currencySymbol: '$',
    isZeroDecimal: false,
    defaultVatRate: 14.975,
    vatName: 'TPS (5 %) + TVQ (9,975 %)',
    timeZone: 'America/Montreal',
    locale: 'fr-CA',
    legalNoticeTemplate: 'Enregistré au Registre des entreprises du Québec (NEQ). Numéros de TPS/TVQ indiqués le cas échéant. Paiement net sous 30 jours à compter de la date de facturation.',
    invoiceConditionsTemplate: 'Dépôt initial de 50 % non remboursable pour réserver le calendrier de production. Cession des droits d’auteur effective à la réception du paiement complet.'
  }
};
