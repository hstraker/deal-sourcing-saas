"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { FileDown, Loader2 } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

interface GenerateInvestorPackButtonProps {
  dealId: string
  dealAddress: string
}

export function GenerateInvestorPackButton({ dealId, dealAddress }: GenerateInvestorPackButtonProps) {
  const [isGenerating, setIsGenerating] = useState(false)
  const { toast } = useToast()

  const handleGenerateInvestorPack = async () => {
    setIsGenerating(true)

    try {
      const response = await fetch(`/api/deals/${dealId}/investor-pack`)

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || "Failed to generate investor pack")
      }

      // Get the PDF blob
      const blob = await response.blob()

      // Create a download link and trigger it
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `investor-pack-${dealAddress.replace(/[^a-z0-9]/gi, "-").toLowerCase()}.pdf`
      document.body.appendChild(a)
      a.click()

      // Cleanup
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)

      toast({
        title: "Success",
        description: "Investor pack generated successfully",
      })
    } catch (error) {
      console.error("Error generating investor pack:", error)
      toast({
        variant: "destructive",
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to generate investor pack",
      })
    } finally {
      setIsGenerating(false)
    }
  }

  return (
    <Button
      onClick={handleGenerateInvestorPack}
      disabled={isGenerating}
      variant="outline"
    >
      {isGenerating ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Generating PDF...
        </>
      ) : (
        <>
          <FileDown className="mr-2 h-4 w-4" />
          Generate Investor Pack
        </>
      )}
    </Button>
  )
}
