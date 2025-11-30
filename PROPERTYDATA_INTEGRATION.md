# PropertyData API Integration Guide

## Overview

This integration provides comprehensive property data enrichment and deal analysis features using the PropertyData API for UK properties.

## Features

### 1. **Auto-Population**
- Automatically fills property details when address is entered
- Reduces manual data entry significantly
- Includes: bedrooms, bathrooms, square feet, property type, EPC rating

### 2. **Market Valuation**
- Estimated market value with confidence range
- BMV (Below Market Value) analysis
- Compares asking price vs. estimated value

### 3. **Comparable Sales**
- Finds similar properties sold in the area
- Shows sale prices, dates, and distances
- Helps validate pricing decisions

### 4. **Rental Analysis**
- Estimated monthly rental income
- Area average rental yields
- Property-specific yield calculations

### 5. **Area Statistics**
- Average property prices in the area
- Price per square foot
- 1-year and 5-year growth trends
- Area rental yield averages

### 6. **Investment Insights**
- Automated analysis and recommendations
- Risk factor identification
- Deal quality indicators

## Setup

### 1. Get PropertyData API Key

1. Sign up at [PropertyData.co.uk](https://propertydata.co.uk)
2. Get your API key from the dashboard
3. Add to `.env`:
   ```bash
   PROPERTYDATA_API_KEY="your-api-key-here"
   PROPERTYDATA_API_URL="https://api.propertydata.co.uk"
   ```

### 2. Update API Client (Important!)

The PropertyData API client in `lib/propertydata.ts` uses a **generic structure**. You need to:

1. Check the [PropertyData API Documentation](https://propertydata.co.uk/api-docs)
2. Update the `fetchPropertyData` function to match the actual API endpoints and response format
3. Adjust the data transformation logic based on the real API structure

**Current implementation is a template** - it needs to be customized for the actual PropertyData API.

### 3. Run Database Migration

```bash
npm run db:push
```

This creates the `PropertyDataCache` table for aggressive caching.

## Usage

### In Deal Form

1. Enter the property address
2. Click **"Fetch Property Data"** button
3. Data auto-populates in the form
4. Review insights and recommendations
5. Adjust any fields as needed

### In Deal Detail Page

1. Navigate to any deal
2. **Property Analysis** panel appears in the sidebar
3. Automatically fetches and displays:
   - Valuation analysis
   - Comparable sales table
   - Area statistics
   - Investment insights
   - Risk factors

## Caching Strategy

- **Cache Duration:** 30 days per property
- **Cache Key:** Address + Postcode combination
- **Benefits:**
  - Reduces API calls
  - Stays within 2,000 credits/month limit
  - Faster response times
  - Lower costs

## Credit Management

### Usage Tracking

- View usage in **Settings** page (admin only)
- Shows: credits used, remaining, requests this month
- Visual progress bar with warnings

### Best Practices

1. **Always check cache first** - Use cached data when available
2. **Batch requests** - Fetch multiple properties at once if possible
3. **Monitor usage** - Check Settings regularly
4. **Use postcodes** - More accurate results = better caching

## API Endpoints

### Fetch Property Data
```
GET /api/propertydata?address=...&postcode=...&refresh=true
```

**Query Parameters:**
- `address` (required) - Full property address
- `postcode` (optional) - UK postcode for accuracy
- `refresh` (optional) - Force refresh, bypass cache

**Response:**
```json
{
  "success": true,
  "data": { ... },
  "analysis": {
    "insights": [...],
    "recommendations": [...],
    "riskFactors": [...]
  },
  "cached": false,
  "fetchedAt": "2025-01-15T10:30:00Z"
}
```

### Usage Statistics
```
GET /api/propertydata/usage
```

**Response:**
```json
{
  "creditsUsed": 450,
  "creditsRemaining": 1550,
  "requestsThisMonth": 120,
  "limit": 2000
}
```

## Analysis Features

### BMV Analysis
- Calculates percentage below/above market value
- Color-coded indicators (green = good, red = warning)
- Recommendations based on BMV percentage

### Yield Analysis
- Compares property yield vs. area average
- Identifies high-yield opportunities
- Warns about low-yield properties

### Growth Analysis
- 1-year and 5-year area growth trends
- Identifies appreciating markets
- Flags declining areas

### Comparable Sales
- Table view of similar properties
- Sorted by distance and relevance
- Helps validate pricing

## Customization

### Adjusting Analysis Logic

Edit `lib/propertydata.ts` → `getPropertyAnalysis()` function to:
- Change BMV thresholds
- Adjust yield recommendations
- Customize risk factors
- Add new insights

### Adding More Data Points

1. Update `PropertyDataResponse` interface
2. Update API client transformation logic
3. Add to UI components
4. Update analysis function

## Troubleshooting

### "PropertyData API key not configured"
- Add `PROPERTYDATA_API_KEY` to `.env` file
- Restart dev server

### "Failed to fetch property data"
- Check API key is valid
- Verify address format is correct
- Check PropertyData API status
- Review API documentation for endpoint changes

### "Invalid API response"
- The API client may need updating
- Check PropertyData API docs for current structure
- Update transformation logic in `lib/propertydata.ts`

### High credit usage
- Check cache is working (should see "Cached" in responses)
- Review Settings → Usage display
- Consider extending cache duration

## Next Steps

1. **Get PropertyData API key** and add to `.env`
2. **Review PropertyData API documentation** and update the client
3. **Test with a real property** address
4. **Monitor usage** in Settings
5. **Customize analysis** logic for your needs

## Notes

- The current implementation is a **template** that needs customization
- PropertyData API structure may differ from what's implemented
- Always check the official API documentation
- Cache aggressively to stay within credit limits
- Analysis insights are customizable based on your criteria

