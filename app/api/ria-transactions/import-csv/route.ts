import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth"
import { hasPermission } from "@/lib/rbac"
import { importRiaTransactions } from "@/lib/ria-transactions-queries"
import { parse } from 'csv-parse/sync'

export async function POST(request: NextRequest) {
  console.log('🔍 API import-csv appelée')
  
  try {
    const { user } = await requireAuth()
    console.log('👤 Utilisateur authentifié:', user?.email, user?.role)
    
    if (!hasPermission(user, "import_ria_csv")) {
      console.log('❌ Permission refusée pour:', user?.email, user?.role)
      return NextResponse.json({ ok: false, error: "Non autorisé" }, { status: 403 })
    }
    
    console.log('✅ Permission accordée pour:', user?.email)
  } catch (error) {
    console.error('❌ Erreur d\'authentification:', error)
    return NextResponse.json({ ok: false, error: "Erreur d'authentification" }, { status: 401 })
  }

  try {
    console.log('📁 Récupération du fichier...')
    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const delestagesJson = formData.get('delestages') as string | null

    if (!file) {
      console.log('❌ Aucun fichier fourni')
      return NextResponse.json({ ok: false, error: "Aucun fichier fourni" }, { status: 400 })
    }

    // Parser les délestages
    let delestages: Record<string, number> = {}
    if (delestagesJson) {
      try {
        delestages = JSON.parse(delestagesJson)
        console.log('💰 Délestages reçus:', delestages)
      } catch (error) {
        console.error('❌ Erreur parsing délestages:', error)
      }
    }

    console.log('📄 Fichier reçu:', file.name, file.size, 'bytes')
    const buffer = Buffer.from(await file.arrayBuffer())
    const csvString = buffer.toString('utf-8')

    console.log('📊 Parsing du CSV...')
    
    // Détecter automatiquement le séparateur
    const firstLine = csvString.split('\n')[0]
    const hasTabs = firstLine.includes('\t')
    const hasSemicolons = firstLine.includes(';')
    const hasCommas = firstLine.includes(',')
    
    let delimiter = '\t' // Par défaut
    if (hasTabs) {
      delimiter = '\t'
      console.log('🔍 Séparateur détecté: tabulation')
    } else if (hasSemicolons) {
      delimiter = ';'
      console.log('🔍 Séparateur détecté: point-virgule')
    } else if (hasCommas) {
      delimiter = ','
      console.log('🔍 Séparateur détecté: virgule')
    } else {
      console.log('⚠️ Séparateur non détecté, utilisation de la tabulation par défaut')
    }
    
    // Parser le CSV avec la structure spécifiée
    const records = parse(csvString, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
      delimiter: delimiter
    })

    console.log(`✅ ${records.length} lignes CSV parsées`)

    // Mapping basé sur la position des colonnes (plus robuste)
    if (records.length > 0) {
      const availableColumns = Object.keys(records[0])
      console.log('📋 Colonnes disponibles:', availableColumns)
      
      // Ordre attendu des colonnes (basé sur l'ordre observé)
      const expectedOrder = [
        'SC Numéro du transfert',
        'Pin', 
        'Mode de livraison',
        'Guichetier',
        'Succursale',
        'Code d\'agence',
        'Sent Amount',
        'Sending Currency',
        'Pays d\'origine',
        'Pays de destination',
        'Montant du paiement',
        'Devise du Bénéficiaire',
        'Commission SA',
        'Devise Comission SA',
        'Date',
        'Taux',
        'TTF',
        'CTE',
        'TVA1',
        'Montant a payer',
        'Frais Client',
        'Action'
      ]
      
      // Créer le mapping basé sur la position
      const columnMapping: { [key: string]: string } = {}
      availableColumns.forEach((col, index) => {
        if (index < expectedOrder.length) {
          columnMapping[col] = expectedOrder[index]
        }
      })
      
      console.log('🔧 Mapping des colonnes (basé sur la position):', columnMapping)
      
      // Normaliser les colonnes dans les enregistrements
      records.forEach(record => {
        const normalizedRecord: any = {}
        Object.keys(record).forEach(key => {
          const normalizedKey = columnMapping[key] || key
          normalizedRecord[normalizedKey] = record[key]
        })
        // Remplacer l'enregistrement original par la version normalisée
        Object.assign(record, normalizedRecord)
      })
      
      console.log('📋 Colonnes après normalisation:', Object.keys(records[0]))
      
      const requiredColumns = [
        'SC Numéro du transfert', 'Guichetier', 'Succursale', 'Code d\'agence',
        'Sent Amount', 'Sending Currency', 'Commission SA', 'Devise Comission SA',
        'Date', 'TTF', 'CTE', 'TVA1', 'Action'
      ]
      
      const missingColumns = requiredColumns.filter(col => !Object.keys(records[0]).includes(col))
      if (missingColumns.length > 0) {
        throw new Error(`Colonnes manquantes: ${missingColumns.join(', ')}. Colonnes disponibles: ${Object.keys(records[0]).join(', ')}`)
      }
      
      console.log('✅ Toutes les colonnes requises sont présentes')
    }

    // Transformer les données CSV en format de base de données
    // Utiliser les délestages par guichetier pour chaque transaction
    const transactions = records.map((record: any, index: number) => {
      try {
        console.log(`🔍 Traitement ligne ${index + 1}:`, Object.keys(record))
        console.log(`📅 Date trouvée:`, record["Date"])
        
        // Vérifier que la date existe (essayer différentes variantes)
        let dateValue = record["Date"] || record["DATE"] || record["date"]
        if (!dateValue) {
          console.log(`❌ Colonnes disponibles:`, Object.keys(record))
          throw new Error(`Colonne "Date" manquante ou vide à la ligne ${index + 1}. Colonnes disponibles: ${Object.keys(record).join(', ')}`)
        }
        
        // Parser la date (format: DD/MM/YYYY HH:MM)
        const [datePart, timePart] = dateValue.split(' ')
        const [day, month, year] = datePart.split('/')
        const isoDate = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T${timePart}:00Z`

        // Vérifier les valeurs requises
        const scNumeroTransfert = record["SC Numéro du transfert"]
        if (!scNumeroTransfert || scNumeroTransfert.trim() === '') {
          throw new Error(`SC Numéro du transfert manquant ou vide à la ligne ${index + 1}`)
        }

        const guichetier = record["Guichetier"]
        if (!guichetier || guichetier.trim() === '') {
          throw new Error(`Guichetier manquant ou vide à la ligne ${index + 1}`)
        }

        const succursale = record["Succursale"]
        if (!succursale || succursale.trim() === '') {
          throw new Error(`Succursale manquante ou vide à la ligne ${index + 1}`)
        }

        const codeAgence = record["Code d'agence"]
        if (!codeAgence || codeAgence.trim() === '') {
          throw new Error(`Code d'agence manquant ou vide à la ligne ${index + 1}`)
        }

        // Valeurs de base
        const sentAmount = parseFloat(record["Sent Amount"]?.replace(/,/g, '.') || '0')
        const commissionSa = parseFloat(record["Commission SA"]?.replace(/,/g, '.') || '0')
        const ttf = parseFloat(record["TTF"]?.replace(/,/g, '.') || '0')
        const cte = parseFloat(record["CTE"]?.replace(/,/g, '.') || '0')
        const tva = parseFloat(record["TVA1"]?.replace(/,/g, '.') || '0')
        // Normaliser la valeur d'action pour respecter la contrainte de la base de données
        const actionValue = (record["Action"] || '').toString().trim()
        let action: 'Envoyé' | 'Payé' | 'Annulé' | 'Remboursé' | 'En attente'
        
        // Fonction de normalisation des caractères corrompus
        const normalizeAction = (value: string): string => {
          return value
            .toLowerCase()
            .replace(/[éèêë]/g, 'e')
            .replace(/[àâä]/g, 'a')
            .replace(/[ùûü]/g, 'u')
            .replace(/[îï]/g, 'i')
            .replace(/[ôö]/g, 'o')
            .replace(/[ç]/g, 'c')
            .replace(/[^a-z\s_-]/g, '') // Supprimer les caractères non-alphabétiques
            .trim()
        }
        
        const normalizedAction = normalizeAction(actionValue)
        console.log(`  - Action originale: "${actionValue}" → normalisée: "${normalizedAction}"`)
        
        // Mapping des valeurs d'action possibles vers les valeurs attendues
        const actionMapping: { [key: string]: 'Envoyé' | 'Payé' | 'Annulé' | 'Remboursé' | 'En attente' } = {
          'envoye': 'Envoyé',
          'envoyé': 'Envoyé',
          'envoye': 'Envoyé',
          'envoy': 'Envoyé',  // Cas partiel pour caractères corrompus
          'paye': 'Payé',
          'payé': 'Payé',
          'paye': 'Payé',
          'pay': 'Payé',      // Cas partiel pour caractères corrompus
          'annule': 'Annulé',
          'annulé': 'Annulé',
          'annule': 'Annulé',
          'annul': 'Annulé',  // Cas partiel pour caractères corrompus
          'rembourse': 'Remboursé',
          'remboursé': 'Remboursé',
          'rembourse': 'Remboursé',
          'rembours': 'Remboursé', // Cas partiel pour caractères corrompus
          'en attente': 'En attente',
          'en_attente': 'En attente',
          'en-attente': 'En attente',
          'attente': 'En attente',
          'en att': 'En attente', // Cas partiel pour caractères corrompus
          'att': 'En attente'     // Cas partiel pour caractères corrompus
        }
        
        // Essayer d'abord la correspondance exacte
        action = actionMapping[normalizedAction]
        
        // Si pas de correspondance exacte, essayer une correspondance partielle
        if (!action) {
          const partialMatches = Object.keys(actionMapping).filter(key => 
            normalizedAction.includes(key) || key.includes(normalizedAction)
          )
          
          if (partialMatches.length > 0) {
            // Prendre la correspondance la plus longue
            const bestMatch = partialMatches.reduce((a, b) => a.length > b.length ? a : b)
            action = actionMapping[bestMatch]
            console.log(`  - Correspondance partielle trouvée: "${normalizedAction}" → "${bestMatch}" → "${action}"`)
          }
        }
        
        // Si toujours pas de correspondance, utiliser la valeur originale
        if (!action) {
          action = actionValue as any
        }
        
        // Vérifier que l'action est valide
        const validActions = ['Envoyé', 'Payé', 'Annulé', 'Remboursé', 'En attente']
        if (!validActions.includes(action)) {
          throw new Error(`Valeur d'action invalide à la ligne ${index + 1}: "${actionValue}" (normalisée: "${normalizedAction}"). Valeurs acceptées: ${validActions.join(', ')}`)
        }
        
        console.log(`  - Action finale: "${actionValue}" → "${action}"`)

        // Calculs des commissions selon les formules
        const commissionRia = Math.round(commissionSa * 70.0 / 100.0 * 100) / 100
        const tvaRia = Math.round(commissionRia * 18.9 / 100.0 * 100) / 100
        const commissionUba = Math.round(commissionSa * 15.0 / 100.0 * 100) / 100
        const tvaUba = Math.round(commissionUba * 18.9 / 100.0 * 100) / 100
        const commissionZtf = commissionUba
        const caZtf = Math.round(tvaUba * 5.0 / 100.0 * 100) / 100
        const tvaZtf = Math.round((tvaUba - caZtf) * 100) / 100
        const cteCalculated = Math.round(sentAmount * 0.25 / 100.0 * 100) / 100
        const ttfCalculated = Math.round(sentAmount * 1.5 / 100.0 * 100) / 100
        const montantPrincipal = sentAmount
        const fraisClientCalculated = commissionSa
        // Montant brut = (Montant principal + Total frais) - Total Délestage
        const delestageAmount = delestages[guichetier] || 0
        const montantBrut = sentAmount + commissionSa - delestageAmount
        const isRemboursement = action === 'Annulé' || action === 'Remboursé'

        return {
          sc_numero_transfert: scNumeroTransfert.trim(),
          pin: record["Pin"] || null,
          mode_livraison: record["Mode de livraison"] || null,
          guichetier: guichetier.trim(),
          succursale: succursale.trim(),
          code_agence: codeAgence.trim(),
          sent_amount: sentAmount,
          sending_currency: record["Sending Currency"] || 'XAF',
          pays_origine: record["Pays d'origine"] || null,
          pays_destination: record["Pays de destination"] || null,
          montant_paiement: record["Montant du paiement"] ? 
            parseFloat(record["Montant du paiement"].replace(/,/g, '.')) : null,
          devise_beneficiaire: record["Devise du Bénéficiaire"] || null,
          commission_sa: commissionSa,
          devise_commission_sa: record["Devise Comission SA"] || 'XAF',
          date_operation: new Date(isoDate).toISOString(),
          taux: record["Taux"] ? parseFloat(record["Taux"].replace(/,/g, '.')) : null,
          ttf: ttf,
          cte: cte,
          tva1: tva,
          montant_a_payer: record["Montant a payer"] ? 
            parseFloat(record["Montant a payer"].replace(/,/g, '.')) : null,
          frais_client: record["Frais Client"] ? 
            parseFloat(record["Frais Client"].replace(/,/g, '.')) : null,
          action: action,
          // Calculs dérivés
          commission_ria: commissionRia,
          tva_ria: tvaRia,
          commission_uba: commissionUba,
          tva_uba: tvaUba,
          commission_ztf: commissionZtf,
          ca_ztf: caZtf,
          tva_ztf: tvaZtf,
          cte_calculated: cteCalculated,
          ttf_calculated: ttfCalculated,
          montant_principal: montantPrincipal,
          frais_client_calculated: fraisClientCalculated,
          montant_brut: montantBrut,
          is_remboursement: isRemboursement
        }
      } catch (error) {
        console.error(`Erreur ligne ${index + 1}:`, error)
        throw new Error(`Erreur ligne ${index + 1}: ${error}`)
      }
    })

    console.log(`✅ ${transactions.length} transactions préparées pour l'importation`)

    // Importer dans la base de données
    console.log('💾 Début de l\'importation en base de données...')
    await importRiaTransactions(transactions, delestages)
    console.log('✅ Importation en base terminée avec succès')

    return NextResponse.json({
      ok: true,
      message: `${transactions.length} transactions RIA importées avec succès`,
      data: {
        count: transactions.length,
        transactions: transactions.slice(0, 5) // Retourner les 5 premières pour vérification
      }
    })

  } catch (error: any) {
    console.error("Erreur lors de l'importation CSV RIA:", error)
    return NextResponse.json({ 
      ok: false, 
      error: error.message 
    }, { status: 500 })
  }
}
