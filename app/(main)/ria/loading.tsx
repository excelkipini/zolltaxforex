import { PageLoader } from "@/components/ui/page-loader"

export default function RiaLoading() {
  return <PageLoader message="Chargement de la gestion RIA..." overlay={false} className="min-h-[400px]" />
}
