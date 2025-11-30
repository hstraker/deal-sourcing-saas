# Debugging PropertyData API Integration

## Issue
When clicking "Fetch Property Data" for "20 Maude Court N7 8TY", it says "Property Data Fetched" but no form fields are populated.

## Changes Made

### 1. Postcode Extraction
- Added `extractPostcode()` function to extract UK postcode from address string
- If postcode field is empty, it will try to extract from the address
- Handles formats like "N7 8TY", "SW1A 1AA", etc.

### 2. Enhanced Logging
Added console logging at multiple points:
- **API Route** (`app/api/propertydata/route.ts`): Logs request params and response
- **PropertyData Library** (`lib/propertydata.ts`): Logs search results and matching logic
- **PropertyDataFetcher** (`components/deals/property-data-fetcher.tsx`): Logs received data
- **DealForm** (`components/deals/deal-form.tsx`): Logs when `onDataFetched` is called and what values are set

### 3. Better Error Messages
- More descriptive error messages when postcode is missing
- Better error when no properties found

## How to Debug

### Step 1: Check Browser Console
1. Open browser DevTools (F12)
2. Go to Console tab
3. Click "Fetch Property Data"
4. Look for logs starting with `[PropertyData]`, `[API]`, `[PropertyDataFetcher]`, `[DealForm]`

### Step 2: Check Server Logs
1. Look at your Next.js terminal/console
2. Check for logs from the API route

### Step 3: Test API Endpoints Manually

#### Option A: Use the Test Script
```bash
# Set your API key
export PROPERTYDATA_API_KEY="your-key-here"

# Run the test script
node test-propertydata-api.js
```

#### Option B: Use curl
```bash
# Test search endpoint
curl "https://api.propertydata.co.uk/sourced-properties?key=YOUR_KEY&list=repossessed-properties&postcode=N7%208TY&radius=20&results=10"

# Test property endpoint (use property_id from search results)
curl "https://api.propertydata.co.uk/sourced-property?key=YOUR_KEY&property_id=Z70132997"
```

#### Option C: Use Browser
1. Open browser DevTools → Network tab
2. Click "Fetch Property Data"
3. Find the `/api/propertydata` request
4. Check Request URL and Response

## Expected Console Output

When working correctly, you should see:

```
[API] Fetching property data: address="20 Maude Court N7 8TY", postcode="N7 8TY", propertyId="undefined"
[PropertyData] Searching for: address="20 Maude Court N7 8TY", postcode="N7 8TY"
[PropertyData] Search returned 5 properties
[PropertyData] Looking for match with normalized address: "20 maude court n7 8ty"
[PropertyData] Comparing: "bishops road, highgate, london n6" with "20 maude court n7 8ty" -> false
[PropertyData] Found matching property: Z70132997
[PropertyData] Fetched property data: success
[API] Property data result: success
[API] Property data fields: { bedrooms: 2, squareFeet: 755, propertyType: "Flat", estimatedValue: 650000 }
[PropertyDataFetcher] Data received: { bedrooms: 2, squareFeet: 755, ... }
[PropertyDataFetcher] Calling onDataFetched with: { bedrooms: 2, squareFeet: 755, ... }
[DealForm] onDataFetched called with: { bedrooms: 2, squareFeet: 755, ... }
[DealForm] Setting bedrooms to: 2
[DealForm] Setting squareFeet to: 755
[DealForm] Setting propertyType to: Flat
[DealForm] Setting marketValue to: 650000
```

## Common Issues

### Issue 1: "No properties found for this postcode"
**Cause**: The postcode might not have any properties in the "repossessed-properties" list.

**Solution**: 
- Try a different postcode
- Check if the property exists in PropertyData
- The search might need a different property list

### Issue 2: Data fetched but form not populated
**Cause**: The `onDataFetched` callback might not be receiving the data, or the form fields might not match.

**Check**:
- Look for `[DealForm] onDataFetched called` in console
- Check if the field names match (e.g., `bedrooms` vs `bedroom`)
- Check if `setValue` is being called

### Issue 3: Postcode not extracted
**Cause**: The address format might not match the regex pattern.

**Check**:
- Look for `[PropertyData] Searching for:` log
- Verify the postcode is in the address string
- Try manually entering the postcode in the postcode field

## Next Steps

1. **Restart your dev server** to pick up the logging changes
2. **Open browser console** and try fetching property data again
3. **Check the logs** to see where the flow breaks
4. **Share the console output** if you need further help

---

**Last Updated**: 2025-01-XX

