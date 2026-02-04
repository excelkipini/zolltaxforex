import { PageLoader } from "@/components/ui/page-loader"

export default function CardsLoading() {
  return <PageLoader message="Chargement de la gestion des cartes..." overlay={false} className="min-h-[400px]" />
}
