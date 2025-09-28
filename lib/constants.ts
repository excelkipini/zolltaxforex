// Constantes de l'application ZOLL TAX FOREX
export const APP_CONSTANTS = {
  // Informations de l'entreprise
  COMPANY_NAME: "ZOLL TAX FOREX",
  COMPANY_DESCRIPTION: "Système interne de gestion des opérations",
  
  // Copyright
  COPYRIGHT_YEAR: 2025,
  
  // Version de l'application
  APP_VERSION: "1.0.0",
  
  // Configuration par défaut
  DEFAULT_CURRENCY: "XAF",
  DEFAULT_LANGUAGE: "fr",
} as const

// Fonction utilitaire pour générer le texte de copyright
export function getCopyrightText(): string {
  return `© ${APP_CONSTANTS.COPYRIGHT_YEAR} ${APP_CONSTANTS.COMPANY_NAME}. ${APP_CONSTANTS.COMPANY_DESCRIPTION}.`
}
