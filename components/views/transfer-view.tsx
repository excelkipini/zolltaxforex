"use client"

import * as React from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { QRCodeSVG } from "qrcode.react"
import { useToast } from "@/hooks/use-toast"
import { useExchangeRates } from "@/hooks/use-exchange-rates"
import { Calculator, Send, CheckCircle, AlertCircle, Upload, FileText, X, Eye, Printer, ChevronsUpDown, Check } from "lucide-react"
import { cn } from "@/lib/utils"
import { CashierPendingTransactionsByType } from "./cashier-pending-transactions-by-type"
import { DailyOperations } from "./daily-operations"
import { getSessionClient, SessionUser } from "@/lib/auth-client"

type TransferData = {
  beneficiaryName: string
  destinationCountry: string
  destinationCity: string
  amountReceived: number
  receivedCurrency: string
  amountToSend: number
  sendCurrency: string
  withdrawalMode: "cash" | "bank_transfer"
  transferMethod: string
  ibanFile?: File
}

export function TransferView() {
  const [transferData, setTransferData] = React.useState<TransferData>({
    beneficiaryName: "",
    destinationCountry: "",
    destinationCity: "",
    amountReceived: 0,
    receivedCurrency: "XAF",
    amountToSend: 0,
    sendCurrency: "XAF",
    withdrawalMode: "cash",
    transferMethod: "",
    ibanFile: undefined
  })
  
  const [errors, setErrors] = React.useState<Record<string, string>>({})
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [transferId, setTransferId] = React.useState<string>("")
  const [qrCodeError, setQrCodeError] = React.useState(false)
  const [isPrinting, setIsPrinting] = React.useState(false)
  const [countryPopoverOpen, setCountryPopoverOpen] = React.useState(false)
  const [feeMode, setFeeMode] = React.useState<"with_fees" | "without_fees">("with_fees")
  const { toast } = useToast()
  const { rates } = useExchangeRates()
  
  // Récupérer l'utilisateur connecté
  const [user, setUser] = React.useState<SessionUser | null>(null)
  
  React.useEffect(() => {
    const sessionUser = getSessionClient()
    if (sessionUser) {
      setUser(sessionUser)
    }
  }, [])

  // Moyens de transfert disponibles
  const transferMethods = [
    "MoneyGram",
    "Ria Money Transfer", 
    "Western Union",
    "Autre"
  ]

  // Mapping pays -> zone géographique pour les grilles tarifaires
  const countryToZone: Record<string, string> = {
    // Afrique Centrale
    "Cameroun": "Afrique Centrale",
    "Centrafrique": "Afrique Centrale",
    "Tchad": "Afrique Centrale",
    "Congo": "Afrique Centrale",
    "Gabon": "Afrique Centrale",
    "Guinée équatoriale": "Afrique Centrale",
    "RDC": "Afrique Centrale",
    // Afrique de l'Ouest
    "Bénin": "Afrique de l'Ouest",
    "Burkina Faso": "Afrique de l'Ouest",
    "Côte d'Ivoire": "Afrique de l'Ouest",
    "Gambie": "Afrique de l'Ouest",
    "Ghana": "Afrique de l'Ouest",
    "Guinée": "Afrique de l'Ouest",
    "Guinée-Bissau": "Afrique de l'Ouest",
    "Mali": "Afrique de l'Ouest",
    "Niger": "Afrique de l'Ouest",
    "Nigeria": "Afrique de l'Ouest",
    "Sénégal": "Afrique de l'Ouest",
    "Sierra Leone": "Afrique de l'Ouest",
    "Togo": "Afrique de l'Ouest",
    // Chine, Turquie, UAE et Liban
    "Chine": "Chine, Turquie, UAE et Liban",
    "Turquie": "Chine, Turquie, UAE et Liban",
    "Émirats arabes unis": "Chine, Turquie, UAE et Liban",
    "Liban": "Chine, Turquie, UAE et Liban",
    // Reste de l'Afrique (tous les autres pays d'Afrique)
    "Afrique du Sud": "Reste de l'Afrique",
    "Algérie": "Reste de l'Afrique",
    "Angola": "Reste de l'Afrique",
    "Botswana": "Reste de l'Afrique",
    "Burundi": "Reste de l'Afrique",
    "Cap-Vert": "Reste de l'Afrique",
    "Comores": "Reste de l'Afrique",
    "Djibouti": "Reste de l'Afrique",
    "Égypte": "Reste de l'Afrique",
    "Érythrée": "Reste de l'Afrique",
    "Eswatini": "Reste de l'Afrique",
    "Éthiopie": "Reste de l'Afrique",
    "Kenya": "Reste de l'Afrique",
    "Lesotho": "Reste de l'Afrique",
    "Liberia": "Reste de l'Afrique",
    "Libye": "Reste de l'Afrique",
    "Madagascar": "Reste de l'Afrique",
    "Malawi": "Reste de l'Afrique",
    "Maroc": "Reste de l'Afrique",
    "Maurice": "Reste de l'Afrique",
    "Mauritanie": "Reste de l'Afrique",
    "Mozambique": "Reste de l'Afrique",
    "Namibie": "Reste de l'Afrique",
    "Ouganda": "Reste de l'Afrique",
    "Rwanda": "Reste de l'Afrique",
    "São Tomé-et-Príncipe": "Reste de l'Afrique",
    "Seychelles": "Reste de l'Afrique",
    "Somalie": "Reste de l'Afrique",
    "Soudan": "Reste de l'Afrique",
    "Soudan du Sud": "Reste de l'Afrique",
    "Tanzanie": "Reste de l'Afrique",
    "Tunisie": "Reste de l'Afrique",
    "Zambie": "Reste de l'Afrique",
    "Zimbabwe": "Reste de l'Afrique",
    // Europe (tous les pays d'Europe sauf France)
    "Albanie": "Europe",
    "Allemagne": "Europe",
    "Andorre": "Europe",
    "Autriche": "Europe",
    "Biélorussie": "Europe",
    "Belgique": "Europe",
    "Bosnie-Herzégovine": "Europe",
    "Bulgarie": "Europe",
    "Chypre": "Europe",
    "Croatie": "Europe",
    "Danemark": "Europe",
    "Espagne": "Europe",
    "Estonie": "Europe",
    "Finlande": "Europe",
    "Grèce": "Europe",
    "Hongrie": "Europe",
    "Irlande": "Europe",
    "Islande": "Europe",
    "Italie": "Europe",
    "Lettonie": "Europe",
    "Liechtenstein": "Europe",
    "Lituanie": "Europe",
    "Luxembourg": "Europe",
    "Macédoine du Nord": "Europe",
    "Malte": "Europe",
    "Moldavie": "Europe",
    "Monaco": "Europe",
    "Monténégro": "Europe",
    "Norvège": "Europe",
    "Pays-Bas": "Europe",
    "Pologne": "Europe",
    "Portugal": "Europe",
    "République tchèque": "Europe",
    "Roumanie": "Europe",
    "Royaume-Uni": "Europe",
    "Russie": "Europe",
    "Saint-Marin": "Europe",
    "Serbie": "Europe",
    "Slovaquie": "Europe",
    "Slovénie": "Europe",
    "Suède": "Europe",
    "Suisse": "Europe",
    "Ukraine": "Europe",
    "Vatican": "Europe",
    // France (Next Day)
    "France": "France (Next Day)",
    // Reste du monde (tous les autres pays)
    "Canada": "Reste du monde",
    "États-Unis": "Reste du monde",
    "Mexique": "Reste du monde",
    "Guatemala": "Reste du monde",
    "Belize": "Reste du monde",
    "El Salvador": "Reste du monde",
    "Honduras": "Reste du monde",
    "Nicaragua": "Reste du monde",
    "Costa Rica": "Reste du monde",
    "Panama": "Reste du monde",
    "Cuba": "Reste du monde",
    "Jamaïque": "Reste du monde",
    "Haïti": "Reste du monde",
    "République dominicaine": "Reste du monde",
    "Trinité-et-Tobago": "Reste du monde",
    "Barbade": "Reste du monde",
    "Bahamas": "Reste du monde",
    "Antigua-et-Barbuda": "Reste du monde",
    "Dominique": "Reste du monde",
    "Grenade": "Reste du monde",
    "Saint-Kitts-et-Nevis": "Reste du monde",
    "Sainte-Lucie": "Reste du monde",
    "Saint-Vincent-et-les-Grenadines": "Reste du monde",
    "Argentine": "Reste du monde",
    "Bolivie": "Reste du monde",
    "Brésil": "Reste du monde",
    "Chili": "Reste du monde",
    "Colombie": "Reste du monde",
    "Équateur": "Reste du monde",
    "Guyane": "Reste du monde",
    "Guyane française": "Reste du monde",
    "Paraguay": "Reste du monde",
    "Pérou": "Reste du monde",
    "Suriname": "Reste du monde",
    "Uruguay": "Reste du monde",
    "Venezuela": "Reste du monde",
    "Afghanistan": "Reste du monde",
    "Arabie saoudite": "Reste du monde",
    "Arménie": "Reste du monde",
    "Azerbaïdjan": "Reste du monde",
    "Bahreïn": "Reste du monde",
    "Bangladesh": "Reste du monde",
    "Bhoutan": "Reste du monde",
    "Birmanie": "Reste du monde",
    "Brunei": "Reste du monde",
    "Cambodge": "Reste du monde",
    "Corée du Nord": "Reste du monde",
    "Corée du Sud": "Reste du monde",
    "Géorgie": "Reste du monde",
    "Inde": "Reste du monde",
    "Indonésie": "Reste du monde",
    "Irak": "Reste du monde",
    "Iran": "Reste du monde",
    "Israël": "Reste du monde",
    "Japon": "Reste du monde",
    "Jordanie": "Reste du monde",
    "Kazakhstan": "Reste du monde",
    "Kirghizistan": "Reste du monde",
    "Koweït": "Reste du monde",
    "Laos": "Reste du monde",
    "Malaisie": "Reste du monde",
    "Maldives": "Reste du monde",
    "Mongolie": "Reste du monde",
    "Népal": "Reste du monde",
    "Oman": "Reste du monde",
    "Ouzbékistan": "Reste du monde",
    "Pakistan": "Reste du monde",
    "Palestine": "Reste du monde",
    "Philippines": "Reste du monde",
    "Qatar": "Reste du monde",
    "Singapour": "Reste du monde",
    "Sri Lanka": "Reste du monde",
    "Syrie": "Reste du monde",
    "Tadjikistan": "Reste du monde",
    "Taïwan": "Reste du monde",
    "Thaïlande": "Reste du monde",
    "Timor oriental": "Reste du monde",
    "Turkménistan": "Reste du monde",
    "Viêt Nam": "Reste du monde",
    "Yémen": "Reste du monde",
    "Australie": "Reste du monde",
    "Fidji": "Reste du monde",
    "Kiribati": "Reste du monde",
    "Marshall": "Reste du monde",
    "Micronésie": "Reste du monde",
    "Nauru": "Reste du monde",
    "Nouvelle-Zélande": "Reste du monde",
    "Palaos": "Reste du monde",
    "Papouasie-Nouvelle-Guinée": "Reste du monde",
    "Samoa": "Reste du monde",
    "Salomon": "Reste du monde",
    "Tonga": "Reste du monde",
    "Tuvalu": "Reste du monde",
    "Vanuatu": "Reste du monde"
  }

  // Grilles tarifaires par zone
  type TariffRule = {
    min: number
    max: number
    feeType: "percentage" | "fixed"
    feeValue: number // pourcentage ou montant fixe
    coverageRate: number // taux de couverture (0,50% pour tous)
  }

  const tariffGrids: Record<string, TariffRule[]> = {
    "Afrique Centrale": [
      { min: 0, max: 500000, feeType: "percentage", feeValue: 6, coverageRate: 0.5 },
      { min: 500001, max: 1000000, feeType: "fixed", feeValue: 45000, coverageRate: 0.5 }
    ],
    "Afrique de l'Ouest": [
      { min: 0, max: 500000, feeType: "percentage", feeValue: 6, coverageRate: 0.5 },
      { min: 500001, max: 1000000, feeType: "fixed", feeValue: 45000, coverageRate: 0.5 }
    ],
    "Chine, Turquie, UAE et Liban": [
      { min: 0, max: 500000, feeType: "percentage", feeValue: 5, coverageRate: 0.5 },
      { min: 500001, max: 1000000, feeType: "fixed", feeValue: 32500, coverageRate: 0.5 }
    ],
    "Reste de l'Afrique": [
      { min: 0, max: 500000, feeType: "percentage", feeValue: 4, coverageRate: 0.5 },
      { min: 500001, max: 1000000, feeType: "fixed", feeValue: 35000, coverageRate: 0.5 }
    ],
    "Europe": [
      { min: 0, max: 500000, feeType: "percentage", feeValue: 6, coverageRate: 0.5 },
      { min: 500001, max: 1000000, feeType: "fixed", feeValue: 50000, coverageRate: 0.5 }
    ],
    "France (Next Day)": [
      { min: 0, max: 500000, feeType: "fixed", feeValue: 17000, coverageRate: 0.5 },
      { min: 500001, max: 1000000, feeType: "fixed", feeValue: 24000, coverageRate: 0.5 }
    ],
    "Reste du monde": [
      { min: 0, max: 500000, feeType: "percentage", feeValue: 5, coverageRate: 0.5 },
      { min: 500001, max: 1000000, feeType: "fixed", feeValue: 35000, coverageRate: 0.5 }
    ]
  }


  // Type pour les détails de calcul
  type CalculationDetails = {
    fees: number
    vatAmount: number
    coverageAmount: number
    tstfAmount: number
    tax: number
    amountToCollect: number
    amountToSendXAF: number
  }

  // Fonction de calcul avec une règle spécifique - retourne les détails
  const calculateWithRule = (amountReceived: number, rule: TariffRule, zone: string): CalculationDetails => {
    // 1. Frais (Commission de Base)
    let fees: number
    if (rule.feeType === "percentage") {
      fees = amountReceived * (rule.feeValue / 100)
    } else {
      fees = rule.feeValue
    }

    // 2. Montant de la TVA (18,9% sur les frais)
    const vatAmount = fees * 0.189

    // 3. Montant RECUP. FRAIS DE COUV. (Taux de Couverture sur montant reçu)
    const coverageAmount = amountReceived * (rule.coverageRate / 100)

    // 4. Montant TSTF (Taxe Spéciale)
    let tstfAmount: number
    if (zone === "Afrique Centrale") {
      tstfAmount = amountReceived * 0.01 // 1,0%
    } else {
      tstfAmount = amountReceived * 0.015 // 1,5%
    }

    // 5. Taxe (Total des Surcharges)
    const tax = vatAmount + coverageAmount + tstfAmount

    return {
      fees: Math.round(fees * 100) / 100,
      vatAmount: Math.round(vatAmount * 100) / 100,
      coverageAmount: Math.round(coverageAmount * 100) / 100,
      tstfAmount: Math.round(tstfAmount * 100) / 100,
      tax: Math.round(tax * 100) / 100,
      amountToCollect: 0, // Sera calculé selon le mode
      amountToSendXAF: 0 // Sera calculé selon le mode
    }
  }

  // Fonction de calcul complète avec détails
  const calculateTransferDetails = (amountReceived: number, destinationCountry: string, mode: "with_fees" | "without_fees"): CalculationDetails | null => {
    if (amountReceived <= 0 || !destinationCountry) {
      return null
    }

    // 1. Déterminer la zone
    const zone = countryToZone[destinationCountry] || "Reste du monde"
    const grid = tariffGrids[zone] || tariffGrids["Reste du monde"]

    // 2. Trouver la règle tarifaire applicable
    const applicableRule = grid.find(rule => amountReceived >= rule.min && amountReceived <= rule.max)
    if (!applicableRule) {
      // Si le montant dépasse 1 000 000, utiliser la dernière règle
      const lastRule = grid[grid.length - 1]
      const details = calculateWithRule(amountReceived, lastRule, zone)
      return calculateFinalAmounts(details, amountReceived, mode)
    }

    const details = calculateWithRule(amountReceived, applicableRule, zone)
    return calculateFinalAmounts(details, amountReceived, mode)
  }

  // Calcul des montants finaux selon le mode
  const calculateFinalAmounts = (details: CalculationDetails, amountReceived: number, mode: "with_fees" | "without_fees"): CalculationDetails => {
    if (mode === "with_fees") {
      // Avec frais : Montant à collecter = Montant reçu + Frais + Taxe
      // Montant à envoyer = Montant reçu
      details.amountToCollect = Math.round((amountReceived + details.fees + details.tax) * 100) / 100
      details.amountToSendXAF = amountReceived
    } else {
      // Sans frais : Montant à collecter = Montant reçu
      // Montant à envoyer = Montant reçu - (Frais + Taxe)
      details.amountToCollect = amountReceived
      details.amountToSendXAF = Math.max(0, Math.round((amountReceived - details.fees - details.tax) * 100) / 100)
    }
    return details
  }

  // Conversion de devise : Devise source vers XAF
  const convertToXAF = (amount: number, currency: string): number => {
    if (currency === "XAF") {
      return amount
    }

    // Taux de conversion vers XAF
    const conversionRates: Record<string, number> = {
      USD: rates.USD,
      EUR: rates.EUR,
      GBP: rates.GBP,
      // Pour les autres devises, on utilise des taux approximatifs basés sur USD
      CAD: rates.USD * 1.35,
      CHF: rates.USD * 0.92,
      JPY: rates.USD * 0.0067,
      CNY: rates.USD * 0.14,
      AUD: rates.USD * 0.65,
      NZD: rates.USD * 0.60,
      // Ajoutez d'autres devises si nécessaire
    }

    const rate = conversionRates[currency] || rates.USD // Par défaut, utiliser USD
    return Math.round((amount * rate) * 100) / 100
  }

  // Conversion de devise : XAF vers devise de destination
  const convertFromXAF = (amountXAF: number, destinationCurrency: string): number => {
    // Si la devise est XAF, pas de conversion
    if (destinationCurrency === "XAF") {
      return amountXAF
    }

    // Taux de conversion de base (XAF vers autres devises)
    // On utilise les taux inverses : si 1 USD = 580 XAF, alors 1 XAF = 1/580 USD
    const conversionRates: Record<string, number> = {
      USD: 1 / rates.USD,
      EUR: 1 / rates.EUR,
      GBP: 1 / rates.GBP,
      // Pour les autres devises, on utilise des taux approximatifs basés sur USD
      CAD: 1 / (rates.USD * 1.35),
      CHF: 1 / (rates.USD * 0.92),
      JPY: 1 / (rates.USD * 0.0067),
      CNY: 1 / (rates.USD * 0.14),
      AUD: 1 / (rates.USD * 0.65),
      NZD: 1 / (rates.USD * 0.60),
      // Ajoutez d'autres devises si nécessaire
    }

    const rate = conversionRates[destinationCurrency] || (1 / rates.USD) // Par défaut, utiliser USD
    return Math.round((amountXAF * rate) * 100) / 100
  }

  // État pour stocker les détails de calcul
  const [calculationDetails, setCalculationDetails] = React.useState<CalculationDetails | null>(null)

  // Calcul automatique selon le mode
  React.useEffect(() => {
    if (transferData.amountReceived > 0 && transferData.destinationCountry) {
      // Convertir le montant reçu en XAF pour les calculs (les grilles tarifaires sont en XAF)
      const amountReceivedXAF = convertToXAF(transferData.amountReceived, transferData.receivedCurrency)
      const details = calculateTransferDetails(amountReceivedXAF, transferData.destinationCountry, feeMode)
      if (details) {
        setCalculationDetails(details)
        // Convertir le montant à envoyer dans la devise de destination
        const convertedAmount = convertFromXAF(details.amountToSendXAF, transferData.sendCurrency)
        setTransferData(prev => ({ ...prev, amountToSend: convertedAmount }))
      }
    } else {
      setCalculationDetails(null)
      setTransferData(prev => ({ ...prev, amountToSend: 0 }))
    }
  }, [transferData.amountReceived, transferData.receivedCurrency, transferData.destinationCountry, feeMode, transferData.sendCurrency, rates])

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {}

    if (!transferData.beneficiaryName.trim()) {
      newErrors.beneficiaryName = "Le nom du bénéficiaire est requis"
    }

    if (!transferData.destinationCountry.trim()) {
      newErrors.destinationCountry = "Le pays de destination est requis"
    }

    if (!transferData.destinationCity.trim()) {
      newErrors.destinationCity = "La ville de destination est requise"
    }

    if (!transferData.transferMethod.trim()) {
      newErrors.transferMethod = "Le moyen de transfert est requis"
    }

    if (transferData.amountReceived <= 0) {
      newErrors.amountReceived = "Le montant reçu doit être supérieur à 0"
    }

    if (transferData.amountToSend <= 0) {
      newErrors.amountToSend = "Le montant à envoyer doit être supérieur à 0"
    }

    if (transferData.withdrawalMode === "bank_transfer" && !transferData.ibanFile) {
      newErrors.ibanFile = "Le fichier IBAN est requis pour un virement bancaire"
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async () => {
    if (!validateForm()) {
      toast({
        title: "Erreur de validation",
        description: "Veuillez corriger les erreurs avant de continuer",
        variant: "destructive"
      })
      return
    }

    // Vérifier que les détails de calcul sont disponibles
    if (!calculationDetails) {
      toast({
        title: "Erreur de calcul",
        description: "Les détails de calcul ne sont pas disponibles. Veuillez vérifier le montant reçu et le pays de destination.",
        variant: "destructive"
      })
      return
    }

    setIsSubmitting(true)
    
    try {
      // Génération d'un ID de transfert
      const newTransferId = `TRF-${Date.now().toString().slice(-8)}`
      
      // Convertir le fichier IBAN en base64 pour le stockage
      let ibanFileData = null
      if (transferData.ibanFile) {
        try {
          const arrayBuffer = await transferData.ibanFile.arrayBuffer()
          const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)))
          ibanFileData = {
            name: transferData.ibanFile.name,
            type: transferData.ibanFile.type,
            size: transferData.ibanFile.size,
            data: base64
          }
        } catch (error) {
          console.error('Erreur lors de la conversion du fichier IBAN:', error)
        }
      }

      // Sauvegarder dans la base de données via l'API
      const response = await fetch('/api/transactions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: "transfer",
          description: `Transfert d'argent vers ${transferData.destinationCountry}`,
          amount: calculationDetails.amountToCollect,
          currency: transferData.receivedCurrency,
          details: {
            beneficiary_name: transferData.beneficiaryName,
            destination_country: transferData.destinationCountry,
            destination_city: transferData.destinationCity,
            transfer_method: transferData.transferMethod,
            amount_received: transferData.amountReceived,
            received_currency: transferData.receivedCurrency,
            amount_sent: transferData.amountToSend,
            sent_currency: transferData.sendCurrency,
            withdrawal_mode: transferData.withdrawalMode,
            iban_file: transferData.ibanFile?.name || null,
            iban_file_data: ibanFileData,
            // Nouvelles informations de calcul
            fee_mode: feeMode,
            fees: calculationDetails.fees,
            vat_amount: calculationDetails.vatAmount,
            coverage_amount: calculationDetails.coverageAmount,
            tstf_amount: calculationDetails.tstfAmount,
            tax: calculationDetails.tax,
            amount_to_collect: calculationDetails.amountToCollect,
            amount_to_send_xaf: calculationDetails.amountToSendXAF
          }
        })
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Erreur inconnue' }))
        throw new Error(errorData.error || 'Erreur lors de la sauvegarde')
      }

      const result = await response.json()
      
      if (!result.ok) {
        throw new Error(result.error || 'Erreur lors de la sauvegarde')
      }

      const newTransaction = result.data
      setTransferId(newTransferId)
      
      // Déclencher un événement personnalisé pour notifier les autres composants
      window.dispatchEvent(new CustomEvent('transferCreated', { detail: newTransaction }))
      
      toast({
        title: "Transfert soumis avec succès",
        description: `Le transfert ${newTransferId} a été soumis et est en attente de validation par l'auditeur`,
      })

      // Réinitialisation du formulaire
      setTransferData({
        beneficiaryName: "",
        destinationCountry: "",
        destinationCity: "",
        transferMethod: "",
        amountReceived: 0,
        receivedCurrency: "XAF",
        amountToSend: 0,
        sendCurrency: "XAF",
        withdrawalMode: "cash",
        ibanFile: undefined
      })
      
      // Réinitialiser les détails de calcul
      setCalculationDetails(null)
      
    } catch (error: any) {
      console.error('Erreur lors de la soumission du transfert:', error)
      toast({
        title: "Erreur",
        description: error.message || "Une erreur est survenue lors de l'envoi du transfert",
        variant: "destructive"
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  // Liste complète des pays couverts par Western Union, Ria et MoneyGram
  const countries = [
    // Afrique
    "Afrique du Sud", "Algérie", "Angola", "Bénin", "Botswana", "Burkina Faso", "Burundi",
    "Cameroun", "Cap-Vert", "Centrafrique", "Tchad", "Comores", "Congo", "RDC", "Côte d'Ivoire",
    "Djibouti", "Égypte", "Érythrée", "Eswatini", "Éthiopie", "Gabon", "Gambie", "Ghana",
    "Guinée", "Guinée-Bissau", "Guinée équatoriale", "Kenya", "Lesotho", "Liberia", "Libye",
    "Madagascar", "Malawi", "Mali", "Maroc", "Maurice", "Mauritanie", "Mozambique", "Namibie",
    "Niger", "Nigeria", "Ouganda", "Rwanda", "São Tomé-et-Príncipe", "Sénégal", "Seychelles",
    "Sierra Leone", "Somalie", "Soudan", "Soudan du Sud", "Tanzanie", "Togo", "Tunisie",
    "Zambie", "Zimbabwe",
    // Amérique du Nord
    "Canada", "États-Unis", "Mexique", "Guatemala", "Belize", "El Salvador", "Honduras",
    "Nicaragua", "Costa Rica", "Panama", "Cuba", "Jamaïque", "Haïti", "République dominicaine",
    "Trinité-et-Tobago", "Barbade", "Bahamas", "Antigua-et-Barbuda", "Dominique", "Grenade",
    "Saint-Kitts-et-Nevis", "Sainte-Lucie", "Saint-Vincent-et-les-Grenadines",
    // Amérique du Sud
    "Argentine", "Bolivie", "Brésil", "Chili", "Colombie", "Équateur", "Guyane", "Guyane française",
    "Paraguay", "Pérou", "Suriname", "Uruguay", "Venezuela",
    // Asie
    "Afghanistan", "Arabie saoudite", "Arménie", "Azerbaïdjan", "Bahreïn", "Bangladesh", "Bhoutan",
    "Birmanie", "Brunei", "Cambodge", "Chine", "Corée du Nord", "Corée du Sud", "Émirats arabes unis",
    "Géorgie", "Inde", "Indonésie", "Irak", "Iran", "Israël", "Japon", "Jordanie", "Kazakhstan",
    "Kirghizistan", "Koweït", "Laos", "Liban", "Malaisie", "Maldives", "Mongolie", "Népal",
    "Oman", "Ouzbékistan", "Pakistan", "Palestine", "Philippines", "Qatar", "Singapour", "Sri Lanka",
    "Syrie", "Tadjikistan", "Taïwan", "Thaïlande", "Timor oriental", "Turkménistan", "Turquie",
    "Viêt Nam", "Yémen",
    // Europe
    "Albanie", "Allemagne", "Andorre", "Autriche", "Biélorussie", "Belgique", "Bosnie-Herzégovine",
    "Bulgarie", "Chypre", "Croatie", "Danemark", "Espagne", "Estonie", "Finlande", "France",
    "Grèce", "Hongrie", "Irlande", "Islande", "Italie", "Lettonie", "Liechtenstein", "Lituanie",
    "Luxembourg", "Macédoine du Nord", "Malte", "Moldavie", "Monaco", "Monténégro", "Norvège",
    "Pays-Bas", "Pologne", "Portugal", "République tchèque", "Roumanie", "Royaume-Uni", "Russie",
    "Saint-Marin", "Serbie", "Slovaquie", "Slovénie", "Suède", "Suisse", "Ukraine", "Vatican",
    // Océanie
    "Australie", "Fidji", "Kiribati", "Marshall", "Micronésie", "Nauru", "Nouvelle-Zélande",
    "Palaos", "Papouasie-Nouvelle-Guinée", "Samoa", "Salomon", "Tonga", "Tuvalu", "Vanuatu"
  ].sort()

  // Mapping pays -> devise principale
  const countryToCurrency: Record<string, string> = {
    // Afrique
    "Afrique du Sud": "ZAR",
    "Algérie": "DZD",
    "Angola": "USD",
    "Bénin": "XOF",
    "Botswana": "BWP",
    "Burkina Faso": "XOF",
    "Burundi": "BIF",
    "Cameroun": "XAF",
    "Cap-Vert": "CVE",
    "Centrafrique": "XAF",
    "Tchad": "XAF",
    "Comores": "KMF",
    "Congo": "XAF",
    "RDC": "USD",
    "Côte d'Ivoire": "XOF",
    "Djibouti": "DJF",
    "Égypte": "EGP",
    "Érythrée": "ERN",
    "Eswatini": "SZL",
    "Éthiopie": "ETB",
    "Gabon": "XAF",
    "Gambie": "GMD",
    "Ghana": "GHS",
    "Guinée": "GNF",
    "Guinée-Bissau": "XOF",
    "Guinée équatoriale": "XAF",
    "Kenya": "KES",
    "Lesotho": "LSL",
    "Liberia": "LRD",
    "Libye": "LYD",
    "Madagascar": "MGA",
    "Malawi": "MWK",
    "Mali": "XOF",
    "Maroc": "MAD",
    "Maurice": "MUR",
    "Mauritanie": "MRU",
    "Mozambique": "MZN",
    "Namibie": "NAD",
    "Niger": "XOF",
    "Nigeria": "NGN",
    "Ouganda": "UGX",
    "Rwanda": "RWF",
    "São Tomé-et-Príncipe": "STN",
    "Sénégal": "XOF",
    "Seychelles": "SCR",
    "Sierra Leone": "SLL",
    "Somalie": "SOS",
    "Soudan": "SDG",
    "Soudan du Sud": "SSP",
    "Tanzanie": "TZS",
    "Togo": "XOF",
    "Tunisie": "TND",
    "Zambie": "ZMW",
    "Zimbabwe": "USD",
    // Amérique du Nord
    "Canada": "CAD",
    "États-Unis": "USD",
    "Mexique": "MXN",
    "Guatemala": "GTQ",
    "Belize": "BZD",
    "El Salvador": "USD",
    "Honduras": "HNL",
    "Nicaragua": "NIO",
    "Costa Rica": "CRC",
    "Panama": "USD",
    "Cuba": "CUP",
    "Jamaïque": "JMD",
    "Haïti": "HTG",
    "République dominicaine": "DOP",
    "Trinité-et-Tobago": "TTD",
    "Barbade": "BBD",
    "Bahamas": "BSD",
    "Antigua-et-Barbuda": "XCD",
    "Dominique": "XCD",
    "Grenade": "XCD",
    "Saint-Kitts-et-Nevis": "XCD",
    "Sainte-Lucie": "XCD",
    "Saint-Vincent-et-les-Grenadines": "XCD",
    // Amérique du Sud
    "Argentine": "ARS",
    "Bolivie": "BOB",
    "Brésil": "BRL",
    "Chili": "CLP",
    "Colombie": "COP",
    "Équateur": "USD",
    "Guyane": "GYD",
    "Guyane française": "EUR",
    "Paraguay": "PYG",
    "Pérou": "PEN",
    "Suriname": "SRD",
    "Uruguay": "UYU",
    "Venezuela": "VES",
    // Asie
    "Afghanistan": "AFN",
    "Arabie saoudite": "SAR",
    "Arménie": "AMD",
    "Azerbaïdjan": "AZN",
    "Bahreïn": "BHD",
    "Bangladesh": "BDT",
    "Bhoutan": "BTN",
    "Birmanie": "MMK",
    "Brunei": "BND",
    "Cambodge": "KHR",
    "Chine": "CNY",
    "Corée du Nord": "KPW",
    "Corée du Sud": "KRW",
    "Émirats arabes unis": "AED",
    "Géorgie": "GEL",
    "Inde": "INR",
    "Indonésie": "IDR",
    "Irak": "IQD",
    "Iran": "IRR",
    "Israël": "ILS",
    "Japon": "JPY",
    "Jordanie": "JOD",
    "Kazakhstan": "KZT",
    "Kirghizistan": "KGS",
    "Koweït": "KWD",
    "Laos": "LAK",
    "Liban": "LBP",
    "Malaisie": "MYR",
    "Maldives": "MVR",
    "Mongolie": "MNT",
    "Népal": "NPR",
    "Oman": "OMR",
    "Ouzbékistan": "UZS",
    "Pakistan": "PKR",
    "Palestine": "ILS",
    "Philippines": "PHP",
    "Qatar": "QAR",
    "Singapour": "SGD",
    "Sri Lanka": "LKR",
    "Syrie": "SYP",
    "Tadjikistan": "TJS",
    "Taïwan": "TWD",
    "Thaïlande": "THB",
    "Timor oriental": "USD",
    "Turkménistan": "TMT",
    "Turquie": "TRY",
    "Viêt Nam": "VND",
    "Yémen": "YER",
    // Europe
    "Albanie": "ALL",
    "Allemagne": "EUR",
    "Andorre": "EUR",
    "Autriche": "EUR",
    "Biélorussie": "BYN",
    "Belgique": "EUR",
    "Bosnie-Herzégovine": "BAM",
    "Bulgarie": "BGN",
    "Chypre": "EUR",
    "Croatie": "EUR",
    "Danemark": "DKK",
    "Espagne": "EUR",
    "Estonie": "EUR",
    "Finlande": "EUR",
    "France": "EUR",
    "Grèce": "EUR",
    "Hongrie": "HUF",
    "Irlande": "EUR",
    "Islande": "ISK",
    "Italie": "EUR",
    "Lettonie": "EUR",
    "Liechtenstein": "CHF",
    "Lituanie": "EUR",
    "Luxembourg": "EUR",
    "Macédoine du Nord": "MKD",
    "Malte": "EUR",
    "Moldavie": "MDL",
    "Monaco": "EUR",
    "Monténégro": "EUR",
    "Norvège": "NOK",
    "Pays-Bas": "EUR",
    "Pologne": "PLN",
    "Portugal": "EUR",
    "République tchèque": "CZK",
    "Roumanie": "RON",
    "Royaume-Uni": "GBP",
    "Russie": "RUB",
    "Saint-Marin": "EUR",
    "Serbie": "RSD",
    "Slovaquie": "EUR",
    "Slovénie": "EUR",
    "Suède": "SEK",
    "Suisse": "CHF",
    "Ukraine": "UAH",
    "Vatican": "EUR",
    // Océanie
    "Australie": "AUD",
    "Fidji": "FJD",
    "Kiribati": "AUD",
    "Marshall": "USD",
    "Micronésie": "USD",
    "Nauru": "AUD",
    "Nouvelle-Zélande": "NZD",
    "Palaos": "USD",
    "Papouasie-Nouvelle-Guinée": "PGK",
    "Samoa": "WST",
    "Salomon": "SBD",
    "Tonga": "TOP",
    "Tuvalu": "AUD",
    "Vanuatu": "VUV"
  }

  // Sélection automatique de la devise selon le pays
  React.useEffect(() => {
    if (transferData.destinationCountry && countryToCurrency[transferData.destinationCountry]) {
      const currency = countryToCurrency[transferData.destinationCountry]
      setTransferData(prev => ({ ...prev, sendCurrency: currency }))
    }
  }, [transferData.destinationCountry])

  // Liste complète des devises les plus répandues
  const currencies = [
    "XAF", "USD", "EUR", "GBP", "JPY", "CNY", "AUD", "CAD", "CHF", "HKD", "SGD", "NZD",
    "INR", "BRL", "MXN", "ZAR", "TRY", "RUB", "KRW", "SEK", "NOK", "DKK", "PLN", "THB",
    "MYR", "PHP", "IDR", "VND", "EGP", "NGN", "KES", "GHS", "ETB", "TZS", "UGX", "MAD",
    "TND", "DZD", "XOF", "XPF", "ARS", "CLP", "COP", "PEN", "UYU", "PYG", "BOB", "VES",
    "ILS", "AED", "SAR", "QAR", "KWD", "BHD", "OMR", "JOD", "LBP", "IQD", "IRR", "AFN",
    "PKR", "BDT", "LKR", "NPR", "MMK", "KHR", "LAK", "MNT", "KZT", "UZS", "TJS", "TMT",
    "AZN", "AMD", "GEL", "BYN", "MDL", "BGN", "RON", "RSD", "BAM", "MKD", "ALL", "HRK",
    "ISK", "CZK", "HUF"
  ].sort()

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      // Vérifier le type de fichier (PDF, images, etc.)
      const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg']
      if (!allowedTypes.includes(file.type)) {
        toast({
          title: "Type de fichier non supporté",
          description: "Veuillez sélectionner un fichier PDF ou une image (JPG, PNG)",
          variant: "destructive"
        })
        return
      }
      
      // Vérifier la taille du fichier (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        toast({
          title: "Fichier trop volumineux",
          description: "La taille du fichier ne doit pas dépasser 5MB",
          variant: "destructive"
        })
        return
      }
      
      setTransferData(prev => ({ ...prev, ibanFile: file }))
      setErrors(prev => ({ ...prev, ibanFile: undefined }))
    }
  }

  const removeFile = () => {
    setTransferData(prev => ({ ...prev, ibanFile: undefined }))
  }

  // Fonctions pour l'aperçu du reçu
  const generateTransferId = () => {
    const now = new Date()
    const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '')
    const timeStr = now.toTimeString().slice(0, 8).replace(/:/g, '')
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0')
    return `TRF-${dateStr}-${timeStr}-${random}`
  }

  const createQRData = () => {
    const transferId = generateTransferId()
    return JSON.stringify({
      id: transferId,
      type: "transfer",
      beneficiary: transferData.beneficiaryName,
      destination: `${transferData.destinationCity}, ${transferData.destinationCountry}`,
      amountReceived: transferData.amountReceived,
      receivedCurrency: transferData.receivedCurrency,
      amountToSend: transferData.amountToSend,
      sendCurrency: transferData.sendCurrency,
      withdrawalMode: transferData.withdrawalMode,
      transferMethod: transferData.transferMethod,
      date: new Date().toISOString(),
      agent: user?.name || "Agent"
    })
  }

  const handleQRError = () => {
    setQrCodeError(true)
  }

  const previewReceipt = async () => {
    const qrData = createQRData()
    const transferId = generateTransferId()
    
    // Générer le QR code côté serveur AVANT de créer le HTML
    let qrCodeDataURL = ''
    try {
      const response = await fetch('/api/qr-code', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          text: qrData,
          options: {
            width: 120,
            height: 120,
            colorDark: '#000000',
            colorLight: '#ffffff',
            errorCorrectionLevel: 'M'
          }
        }),
      })
      
      if (response.ok) {
        const data = await response.json()
        qrCodeDataURL = data.qrCodeDataURL
      }
    } catch (error) {
      console.error('Erreur lors de la génération du QR code:', error)
    }
    
    const receiptHTML = generateReceiptHTML(qrCodeDataURL, transferId)
    
    const printWindow = window.open('', '_blank', 'width=600,height=800')
    if (printWindow) {
      printWindow.document.write(receiptHTML)
      printWindow.document.close()
    }
  }

  const generateReceiptHTML = (qrCodeDataURL: string, transferId: string) => {
    return `
      <!DOCTYPE html>
      <html lang="fr">
        <head>
          <meta charset="utf-8" />
          <title>Reçu de Transfert - ${transferId}</title>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { 
              font-family: 'Courier New', monospace;
              margin: 0; padding: 20px;
              background: white; color: #000; line-height: 1.4;
            }
            .receipt { 
              max-width: 400px; margin: 0 auto; 
              border: 2px solid #000; padding: 20px; background: white;
            }
            .header { 
              text-align: center; margin-bottom: 20px;
              border-bottom: 1px dashed #000; padding-bottom: 15px;
            }
            .logo { 
              font-size: 18px; font-weight: bold; margin-bottom: 8px;
              text-transform: uppercase;
            }
            .receipt-title { font-size: 16px; font-weight: bold; margin-bottom: 5px; }
            .receipt-number {
              font-size: 14px; font-weight: bold; background: #f0f0f0;
              padding: 5px; border: 1px solid #000;
            }
            .row { 
              display: flex; justify-content: space-between; 
              margin: 8px 0; padding: 2px 0;
            }
            .row.total {
              border-top: 1px solid #000; border-bottom: 1px solid #000;
              font-weight: bold; margin-top: 10px; padding: 8px 0;
            }
            .qrcode-section { 
              text-align: center; margin: 20px 0;
              border-top: 1px dashed #000; padding-top: 15px;
            }
            .qrcode-container {
              display: inline-block; border: 1px solid #000;
              padding: 10px; background: white;
            }
            .footer { 
              text-align: center; font-size: 11px; color: #666; 
              margin-top: 20px; border-top: 1px dashed #000; padding-top: 15px;
            }
            .timestamp { font-size: 10px; color: #888; margin-top: 10px; }
            @media print {
              body { margin: 0; padding: 10px; }
              .receipt { border: 2px solid #000; box-shadow: none; }
            }
          </style>
        </head>
        <body>
          <div class="receipt">
            <div class="header">
              <div class="logo">ZOLL TAX FOREX</div>
              <div class="receipt-title">Reçu de Transfert d'Argent</div>
              <div class="receipt-number">${transferId}</div>
            </div>
            
            <div class="transaction-details">
              <div class="row">
                <span>Date:</span>
                <span>${new Date().toLocaleDateString("fr-FR")}</span>
              </div>
              <div class="row">
                <span>Agent:</span>
                <span>${user?.name || "-"}</span>
              </div>
              <div class="row">
                <span>Bénéficiaire:</span>
                <span>${transferData.beneficiaryName || "-"}</span>
              </div>
              <div class="row">
                <span>Destination:</span>
                <span>${transferData.destinationCity}, ${transferData.destinationCountry}</span>
              </div>
              <div class="row">
                <span>Moyen de transfert:</span>
                <span>${transferData.transferMethod || "-"}</span>
              </div>
              ${calculationDetails ? `
              <div class="row">
                <span>Montant à collecter:</span>
                <span>${calculationDetails.amountToCollect.toLocaleString("fr-FR")} ${transferData.receivedCurrency}</span>
              </div>
              ` : ''}
              <div class="row">
                <span>Mode de retrait:</span>
                <span>${transferData.withdrawalMode === "cash" ? "Espèces" : "Virement bancaire"}</span>
              </div>
              <div class="row total">
                <span>Montant envoyé:</span>
                <span>${transferData.amountToSend.toLocaleString("fr-FR")} ${transferData.sendCurrency}</span>
              </div>
            </div>
            
            <div class="qrcode-section">
              <div class="qrcode-container">
                ${qrCodeDataURL 
                  ? `<img src="${qrCodeDataURL}" alt="QR Code" style="width: 120px; height: 120px;" />`
                  : `<div style="width: 120px; height: 120px; border: 2px solid #000; display: flex; align-items: center; justify-content: center; font-size: 10px; text-align: center; background: #f9f9f9;">QR Code<br/>Non disponible</div>`
                }
              </div>
              <div style="font-size: 11px; margin-top: 8px; font-style: italic;">
                Scannez ce QR code pour vérifier<br/>
                l'authenticité de cette transaction
              </div>
            </div>
            
            <div class="footer">
              <div>Merci pour votre confiance</div>
              <div><strong>ZOLL TAX FOREX</strong></div>
              <div>© 2025 - Tous droits réservés</div>
              <div class="timestamp">
                Généré le ${new Date().toLocaleString("fr-FR")}
              </div>
            </div>
          </div>
          
          <script>
            // QR Code généré côté serveur - pas besoin de bibliothèque externe
            console.log('QR Code généré côté serveur');
          </script>
        </body>
      </html>
    `
  }

  const printReceipt = async () => {
    if (!transferData.beneficiaryName || !transferData.destinationCountry) {
      toast({
        title: "Données manquantes",
        description: "Veuillez remplir tous les champs obligatoires avant d'imprimer le reçu",
        variant: "destructive"
      })
      return
    }

    setIsPrinting(true)
    try {
      await previewReceipt()
      // Attendre un peu pour que la fenêtre se charge
      setTimeout(() => {
        setIsPrinting(false)
      }, 1000)
    } catch (error) {
      setIsPrinting(false)
      toast({
        title: "Erreur d'impression",
        description: "Une erreur est survenue lors de l'impression du reçu",
        variant: "destructive"
      })
    }
  }

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Transfert d'Argent</h2>
          <p className="text-gray-600 mt-1">Effectuer un transfert d'argent vers l'étranger</p>
        </div>
        {transferId && (
          <div className="flex items-center gap-2 text-green-600">
            <CheckCircle className="h-5 w-5" />
            <span className="font-medium">Transfert {transferId} créé</span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Formulaire principal */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Send className="h-5 w-5" />
              Informations du Transfert
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Informations du bénéficiaire */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium text-gray-700">Bénéficiaire</h3>
              
              <div>
                <Label htmlFor="beneficiaryName">Nom(s) et Prénom(s) *</Label>
                <Input
                  id="beneficiaryName"
                  value={transferData.beneficiaryName}
                  onChange={(e) => setTransferData(prev => ({ ...prev, beneficiaryName: e.target.value }))}
                  placeholder="Ex: Jean Dupont"
                  className={errors.beneficiaryName ? "border-red-500" : ""}
                />
                {errors.beneficiaryName && (
                  <p className="text-sm text-red-600 mt-1">{errors.beneficiaryName}</p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="destinationCountry">Pays de destination *</Label>
                  <Popover open={countryPopoverOpen} onOpenChange={setCountryPopoverOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        className={cn(
                          "w-full justify-between",
                          !transferData.destinationCountry && "text-muted-foreground",
                          errors.destinationCountry && "border-red-500"
                        )}
                      >
                        {transferData.destinationCountry
                          ? countries.find((country) => country === transferData.destinationCountry)
                          : "Sélectionner un pays"}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[400px] p-0">
                      <Command>
                        <CommandInput placeholder="Rechercher un pays..." />
                        <CommandList>
                          <CommandEmpty>Aucun pays trouvé.</CommandEmpty>
                          <CommandGroup>
                            {countries.map((country) => (
                              <CommandItem
                                key={country}
                                value={country}
                                onSelect={() => {
                                  setTransferData(prev => ({ ...prev, destinationCountry: country }))
                                  setCountryPopoverOpen(false)
                                }}
                              >
                                <Check
                                  className={cn(
                                    "mr-2 h-4 w-4",
                                    transferData.destinationCountry === country ? "opacity-100" : "opacity-0"
                                  )}
                                />
                                {country}
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                  {errors.destinationCountry && (
                    <p className="text-sm text-red-600 mt-1">{errors.destinationCountry}</p>
                  )}
                </div>

                <div>
                  <Label htmlFor="destinationCity">Ville de destination *</Label>
                  <Input
                    id="destinationCity"
                    value={transferData.destinationCity}
                    onChange={(e) => setTransferData(prev => ({ ...prev, destinationCity: e.target.value }))}
                    placeholder="Ex: Paris"
                    className={errors.destinationCity ? "border-red-500" : ""}
                  />
                  {errors.destinationCity && (
                    <p className="text-sm text-red-600 mt-1">{errors.destinationCity}</p>
                  )}
                </div>
              </div>

              {/* Moyen de transfert */}
              <div>
                <Label htmlFor="transferMethod">Moyen de transfert *</Label>
                <Select
                  value={transferData.transferMethod}
                  onValueChange={(value) => setTransferData(prev => ({ ...prev, transferMethod: value }))}
                >
                  <SelectTrigger className={errors.transferMethod ? "border-red-500" : ""}>
                    <SelectValue placeholder="Sélectionner un moyen de transfert" />
                  </SelectTrigger>
                  <SelectContent>
                    {transferMethods.map(method => (
                      <SelectItem key={method} value={method}>{method}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.transferMethod && (
                  <p className="text-sm text-red-600 mt-1">{errors.transferMethod}</p>
                )}
              </div>
            </div>

            {/* Montants */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium text-gray-700">Montants</h3>
              
              {/* Boutons Avec frais / Sans frais */}
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant={feeMode === "with_fees" ? "default" : "outline"}
                  onClick={() => setFeeMode("with_fees")}
                  className="flex-1"
                >
                  Avec frais
                </Button>
                <Button
                  type="button"
                  variant={feeMode === "without_fees" ? "default" : "outline"}
                  onClick={() => setFeeMode("without_fees")}
                  className="flex-1"
                >
                  Sans frais
                </Button>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="amountReceived">Montant reçu *</Label>
                  <div className="flex gap-2">
                    <Input
                      id="amountReceived"
                      type="number"
                      value={transferData.amountReceived || ""}
                      onChange={(e) => setTransferData(prev => ({ ...prev, amountReceived: Number(e.target.value) || 0 }))}
                      placeholder="0"
                      className={errors.amountReceived ? "border-red-500" : ""}
                    />
                    <Select
                      value={transferData.receivedCurrency}
                      onValueChange={(value) => setTransferData(prev => ({ ...prev, receivedCurrency: value }))}
                    >
                      <SelectTrigger className="w-20">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {currencies.map(currency => (
                          <SelectItem key={currency} value={currency}>{currency}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {errors.amountReceived && (
                    <p className="text-sm text-red-600 mt-1">{errors.amountReceived}</p>
                  )}
                </div>

                <div>
                  <Label htmlFor="amountToSend">Montant à envoyer *</Label>
                  <div className="flex gap-2">
                    <Input
                      id="amountToSend"
                      type="number"
                      value={transferData.amountToSend || ""}
                      readOnly
                      placeholder="0"
                      className={cn(
                        "bg-gray-50 cursor-not-allowed",
                        errors.amountToSend ? "border-red-500" : ""
                      )}
                    />
                    <Select
                      value={transferData.sendCurrency}
                      onValueChange={(value) => setTransferData(prev => ({ ...prev, sendCurrency: value }))}
                    >
                      <SelectTrigger className="w-20">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {currencies.map(currency => (
                          <SelectItem key={currency} value={currency}>{currency}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {errors.amountToSend && (
                    <p className="text-sm text-red-600 mt-1">{errors.amountToSend}</p>
                  )}
                </div>
              </div>

              {/* Section d'affichage des détails */}
              {calculationDetails && transferData.amountReceived > 0 && transferData.destinationCountry && (
                <div className="mt-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
                  <h4 className="text-sm font-semibold text-gray-700 mb-3">Détails du calcul</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Frais (Commission de Base):</span>
                      <span className="font-medium">{calculationDetails.fees.toLocaleString("fr-FR")} XAF</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">TVA (18,9%):</span>
                      <span className="font-medium">{calculationDetails.vatAmount.toLocaleString("fr-FR")} XAF</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Frais de couverture (0,50%):</span>
                      <span className="font-medium">{calculationDetails.coverageAmount.toLocaleString("fr-FR")} XAF</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">TSTF:</span>
                      <span className="font-medium">{calculationDetails.tstfAmount.toLocaleString("fr-FR")} XAF</span>
                    </div>
                    <div className="flex justify-between pt-2 border-t border-gray-300">
                      <span className="text-gray-700 font-semibold">Taxe (Total):</span>
                      <span className="font-semibold">{calculationDetails.tax.toLocaleString("fr-FR")} XAF</span>
                    </div>
                    <div className="flex justify-between pt-2 border-t-2 border-gray-400">
                      <span className="text-gray-900 font-bold">Montant à collecter:</span>
                      <span className="font-bold text-lg">
                        {transferData.receivedCurrency !== "XAF" 
                          ? `${convertFromXAF(calculationDetails.amountToCollect, transferData.receivedCurrency).toLocaleString("fr-FR")} ${transferData.receivedCurrency}`
                          : `${calculationDetails.amountToCollect.toLocaleString("fr-FR")} XAF`
                        }
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Mode de retrait */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium text-gray-700">Mode de retrait</h3>
              
              <RadioGroup
                value={transferData.withdrawalMode}
                onValueChange={(value) => setTransferData(prev => ({ ...prev, withdrawalMode: value as "cash" | "bank_transfer" }))}
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="cash" id="cash" />
                  <Label htmlFor="cash">Espèces</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="bank_transfer" id="bank_transfer" />
                  <Label htmlFor="bank_transfer">Virement bancaire</Label>
                </div>
              </RadioGroup>

              {transferData.withdrawalMode === "bank_transfer" && (
                <div>
                  <Label htmlFor="ibanFile">Fichier IBAN *</Label>
                  <div className="space-y-2">
                    {!transferData.ibanFile ? (
                      <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-gray-400 transition-colors">
                        <input
                          type="file"
                          id="ibanFile"
                          accept=".pdf,.jpg,.jpeg,.png"
                          onChange={handleFileUpload}
                          className="hidden"
                        />
                        <label htmlFor="ibanFile" className="cursor-pointer">
                          <Upload className="mx-auto h-8 w-8 text-gray-400 mb-2" />
                          <p className="text-sm text-gray-600 mb-1">
                            Cliquez pour joindre le fichier IBAN
                          </p>
                          <p className="text-xs text-gray-500">
                            PDF, JPG, PNG (max 5MB)
                          </p>
                        </label>
                      </div>
                    ) : (
                      <div className="border border-gray-300 rounded-lg p-4 bg-gray-50">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <FileText className="h-5 w-5 text-blue-600" />
                            <div>
                              <p className="text-sm font-medium text-gray-900">
                                {transferData.ibanFile.name}
                              </p>
                              <p className="text-xs text-gray-500">
                                {(transferData.ibanFile.size / 1024 / 1024).toFixed(2)} MB
                              </p>
                            </div>
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={removeFile}
                            className="text-red-600 hover:text-red-700"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    )}
                    {errors.ibanFile && (
                      <p className="text-sm text-red-600">{errors.ibanFile}</p>
                    )}
                  </div>
                </div>
              )}
            </div>

            <Button 
              onClick={handleSubmit} 
              disabled={isSubmitting}
              className="w-full"
            >
              {isSubmitting ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Envoi en cours...
                </>
              ) : (
                <>
                  <Send className="mr-2 h-4 w-4" />
                  Effectuer le transfert
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Aperçu du reçu */}
        <Card>
          <CardHeader>
            <CardTitle>Aperçu du reçu</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border p-4">
              <div className="mb-4 text-center">
                <h4 className="text-xl font-bold">Reçu de Transfert d'Argent</h4>
                <p className="text-sm text-gray-500">
                  N°: <span className="font-medium">{generateTransferId()}</span>
                </p>
              </div>

              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Date:</span>
                  <span>{new Date().toLocaleDateString("fr-FR")}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Agent:</span>
                  <span>{user?.name || "-"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Bénéficiaire:</span>
                  <span>{transferData.beneficiaryName || "-"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Destination:</span>
                  <span>{transferData.destinationCity && transferData.destinationCountry 
                    ? `${transferData.destinationCity}, ${transferData.destinationCountry}`
                    : "-"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Moyen de transfert:</span>
                  <span>{transferData.transferMethod || "-"}</span>
                </div>
                {calculationDetails && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Montant à collecter:</span>
                    <span className="font-semibold">
                      {calculationDetails.amountToCollect.toLocaleString("fr-FR")} {transferData.receivedCurrency}
                    </span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-gray-600">Montant envoyé:</span>
                  <span>{transferData.amountToSend > 0 
                    ? `${transferData.amountToSend.toLocaleString("fr-FR")} ${transferData.sendCurrency}`
                    : "-"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Mode de retrait:</span>
                  <span>{transferData.withdrawalMode === "cash" ? "Espèces" : "Virement bancaire"}</span>
                </div>
              </div>

              <div className="mt-6 border-t pt-4 text-center">
                <div className="mb-2 flex justify-center">
                  {qrCodeError ? (
                    <div className="flex h-[100px] w-[100px] items-center justify-center border border-gray-300 bg-gray-100 text-xs text-gray-500">
                      QR Code Error
                    </div>
                  ) : (
                    <div className="relative">
                      <QRCodeSVG
                        value={createQRData()}
                        size={100}
                        level="M"
                        includeMargin={true}
                        onError={handleQRError}
                      />
                      {!transferData.beneficiaryName && (
                        <div className="absolute inset-0 flex items-center justify-center bg-white bg-opacity-80 text-xs text-gray-500">
                          Remplissez d'abord
                        </div>
                      )}
                    </div>
                  )}
                </div>
                <p className="text-xs text-gray-500">
                  {!transferData.beneficiaryName
                    ? "Scannez pour vérifier la transaction"
                    : "QR Code généré avec succès"}
                </p>
              </div>

              <div className="mt-6 flex flex-col gap-2">
                <Button
                  variant="outline"
                  onClick={previewReceipt}
                  disabled={!transferData.beneficiaryName || qrCodeError}
                  className="w-full bg-transparent"
                >
                  <Eye className="mr-2 h-4 w-4" />
                  Prévisualiser
                </Button>
                <Button 
                  onClick={printReceipt} 
                  disabled={!transferData.beneficiaryName || qrCodeError || isPrinting} 
                  className="w-full"
                >
                  <Printer className="mr-2 h-4 w-4" />
                  {isPrinting ? "Impression..." : "Imprimer le reçu"}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>


      {/* Section des transactions en attente pour les caissiers */}
      {user && (
        <CashierPendingTransactionsByType user={user} transactionType="transfer" />
      )}

      {/* Section Opérations du jour */}
      {user && (
        <DailyOperations 
          operationType="transfer" 
          user={user} 
        />
      )}
    </div>
    )
  }
