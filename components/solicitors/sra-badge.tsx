"use client"

import { useState } from "react"
import { ShieldCheck, ShieldAlert, ExternalLink, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { toast } from "sonner"

export interface SolicitorForBadge {
  id: string
  sraNumber: string | null
  sraVerified: boolean
  sraStatus: string | null
  sraVerifiedAt: string | null
  sraDisplayName: string | null
}

interface SRABadgeProps {
  solicitor: SolicitorForBadge
  onVerified?: (updated: SolicitorForBadge) => void
  showVerifyButton?: boolean
}

export function SRABadge({
  solicitor,
  onVerified,
  showVerifyButton = true,
}: SRABadgeProps) {
  const [isVerifying, setIsVerifying] = useState(false)
  const [current, setCurrent] = useState(solicitor)

  const handleVerify = async () => {
    setIsVerifying(true)
    try {
      const res = await fetch(`/api/solicitors/${current.id}/verify-sra`, {
        method: "POST",
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Verification failed")

      const updated = data.solicitor as SolicitorForBadge
      setCurrent(updated)
      onVerified?.(updated)

      if (updated.sraVerified) {
        toast.success(`SRA Verified: ${updated.sraStatus ?? "Authorised"}`)
      } else {
        toast.warning(
          `SRA check complete: ${updated.sraStatus ?? "Could not confirm authorisation"}`
        )
      }
    } catch (err: any) {
      toast.error(err.message ?? "SRA verification failed")
    } finally {
      setIsVerifying(false)
    }
  }

  const sraProfileUrl = current.sraNumber
    ? `https://www.sra.org.uk/consumers/register/individual/?id=${encodeURIComponent(current.sraNumber)}`
    : null

  // No SRA number on record — show neutral state
  if (!current.sraNumber) {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
        <ShieldAlert className="h-3.5 w-3.5" />
        No SRA number
      </span>
    )
  }

  if (current.sraVerified) {
    return (
      <div className="flex items-center gap-1.5">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700 dark:text-green-400">
                <ShieldCheck className="h-3.5 w-3.5" />
                SRA Verified
              </span>
            </TooltipTrigger>
            <TooltipContent>
              <p className="text-xs">
                Status: <strong>{current.sraStatus}</strong>
                {current.sraDisplayName && (
                  <> · {current.sraDisplayName}</>
                )}
                {current.sraVerifiedAt && (
                  <> · Checked {new Date(current.sraVerifiedAt).toLocaleDateString("en-GB")}</>
                )}
              </p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
        {sraProfileUrl && (
          <a
            href={sraProfileUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-muted-foreground hover:text-foreground"
            title="View on SRA register"
          >
            <ExternalLink className="h-3 w-3" />
          </a>
        )}
      </div>
    )
  }

  return (
    <div className="flex items-center gap-1.5">
      <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-600 dark:text-amber-400">
        <ShieldAlert className="h-3.5 w-3.5" />
        {current.sraStatus ?? "Unverified"}
      </span>
      {sraProfileUrl && (
        <a
          href={sraProfileUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-muted-foreground hover:text-foreground"
          title="View on SRA register"
        >
          <ExternalLink className="h-3 w-3" />
        </a>
      )}
      {showVerifyButton && (
        <Button
          variant="ghost"
          size="sm"
          className="h-5 px-1.5 text-xs text-amber-700 hover:text-amber-900"
          onClick={handleVerify}
          disabled={isVerifying}
        >
          {isVerifying && <Loader2 className="h-3 w-3 animate-spin mr-1" />}
          Verify
        </Button>
      )}
    </div>
  )
}
