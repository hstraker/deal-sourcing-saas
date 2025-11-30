# PropertyData API Update

## Changes Made

Updated the PropertyData API integration to use the correct endpoints:

### Endpoints Used

1. **`/sourced-properties`** - Search for properties by postcode/location
   - Method: GET
   - Parameters: `key`, `list`, `postcode`, `radius`, `max_age`, `results`
   - Returns: List of properties with basic info

2. **`/sourced-property`** - Get detailed property data by property_id
   - Method: GET
   - Parameters: `key`, `property_id`
   - Returns: Detailed property information

### New Functions

1. **`searchProperties()`** - Searches for properties using `/sourced-properties`
2. **`fetchPropertyDataById()`** - Fetches property details using `/sourced-property`
3. **`fetchPropertyData()`** - Updated to support both workflows:
   - If `property_id` is provided: directly fetches property details
   - If `address` + `postcode` provided: searches first, then fetches details

### API Route Updates

The `/api/propertydata` route now supports:
- `?address=...&postcode=...` - Search by address/postcode
- `?property_id=...` - Direct lookup by property ID

### Response Mapping

The API response from `/sourced-property` is mapped as follows:

| API Field | Our Field | Notes |
|-----------|-----------|-------|
| `property.bedrooms` | `bedrooms` | Number of bedrooms |
| `property.sqf` | `squareFeet` | Square feet |
| `property.type` | `propertyType` | Property type (Flat, House, etc.) |
| `property.price` | `estimatedValue` | Asking price |
| `property.lat` | `latitude` | GPS latitude |
| `property.lng` | `longitude` | GPS longitude |
| `property.postcode` | `postcode` | UK postcode |

**Note**: The `/sourced-property` endpoint doesn't provide:
- Bathrooms count
- Year built
- EPC rating
- Comparable sales
- Rental yield
- Area statistics
- Historical sales

These fields will be `undefined` in the response.

### Usage Examples

#### By Property ID (Direct)
```typescript
const data = await fetchPropertyData("", null, "Z70132997")
```

#### By Address + Postcode (Search then Fetch)
```typescript
const data = await fetchPropertyData("Bishops Road, Highgate", "N6 4AQ")
```

#### API Route
```bash
# Direct lookup
GET /api/propertydata?property_id=Z70132997

# Search by address
GET /api/propertydata?address=Bishops%20Road&postcode=N6%204AQ
```

### Caching

- Properties are cached by `property_id` when using direct lookup
- Properties are cached by `address|postcode` when searching
- Cache duration: 30 days

### Error Handling

- Returns proper JSON errors (never HTML)
- Checks content-type before parsing
- Handles API errors gracefully
- Logs errors for debugging

---

**Last Updated**: 2025-01-XX

