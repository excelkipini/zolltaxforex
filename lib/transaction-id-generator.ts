/**
 * Générateur d'ID de transactions au format TRX-YYYYMMDD-HHMM-XXX
 */

export function generateTransactionId(): string {
  const now = new Date()
  
  // Format: YYYYMMDD
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  const dateStr = `${year}${month}${day}`
  
  // Format: HHMM
  const hours = String(now.getHours()).padStart(2, '0')
  const minutes = String(now.getMinutes()).padStart(2, '0')
  const timeStr = `${hours}${minutes}`
  
  // Format: XXX (3 chiffres aléatoires)
  const randomNum = Math.floor(Math.random() * 1000).toString().padStart(3, '0')
  
  return `TRX-${dateStr}-${timeStr}-${randomNum}`
}

/**
 * Valide si un ID de transaction respecte le format TRX-YYYYMMDD-HHMM-XXX
 */
export function isValidTransactionId(id: string): boolean {
  const pattern = /^TRX-\d{8}-\d{4}-\d{3}$/
  return pattern.test(id)
}

/**
 * Extrait la date de création d'un ID de transaction
 */
export function extractDateFromTransactionId(id: string): Date | null {
  if (!isValidTransactionId(id)) {
    return null
  }
  
  try {
    // TRX-20250926-2202-455 -> 20250926
    const dateStr = id.substring(4, 12) // "20250926"
    const year = parseInt(dateStr.substring(0, 4))
    const month = parseInt(dateStr.substring(4, 6)) - 1 // Les mois commencent à 0
    const day = parseInt(dateStr.substring(6, 8))
    
    return new Date(year, month, day)
  } catch (error) {
    return null
  }
}

/**
 * Extrait l'heure de création d'un ID de transaction
 */
export function extractTimeFromTransactionId(id: string): { hours: number; minutes: number } | null {
  if (!isValidTransactionId(id)) {
    return null
  }
  
  try {
    // TRX-20250926-2202-455 -> 2202
    const timeStr = id.substring(13, 17) // "2202"
    const hours = parseInt(timeStr.substring(0, 2))
    const minutes = parseInt(timeStr.substring(2, 4))
    
    return { hours, minutes }
  } catch (error) {
    return null
  }
}
