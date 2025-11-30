"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Loader2 } from "lucide-react"

interface TeamMember {
  id: string
  email: string
  firstName: string | null
  lastName: string | null
  role: string
}

interface QuickAssignUserProps {
  dealId: string
  currentAssignedToId: string | null
  currentAssignedToName?: string | null
}

export function QuickAssignUser({
  dealId,
  currentAssignedToId,
  currentAssignedToName,
}: QuickAssignUserProps) {
  const router = useRouter()
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isAssigning, setIsAssigning] = useState(false)

  useEffect(() => {
    const fetchTeamMembers = async () => {
      try {
        const response = await fetch("/api/users/team")
        if (response.ok) {
          const members = await response.json()
          setTeamMembers(members)
        }
      } catch (error) {
        console.error("Failed to fetch team members:", error)
      } finally {
        setIsLoading(false)
      }
    }
    fetchTeamMembers()
  }, [])

  const handleAssign = async (userId: string | null) => {
    setIsAssigning(true)
    try {
      const response = await fetch(`/api/deals/${dealId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          assignedToId: userId,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Failed to assign user")
      }

      router.refresh()
    } catch (error) {
      console.error("Error assigning user:", error)
      alert(`Error assigning user: ${error instanceof Error ? error.message : "Unknown error"}`)
    } finally {
      setIsAssigning(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading...
      </div>
    )
  }

  return (
    <Select
      value={currentAssignedToId || "unassigned"}
      onValueChange={(value) => handleAssign(value === "unassigned" ? null : value)}
      disabled={isAssigning}
    >
      <SelectTrigger className="w-[200px]">
        <SelectValue placeholder="Unassigned">
          {currentAssignedToName || "Unassigned"}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="unassigned">Unassigned</SelectItem>
        {teamMembers.map((member) => {
          const name = [member.firstName, member.lastName]
            .filter(Boolean)
            .join(" ") || member.email
          return (
            <SelectItem key={member.id} value={member.id}>
              {name} {member.role === "admin" && "(Admin)"}
            </SelectItem>
          )
        })}
      </SelectContent>
    </Select>
  )
}

