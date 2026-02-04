"use client"

import * as React from "react"
import { useState, useEffect } from "react"
import { useToast } from "@/hooks/use-toast"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { AlertCircle, CheckCircle, XCircle, Edit, DollarSign, Clock, Send, Download } from "lucide-react"
import { PageLoader } from "@/components/ui/page-loader"
import { getSessionClient } from "@/lib/auth-client"

type CashDeclarationStatus = 'pending' | 'submitted' | 'rejected' | 'corrected' | 'validated'

type CashDeclaration = {
  id: string
  user_id: string
  guichetier: string
  declaration_date: string
  montant_brut: number
  total_delestage: number
  excedents: number
  delestage_comment?: string
  justificatif_file_path?: string
  justificatif_files?: Array<{
    id: string
    filename: string
    url: string
    uploaded_at: string
  }>
  status: CashDeclarationStatus
  rejection_comment?: string
  validation_comment?: string
  validated_by?: string
  validated_at?: string
  created_at: string
  updated_at: string
  submitted_at?: string
}

type CashDeclarationWithUser = CashDeclaration & {
  user_name: string
  user_email: string
  validator_name?: string
}

export function RiaCashClosure() {
  const { toast } = useToast()
  const [user, setUser] = useState<any>(null)
  const [declarations, setDeclarations] = useState<CashDeclaration[]>([])
  const [loading, setLoading] = useState(true)
  const [uploadProgress, setUploadProgress] = useState<{ current: number; total: number } | null>(null)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingDeclaration, setEditingDeclaration] = useState<CashDeclaration | null>(null)
  const [managerComment, setManagerComment] = useState<string>('')
  const [detailDialogOpen, setDetailDialogOpen] = useState(false)
  const [selectedDeclaration, setSelectedDeclaration] = useState<CashDeclaration | null>(null)
  const [stats, setStats] = useState<any>(null)
  
  // Filtres
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [dateFromFilter, setDateFromFilter] = useState<string>('')
  const [dateToFilter, setDateToFilter] = useState<string>('')
  const [searchTerm, setSearchTerm] = useState<string>('')
  const [guichetierFilter, setGuichetierFilter] = useState<string>('')
  
  // État du formulaire
  const [formData, setFormData] = useState({
    guichetier: '',
    declaration_date: new Date().toISOString().split('T')[0],
    montant_brut: '0',
    total_delestage: '0',
    excedents: '0',
    delestage_comment: '',
    justificatif_files: [] as File[],
  })

  // État pour la gestion du responsable
  const [pendingDeclarations, setPendingDeclarations] = useState<CashDeclarationWithUser[]>([])
  const [actionDialog, setActionDialog] = useState<{
    open: boolean
    declaration: CashDeclarationWithUser | null
    action: 'validate' | 'reject' | null
  }>({
    open: false,
    declaration: null,
    action: null,
  })
  const [actionComment, setActionComment] = useState('')

  useEffect(() => {
    loadUser()
  }, [])

  useEffect(() => {
    if (user) {
      loadDeclarations()
      loadStats()
      // Charger les arrêtés en attente pour Responsable caisse, Directeur et Comptable
      if (['cash_manager', 'director', 'delegate', 'accounting'].includes(user.role)) {
        loadPendingDeclarations()
      }
    }
  }, [user])

  // Rafraîchir les stats d'excédents quand une dépense approuvée impacte les excédents
  useEffect(() => {
    const handleStorage = () => {
      try {
        const raw = localStorage.getItem('maf_notifications')
        const list = raw ? JSON.parse(raw) : []
        const remaining = [] as any[]
        let shouldRefresh = false
        for (const it of list) {
          if (it?.type === 'excedents_changed') {
            shouldRefresh = true
            continue
          }
          remaining.push(it)
        }
        if (shouldRefresh) {
          loadStats()
        }
        if (remaining.length !== list.length) {
          localStorage.setItem('maf_notifications', JSON.stringify(remaining))
        }
      } catch {}
    }
    window.addEventListener('storage', handleStorage)
    // Vérification immédiate au montage
    handleStorage()
    return () => window.removeEventListener('storage', handleStorage)
  }, [])
  
  const loadStats = async () => {
    try {
      const response = await fetch('/api/ria-cash-declarations?type=stats')
      const result = await response.json()
      if (result.data) {
        setStats(result.data)
      }
    } catch (error) {
      console.error('Erreur lors du chargement des stats:', error)
    }
  }

  const loadUser = () => {
    const currentUser = getSessionClient()
    setUser(currentUser)
  }

  const loadDeclarations = async () => {
    try {
      // Pour le Responsable caisses, Directeur et Comptable, charger tous les arrêtés
      const url = ['cash_manager', 'director', 'delegate', 'accounting'].includes(user?.role || '')
        ? '/api/ria-cash-declarations?type=all'
        : '/api/ria-cash-declarations'
      
      const response = await fetch(url)
      const result = await response.json()
      if (result.data) {
        setDeclarations(result.data)
      }
    } catch (error) {
      console.error('Erreur lors du chargement des arrêtés:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadPendingDeclarations = async () => {
    try {
      const response = await fetch('/api/ria-cash-declarations?type=pending')
      const result = await response.json()
      if (result.data) {
        setPendingDeclarations(result.data)
      }
    } catch (error) {
      console.error('Erreur lors du chargement des arrêtés en attente:', error)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.guichetier || !formData.declaration_date || !formData.montant_brut || formData.montant_brut === '0') {
      toast({
        title: "Erreur",
        description: "Veuillez remplir tous les champs obligatoires.",
        variant: "destructive",
      })
      return
    }

    try {
      setLoading(true)

      // Uploader les fichiers en parallèle si fournis
      const justificatifFiles = []
      if (formData.justificatif_files && formData.justificatif_files.length > 0) {
        console.log(`📤 Upload de ${formData.justificatif_files.length} fichier(s) en parallèle...`)
        setUploadProgress({ current: 0, total: formData.justificatif_files.length })
        
        const uploadPromises = formData.justificatif_files.map(async (file, index) => {
          try {
            const formDataToUpload = new FormData()
            formDataToUpload.append('file', file)
            
            const uploadResponse = await fetch('/api/upload', {
              method: 'POST',
              body: formDataToUpload,
            })
            
            const uploadResult = await uploadResponse.json()
            
            if (uploadResponse.ok && uploadResult.filePath) {
              // Mettre à jour le progrès
              setUploadProgress(prev => prev ? { ...prev, current: prev.current + 1 } : null)
              return {
                id: uploadResult.fileId || Date.now().toString(),
                filename: file.name,
                url: uploadResult.filePath,
                uploaded_at: new Date().toISOString()
              }
            } else {
              console.warn(`⚠️ Échec upload: ${file.name}`)
              setUploadProgress(prev => prev ? { ...prev, current: prev.current + 1 } : null)
              return null
            }
          } catch (error) {
            console.error(`❌ Erreur upload ${file.name}:`, error)
            return null
          }
        })
        
        // Attendre tous les uploads en parallèle
        const uploadResults = await Promise.all(uploadPromises)
        
        // Filtrer les uploads réussis
        const successfulUploads = uploadResults.filter(result => result !== null)
        justificatifFiles.push(...successfulUploads)
        
        // Afficher un avertissement pour les échecs
        const failedCount = uploadResults.length - successfulUploads.length
        if (failedCount > 0) {
          toast({
            title: "Avertissement",
            description: `${failedCount} fichier(s) n'ont pas pu être uploadé(s).`,
            variant: "default",
          })
        }
        
        console.log(`✅ ${successfulUploads.length}/${formData.justificatif_files.length} fichiers uploadés avec succès`)
        setUploadProgress(null) // Réinitialiser le progrès
      }

      const response = await fetch('/api/ria-cash-declarations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          guichetier: formData.guichetier,
          declaration_date: formData.declaration_date,
          montant_brut: parseFloat(formData.montant_brut),
          total_delestage: parseFloat(formData.total_delestage) || 0,
          excedents: parseFloat(formData.excedents) || 0,
          delestage_comment: formData.delestage_comment || undefined,
          justificatif_files: justificatifFiles,
        }),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Erreur lors de la création de l\'arrêté')
      }

      // L'arrêté est créé et soumis automatiquement par l'API
      toast({
        title: "Succès",
        description: "Arrêté de caisse créé et soumis avec succès.",
      })

      // Réinitialiser le formulaire
      setFormData({
        guichetier: '',
        declaration_date: new Date().toISOString().split('T')[0],
        montant_brut: '0',
        total_delestage: '0',
        excedents: '0',
        delestage_comment: '',
        justificatif_files: [],
      })
      
      setIsDialogOpen(false)
      
      // Recharger les données en parallèle
      console.log('🔄 Rechargement des données en parallèle...')
      const reloadPromises = [loadDeclarations()]
      if (['cash_manager', 'director', 'delegate', 'accounting'].includes(user?.role || '')) {
        reloadPromises.push(loadPendingDeclarations())
      }
      await Promise.all(reloadPromises)
      console.log('✅ Données rechargées')
      
    } catch (error: any) {
      console.error('Erreur:', error)
      toast({
        title: "Erreur",
        description: error.message || "Erreur lors de la création de l'arrêté.",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const handleSubmitDeclaration = async (id: string) => {
    try {
      const response = await fetch('/api/ria-cash-declarations', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action: 'submit' }),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Erreur lors de la soumission')
      }

      toast({
        title: "Succès",
        description: "Arrêté soumis avec succès. Une notification a été envoyée aux responsables.",
      })

      loadDeclarations()
      if (['cash_manager', 'director', 'delegate', 'accounting'].includes(user?.role || '')) {
        loadPendingDeclarations()
      }
      
    } catch (error: any) {
      toast({
        title: "Erreur",
        description: error.message || "Erreur lors de la soumission.",
        variant: "destructive",
      })
    }
  }

  const handleAction = async () => {
    if (!actionDialog.declaration || !actionDialog.action) return
    
    // Validation pour les actions nécessitant un commentaire
    if (actionDialog.action === 'reject' && !actionComment.trim()) {
      toast({
        title: "Erreur",
        description: "Veuillez fournir un commentaire.",
        variant: "destructive",
      })
      return
    }

    try {
      const response = await fetch('/api/ria-cash-declarations', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: actionDialog.declaration.id,
          action: actionDialog.action,
          data: { comment: actionComment },
        }),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Erreur lors de l\'action')
      }

      toast({
        title: "Succès",
        description: `L'arrêté a été ${actionDialog.action === 'validate' ? 'validé' : 'rejeté'} avec succès.`,
      })

      setActionDialog({ open: false, declaration: null, action: null })
      setActionComment('')
      loadDeclarations()
      loadPendingDeclarations()
      
    } catch (error: any) {
      toast({
        title: "Erreur",
        description: error.message || "Erreur lors de l'action.",
        variant: "destructive",
      })
    }
  }

  const handleUpdateDeclaration = async () => {
    if (!editingDeclaration) return

    try {
      const response = await fetch('/api/ria-cash-declarations', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingDeclaration.id,
          action: 'update',
          data: {
            montant_brut: parseFloat(formData.montant_brut),
            total_delestage: parseFloat(formData.total_delestage) || 0,
            delestage_comment: formData.delestage_comment || undefined,
          },
        }),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Erreur lors de la mise à jour')
      }

      toast({
        title: "Succès",
        description: "Arrêté mis à jour avec succès.",
      })

      setEditingDeclaration(null)
      setManagerComment('')
      setIsDialogOpen(false)
      setFormData({
        guichetier: '',
        declaration_date: new Date().toISOString().split('T')[0],
        montant_brut: '0',
        total_delestage: '0',
        excedents: '0',
        delestage_comment: '',
        justificatif_files: [],
      })
      loadDeclarations()
      
    } catch (error: any) {
      toast({
        title: "Erreur",
        description: error.message || "Erreur lors de la mise à jour.",
        variant: "destructive",
      })
    }
  }

  const formatAmount = (amount: number) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'decimal',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount) + ' FCFA'
  }

  const getStatusBadge = (status: CashDeclarationStatus) => {
    const badges = {
      pending: { 
        className: 'bg-gray-100 text-gray-700 hover:bg-gray-200',
        label: 'Brouillon', 
        icon: Clock 
      },
      submitted: { 
        className: 'bg-blue-100 text-blue-700 hover:bg-blue-200',
        label: 'Soumis', 
        icon: Send 
      },
      corrected: { 
        className: 'bg-orange-100 text-orange-700 hover:bg-orange-200',
        label: 'À corriger', 
        icon: Edit 
      },
      validated: { 
        className: 'bg-green-100 text-green-700 hover:bg-green-200',
        label: 'Validé', 
        icon: CheckCircle 
      },
      rejected: { 
        className: 'bg-red-100 text-red-700 hover:bg-red-200',
        label: 'Rejeté', 
        icon: XCircle 
      },
    }
    const badge = badges[status]
    const Icon = badge.icon
    return (
      <Badge className={`${badge.className} flex items-center gap-1 border-0`}>
        <Icon className="w-3 h-3" />
        {badge.label}
      </Badge>
    )
  }

  // Vérifier si l'utilisateur est un manager (Responsable caisse, Directeur ou Comptable)
  const isManager = ['cash_manager', 'director', 'delegate', 'accounting'].includes(user?.role || '')

  // Filtrer les déclarations
  const filteredDeclarations = declarations.filter(declaration => {
    // Filtre par statut
    if (statusFilter !== 'all' && declaration.status !== statusFilter) {
      return false
    }
    
    // Filtre par date de début
    if (dateFromFilter && declaration.declaration_date < dateFromFilter) {
      return false
    }
    
    // Filtre par date de fin
    if (dateToFilter && declaration.declaration_date > dateToFilter) {
      return false
    }
    
    // Filtre par recherche (guichetier)
    if (searchTerm && !declaration.guichetier.toLowerCase().includes(searchTerm.toLowerCase())) {
      return false
    }
    
    // Filtre par guichetier spécifique
    if (guichetierFilter && declaration.guichetier !== guichetierFilter) {
      return false
    }
    
    return true
  })
  
  // Extraire la liste unique des guichetiers pour le filtre
  const uniqueGuichetiers = Array.from(new Set(declarations.map(d => d.guichetier))).sort()

  // Calculer les statistiques filtrées
  const filteredStats = React.useMemo(() => {
    const submitted = filteredDeclarations.filter(d => d.status === 'submitted').length
    const validated = filteredDeclarations.filter(d => d.status === 'validated').length
    const rejected = filteredDeclarations.filter(d => d.status === 'rejected').length
    const totalMontantSubmitted = filteredDeclarations
      .filter(d => d.status === 'submitted')
      .reduce((sum, d) => sum + Number(d.montant_brut || 0), 0)
    const totalMontantValidated = filteredDeclarations
      .filter(d => d.status === 'validated')
      .reduce((sum, d) => sum + Number(d.montant_brut || 0), 0)
    const totalDelestage = filteredDeclarations.reduce((sum, d) => sum + Number(d.total_delestage || 0), 0)
    const totalExcedents = filteredDeclarations.reduce((sum, d) => sum + Number(d.excedents || 0), 0)
    
    return {
      total_submitted: submitted,
      total_validated: validated,
      total_rejected: rejected,
      total_montant_submitted: totalMontantSubmitted,
      total_montant_validated: totalMontantValidated,
      total_delestage: totalDelestage,
      total_excedents: totalExcedents,
    }
  }, [filteredDeclarations])

  // Utiliser les stats filtrées pour l'affichage
  const displayStats = { 
    total_excedents: 0, // Valeur par défaut
    ...stats, 
    ...filteredStats 
  }

  // Fonction pour télécharger le PDF
  const handleDownloadPDF = async (declaration: CashDeclaration) => {
    try {
      const response = await fetch(`/api/ria-cash-declarations/pdf?id=${declaration.id}`)
      if (!response.ok) {
        throw new Error('Erreur lors de la génération du PDF')
      }
      
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `arrete-caisse-${declaration.guichetier}-${declaration.declaration_date}.pdf`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
      
      toast({
        title: "Succès",
        description: "PDF téléchargé avec succès.",
      })
    } catch (error: any) {
      toast({
        title: "Erreur",
        description: error.message || "Erreur lors du téléchargement du PDF.",
        variant: "destructive",
      })
    }
  }

  if (loading && !user) {
    return <PageLoader message="Chargement..." overlay={false} />
  }

  return (
    <div className="space-y-6">
      {/* En-tête avec statistiques améliorées */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="bg-gradient-to-br from-gray-50 to-gray-100 border-gray-200 hover:shadow-lg transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-700">Mes Arrêtés</CardTitle>
            <div className="bg-gray-600 p-2 rounded-lg">
              <DollarSign className="h-4 w-4 text-white" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-gray-800">{declarations.length}</div>
            <p className="text-xs text-gray-600 mt-1">Arrêtés créés</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200 hover:shadow-lg transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-blue-800">
              {isManager ? 'En Attente' : 'Soumis'}
            </CardTitle>
            <div className="bg-blue-600 p-2 rounded-lg">
              <Clock className="h-4 w-4 text-white" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-blue-700">
              {isManager ? pendingDeclarations.length : (displayStats?.total_submitted || 0)}
            </div>
            <p className="text-xs text-blue-600 mt-1">
              {isManager ? 'Arrêtés en attente' : 'Arrêtés soumis'}
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200 hover:shadow-lg transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-green-800">Validés</CardTitle>
            <div className="bg-green-600 p-2 rounded-lg">
              <CheckCircle className="h-4 w-4 text-white" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-700">
              {displayStats?.total_validated || 0}
            </div>
            <p className="text-xs text-green-600 mt-1">
              {isManager ? 'Arrêtés validés' : 'Mes arrêtés validés'}
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-red-50 to-red-100 border-red-200 hover:shadow-lg transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-red-800">Rejetés</CardTitle>
            <div className="bg-red-600 p-2 rounded-lg">
              <XCircle className="h-4 w-4 text-white" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-red-700">
              {displayStats?.total_rejected || 0}
            </div>
            <p className="text-xs text-red-600 mt-1">
              {isManager ? 'Arrêtés rejetés' : 'Mes arrêtés rejetés'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Statistiques montants améliorées */}
      {displayStats && (
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
          <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200 hover:shadow-lg transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xs font-medium text-green-800">Montant Total Validé</CardTitle>
              <div className="bg-green-600 p-1.5 rounded-lg">
                <DollarSign className="h-3 w-3 text-white" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-lg font-bold text-green-700">
                {formatAmount(displayStats.total_montant_validated)}
              </div>
              <p className="text-xs text-green-600 mt-1">
                {isManager ? 'Tous les arrêtés validés' : 'Mes arrêtés validés'}
              </p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200 hover:shadow-lg transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xs font-medium text-blue-800">Montant Total Soumis</CardTitle>
              <div className="bg-blue-600 p-1.5 rounded-lg">
                <Clock className="h-3 w-3 text-white" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-lg font-bold text-blue-700">
                {formatAmount(displayStats.total_montant_submitted)}
              </div>
              <p className="text-xs text-blue-600 mt-1">
                {isManager ? 'Tous les arrêtés soumis' : 'Mes arrêtés soumis'}
              </p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-orange-50 to-orange-100 border-orange-200 hover:shadow-lg transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xs font-medium text-orange-800">Total Délestage</CardTitle>
              <div className="bg-orange-600 p-1.5 rounded-lg">
                <AlertCircle className="h-3 w-3 text-white" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-lg font-bold text-orange-700">
                {formatAmount(displayStats.total_delestage)}
              </div>
              <p className="text-xs text-orange-600 mt-1">
                {isManager ? 'Tous les délestages' : 'Mes délestages'}
              </p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200 hover:shadow-lg transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xs font-medium text-green-800">Total Excédents</CardTitle>
              <div className="bg-green-600 p-1.5 rounded-lg">
                <DollarSign className="h-3 w-3 text-white" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-lg font-bold text-green-700">
                {formatAmount((displayStats.total_excedents_available ?? displayStats.total_excedents) || 0)}
              </div>
              <p className="text-xs text-green-600 mt-1">
                {isManager ? 'Tous les excédents' : 'Mes excédents'}
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Bouton pour créer un nouvel arrêté */}
      {!isManager && (
        <div className="flex justify-end">
          <Button onClick={() => {
            setEditingDeclaration(null)
            setFormData({
              guichetier: user?.name || '',
              declaration_date: new Date().toISOString().split('T')[0],
              montant_brut: '',
              total_delestage: '',
              delestage_comment: '',
              justificatif_file: null,
            })
            setIsDialogOpen(true)
          }}>
            Nouvel Arrêté de Caisse
          </Button>
        </div>
      )}

      {/* Liste des arrêtés en attente (Responsable caisses) */}
      {isManager && pendingDeclarations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Arrêtés en Attente de Validation</CardTitle>
            <CardDescription>
              Validez, rejetez ou demandez une correction pour chaque arrêté soumis
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {pendingDeclarations.map((declaration) => (
                <Alert key={declaration.id}>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-semibold">{declaration.guichetier}</div>
                        <div className="text-sm text-muted-foreground">
                          Date: {new Date(declaration.declaration_date).toLocaleDateString('fr-FR')} | 
                          Montant brut: {formatAmount(declaration.montant_brut)} | 
                          Délestage: {formatAmount(declaration.total_delestage)}
                        </div>
                        {declaration.delestage_comment && (
                          <div className="text-sm text-muted-foreground mt-1">
                            Commentaire délestage: {declaration.delestage_comment}
                          </div>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          className="bg-green-600 hover:bg-green-700 text-white"
                          onClick={() => {
                            setActionDialog({ open: true, declaration, action: 'validate' })
                            setActionComment('')
                          }}
                        >
                          Valider
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => {
                            setActionDialog({ open: true, declaration, action: 'reject' })
                            setActionComment('')
                          }}
                        >
                          Rejeter
                        </Button>
                      </div>
                    </div>
                  </AlertDescription>
                </Alert>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Liste des arrêtés */}
      <Card>
        <CardHeader>
          <CardTitle>Historique des Arrêtés de Caisse</CardTitle>
          <CardDescription>
            Liste de tous vos arrêtés de caisse
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Filtres */}
          <div className="space-y-4 mb-6">
            {/* Ligne de filtres */}
            <div className="flex flex-col md:flex-row gap-4 items-end">
              <div className="w-full md:w-64">
                <Label htmlFor="search">Rechercher</Label>
                <Input
                  id="search"
                  placeholder="Rechercher..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              
              {isManager && (
                <div className="w-full md:w-48">
                  <Label htmlFor="guichetier">Guichetier</Label>
                  <Select value={guichetierFilter || 'all'} onValueChange={(value) => setGuichetierFilter(value === 'all' ? '' : value)}>
                    <SelectTrigger id="guichetier">
                      <SelectValue placeholder="Tous les guichetiers" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Tous les guichetiers</SelectItem>
                      {uniqueGuichetiers.map((guichetier) => (
                        <SelectItem key={guichetier} value={guichetier}>
                          {guichetier}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              
              <div className="w-full md:w-48">
                <Label htmlFor="status">Statut</Label>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger id="status">
                    <SelectValue placeholder="Tous les statuts" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tous les statuts</SelectItem>
                    <SelectItem value="pending">Brouillon</SelectItem>
                    <SelectItem value="submitted">Soumis</SelectItem>
                    <SelectItem value="validated">Validé</SelectItem>
                    <SelectItem value="rejected">Rejeté</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="w-full md:w-48">
                <Label htmlFor="dateFrom">Date de début</Label>
                <Input
                  id="dateFrom"
                  type="date"
                  value={dateFromFilter}
                  onChange={(e) => setDateFromFilter(e.target.value)}
                />
              </div>
              
              <div className="w-full md:w-48">
                <Label htmlFor="dateTo">Date de fin</Label>
                <Input
                  id="dateTo"
                  type="date"
                  value={dateToFilter}
                  onChange={(e) => setDateToFilter(e.target.value)}
                />
              </div>
              
              <Button
                variant="outline"
                onClick={() => {
                  setStatusFilter('all')
                  setDateFromFilter('')
                  setDateToFilter('')
                  setSearchTerm('')
                  if (isManager) {
                    setGuichetierFilter('')
                  }
                }}
              >
                Réinitialiser
              </Button>
            </div>
          </div>
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-gradient-to-r from-gray-50 to-gray-100 border-b">
                  <TableHead className="font-semibold">ID</TableHead>
                  <TableHead className="font-semibold">Date</TableHead>
                  <TableHead className="font-semibold">Guichetier</TableHead>
                  <TableHead className="font-semibold">Montant Brut</TableHead>
                  <TableHead className="font-semibold">Délestage</TableHead>
                  <TableHead className="font-semibold">Excédents</TableHead>
                  <TableHead className="font-semibold">Montant Net</TableHead>
                  <TableHead className="font-semibold">Statut</TableHead>
                  <TableHead className="font-semibold text-center">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
              {filteredDeclarations.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                    {declarations.length === 0 
                      ? "Aucun arrêté de caisse pour le moment"
                      : "Aucun résultat ne correspond aux filtres sélectionnés"
                    }
                  </TableCell>
                </TableRow>
              ) : (
                filteredDeclarations.map((declaration) => {
                  // Déterminer la couleur de fond selon le statut
                  let rowBgColor = ""
                  switch (declaration.status) {
                    case 'pending':
                      rowBgColor = "bg-gray-50 hover:bg-gray-100"
                      break
                    case 'submitted':
                      rowBgColor = "bg-blue-50 hover:bg-blue-100"
                      break
                    case 'validated':
                      rowBgColor = "bg-green-50 hover:bg-green-100"
                      break
                    case 'rejected':
                      rowBgColor = "bg-red-50 hover:bg-red-100"
                      break
                    default:
                      rowBgColor = "bg-white hover:bg-gray-50"
                  }

                  return (
                  <React.Fragment key={declaration.id}>
                    <TableRow className={`${rowBgColor} transition-colors`}>
                      <TableCell className="font-mono text-xs text-gray-500">
                        {declaration.id.substring(0, 8)}
                      </TableCell>
                      <TableCell className="font-medium">
                        {new Date(declaration.declaration_date).toLocaleDateString('fr-FR')}
                      </TableCell>
                      <TableCell className="font-medium">{declaration.guichetier}</TableCell>
                      <TableCell>
                        <div className="text-blue-600 font-semibold">
                          {formatAmount(declaration.montant_brut)}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-orange-600 font-semibold">
                          {formatAmount(declaration.total_delestage)}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-green-600 font-semibold">
                          {formatAmount(declaration.excedents || 0)}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-green-700 font-bold">
                          {formatAmount(declaration.montant_brut - declaration.total_delestage)}
                        </div>
                      </TableCell>
                      <TableCell>{getStatusBadge(declaration.status)}</TableCell>
                      <TableCell>
                      <div className="flex gap-2 justify-center">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                          onClick={() => {
                            setSelectedDeclaration(declaration)
                            setDetailDialogOpen(true)
                          }}
                          title="Voir les détails"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                        </Button>
                        <Button
                          size="default"
                          variant="default"
                          className="bg-blue-600 hover:bg-blue-700 text-white"
                          onClick={async (e) => {
                            e.stopPropagation()
                            e.preventDefault()
                            console.log('📥 Début du téléchargement PDF pour:', declaration.id)
                            
                            try {
                              const pdfUrl = `/api/ria-cash-declarations/pdf?id=${declaration.id}`
                              console.log('📍 URL de l\'API:', pdfUrl)
                              
                              const response = await fetch(pdfUrl)
                              console.log('📡 Réponse API:', {
                                ok: response.ok,
                                status: response.status,
                                headers: Object.fromEntries(response.headers.entries())
                              })
                              
                              if (response.ok) {
                                const blob = await response.blob()
                                console.log('✅ Blob reçu:', {
                                  type: blob.type,
                                  size: blob.size
                                })
                                
                                const url = URL.createObjectURL(blob)
                                const a = document.createElement('a')
                                a.href = url
                                const dateStr = new Date(declaration.declaration_date).toISOString().split('T')[0]
                                a.download = `arrete-caisse-${declaration.guichetier}-${dateStr}.pdf`
                                console.log('📄 Nom du fichier:', a.download)
                                
                                document.body.appendChild(a)
                                console.log('🔘 Clic sur le lien...')
                                a.click()
                                document.body.removeChild(a)
                                URL.revokeObjectURL(url)
                                
                                toast({
                                  title: "Succès",
                                  description: "PDF téléchargé avec succès",
                                })
                              } else {
                                const errorText = await response.text()
                                console.error('❌ Erreur API:', errorText)
                                toast({
                                  title: "Erreur",
                                  description: `Impossible de télécharger le PDF (${response.status})`,
                                  variant: "destructive",
                                })
                              }
                            } catch (error) {
                              console.error('❌ Erreur lors du téléchargement du PDF:', error)
                              toast({
                                title: "Erreur",
                                description: `Erreur: ${error instanceof Error ? error.message : 'Erreur inconnue'}`,
                                variant: "destructive",
                              })
                            }
                          }}
                          title="Télécharger le PDF"
                        >
                          <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                          </svg>
                          PDF
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                  </React.Fragment>
                  )
                })
              )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Dialogue pour créer/modifier un arrêté */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingDeclaration ? 'Modifier l\'Arrêté' : 'Nouvel Arrêté de Caisse'}
            </DialogTitle>
            <DialogDescription>
              {editingDeclaration ? 'Corrigez les informations de l\'arrêté selon les commentaires du responsable' : 'Remplissez les informations pour créer votre arrêté de caisse'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={editingDeclaration ? handleUpdateDeclaration : handleSubmit}>
            <div className="space-y-4">
              {editingDeclaration && managerComment && (
                <div className="bg-gradient-to-r from-yellow-50 to-orange-50 border-l-4 border-yellow-500 rounded-lg p-4 shadow-sm">
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0">
                      <svg className="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                    </div>
                    <div className="flex-1">
                      <h4 className="font-semibold text-sm text-yellow-800 mb-2 flex items-center gap-2">
                        <span>Commentaire du Responsable Caisses</span>
                      </h4>
                      <p className="text-sm text-gray-700 leading-relaxed">{managerComment}</p>
                    </div>
                  </div>
                </div>
              )}
              <div>
                <Label htmlFor="guichetier">Guichetier *</Label>
                <Input
                  id="guichetier"
                  value={formData.guichetier}
                  onChange={(e) => setFormData({ ...formData, guichetier: e.target.value })}
                  required
                  disabled={!!editingDeclaration}
                />
              </div>
              <div>
                <Label htmlFor="declaration_date">Date *</Label>
                <Input
                  id="declaration_date"
                  type="date"
                  value={formData.declaration_date}
                  onChange={(e) => setFormData({ ...formData, declaration_date: e.target.value })}
                  required
                  disabled={!!editingDeclaration}
                />
              </div>
              <div>
                <Label htmlFor="montant_brut">Montant Brut (FCFA) *</Label>
                <Input
                  id="montant_brut"
                  type="number"
                  value={formData.montant_brut}
                  onChange={(e) => setFormData({ ...formData, montant_brut: e.target.value })}
                  required
                />
              </div>
              <div>
                <Label htmlFor="total_delestage">Total Délestage (FCFA)</Label>
                <Input
                  id="total_delestage"
                  type="number"
                  value={formData.total_delestage}
                  onChange={(e) => setFormData({ ...formData, total_delestage: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="excedents">Excédents (FCFA)</Label>
                <Input
                  id="excedents"
                  type="number"
                  value={formData.excedents}
                  onChange={(e) => setFormData({ ...formData, excedents: e.target.value })}
                  placeholder="Montant des excédents"
                />
              </div>
              <div>
                <Label htmlFor="delestage_comment">Commentaire sur le Délestage</Label>
                <Textarea
                  id="delestage_comment"
                  value={formData.delestage_comment}
                  onChange={(e) => setFormData({ ...formData, delestage_comment: e.target.value })}
                  placeholder="Décrivez la raison du délestage..."
                />
              </div>
              {!editingDeclaration && (
                <div>
                  <Label htmlFor="justificatif">Fichiers Justificatifs (PDF/CSV) - Max 10MB par fichier</Label>
                  <Input
                    id="justificatif"
                    type="file"
                    accept=".pdf,.csv"
                    multiple
                    onChange={(e) => {
                      const files = Array.from(e.target.files || [])
                      setFormData({ ...formData, justificatif_files: files })
                    }}
                  />
                  {formData.justificatif_files && formData.justificatif_files.length > 0 && (
                    <div className="mt-2 space-y-1">
                      <p className="text-sm font-medium text-muted-foreground">Fichiers sélectionnés:</p>
                      {formData.justificatif_files.map((file, index) => (
                        <p key={index} className="text-sm text-muted-foreground">
                          • {file.name} ({(file.size / 1024).toFixed(2)} KB)
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
            <DialogFooter className="mt-6">
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                Annuler
              </Button>
              <Button type="submit" disabled={loading}>
                {uploadProgress ? (
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Upload {uploadProgress.current}/{uploadProgress.total}
                  </div>
                ) : loading ? (
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Enregistrement...
                  </div>
                ) : (
                  editingDeclaration ? 'Mettre à jour' : 'Créer'
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialogue pour les actions du Responsable */}
      <Dialog open={actionDialog.open} onOpenChange={(open) => setActionDialog({ ...actionDialog, open })}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {actionDialog.action === 'validate' && 'Valider l\'Arrêté'}
              {actionDialog.action === 'reject' && 'Rejeter l\'Arrêté'}
              {actionDialog.action === 'request_correction' && 'Demander une Correction'}
            </DialogTitle>
            <DialogDescription>
              {actionDialog.action === 'validate' && 'Confirmez que le montant reçu correspond à celui déclaré.'}
              {actionDialog.action === 'reject' && 'Indiquez la raison du rejet de cet arrêté.'}
              {actionDialog.action === 'request_correction' && 'Indiquez les corrections à apporter.'}
            </DialogDescription>
          </DialogHeader>
          {actionDialog.declaration && (
            <div className="space-y-4">
              <div className="bg-muted p-4 rounded-lg">
                <div className="text-sm font-medium">Montant Brut: {formatAmount(actionDialog.declaration.montant_brut)}</div>
                <div className="text-sm">Délestage: {formatAmount(actionDialog.declaration.total_delestage)}</div>
                <div className="text-sm font-semibold">À Verser: {formatAmount(actionDialog.declaration.montant_brut - actionDialog.declaration.total_delestage)}</div>
              </div>
              {(actionDialog.action === 'reject' || actionDialog.action === 'request_correction') && (
                <div>
                  <Label htmlFor="comment">Commentaire *</Label>
                  <Textarea
                    id="comment"
                    value={actionComment}
                    onChange={(e) => setActionComment(e.target.value)}
                    placeholder="Votre commentaire..."
                    required
                  />
                </div>
              )}
              {actionDialog.action === 'validate' && (
                <div>
                  <Label htmlFor="comment">Commentaire (optionnel)</Label>
                  <Textarea
                    id="comment"
                    value={actionComment}
                    onChange={(e) => setActionComment(e.target.value)}
                    placeholder="Votre commentaire..."
                  />
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setActionDialog({ open: false, declaration: null, action: null })}>
              Annuler
            </Button>
            <Button onClick={handleAction}>
              {actionDialog.action === 'validate' && 'Valider'}
              {actionDialog.action === 'reject' && 'Rejeter'}
              {actionDialog.action === 'request_correction' && 'Demander Correction'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialogue de détails de l'arrêté */}
      <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Détails de l'Arrêté de Caisse</DialogTitle>
            <DialogDescription>
              Informations complètes de l'arrêté de caisse
            </DialogDescription>
          </DialogHeader>
          {selectedDeclaration && (
            <div className="space-y-6">
              {/* En-tête avec statut */}
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-4 rounded-lg border border-blue-200">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-lg">{selectedDeclaration.guichetier}</h3>
                    <p className="text-sm text-gray-600">
                      {new Date(selectedDeclaration.declaration_date).toLocaleDateString('fr-FR', {
                        weekday: 'long',
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                      })}
                    </p>
                  </div>
                  {getStatusBadge(selectedDeclaration.status)}
                </div>
              </div>

              {/* Montants */}
              <div className="grid grid-cols-2 gap-4">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium text-gray-600">Montant Brut</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-blue-600">
                      {formatAmount(selectedDeclaration.montant_brut)}
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium text-gray-600">Total Délestage</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-orange-600">
                      {formatAmount(selectedDeclaration.total_delestage)}
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium text-gray-600">Excédents</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-green-600">
                      {formatAmount(selectedDeclaration.excedents || 0)}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Montant net */}
              <div className="bg-green-50 border-2 border-green-300 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-green-800 mb-1">Montant Net à Verser</p>
                    <p className="text-xs text-green-600">Montant brut - Délestage</p>
                  </div>
                  <div className="text-3xl font-bold text-green-700">
                    {formatAmount(selectedDeclaration.montant_brut - selectedDeclaration.total_delestage)}
                  </div>
                </div>
              </div>

              {/* Commentaire délestage */}
              {selectedDeclaration.delestage_comment && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <h4 className="font-semibold text-sm text-blue-800 mb-2 flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                    </svg>
                    Commentaire sur le délestage
                  </h4>
                  <p className="text-sm text-gray-700">{selectedDeclaration.delestage_comment}</p>
                </div>
              )}

              {/* Fichiers joints */}
              {(selectedDeclaration.justificatif_file_path || (selectedDeclaration.justificatif_files && selectedDeclaration.justificatif_files.length > 0)) && (
                <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                  <h4 className="font-semibold text-sm text-purple-800 mb-3 flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                    </svg>
                    Fichiers Justificatifs
                  </h4>
                  
                  {/* Fichier unique (ancien format) */}
                  {selectedDeclaration.justificatif_file_path && (
                    <div className="mb-3">
                      <div className="flex gap-3">
                        <a 
                          href={selectedDeclaration.justificatif_file_path} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-2 px-4 py-2 bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 transition-colors"
                          onClick={(e) => {
                            console.log('🔗 Clic sur le fichier:', {
                              path: selectedDeclaration.justificatif_file_path,
                              fullUrl: window.location.origin + selectedDeclaration.justificatif_file_path
                            })
                          }}
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                          </svg>
                          <span className="font-medium">Ouvrir le justificatif</span>
                        </a>
                      </div>
                    </div>
                  )}

                  {/* Fichiers multiples (nouveau format) */}
                  {selectedDeclaration.justificatif_files && selectedDeclaration.justificatif_files.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-sm text-gray-600 mb-2">
                        {selectedDeclaration.justificatif_files.length} fichier(s) joint(s) :
                      </p>
                      {selectedDeclaration.justificatif_files.map((file: any, index: number) => (
                        <div key={file.id || index} className="flex items-center justify-between bg-white rounded-lg p-3 border border-purple-200">
                          <div className="flex items-center gap-3">
                            <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                            </svg>
                            <div>
                              <p className="font-medium text-sm text-gray-900">{file.filename}</p>
                              <p className="text-xs text-gray-500">
                                Ajouté le {new Date(file.uploaded_at).toLocaleDateString('fr-FR')} à {new Date(file.uploaded_at).toLocaleTimeString('fr-FR')}
                              </p>
                            </div>
                          </div>
                          <a 
                            href={file.url} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 px-3 py-1 bg-purple-100 text-purple-700 rounded-md hover:bg-purple-200 transition-colors text-sm"
                            onClick={(e) => {
                              console.log('🔗 Clic sur le fichier multiple:', {
                                filename: file.filename,
                                url: file.url,
                                fullUrl: window.location.origin + file.url
                              })
                            }}
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                            </svg>
                            Ouvrir
                          </a>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Bouton de téléchargement PDF */}
                  <div className="mt-4 pt-3 border-t border-purple-200">
                    <Button
                      onClick={async () => {
                        try {
                          const response = await fetch(`/api/ria-cash-declarations/pdf?id=${selectedDeclaration.id}`)
                          if (response.ok) {
                            const blob = await response.blob()
                            const url = URL.createObjectURL(blob)
                            const a = document.createElement('a')
                            a.href = url
                            const dateStr = new Date(selectedDeclaration.declaration_date).toISOString().split('T')[0]
                            a.download = `arrete-caisse-${selectedDeclaration.guichetier}-${dateStr}.pdf`
                            document.body.appendChild(a)
                            a.click()
                            document.body.removeChild(a)
                            URL.revokeObjectURL(url)
                            toast({
                              title: "Succès",
                              description: "PDF téléchargé avec succès",
                            })
                          } else {
                            toast({
                              title: "Erreur",
                              description: "Impossible de télécharger le PDF",
                              variant: "destructive",
                            })
                          }
                        } catch (error) {
                          console.error('Erreur lors du téléchargement du PDF:', error)
                          toast({
                            title: "Erreur",
                            description: "Erreur lors du téléchargement du PDF",
                            variant: "destructive",
                          })
                        }
                      }}
                      variant="default"
                      className="bg-blue-600 hover:bg-blue-700 text-white"
                    >
                      <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v12m0 0l4-4m-4 4L8 11" />
                      </svg>
                      Télécharger PDF
                    </Button>
                  </div>
                </div>
              )}

              {/* Commentaires de validation/rejet/correction */}
              {selectedDeclaration.validation_comment && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <h4 className="font-semibold text-sm text-green-800 mb-2 flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Commentaire de Validation
                  </h4>
                  <p className="text-sm text-gray-700">{selectedDeclaration.validation_comment}</p>
                </div>
              )}

              {selectedDeclaration.rejection_comment && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <h4 className="font-semibold text-sm text-red-800 mb-2 flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                    Raison du Rejet
                  </h4>
                  <p className="text-sm text-gray-700">{selectedDeclaration.rejection_comment}</p>
                </div>
              )}

              {/* Informations de validation */}
              {(selectedDeclaration.status === 'validated' || selectedDeclaration.status === 'rejected') && selectedDeclaration.validated_at && (
                <div className="text-xs text-gray-500 border-t pt-4">
                  <p>
                    {selectedDeclaration.status === 'validated' ? 'Validé' : 'Rejeté'} le {' '}
                    {new Date(selectedDeclaration.validated_at).toLocaleString('fr-FR')}
                  </p>
                  {selectedDeclaration.submitted_at && (
                    <p className="mt-1">
                      Soumis le {new Date(selectedDeclaration.submitted_at).toLocaleString('fr-FR')}
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDetailDialogOpen(false)}>
              Fermer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

