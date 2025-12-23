#!/bin/bash
# Test creating a vendor lead via API

echo "🧪 Testing Vendor Lead Creation API..."
echo ""

curl -X POST http://localhost:3000/api/vendor-pipeline/leads \
  -H "Content-Type: application/json" \
  -d '{
    "vendorName": "John Doe",
    "vendorPhone": "+447700900789",
    "vendorEmail": "john.doe@example.com",
    "propertyAddress": "123 Main Street, London",
    "propertyPostcode": "SW1A 1AA",
    "askingPrice": 350000,
    "propertyType": "terraced",
    "bedrooms": 3,
    "bathrooms": 1
  }' | jq '.'

echo ""
echo "✅ If successful, view the lead at:"
echo "   http://localhost:3000/dashboard/vendors/pipeline"

