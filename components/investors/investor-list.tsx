"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Loader2, Search, Mail, Phone, PoundSterling, Plus, Edit, Trash2 } from "lucide-react"
import Link from "next/link"
import { format } from "date-fns"
import { InvestorForm } from "./investor-form"

interface Investor {
  id: string
  user: {
    id: string
    email: string
    firstName: string | null
    lastName: string | null
    phone: string | null
  }
  minBudget: number | null
  maxBudget: number | null
  strategy: string[]
  experienceLevel: string | null
  financingStatus: string | null
  emailAlerts: boolean
  smsAlerts: boolean
  dealsPurchased: number
  totalSpent: number
  createdAt: string
  _count?: {
    reservations: number
  }
}

interface InvestorListProps {
  initialInvestors?: Investor[]
}

// Color mappings for labels
const experienceColors: Record<string, string> = {
  beginner: "bg-blue-100 text-blue-800 border-blue-200",
  intermediate: "bg-green-100 text-green-800 border-green-200",
  advanced: "bg-purple-100 text-purple-800 border-purple-200",
}

const financingColors: Record<string, string> = {
  cash: "bg-emerald-100 text-emerald-800 border-emerald-200",
  mortgage: "bg-amber-100 text-amber-800 border-amber-200",
  both: "bg-indigo-100 text-indigo-800 border-indigo-200",
}

const strategyColors: Record<string, string> = {
  BRRRR: "bg-pink-100 text-pink-800 border-pink-200",
  BTL: "bg-cyan-100 text-cyan-800 border-cyan-200",
  Flip: "bg-orange-100 text-orange-800 border-orange-200",
}

export function InvestorList({ initialInvestors = [] }: InvestorListProps) {
  const [investors, setInvestors] = useState<Investor[]>(initialInvestors)
  const [isLoading, setIsLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editingInvestor, setEditingInvestor] = useState<Investor | null>(null)

  const fetchInvestors = async () => {
    setIsLoading(true)
    try {
      const response = await fetch("/api/investors")
      if (response.ok) {
        const data = await response.json()
        setInvestors(data)
      }
    } catch (error) {
      console.error("Error fetching investors:", error)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    if (initialInvestors.length === 0) {
      fetchInvestors()
    }
  }, [])

  const filteredInvestors = investors.filter((investor) => {
    const name = [
      investor.user.firstName,
      investor.user.lastName,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase()
    const email = investor.user.email.toLowerCase()
    const query = searchQuery.toLowerCase()
    return name.includes(query) || email.includes(query)
  })

  const getInvestorName = (investor: Investor) => {
    const name = [investor.user.firstName, investor.user.lastName]
      .filter(Boolean)
      .join(" ")
    return name || investor.user.email
  }

  const handleCreate = () => {
    setEditingInvestor(null)
    setIsFormOpen(true)
  }

  const handleEdit = (investor: Investor) => {
    setEditingInvestor(investor)
    setIsFormOpen(true)
  }

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this investor? This will also delete their user account.")) {
      return
    }

    try {
      const response = await fetch(`/api/investors/${id}`, {
        method: "DELETE",
      })

      if (response.ok) {
        fetchInvestors()
      } else {
        const errorData = await response.json()
        alert(errorData.error || "Failed to delete investor")
      }
    } catch (error) {
      console.error("Error deleting investor:", error)
      alert("Failed to delete investor")
    }
  }

  const handleFormSuccess = () => {
    setIsFormOpen(false)
    setEditingInvestor(null)
    fetchInvestors()
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Investors</CardTitle>
            <CardDescription>
              Manage investor profiles and track reservations
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search investors..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 w-64"
              />
            </div>
            <Button onClick={handleCreate} size="sm">
              <Plus className="mr-2 h-4 w-4" />
              New Investor
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : filteredInvestors.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground">
            <p>No investors found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Investor</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Budget</TableHead>
                  <TableHead>Strategy</TableHead>
                  <TableHead>Experience</TableHead>
                  <TableHead>Financing</TableHead>
                  <TableHead>Deals Purchased</TableHead>
                  <TableHead>Total Spent</TableHead>
                  <TableHead>Joined</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredInvestors.map((investor) => (
                  <TableRow key={investor.id}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{getInvestorName(investor)}</div>
                        <div className="text-sm text-muted-foreground flex items-center gap-1">
                          <Mail className="h-3 w-3" />
                          {investor.user.email}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {investor.user.phone ? (
                        <div className="flex items-center gap-1 text-sm">
                          <Phone className="h-3 w-3" />
                          {investor.user.phone}
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-sm">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {investor.minBudget || investor.maxBudget ? (
                        <div className="text-sm">
                          £
                          {investor.minBudget
                            ? investor.minBudget.toLocaleString()
                            : "—"}
                          {" - "}
                          £
                          {investor.maxBudget
                            ? investor.maxBudget.toLocaleString()
                            : "—"}
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-sm">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {investor.strategy && investor.strategy.length > 0 ? (
                          investor.strategy.map((s) => (
                            <Badge
                              key={s}
                              variant="outline"
                              className={`text-xs ${
                                strategyColors[s] || "bg-gray-100 text-gray-800 border-gray-200"
                              }`}
                            >
                              {s}
                            </Badge>
                          ))
                        ) : (
                          <span className="text-muted-foreground text-sm">—</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {investor.experienceLevel ? (
                        <Badge
                          variant="outline"
                          className={`text-xs ${
                            experienceColors[investor.experienceLevel] ||
                            "bg-gray-100 text-gray-800 border-gray-200"
                          }`}
                        >
                          {investor.experienceLevel.charAt(0).toUpperCase() +
                            investor.experienceLevel.slice(1)}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground text-sm">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {investor.financingStatus ? (
                        <Badge
                          variant="outline"
                          className={`text-xs ${
                            financingColors[investor.financingStatus] ||
                            "bg-gray-100 text-gray-800 border-gray-200"
                          }`}
                        >
                          {investor.financingStatus.charAt(0).toUpperCase() +
                            investor.financingStatus.slice(1)}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground text-sm">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">{investor.dealsPurchased}</div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <PoundSterling className="h-3 w-3" />
                        {Number(investor.totalSpent).toLocaleString()}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {format(new Date(investor.createdAt), "MMM d, yyyy")}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEdit(investor)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(investor.id)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>

      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingInvestor ? "Edit Investor" : "New Investor"}
            </DialogTitle>
            <DialogDescription>
              {editingInvestor
                ? "Update investor details and preferences"
                : "Create a new investor profile"}
            </DialogDescription>
          </DialogHeader>
          <InvestorForm
            investor={editingInvestor || undefined}
            onSuccess={handleFormSuccess}
            onCancel={() => {
              setIsFormOpen(false)
              setEditingInvestor(null)
            }}
          />
        </DialogContent>
      </Dialog>
    </Card>
  )
}

