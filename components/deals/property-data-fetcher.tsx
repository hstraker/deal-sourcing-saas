"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Loader2, Search, AlertCircle, CheckCircle2, TrendingUp, TrendingDown, Info, MapPin } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { PROPERTY_LISTS, getPropertyListInsights } from "@/lib/propertydata"

interface PropertyDataFetcherProps {
  address: string
  postcode?: string | null
  onDataFetched: (data: {
    address?: string
    postcode?: string
    bedrooms?: number
    bathrooms?: number
    squareFeet?: number
    propertyType?: string
    marketValue?: number
    estimatedMonthlyRent?: number
    latitude?: number
    longitude?: number
  }) => void
}

interface PropertyDataResponse {
  success: boolean
  data?: {
    address?: string
    postcode?: string
    bedrooms?: number
    bathrooms?: number
    squareFeet?: number
    propertyType?: string
    estimatedValue?: number
    estimatedMonthlyRent?: number
    latitude?: number
    longitude?: number
    comparables?: Array<{
      address: string
      salePrice: number
      saleDate: string
      bedrooms: number
      distance: number
    }>
    areaStats?: {
      averagePrice: number
      growthLastYear: number
      growthLast5Years: number
      rentalYield: number
    }
  }
  analysis?: {
    insights: string[]
    recommendations: string[]
    riskFactors: string[]
  }
  error?: string
  warning?: string // Warning message (e.g., when no exact match found)
  cached?: boolean
}

interface PropertySearchResult {
  id: string
  address: string
  postcode: string
  type: string
  bedrooms: number
  price: number
  sqf: number | null
  distance_to: string
  days_on_market: number
  sourceList?: string
  sourceListLabel?: string
}

// Extract postcode from address if not provided
function extractPostcode(addr: string): string | null {
  const postcodeRegex = /\b([A-Z]{1,2}\d{1,2}\s?\d[A-Z]{2})\b/i
  const match = addr.match(postcodeRegex)
  return match ? match[1].replace(/\s+/g, " ").trim() : null
}

export function PropertyDataFetcher({
  address,
  postcode,
  onDataFetched,
}: PropertyDataFetcherProps) {
  const [isFetching, setIsFetching] = useState(false)
  const [isSearching, setIsSearching] = useState(false)
  const [propertyData, setPropertyData] = useState<PropertyDataResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [searchResults, setSearchResults] = useState<PropertySearchResult[] | null>(null)
  const [selectedPropertyId, setSelectedPropertyId] = useState<string | null>(null)
  // Default to common BMV-focused lists
  const [selectedLists, setSelectedLists] = useState<string[]>([
    "repossessed-properties",
    "reduced-properties",
    "quick-sale-properties",
    "properties-with-no-chain",
  ])

  const handleSearch = async () => {
    // Search by postcode only
    const searchPostcode = postcode?.trim() || extractPostcode(address)
    
    if (!searchPostcode) {
      setError("Please enter a postcode or include it in the address")
      return
    }

    setIsSearching(true)
    setError(null)
    setSearchResults(null)
    setSelectedPropertyId(null)
    setPropertyData(null)

    try {
      const params = new URLSearchParams({
        postcode: searchPostcode,
        lists: selectedLists.join(","), // Send selected lists
        radius: "5", // Reduce radius to 5 miles for more relevant results
        results: "20", // Get more results to filter
      })

      const response = await fetch(`/api/propertydata/search?${params.toString()}`)

      // Check content type before parsing
      const contentType = response.headers.get("content-type")
      if (!contentType || !contentType.includes("application/json")) {
        const errorText = await response.text()
        console.error("API returned non-JSON:", errorText.substring(0, 200))
        throw new Error(
          `Server returned HTML instead of JSON. Status: ${response.status}.`
        )
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ 
          error: `HTTP ${response.status}: ${response.statusText}` 
        }))
        throw new Error(errorData.error || "Failed to search properties")
      }

      const data = await response.json()

      if (!data.success) {
        throw new Error(data.error || "Failed to search properties")
      }

      if (data.properties && data.properties.length > 0) {
        setSearchResults(data.properties)
      } else {
        setError(data.message || "No properties found for this postcode")
      }
    } catch (err) {
      console.error("Error searching properties:", err)
      setError(err instanceof Error ? err.message : "Failed to search properties")
    } finally {
      setIsSearching(false)
    }
  }

  const handleFetch = async (propertyId?: string) => {
    // If propertyId is provided, fetch directly
    // Otherwise, use address + postcode
    const fetchPropertyId = propertyId || selectedPropertyId

    if (!fetchPropertyId && !address.trim()) {
      setError("Please select a property or enter an address")
      return
    }

    setIsFetching(true)
    setError(null)
    setPropertyData(null)

    try {
      const params = new URLSearchParams()
      
      if (fetchPropertyId) {
        params.append("property_id", fetchPropertyId)
      } else {
        params.append("address", address.trim())
        if (postcode) {
          params.append("postcode", postcode.trim())
        }
      }

      const response = await fetch(`/api/propertydata?${params.toString()}`)

      // Check content type before parsing
      const contentType = response.headers.get("content-type")
      if (!contentType || !contentType.includes("application/json")) {
        const errorText = await response.text()
        console.error("API returned non-JSON:", errorText.substring(0, 200))
        throw new Error(
          `Server returned HTML instead of JSON. Status: ${response.status}. ` +
          `This usually means the API route has an error. Check server logs.`
        )
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ 
          error: `HTTP ${response.status}: ${response.statusText}` 
        }))
        throw new Error(errorData.error || "Failed to fetch property data")
      }

      const data: PropertyDataResponse = await response.json()

      if (!data.success) {
        throw new Error(data.error || "Failed to fetch property data")
      }

      setPropertyData(data)

      // Get selected property details from search results if available
      const selectedProperty = fetchPropertyId && searchResults 
        ? searchResults.find(p => p.id === fetchPropertyId)
        : null

      // Auto-populate form fields
      if (data.data) {
        console.log("[PropertyDataFetcher] Data received:", data.data)
        console.log("[PropertyDataFetcher] Selected property from search:", selectedProperty)
        
        // Prepare data to populate, including address from search results
        const dataToPopulate = {
          // Priority: selectedProperty address > API response address > current form address
          address: selectedProperty?.address || data.data.address || address || undefined,
          postcode: selectedProperty?.postcode || data.data.postcode || postcode || undefined,
          bedrooms: data.data.bedrooms,
          bathrooms: data.data.bathrooms,
          squareFeet: data.data.squareFeet,
          propertyType: data.data.propertyType,
          marketValue: data.data.estimatedValue,
          estimatedMonthlyRent: data.data.estimatedMonthlyRent,
          latitude: data.data.latitude,
          longitude: data.data.longitude,
        }
        
        console.log("[PropertyDataFetcher] Final data to populate:", dataToPopulate)
        
        onDataFetched(dataToPopulate)
      } else {
        console.warn("[PropertyDataFetcher] No data.data in response:", data)
      }
    } catch (err) {
      console.error("Error fetching property data:", err)
      setError(err instanceof Error ? err.message : "Failed to fetch property data")
    } finally {
      setIsFetching(false)
    }
  }

  const hasPostcode = postcode?.trim() || extractPostcode(address || "")

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="h-5 w-5" />
            Property Data Enrichment
          </CardTitle>
          <CardDescription>
            Search by postcode to find properties, or fetch data for a specific address
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Search by Postcode */}
          {hasPostcode && (
            <div className="space-y-2">
              <Button
                onClick={handleSearch}
                disabled={isSearching || !hasPostcode}
                variant="outline"
                className="w-full"
              >
                {isSearching ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Searching Properties...
                  </>
                ) : (
                  <>
                    <MapPin className="mr-2 h-4 w-4" />
                    Search Properties by Postcode
                  </>
                )}
              </Button>
            </div>
          )}

          {/* Property Selection */}
          {searchResults && searchResults.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">Select a Property:</label>
                <span className="text-xs text-muted-foreground">
                  {searchResults.length} properties found near {postcode?.trim() || extractPostcode(address || "")}
                </span>
              </div>
              <Select
                value={selectedPropertyId || ""}
                onValueChange={(value) => {
                  setSelectedPropertyId(value)
                  setPropertyData(null)
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Choose a property..." />
                </SelectTrigger>
                <SelectContent>
                  {searchResults.map((property) => {
                    const searchPostcode = postcode?.trim() || extractPostcode(address || "")
                    const isExactPostcode = property.postcode?.toUpperCase() === searchPostcode?.toUpperCase()
                    const distance = property.distance_to ? parseFloat(property.distance_to) : null
                    
                    return (
                      <SelectItem key={property.id} value={property.id}>
                        <div className="flex flex-col">
                          <div className="flex items-center gap-2">
                          <span className="font-medium">{property.address}</span>
                          {isExactPostcode && (
                            <span className="text-xs bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 px-1.5 py-0.5 rounded">
                              Exact match
                            </span>
                          )}
                          {property.sourceListLabel && (
                            <span className="text-xs bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 px-1.5 py-0.5 rounded">
                              {property.sourceListLabel}
                            </span>
                          )}
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {property.bedrooms} bed • {property.type} • £{property.price.toLocaleString()}
                          {property.sqf && ` • ${property.sqf} sqft`}
                          {distance && !isExactPostcode && ` • ${distance.toFixed(1)} miles away`}
                          {!isExactPostcode && property.postcode && ` • ${property.postcode}`}
                        </span>
                        </div>
                      </SelectItem>
                    )
                  })}
                </SelectContent>
              </Select>
              {selectedPropertyId && (
                <Button
                  onClick={() => handleFetch(selectedPropertyId)}
                  disabled={isFetching}
                  className="w-full"
                >
                  {isFetching ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Fetching Property Data...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="mr-2 h-4 w-4" />
                      Load Selected Property Data
                    </>
                  )}
                </Button>
              )}
            </div>
          )}

          {/* Fetch by Address (if address provided) */}
          {address.trim() && !searchResults && (
            <Button
              onClick={() => handleFetch()}
              disabled={isFetching || !address.trim()}
              className="w-full"
            >
              {isFetching ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Fetching Property Data...
                </>
              ) : (
                <>
                  <Search className="mr-2 h-4 w-4" />
                  Fetch Property Data
                </>
              )}
            </Button>
          )}

          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {propertyData && propertyData.data && (
            <div className="space-y-4">
              {propertyData.warning ? (
                <Alert variant="default" className="border-yellow-500 bg-yellow-50 dark:bg-yellow-950">
                  <AlertCircle className="h-4 w-4 text-yellow-600" />
                  <AlertTitle className="text-yellow-800 dark:text-yellow-200">Warning</AlertTitle>
                  <AlertDescription className="text-yellow-700 dark:text-yellow-300">
                    {propertyData.warning}
                  </AlertDescription>
                </Alert>
              ) : (
                <Alert>
                  <CheckCircle2 className="h-4 w-4" />
                  <AlertTitle>
                    Property Data Fetched {propertyData.cached && "(Cached)"}
                  </AlertTitle>
                  <AlertDescription>
                    Data has been auto-populated in the form below
                  </AlertDescription>
                </Alert>
              )}

              {/* Analysis Insights */}
              {propertyData.analysis && (
                <div className="space-y-3">
                  {propertyData.analysis.insights.length > 0 && (
                    <div>
                      <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                        <TrendingUp className="h-4 w-4 text-green-600" />
                        Key Insights
                      </h4>
                      <ul className="space-y-1">
                        {propertyData.analysis.insights.map((insight, idx) => (
                          <li key={idx} className="text-sm text-muted-foreground flex items-start gap-2">
                            <CheckCircle2 className="h-3 w-3 text-green-600 mt-0.5 flex-shrink-0" />
                            {insight}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {propertyData.analysis.recommendations.length > 0 && (
                    <div>
                      <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                        <Info className="h-4 w-4 text-blue-600" />
                        Recommendations
                      </h4>
                      <ul className="space-y-1">
                        {propertyData.analysis.recommendations.map((rec, idx) => (
                          <li key={idx} className="text-sm text-muted-foreground flex items-start gap-2">
                            <Info className="h-3 w-3 text-blue-600 mt-0.5 flex-shrink-0" />
                            {rec}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {propertyData.analysis.riskFactors.length > 0 && (
                    <div>
                      <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                        <TrendingDown className="h-4 w-4 text-orange-600" />
                        Risk Factors
                      </h4>
                      <ul className="space-y-1">
                        {propertyData.analysis.riskFactors.map((risk, idx) => (
                          <li key={idx} className="text-sm text-muted-foreground flex items-start gap-2">
                            <AlertCircle className="h-3 w-3 text-orange-600 mt-0.5 flex-shrink-0" />
                            {risk}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              {/* Comparables Preview */}
              {propertyData.data.comparables && propertyData.data.comparables.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold mb-2">Comparable Sales</h4>
                  <p className="text-xs text-muted-foreground">
                    {propertyData.data.comparables.length} comparable properties found
                  </p>
                  <div className="mt-2 space-y-1">
                    {propertyData.data.comparables.slice(0, 3).map((comp, idx) => (
                      <div key={idx} className="text-xs p-2 bg-muted rounded">
                        <div className="font-medium">
                          {new Intl.NumberFormat("en-GB", {
                            style: "currency",
                            currency: "GBP",
                            maximumFractionDigits: 0,
                          }).format(comp.salePrice)}
                        </div>
                        <div className="text-muted-foreground">
                          {comp.bedrooms} bed • {comp.distance.toFixed(1)} miles away • {new Date(comp.saleDate).getFullYear()}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Area Statistics */}
              {propertyData.data.areaStats && (
                <div>
                  <h4 className="text-sm font-semibold mb-2">Area Statistics</h4>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <div className="text-muted-foreground">Avg Price</div>
                      <div className="font-medium">
                        {new Intl.NumberFormat("en-GB", {
                          style: "currency",
                          currency: "GBP",
                          maximumFractionDigits: 0,
                        }).format(propertyData.data.areaStats.averagePrice)}
                      </div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">1yr Growth</div>
                      <div className={`font-medium ${propertyData.data.areaStats.growthLastYear > 0 ? "text-green-600" : "text-red-600"}`}>
                        {propertyData.data.areaStats.growthLastYear > 0 ? "+" : ""}
                        {propertyData.data.areaStats.growthLastYear.toFixed(1)}%
                      </div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">5yr Growth</div>
                      <div className={`font-medium ${propertyData.data.areaStats.growthLast5Years > 0 ? "text-green-600" : "text-red-600"}`}>
                        {propertyData.data.areaStats.growthLast5Years > 0 ? "+" : ""}
                        {propertyData.data.areaStats.growthLast5Years.toFixed(1)}%
                      </div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Rental Yield</div>
                      <div className="font-medium">
                        {propertyData.data.areaStats.rentalYield.toFixed(1)}%
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

