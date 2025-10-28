"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { RiaCsvImport } from "@/components/views/ria-csv-import"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { FileText, Upload, AlertCircle } from "lucide-react"

export function RiaImportClient() {
  const router = useRouter()
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Importation CSV RIA</h1>
        <p className="text-gray-600">
          Importez les fichiers CSV des opérations RIA pour alimenter le tableau de bord
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Upload className="h-5 w-5" />
              <span>Importer un fichier</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-gray-600">
              Cliquez sur le bouton ci-dessous pour ouvrir l'interface d'importation CSV.
            </p>
            <Button 
              onClick={() => setIsImportDialogOpen(true)}
              className="w-full"
            >
              <Upload className="h-4 w-4 mr-2" />
              Ouvrir l'importation CSV
            </Button>
            
            <RiaCsvImport
              isOpen={isImportDialogOpen}
              onClose={() => setIsImportDialogOpen(false)}
              onImportSuccess={() => {
                // Redirection vers le tableau de bord après importation
                router.push('/ria-dashboard')
              }}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <FileText className="h-5 w-5" />
              <span>Format du fichier</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Le fichier CSV doit contenir les colonnes suivantes (séparées par des tabulations, points-virgules ou virgules) :
              </AlertDescription>
            </Alert>
            
            <div className="space-y-2">
              <h4 className="font-medium">Colonnes requises :</h4>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>• SC Numéro du transfert</li>
                <li>• Pin</li>
                <li>• Mode de livraison</li>
                <li>• Guichetier</li>
                <li>• Succursale</li>
                <li>• Code d'agence</li>
                <li>• Sent Amount</li>
                <li>• Sending Currency</li>
                <li>• Pays d'origine</li>
                <li>• Pays de destination</li>
                <li>• Montant du paiement</li>
                <li>• Devise du Bénéficiaire</li>
                <li>• Commission SA</li>
                <li>• Devise Comission SA</li>
                <li>• Date</li>
                <li>• Taux</li>
                <li>• TTF</li>
                <li>• CTE</li>
                <li>• TVA1</li>
                <li>• Montant a payer</li>
                <li>• Frais Client</li>
                <li>• Action</li>
              </ul>
            </div>

            <div className="space-y-2">
              <h4 className="font-medium">Actions possibles :</h4>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>• <Badge variant="outline">Envoyé</Badge> - Transaction envoyée</li>
                <li>• <Badge variant="outline">Payé</Badge> - Transaction payée</li>
                <li>• <Badge variant="outline">Annulé</Badge> - Transaction annulée</li>
                <li>• <Badge variant="outline">Remboursé</Badge> - Transaction remboursée</li>
                <li>• <Badge variant="outline">En attente</Badge> - Transaction en attente</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
