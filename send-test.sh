curl -X POST http://localhost:3000/api/facebook-leads/webhook \
  -H "Content-Type: application/json" \
  -d '{
    "leadgen_id": "test_lead_004",
    "created_time": "2026-04-02T10:00:00Z",
    "isTest": true,
    "testScenario": "CLEAR_NEVER_LISTED",
    "field_data": [
      { "name": "full_name",         "values": ["Henry Smith"] },
      { "name": "phone_number",      "values": ["+4407595354573"] },
      { "name": "property_address",  "values": ["Victoria Road, Port Talbot"] },
      { "name": "property_postcode", "values": ["SA12 6AD"] },
      { "name": "email",             "values": ["henrystraker@gmail.com"] },
      { "name": "asking_price",      "values": ["195000"] },
      { "name": "property_type",     "values": ["Semi-Detached"] },
      { "name": "bedrooms",          "values": ["3"] },
      { "name": "urgency",           "values": ["urgent"] },
      { "name": "selling_reason",    "values": ["Relocating for work"] },
      { "name": "garden",            "values": ["Yes"] },
      { "name": "garage",            "values": ["No"] }
    ]
  }'

