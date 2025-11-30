import { DealForm } from "@/components/deals/deal-form"

export default function NewDealPage() {
  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Create New Deal</h1>
        <p className="text-muted-foreground">
          Add a new property deal to the system
        </p>
      </div>

      <DealForm />
    </div>
  )
}

