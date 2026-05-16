import { InvestorDealDetail } from "@/components/investor/investor-deal-detail"

export const metadata = { title: "Deal Detail | Investor Portal" }

export default function DealDetailPage({ params }: { params: { id: string } }) {
  return <InvestorDealDetail dealId={params.id} />
}
