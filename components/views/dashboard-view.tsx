"use client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ChartContainer } from "@/components/ui/chart"
import { Bar, BarChart, CartesianGrid, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis, Cell } from "recharts"
import { Button } from "@/components/ui/button"

// Les stats seront maintenant dynamiques via les props

const transactionsData = [
  { day: "Lun", reception: 12, envoi: 8, change: 5 },
  { day: "Mar", reception: 19, envoi: 12, change: 8 },
  { day: "Mer", reception: 8, envoi: 5, change: 3 },
  { day: "Jeu", reception: 15, envoi: 9, change: 6 },
  { day: "Ven", reception: 12, envoi: 7, change: 4 },
  { day: "Sam", reception: 5, envoi: 3, change: 2 },
  { day: "Dim", reception: 3, envoi: 1, change: 0 },
]

const agenciesData = [
  { name: "Agence Centrale", value: 6500000 },
  { name: "Agence Nord", value: 2500000 },
  { name: "Agence Sud", value: 1200000 },
]

const recentTx = [
  {
    id: "TRX-2023-001",
    client: "Jean Dupont",
    type: "Réception",
    montant: "250,000 XAF",
    frais: "9,450 XAF",
    statut: "Confirmé",
    date: "10:45 Aujourd'hui",
  },
  {
    id: "TRX-2023-002",
    client: "Awa Mbala",
    type: "Envoi",
    montant: "500,000 XAF",
    frais: "18,900 XAF",
    statut: "En attente",
    date: "11:20 Aujourd'hui",
  },
  {
    id: "TRX-2023-003",
    client: "Mohamed Diallo",
    type: "Change USD",
    montant: "1,000 $",
    frais: "5,800 XAF",
    statut: "Confirmé",
    date: "09:15 Aujourd'hui",
  },
]

interface DashboardViewProps {
  stats?: Array<{
    title: string
    value: string | number
    delta: string
    color: string
  }>
}

export function DashboardView({ stats = [
  { title: "Transactions aujourd'hui", value: 24, delta: "+12% vs hier", color: "border-blue-500" },
  { title: "Montant total", value: "5,420,000 XAF", delta: "+8% vs hier", color: "border-green-500" },
  { title: "Cartes actives", value: 143, delta: "3 à recharger", color: "border-yellow-500" },
  { title: "Taux USD", value: "1$ = 580 XAF", delta: "Mise à jour: 10:30", color: "border-purple-500" },
] }: DashboardViewProps) {
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-800">Tableau de bord</h2>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {stats.map((s) => (
          <Card key={s.title} className={`border-l-4 ${s.color}`}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{s.title}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{s.value}</div>
              <p className="mt-1 text-sm text-emerald-600">{s.delta}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Transactions par type (7 jours)</CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer
              config={{
                reception: { label: "Réception", color: "#3b82f6" },
                envoi: { label: "Envoi", color: "#10b981" },
                change: { label: "Change", color: "#f59e0b" },
              }}
              className="h-[280px]"
            >
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={transactionsData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="day" />
                  <YAxis />
                  <Tooltip formatter={(value, name) => [value, name]} labelFormatter={(label) => `Jour: ${label}`} />
                  <Bar dataKey="reception" fill="#3b82f6" name="Réception" />
                  <Bar dataKey="envoi" fill="#10b981" name="Envoi" />
                  <Bar dataKey="change" fill="#f59e0b" name="Change" />
                </BarChart>
              </ResponsiveContainer>
            </ChartContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Montants par agence</CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer
              config={{
                value: { label: "Montant", color: "#3b82f6" },
              }}
              className="h-[280px]"
            >
              <ResponsiveContainer width="100%" height="100%">
                <PieChart margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                  <Tooltip formatter={(value, name) => [`${value.toLocaleString()} XAF`, name]} />
                  <Pie
                    data={agenciesData}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={60}
                    outerRadius={100}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  >
                    <Cell fill="#3b82f6" />
                    <Cell fill="#10b981" />
                    <Cell fill="#f59e0b" />
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>

      <Card>
        <div className="flex items-center justify-between p-4">
          <CardTitle>Dernières transactions</CardTitle>
          <Button variant="link" className="px-0">
            Voir tout
          </Button>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                {["N°", "Client", "Type", "Montant", "Frais", "Statut", "Date"].map((h) => (
                  <th
                    key={h}
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {recentTx.map((r) => (
                <tr key={r.id}>
                  <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-gray-900">{r.id}</td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">{r.client}</td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">{r.type}</td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">{r.montant}</td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">{r.frais}</td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm">
                    <span
                      className={`rounded-full px-2 py-1 text-xs ${
                        r.statut === "Confirmé"
                          ? "bg-emerald-100 text-emerald-700"
                          : r.statut === "En attente"
                            ? "bg-amber-100 text-amber-800"
                            : "bg-red-100 text-red-800"
                      }`}
                    >
                      {r.statut}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">{r.date}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}
