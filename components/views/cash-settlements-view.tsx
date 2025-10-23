"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { 
  Receipt, 
  Plus, 
  Eye, 
  CheckCircle, 
  XCircle, 
  AlertTriangle,
  Upload,
  Download,
  Calendar,
  DollarSign,
  FileText
} from "lucide-react"
import { getRoleDisplayName } from "@/lib/rbac"
import type { SessionUser } from "@/lib/auth"
import type { CashSettlement, CashUnloading } from "@/lib/cash-settlements-queries"

interface CashSettlementsViewProps {
  user: SessionUser
}

export function CashSettlementsView({ user }: CashSettlementsViewProps) {
  const [settlements, setSettlements] = useState<CashSettlement[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [showValidationDialog, setShowValidationDialog] = useState(false)
  const [selectedSettlement, setSelectedSettlement] = useState<CashSettlement | null>(null)
  const [unloadings, setUnloadings] = useState<CashUnloading[]>([])

  // États pour le formulaire de création
  const [formData, setFormData] = useState({
    settlement_date: new Date().toISOString().split('T')[0],
    total_transactions_amount: '',
    unloading_amount: '',
    unloading_reason: '',
    operation_report_file: null as File | null
  })

  // États pour le formulaire de validation
  const [validationData, setValidationData] = useState({
    received_amount: '',
    validation_notes: '',
    exception_reason: '',
    rejection_reason: ''
  })

  useEffect(() => {
    loadSettlements()
  }, [])

  const loadSettlements = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/cash-settlements')
      if (response.ok) {
        const data = await response.json()
        setSettlements(data.settlements || [])
      }
    } catch (error) {
      console.error('Erreur lors du chargement des arrêtés:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadSettlementUnloadings = async (settlementId: string) => {
    try {
      const response = await fetch(`/api/cash-settlements/${settlementId}/unloadings`)
      if (response.ok) {
        const data = await response.json()
        setUnloadings(data.unloadings || [])
      }
    } catch (error) {
      console.error('Erreur lors du chargement des délestages:', error)
    }
  }

  const handleCreateSettlement = async () => {
    try {
      const formDataToSend = new FormData()
      formDataToSend.append('settlement_date', formData.settlement_date)
      formDataToSend.append('total_transactions_amount', formData.total_transactions_amount)
      formDataToSend.append('unloading_amount', formData.unloading_amount || '0')
      formDataToSend.append('unloading_reason', formData.unloading_reason || '')
      
      if (formData.operation_report_file) {
        formDataToSend.append('operation_report_file', formData.operation_report_file)
      }

      const response = await fetch('/api/cash-settlements', {
        method: 'POST',
        body: formDataToSend
      })

      if (response.ok) {
        setShowCreateDialog(false)
        setFormData({
          settlement_date: new Date().toISOString().split('T')[0],
          total_transactions_amount: '',
          unloading_amount: '',
          unloading_reason: '',
          operation_report_file: null
        })
        loadSettlements()
      } else {
        const error = await response.json()
        alert(`Erreur: ${error.error}`)
      }
    } catch (error) {
      console.error('Erreur lors de la création:', error)
      alert('Erreur lors de la création de l\'arrêté')
    }
  }

  const handleValidateSettlement = async (action: 'validate' | 'reject') => {
    if (!selectedSettlement) return

    try {
      const response = await fetch(`/api/cash-settlements/${selectedSettlement.id}/validate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          received_amount: parseFloat(validationData.received_amount),
          validation_notes: validationData.validation_notes,
          exception_reason: validationData.exception_reason,
          rejection_reason: validationData.rejection_reason
        })
      })

      if (response.ok) {
        setShowValidationDialog(false)
        setSelectedSettlement(null)
        setValidationData({
          received_amount: '',
          validation_notes: '',
          exception_reason: '',
          rejection_reason: ''
        })
        loadSettlements()
      } else {
        const error = await response.json()
        alert(`Erreur: ${error.error}`)
      }
    } catch (error) {
      console.error('Erreur lors de la validation:', error)
      alert('Erreur lors de la validation de l\'arrêté')
    }
  }

  const handleAddUnloading = async () => {
    if (!selectedSettlement) return

    try {
      const response = await fetch(`/api/cash-settlements/${selectedSettlement.id}/unloading`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: parseFloat(formData.unloading_amount),
          reason: formData.unloading_reason
        })
      })

      if (response.ok) {
        setFormData(prev => ({ ...prev, unloading_amount: '', unloading_reason: '' }))
        loadSettlements()
        loadSettlementUnloadings(selectedSettlement.id)
      } else {
        const error = await response.json()
        alert(`Erreur: ${error.error}`)
      }
    } catch (error) {
      console.error('Erreur lors de l\'ajout du délestage:', error)
      alert('Erreur lors de l\'ajout du délestage')
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="outline" className="text-yellow-600">En attente</Badge>
      case 'validated':
        return <Badge variant="outline" className="text-green-600">Validé</Badge>
      case 'rejected':
        return <Badge variant="destructive">Rejeté</Badge>
      case 'exception':
        return <Badge variant="outline" className="text-orange-600">Exceptionnel</Badge>
      default:
        return <Badge variant="secondary">{status}</Badge>
    }
  }

  const canCreateSettlement = user.role === 'cashier' || user.role === 'accounting'
  const canValidateSettlement = user.role === 'cash_manager' || user.role === 'accounting' || user.role === 'director'
  const canViewAllSettlements = user.role === 'cash_manager' || user.role === 'accounting' || user.role === 'director' || user.role === 'auditor'

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Receipt className="h-6 w-6" />
          <h1 className="text-2xl font-bold">Arrêté de caisse</h1>
        </div>
        {canCreateSettlement && (
          <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Nouvel arrêté
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Créer un arrêté de caisse</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="settlement_date">Date de l'arrêté</Label>
                    <Input
                      id="settlement_date"
                      type="date"
                      value={formData.settlement_date}
                      onChange={(e) => setFormData(prev => ({ ...prev, settlement_date: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label htmlFor="total_amount">Montant total des transactions (XAF)</Label>
                    <Input
                      id="total_amount"
                      type="number"
                      value={formData.total_transactions_amount}
                      onChange={(e) => setFormData(prev => ({ ...prev, total_transactions_amount: e.target.value }))}
                      placeholder="0"
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="unloading_amount">Montant du délestage (XAF)</Label>
                  <Input
                    id="unloading_amount"
                    type="number"
                    value={formData.unloading_amount}
                    onChange={(e) => setFormData(prev => ({ ...prev, unloading_amount: e.target.value }))}
                    placeholder="0"
                  />
                </div>
                <div>
                  <Label htmlFor="unloading_reason">Raison du délestage</Label>
                  <Textarea
                    id="unloading_reason"
                    value={formData.unloading_reason}
                    onChange={(e) => setFormData(prev => ({ ...prev, unloading_reason: e.target.value }))}
                    placeholder="Raison du délestage..."
                  />
                </div>
                <div>
                  <Label htmlFor="operation_report">Rapport des opérations du jour</Label>
                  <Input
                    id="operation_report"
                    type="file"
                    accept=".pdf,.xlsx,.xls,.csv"
                    onChange={(e) => setFormData(prev => ({ ...prev, operation_report_file: e.target.files?.[0] || null }))}
                  />
                </div>
                <div className="flex justify-end space-x-2">
                  <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
                    Annuler
                  </Button>
                  <Button onClick={handleCreateSettlement}>
                    Créer l'arrêté
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <Tabs defaultValue="settlements" className="space-y-4">
        <TabsList>
          <TabsTrigger value="settlements">Arrêtés de caisse</TabsTrigger>
          {canValidateSettlement && (
            <TabsTrigger value="pending">En attente de validation</TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="settlements" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <FileText className="h-5 w-5" />
                <span>Historique des arrêtés</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="text-center py-8">Chargement...</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Numéro</TableHead>
                      <TableHead>Caissier</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Montant total</TableHead>
                      <TableHead>Délestage</TableHead>
                      <TableHead>Montant final</TableHead>
                      <TableHead>Statut</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {settlements.map((settlement) => (
                      <TableRow key={settlement.id}>
                        <TableCell className="font-medium">{settlement.settlement_number}</TableCell>
                        <TableCell>{settlement.cashier_name}</TableCell>
                        <TableCell>{new Date(settlement.settlement_date).toLocaleDateString('fr-FR')}</TableCell>
                        <TableCell>{settlement.total_transactions_amount.toLocaleString('fr-FR')} XAF</TableCell>
                        <TableCell>{settlement.unloading_amount.toLocaleString('fr-FR')} XAF</TableCell>
                        <TableCell>{settlement.final_amount.toLocaleString('fr-FR')} XAF</TableCell>
                        <TableCell>{getStatusBadge(settlement.status)}</TableCell>
                        <TableCell>
                          <div className="flex space-x-2">
                            <Dialog>
                              <DialogTrigger asChild>
                                <Button 
                                  size="sm" 
                                  variant="outline"
                                  onClick={() => {
                                    setSelectedSettlement(settlement)
                                    loadSettlementUnloadings(settlement.id)
                                  }}
                                >
                                  <Eye className="h-3 w-3" />
                                </Button>
                              </DialogTrigger>
                              <DialogContent className="max-w-4xl">
                                <DialogHeader>
                                  <DialogTitle>Détails de l'arrêté {settlement.settlement_number}</DialogTitle>
                                </DialogHeader>
                                <div className="space-y-4">
                                  <div className="grid grid-cols-2 gap-4">
                                    <div>
                                      <Label>Caissier</Label>
                                      <p className="text-sm">{settlement.cashier_name}</p>
                                    </div>
                                    <div>
                                      <Label>Date</Label>
                                      <p className="text-sm">{new Date(settlement.settlement_date).toLocaleDateString('fr-FR')}</p>
                                    </div>
                                    <div>
                                      <Label>Montant total des transactions</Label>
                                      <p className="text-sm font-medium">{settlement.total_transactions_amount.toLocaleString('fr-FR')} XAF</p>
                                    </div>
                                    <div>
                                      <Label>Montant du délestage</Label>
                                      <p className="text-sm">{settlement.unloading_amount.toLocaleString('fr-FR')} XAF</p>
                                    </div>
                                    <div>
                                      <Label>Montant final</Label>
                                      <p className="text-sm font-medium">{settlement.final_amount.toLocaleString('fr-FR')} XAF</p>
                                    </div>
                                    <div>
                                      <Label>Statut</Label>
                                      <div>{getStatusBadge(settlement.status)}</div>
                                    </div>
                                  </div>
                                  
                                  {settlement.unloading_reason && (
                                    <div>
                                      <Label>Raison du délestage</Label>
                                      <p className="text-sm">{settlement.unloading_reason}</p>
                                    </div>
                                  )}

                                  {settlement.validation_notes && (
                                    <div>
                                      <Label>Notes de validation</Label>
                                      <p className="text-sm">{settlement.validation_notes}</p>
                                    </div>
                                  )}

                                  {settlement.exception_reason && (
                                    <div>
                                      <Label>Raison de l'exception</Label>
                                      <p className="text-sm text-orange-600">{settlement.exception_reason}</p>
                                    </div>
                                  )}

                                  {settlement.rejection_reason && (
                                    <div>
                                      <Label>Motif du rejet</Label>
                                      <p className="text-sm text-red-600">{settlement.rejection_reason}</p>
                                    </div>
                                  )}

                                  {canValidateSettlement && settlement.status === 'pending' && (
                                    <div className="pt-4 border-t">
                                      <div className="flex justify-end space-x-2">
                                        <Button 
                                          variant="outline"
                                          onClick={() => {
                                            setShowValidationDialog(true)
                                            setSelectedSettlement(settlement)
                                          }}
                                        >
                                          Valider/Rejeter
                                        </Button>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </DialogContent>
                            </Dialog>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {canValidateSettlement && (
          <TabsContent value="pending" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <AlertTriangle className="h-5 w-5" />
                  <span>Arrêtés en attente de validation</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Numéro</TableHead>
                      <TableHead>Caissier</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Montant final</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {settlements.filter(s => s.status === 'pending').map((settlement) => (
                      <TableRow key={settlement.id}>
                        <TableCell className="font-medium">{settlement.settlement_number}</TableCell>
                        <TableCell>{settlement.cashier_name}</TableCell>
                        <TableCell>{new Date(settlement.settlement_date).toLocaleDateString('fr-FR')}</TableCell>
                        <TableCell>{settlement.final_amount.toLocaleString('fr-FR')} XAF</TableCell>
                        <TableCell>
                          <Button 
                            size="sm"
                            onClick={() => {
                              setShowValidationDialog(true)
                              setSelectedSettlement(settlement)
                            }}
                          >
                            Valider
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>

      {/* Dialog de validation */}
      <Dialog open={showValidationDialog} onOpenChange={setShowValidationDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Validation de l'arrêté {selectedSettlement?.settlement_number}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="p-4 bg-gray-50 rounded-lg">
              <p className="text-sm"><strong>Montant final attendu:</strong> {selectedSettlement?.final_amount.toLocaleString('fr-FR')} XAF</p>
            </div>
            <div>
              <Label htmlFor="received_amount">Montant reçu (XAF)</Label>
              <Input
                id="received_amount"
                type="number"
                value={validationData.received_amount}
                onChange={(e) => setValidationData(prev => ({ ...prev, received_amount: e.target.value }))}
                placeholder="0"
              />
            </div>
            <div>
              <Label htmlFor="validation_notes">Notes de validation</Label>
              <Textarea
                id="validation_notes"
                value={validationData.validation_notes}
                onChange={(e) => setValidationData(prev => ({ ...prev, validation_notes: e.target.value }))}
                placeholder="Notes..."
              />
            </div>
            <div>
              <Label htmlFor="exception_reason">Raison de l'exception (si applicable)</Label>
              <Textarea
                id="exception_reason"
                value={validationData.exception_reason}
                onChange={(e) => setValidationData(prev => ({ ...prev, exception_reason: e.target.value }))}
                placeholder="Raison de l'exception..."
              />
            </div>
            <div>
              <Label htmlFor="rejection_reason">Motif du rejet (si applicable)</Label>
              <Textarea
                id="rejection_reason"
                value={validationData.rejection_reason}
                onChange={(e) => setValidationData(prev => ({ ...prev, rejection_reason: e.target.value }))}
                placeholder="Motif du rejet..."
              />
            </div>
            <div className="flex justify-end space-x-2">
              <Button variant="outline" onClick={() => setShowValidationDialog(false)}>
                Annuler
              </Button>
              <Button 
                variant="destructive"
                onClick={() => handleValidateSettlement('reject')}
                disabled={!validationData.rejection_reason}
              >
                Rejeter
              </Button>
              <Button 
                onClick={() => handleValidateSettlement('validate')}
                disabled={!validationData.received_amount}
              >
                Valider
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
