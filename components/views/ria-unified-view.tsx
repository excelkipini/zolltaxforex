"use client"

import * as React from "react"
import { useState, useEffect } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { RiaDashboard } from "./ria-dashboard"
import { RiaTransactionsView } from "./ria-transactions-view"
import { RiaCashClosure } from "./ria-cash-closure"
import { useToast } from "@/hooks/use-toast"
import { getSessionClient } from "@/lib/auth-client"

type DashboardData = {
  // Indicateurs primaires
  montant_principal_total: number
  montant_brut: number
  total_frais: number
  remboursements: number
  versement_banque: number
  montant_a_debiter: number
  montant_en_coffre: number
  
  // Indicateurs secondaires
  commissions_ria: number
  tva_ria: number
  commissions_uba: number
  tva_uba: number
  commissions_ztf: number
  tva_ztf: number
  ca_ztf: number
  cte: number
  ttf: number
  
  // Statistiques
  nb_transactions: number
  nb_paiements: number
  nb_annulations: number
  nb_remboursements: number
  montant_moyen: number
}

type GuichetierStats = {
  guichetier: string
  agence: string
  nb_transactions: number
  montant_total: number
  montant_moyen: number
  commissions_generes: number
}

type AgenceStats = {
  agence: string
  nb_transactions: number
  montant_total: number
  montant_moyen: number
  commissions_generes: number
}

type TimeSeriesData = {
  date: string
  transactions: number
  montant_total: number
  montant_principal: number
  commissions: number
  paiements: number
  annulations: number
  remboursements: number
  variation_transactions: number
  variation_montant: number
}

interface RiaUnifiedViewProps {
  initialDashboardData?: {
    guichetierStats: GuichetierStats[]
    agenceStats: AgenceStats[]
    timeSeriesData: TimeSeriesData[]
    filters: {
      agences: { id: string; name: string }[]
      guichetiers: { id: string; name: string }[]
    }
  } & DashboardData
}

export function RiaUnifiedView({ initialDashboardData }: RiaUnifiedViewProps) {
  const { toast } = useToast()
  const [activeTab, setActiveTab] = useState("dashboard")
  const [refreshKey, setRefreshKey] = useState(0)
  const [user, setUser] = useState<any>(null)
  
  // Déterminer si l'utilisateur est un caissier
  const isCashier = user?.role === 'cashier'
  
  // Si c'est un caissier, forcer l'onglet clôture de caisse par défaut
  useEffect(() => {
    const currentUser = getSessionClient()
    setUser(currentUser)
    
    if (currentUser?.role === 'cashier') {
      setActiveTab('cash-closure')
    }
  }, [])

  const handleImportSuccess = () => {
    toast({
      title: "Importation réussie",
      description: "Les données RIA ont été importées avec succès.",
    })
    // Forcer le rafraîchissement du tableau de bord
    setRefreshKey(prev => prev + 1)
  }

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <div>
        <h1 className="text-2xl font-bold">Gestion RIA</h1>
        <p className="text-gray-600">
          Tableau de bord et gestion des opérations RIA
        </p>
      </div>

      {/* Onglets avec design amélioré */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <div className="flex items-center justify-center mb-6">
          <TabsList className="flex w-full max-w-3xl bg-transparent p-3 rounded-lg gap-4">
            {!isCashier && (
              <>
                <TabsTrigger 
                  value="dashboard" 
                  className="flex items-center justify-center space-x-2 px-6 py-4 rounded-md transition-all duration-200 data-[state=active]:bg-white data-[state=active]:shadow-md data-[state=active]:text-blue-600 data-[state=active]:border data-[state=active]:border-blue-200 hover:bg-white/50 flex-1 bg-green-50 hover:bg-green-100 text-green-600 font-semibold"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                  <span className="font-medium text-sm">Tableau de bord</span>
                </TabsTrigger>
                <TabsTrigger 
                  value="transactions" 
                  className="flex items-center justify-center space-x-2 px-6 py-4 rounded-md transition-all duration-200 data-[state=active]:bg-white data-[state=active]:shadow-md data-[state=active]:text-blue-600 data-[state=active]:border data-[state=active]:border-blue-200 hover:bg-white/50 flex-1 bg-yellow-50 hover:bg-yellow-100 text-yellow-600 font-semibold"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                  </svg>
                  <span className="font-medium text-sm">Transactions</span>
                </TabsTrigger>
              </>
            )}
            <TabsTrigger 
              value="cash-closure" 
              className={`flex items-center justify-center space-x-2 px-6 py-4 rounded-md transition-all duration-200 data-[state=active]:bg-white data-[state=active]:shadow-md data-[state=active]:text-blue-600 data-[state=active]:border data-[state=active]:border-blue-200 hover:bg-white/50 ${isCashier ? 'w-full' : 'flex-1'} bg-purple-50 hover:bg-purple-100 text-purple-600 font-semibold`}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              <span className="font-medium text-sm">Clôture de caisse</span>
            </TabsTrigger>
          </TabsList>
        </div>

        {/* Onglet Tableau de bord */}
        {!isCashier && (
          <TabsContent value="dashboard" className="space-y-6">
            <RiaDashboard 
              key={refreshKey}
              initialData={initialDashboardData}
              onImportSuccess={handleImportSuccess}
            />
          </TabsContent>
        )}

        {/* Onglet Transactions */}
        {!isCashier && (
          <TabsContent value="transactions" className="space-y-6">
            <RiaTransactionsView />
          </TabsContent>
        )}

        {/* Onglet Clôture de caisse */}
        <TabsContent value="cash-closure" className="space-y-6">
          <RiaCashClosure />
        </TabsContent>
      </Tabs>
    </div>
  )
}
