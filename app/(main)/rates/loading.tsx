import { PageLoader } from "@/components/ui/page-loader"

export default function RatesLoading() {
  return <PageLoader message="Chargement des taux et plafonds..." overlay={false} className="min-h-[400px]" />
}
