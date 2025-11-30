"use client"

import { useState, useMemo, useRef, useEffect } from "react"
import { Input } from "@/components/ui/input"
import { Search, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { DealWithRelations } from "@/types/deal"

interface DealSearchProps {
  deals: DealWithRelations[]
  onFilteredDealsChange?: (filteredDeals: DealWithRelations[]) => void
  onSearchQueryChange?: (query: string) => void
  searchQuery?: string
}

export function DealSearch({
  deals,
  onFilteredDealsChange,
  onSearchQueryChange,
  searchQuery: externalSearchQuery,
}: DealSearchProps) {
  const [internalSearchQuery, setInternalSearchQuery] = useState("")
  const searchQuery = externalSearchQuery ?? internalSearchQuery
  const [isFocused, setIsFocused] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Filter deals based on search query
  const filteredDeals = useMemo(() => {
    if (!searchQuery.trim()) {
      return deals
    }

    const query = searchQuery.toLowerCase().trim()
    
    return deals.filter((deal) => {
      const addressMatch = deal.address.toLowerCase().includes(query)
      const postcodeMatch = deal.postcode?.toLowerCase().includes(query)
      const priceMatch = deal.askingPrice.toString().includes(query)
      
      return addressMatch || postcodeMatch || priceMatch
    })
  }, [deals, searchQuery])

  // Generate suggestions for autocomplete
  const suggestions = useMemo(() => {
    if (!searchQuery.trim() || searchQuery.length < 2) {
      return []
    }

    const query = searchQuery.toLowerCase().trim()
    const suggestionSet = new Set<string>()

    deals.forEach((deal) => {
      // Address suggestions
      if (deal.address.toLowerCase().includes(query)) {
        suggestionSet.add(deal.address)
      }
      
      // Postcode suggestions
      if (deal.postcode?.toLowerCase().includes(query)) {
        if (deal.postcode) {
          suggestionSet.add(deal.postcode)
        }
      }
    })

    return Array.from(suggestionSet).slice(0, 5)
  }, [deals, searchQuery])

  // Notify parent component of filtered deals
  useEffect(() => {
    onFilteredDealsChange?.(filteredDeals)
  }, [filteredDeals, onFilteredDealsChange])

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsFocused(false)
      }
    }

    document.addEventListener("mousedown", handleClickOutside)
    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [])

  const handleSuggestionClick = (suggestion: string) => {
    const newQuery = suggestion
    if (externalSearchQuery === undefined) {
      setInternalSearchQuery(newQuery)
    }
    onSearchQueryChange?.(newQuery)
    setIsFocused(false)
    inputRef.current?.blur()
  }

  const handleClear = () => {
    const newQuery = ""
    if (externalSearchQuery === undefined) {
      setInternalSearchQuery(newQuery)
    }
    onSearchQueryChange?.(newQuery)
    inputRef.current?.focus()
  }

  const handleQueryChange = (value: string) => {
    if (externalSearchQuery === undefined) {
      setInternalSearchQuery(value)
    }
    onSearchQueryChange?.(value)
  }

  return (
    <div className="relative w-full" ref={containerRef}>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          ref={inputRef}
          type="text"
          placeholder="Search by address, postcode, or price..."
          value={searchQuery}
          onChange={(e) => handleQueryChange(e.target.value)}
          onFocus={() => setIsFocused(true)}
          className="pl-9 pr-9"
        />
        {searchQuery && (
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-1 top-1/2 h-7 w-7 -translate-y-1/2"
            onClick={handleClear}
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Autocomplete Suggestions */}
      {isFocused && suggestions.length > 0 && (
        <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover shadow-md">
          <div className="p-1">
            {suggestions.map((suggestion, index) => (
              <button
                key={index}
                className="w-full rounded-sm px-2 py-1.5 text-sm text-left hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground"
                onClick={() => handleSuggestionClick(suggestion)}
              >
                <div className="flex items-center gap-2">
                  <Search className="h-3 w-3 text-muted-foreground" />
                  <span>{suggestion}</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Results count */}
      {searchQuery && (
        <p className="mt-2 text-sm text-muted-foreground">
          {filteredDeals.length} {filteredDeals.length === 1 ? "deal" : "deals"} found
        </p>
      )}
    </div>
  )
}

