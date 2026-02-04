import { PageLoader } from "@/components/ui/page-loader"

export default function TransactionsLoading() {
  return <PageLoader message="Chargement des opérations..." overlay={false} className="min-h-[400px]" />
}
