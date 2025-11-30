# PropertyData API - Expected Response Structure

## Current Implementation Expectations

The code in `lib/propertydata.ts` expects the PropertyData API endpoint `/property/search` to return a JSON response with the following structure:

---

## Expected Response Format

### Top-Level Response
```json
{
  "bedrooms": 3,
  "bathrooms": 2,
  "square_feet": 1200,           // OR "square_meters": 111.5
  "property_type": "house",
  "year_built": 1985,
  "epc_rating": "C",
  "estimated_value": 250000,
  "value_range": {
    "min": 230000,
    "max": 270000
  },
  "comparable_sales": [
    {
      "address": "123 Main Street",
      "price": 245000,
      "date": "2024-11-15",
      "bedrooms": 3,
      "bathrooms": 2,
      "square_feet": 1150,
      "distance_miles": 0.5,
      "property_type": "house"
    }
  ],
  "rental_yield": 5.5,
  "estimated_monthly_rent": 1150,
  "area_average_rent": 1200,
  "area_statistics": {
    "average_price": 240000,
    "price_per_sqft": 200,
    "growth_1yr": 3.5,
    "growth_5yr": 15.2,
    "rental_yield": 5.8
  },
  "historical_sales": [
    {
      "price": 180000,
      "date": "2015-06-20",
      "type": "freehold"
    }
  ],
  "latitude": 51.5074,
  "longitude": -0.1278,
  "postcode": "SW1A 1AA",
  "credits_used": 1
}
```

---

## Field Mapping

The code maps the API response to our internal format:

| API Field | Our Field | Type | Notes |
|-----------|-----------|------|-------|
| `bedrooms` | `bedrooms` | number | Number of bedrooms |
| `bathrooms` | `bathrooms` | number | Number of bathrooms |
| `square_feet` OR `square_meters` | `squareFeet` | number | Converts meters to feet if needed |
| `property_type` | `propertyType` | string | e.g., "house", "flat" |
| `year_built` | `yearBuilt` | number | Year property was built |
| `epc_rating` | `epcRating` | string | EPC rating (A-G) |
| `estimated_value` | `estimatedValue` | number | Market value estimate |
| `value_range.min` | `valueRange.min` | number | Minimum value estimate |
| `value_range.max` | `valueRange.max` | number | Maximum value estimate |
| `comparable_sales[]` | `comparables[]` | array | Array of comparable sales |
| `rental_yield` | `estimatedRentalYield` | number | Percentage (e.g., 5.5) |
| `estimated_monthly_rent` | `estimatedMonthlyRent` | number | Monthly rent in GBP |
| `area_average_rent` | `areaAverageRent` | number | Area average monthly rent |
| `area_statistics` | `areaStats` | object | Area statistics object |
| `historical_sales[]` | `recentSales[]` | array | Historical sales data |
| `latitude` | `latitude` | number | GPS latitude |
| `longitude` | `longitude` | number | GPS longitude |
| `postcode` | `postcode` | string | UK postcode |
| `credits_used` | `creditsUsed` | number | API credits consumed |

---

## Comparable Sales Structure

Each item in `comparable_sales` array should have:
```json
{
  "address": "123 Main Street, London",
  "price": 245000,
  "date": "2024-11-15",           // ISO date format
  "bedrooms": 3,
  "bathrooms": 2,
  "square_feet": 1150,           // Optional
  "distance_miles": 0.5,          // Distance from property
  "property_type": "house"
}
```

---

## Area Statistics Structure

The `area_statistics` object should have:
```json
{
  "average_price": 240000,        // Average property price in area
  "price_per_sqft": 200,          // Price per square foot
  "growth_1yr": 3.5,              // 1-year growth percentage
  "growth_5yr": 15.2,             // 5-year growth percentage
  "rental_yield": 5.8             // Area average rental yield %
}
```

---

## Historical Sales Structure

Each item in `historical_sales` array should have:
```json
{
  "price": 180000,
  "date": "2015-06-20",           // ISO date format
  "type": "freehold"              // "freehold" or "leasehold"
}
```

---

## Request Format Expected

The code currently sends:
```typescript
POST /property/search
Headers:
  Content-Type: application/json
  X-API-Key: YOUR_API_KEY

Body:
{
  "address": "123 Main Street, SW1A 1AA",
  "include_comparables": true,
  "include_rental": true,
  "include_area_stats": true,
  "include_history": true
}
```

**BUT** - This is a template! The actual PropertyData API might:
- Use GET instead of POST
- Use query parameters instead of body
- Use different header names (e.g., `Authorization: Bearer TOKEN`)
- Use different endpoint paths

---

## What to Look For in PropertyData API Docs

When checking the PropertyData API documentation, look for:

### 1. Endpoint for Property Search
- What is the actual endpoint URL?
  - `/property/search`?
  - `/property-details`?
  - `/property`?
  - Something else?

### 2. Request Method
- GET or POST?
- Query parameters or request body?

### 3. Authentication
- Header name: `X-API-Key`, `Authorization`, `API-Key`?
- Format: `Bearer TOKEN`, just the key, or something else?

### 4. Request Parameters
- How to pass address?
- How to pass postcode?
- Any other required/optional parameters?

### 5. Response Structure
- Does it match the structure above?
- Are field names different (snake_case vs camelCase)?
- Are there nested objects?
- What's the error response format?

### 6. Response Fields
Check if these fields exist in their API:
- ✅ Property details (bedrooms, bathrooms, type)
- ✅ Valuation (estimated_value, value_range)
- ✅ Comparables (comparable_sales array)
- ✅ Rental data (rental_yield, monthly_rent)
- ✅ Area statistics
- ✅ Historical sales
- ✅ Location (lat/lng, postcode)

---

## Alternative: Use Multiple Endpoints

Based on your Python code, PropertyData might have separate endpoints:

1. **Sold Prices**: `GET /sold-prices?key=...&postcode=...&bedrooms=...`
   - Returns: `{ "status": "success", "data": { "raw_data": [...] } }`

2. **Property Details**: Might be a different endpoint
3. **Rental Data**: Might be a different endpoint
4. **Area Stats**: Might be a different endpoint

If so, you may need to:
- Make multiple API calls
- Combine the results
- Cache each separately

---

## Example: What Your Python Code Shows

Your Python code uses:
```python
url = "https://api.propertydata.co.uk/sold-prices"
params = {
    "key": self.propertydata_api_key,  # Query param, not header!
    "postcode": postcode_area,
    "bedrooms": bedrooms,
    "radius": "3",
    "results": "50"
}
response = requests.get(url, params=params)  # GET request!

data = response.json()
# Structure: { "status": "success", "data": { "raw_data": [...] } }
```

**This is different from what the TypeScript code expects!**

---

## Action Items

1. **Check PropertyData API Documentation** for:
   - Available endpoints
   - Request/response formats
   - Authentication method

2. **Update `lib/propertydata.ts`** to match actual API:
   - Fix endpoint URL
   - Fix request method (GET vs POST)
   - Fix authentication (query param vs header)
   - Fix response parsing

3. **Test with a real API call** to see actual response structure

4. **Update transformation logic** to match actual API response

---

## Quick Test

You can test the actual API structure with:

```bash
# If it's GET with query params:
curl "https://api.propertydata.co.uk/sold-prices?key=YOUR_KEY&postcode=SW1A&bedrooms=3"

# If it's POST with body:
curl -X POST "https://api.propertydata.co.uk/property/search" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: YOUR_KEY" \
  -d '{"address": "123 Main St, SW1A 1AA"}'
```

This will show you the actual response structure!

---

**Last Updated**: 2025-01-XX

