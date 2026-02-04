import { PageLoader } from "@/components/ui/page-loader"

export default function ReceiptLoading() {
  return <PageLoader message="Chargement du transfert international..." overlay={false} className="min-h-[400px]" />
}
