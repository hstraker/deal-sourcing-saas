# Troubleshooting PropertyData API Error

## Error: "Unexpected token '<', "<!DOCTYPE "... is not valid JSON"

This error means the API is returning HTML (an error page) instead of JSON.

---

## Quick Fixes

### 1. Check Server Logs
Look at your Next.js server console for errors. Common issues:
- Syntax errors in route files
- Missing environment variables
- Database connection errors
- Authentication errors

### 2. Verify API Route Exists
Make sure the route file exists at:
```
app/api/propertydata/route.ts
```

### 3. Check Environment Variables
Ensure `.env.local` has:
```bash
PROPERTYDATA_API_KEY="your-key-here"
PROPERTYDATA_API_URL="https://api.propertydata.co.uk"
```

### 4. Verify Authentication
The route requires authentication. Make sure:
- You're logged in
- Your user role is "admin" or "sourcer"
- Session is valid

---

## Common Causes

### Cause 1: Syntax Error in Route
**Symptom**: Route crashes, returns HTML error page

**Fix**: Check `app/api/propertydata/route.ts` for syntax errors
- Look for missing brackets, commas, or incomplete code
- Check for duplicate code blocks

### Cause 2: Missing API Key
**Symptom**: Returns error about API key not configured

**Fix**: Add to `.env.local`:
```bash
PROPERTYDATA_API_KEY="your-key-here"
```

### Cause 3: Wrong PropertyData API Endpoint
**Symptom**: 404 or HTML error from PropertyData API

**Fix**: Check PropertyData API documentation and update:
- `lib/propertydata.ts` → `fetchPropertyData()` function
- Update the URL, method, and headers to match their API

### Cause 4: Database Error
**Symptom**: Error when trying to cache data

**Fix**: 
- Check Prisma schema has `PropertyDataCache` model
- Run `npm run db:push` to sync schema
- Check database connection

### Cause 5: Authentication Failure
**Symptom**: Redirects to login page (HTML)

**Fix**:
- Ensure you're logged in
- Check `authOptions` is configured correctly
- Verify session is valid

---

## Debugging Steps

### Step 1: Check Browser Network Tab
1. Open browser DevTools (F12)
2. Go to Network tab
3. Click "Fetch Property Data" button
4. Find the `/api/propertydata` request
5. Check:
   - **Status Code**: Should be 200, not 404/500
   - **Response**: Should be JSON, not HTML
   - **Headers**: Content-Type should be `application/json`

### Step 2: Check Server Console
Look for errors in your Next.js terminal:
```
Error fetching property data: [error message]
```

### Step 3: Test API Route Directly
Use curl or Postman to test:
```bash
curl "http://localhost:3000/api/propertydata?address=123%20Main%20St&postcode=SW1A1AA" \
  -H "Cookie: [your-session-cookie]"
```

### Step 4: Check PropertyData API
Test PropertyData API directly:
```bash
curl "https://api.propertydata.co.uk/sold-prices?key=YOUR_KEY&postcode=SW1A&bedrooms=3"
```

---

## Fixed Issues

### ✅ Fixed: Syntax Error in route.ts
- Removed orphaned code (lines 100-113)
- Fixed duplicate cache creation code

### ✅ Fixed: Better Error Handling
- Added content-type checking
- Returns proper JSON errors instead of HTML
- Better error messages

---

## Next Steps

1. **Restart your dev server** after fixes
2. **Clear browser cache** and try again
3. **Check server logs** for any remaining errors
4. **Verify PropertyData API endpoint** matches their documentation

---

## PropertyData API Endpoint

**Current Implementation** (may need updating):
```typescript
const url = `${PROPERTYDATA_API_URL}/property/search`
```

**Check PropertyData Documentation** for:
- Correct endpoint URL
- Request method (GET vs POST)
- Required headers
- Request body format
- Response structure

**Common PropertyData Endpoints**:
- `/sold-prices` - Get sold prices (GET with query params)
- `/property-details` - Get property details
- `/rental-yields` - Get rental data

---

## Still Having Issues?

1. Check Next.js server logs
2. Check browser console for errors
3. Verify all environment variables
4. Test PropertyData API directly
5. Check PropertyData API documentation

---

**Last Updated**: 2025-01-XX

