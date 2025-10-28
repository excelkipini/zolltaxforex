"use client"

import * as React from "react"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Upload, FileText, CheckCircle, AlertCircle, Loader2 } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

interface RiaCsvImportProps {
  isOpen: boolean
  onClose: () => void
  onImportSuccess?: () => void
}

export function RiaCsvImport({ isOpen, onClose, onImportSuccess }: RiaCsvImportProps) {
  const { toast } = useToast()
  const [file, setFile] = useState<File | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [guichetiers, setGuichetiers] = useState<string[]>([])
  const [delestages, setDelestages] = useState<Record<string, number>>({})
  const [showDelestageForm, setShowDelestageForm] = useState(false)

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0]
    if (selectedFile) {
      if (selectedFile.type === 'text/csv' || selectedFile.name.endsWith('.csv')) {
        setFile(selectedFile)
        setUploadProgress(0)
        
        // Analyser le fichier pour extraire les guichetiers
        try {
          const text = await selectedFile.text()
          const lines = text.split('\n').filter(line => line.trim())
          if (lines.length > 1) {
            const headers = lines[0].split(/[;\t,]/).map(h => h.trim())
            const guichetierIndex = headers.findIndex(h => 
              h.toLowerCase().includes('guichetier') || 
              h.toLowerCase().includes('guichet')
            )
            
            if (guichetierIndex !== -1) {
              const uniqueGuichetiers = new Set<string>()
              for (let i = 1; i < Math.min(lines.length, 100); i++) { // Limiter à 100 lignes pour l'analyse
                const values = lines[i].split(/[;\t,]/).map(v => v.trim())
                if (values[guichetierIndex]) {
                  uniqueGuichetiers.add(values[guichetierIndex])
                }
              }
              setGuichetiers(Array.from(uniqueGuichetiers))
              setShowDelestageForm(true)
            }
          }
        } catch (error) {
          console.error('Erreur lors de l\'analyse du fichier:', error)
        }
      } else {
        toast({
          title: "Format de fichier invalide",
          description: "Veuillez sélectionner un fichier CSV.",
          variant: "destructive",
        })
      }
    }
  }

  const handleUpload = async () => {
    if (!file) {
      toast({
        title: "Aucun fichier sélectionné",
        description: "Veuillez sélectionner un fichier CSV à importer.",
        variant: "destructive",
      })
      return
    }

    setIsUploading(true)
    setUploadProgress(0)

    try {
      const formData = new FormData()
      formData.append('file', file)
      
      // Ajouter les délestages
      formData.append('delestages', JSON.stringify(delestages))

      // Simuler le progrès
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => Math.min(prev + 10, 90))
      }, 200)

      const response = await fetch('/api/ria-transactions/import-csv', {
        method: 'POST',
        body: formData,
      })

      clearInterval(progressInterval)
      setUploadProgress(100)

      const result = await response.json()

      if (result.ok) {
        toast({
          title: "Importation réussie",
          description: `${result.data.count} transactions RIA importées avec succès.`,
        })
        
        setFile(null)
        setGuichetiers([])
        setDelestages({})
        setShowDelestageForm(false)
        onClose()
        onImportSuccess?.()
      } else {
        throw new Error(result.error || 'Erreur lors de l\'importation')
      }
    } catch (error: any) {
      console.error('Erreur importation:', error)
      toast({
        title: "Erreur d'importation",
        description: error.message || "Une erreur est survenue lors de l'importation.",
        variant: "destructive",
      })
    } finally {
      setIsUploading(false)
      setUploadProgress(0)
    }
  }

  const handleClose = () => {
    if (!isUploading) {
      setFile(null)
      setUploadProgress(0)
      onClose()
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <FileText className="h-5 w-5" />
            <span>Importer CSV RIA</span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <strong>Format attendu :</strong> Fichier CSV avec séparateur tabulation, point-virgule ou virgule contenant les colonnes :
                SC Numéro du transfert, Pin, Mode de livraison, Guichetier, Succursale, Code d'agence, 
                Sent Amount, Sending Currency, Pays d'origine, Pays de destination, Montant du paiement, 
                Devise du Bénéficiaire, Commission SA, Devise Comission SA, Date, Taux, TTF, CTE, TVA1, 
                Montant a payer, Frais Client, Action
              </AlertDescription>
            </Alert>

          <div className="space-y-2">
            <Label htmlFor="csv-file">Fichier CSV</Label>
            <Input
              id="csv-file"
              type="file"
              accept=".csv,text/csv"
              onChange={handleFileChange}
              disabled={isUploading}
            />
            {file && (
              <div className="flex items-center space-x-2 text-sm text-green-600">
                <CheckCircle className="h-4 w-4" />
                <span>{file.name} ({(file.size / 1024).toFixed(1)} KB)</span>
              </div>
            )}
          </div>

          {/* Formulaire de délestage */}
          {showDelestageForm && guichetiers.length > 0 && (
            <div className="space-y-4 p-4 bg-gray-50 rounded-lg">
              <h3 className="text-lg font-semibold text-gray-800">Délestages par Guichetier</h3>
              <p className="text-sm text-gray-600">
                Saisissez le montant du délestage pour chaque guichetier (montant en FCFA)
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {guichetiers.map(guichetier => (
                  <div key={guichetier} className="space-y-2">
                    <Label htmlFor={`delestage-${guichetier}`}>{guichetier}</Label>
                    <Input
                      id={`delestage-${guichetier}`}
                      type="number"
                      min="0"
                      step="1"
                      placeholder="0"
                      value={delestages[guichetier] || ''}
                      onChange={(e) => setDelestages(prev => ({
                        ...prev,
                        [guichetier]: parseFloat(e.target.value) || 0
                      }))}
                      disabled={isUploading}
                    />
                  </div>
                ))}
              </div>
              <div className="text-sm text-gray-600">
                <strong>Total délestage :</strong> {Object.values(delestages).reduce((sum, val) => sum + val, 0).toLocaleString('fr-FR')} FCFA
              </div>
            </div>
          )}

          {isUploading && (
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm">Importation en cours...</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </div>
          )}

          <div className="flex justify-end space-x-2">
            <Button 
              variant="outline" 
              onClick={handleClose}
              disabled={isUploading}
            >
              Annuler
            </Button>
            <Button 
              onClick={handleUpload}
              disabled={!file || isUploading}
              className="flex items-center space-x-2"
            >
              {isUploading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Upload className="h-4 w-4" />
              )}
              <span>{isUploading ? 'Importation...' : 'Importer'}</span>
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
