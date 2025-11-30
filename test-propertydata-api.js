/**
 * Manual test script for PropertyData API endpoints
 * 
 * Run with: node test-propertydata-api.js
 * Make sure to set PROPERTYDATA_API_KEY in your environment
 */

const PROPERTYDATA_API_KEY = process.env.PROPERTYDATA_API_KEY || "YOUR_API_KEY_HERE"
const PROPERTYDATA_API_URL = "https://api.propertydata.co.uk"

async function testSearchProperties(postcode) {
  console.log("\n=== Testing /sourced-properties ===")
  console.log(`Postcode: ${postcode}`)
  
  const params = new URLSearchParams({
    key: PROPERTYDATA_API_KEY,
    list: "repossessed-properties",
    postcode: postcode,
    radius: "20",
    results: "10",
  })

  const url = `${PROPERTYDATA_API_URL}/sourced-properties?${params.toString()}`
  console.log(`URL: ${url.replace(PROPERTYDATA_API_KEY, "***")}`)

  try {
    const response = await fetch(url)
    const data = await response.json()
    
    console.log(`Status: ${response.status}`)
    console.log(`Response:`, JSON.stringify(data, null, 2))
    
    if (data.status === "success" && data.properties && data.properties.length > 0) {
      console.log(`\n✅ Found ${data.properties.length} properties`)
      console.log(`First property ID: ${data.properties[0].id}`)
      return data.properties[0].id
    } else {
      console.log(`\n❌ No properties found`)
      return null
    }
  } catch (error) {
    console.error("Error:", error)
    return null
  }
}

async function testFetchProperty(propertyId) {
  console.log("\n=== Testing /sourced-property ===")
  console.log(`Property ID: ${propertyId}`)
  
  const params = new URLSearchParams({
    key: PROPERTYDATA_API_KEY,
    property_id: propertyId,
  })

  const url = `${PROPERTYDATA_API_URL}/sourced-property?${params.toString()}`
  console.log(`URL: ${url.replace(PROPERTYDATA_API_KEY, "***")}`)

  try {
    const response = await fetch(url)
    const data = await response.json()
    
    console.log(`Status: ${response.status}`)
    console.log(`Response:`, JSON.stringify(data, null, 2))
    
    if (data.status === "success" && data.property) {
      console.log(`\n✅ Property found:`)
      console.log(`  Address: ${data.property.address}`)
      console.log(`  Postcode: ${data.property.postcode}`)
      console.log(`  Type: ${data.property.type}`)
      console.log(`  Bedrooms: ${data.property.bedrooms}`)
      console.log(`  Price: £${data.property.price?.toLocaleString()}`)
      console.log(`  Square Feet: ${data.property.sqf}`)
      return data.property
    } else {
      console.log(`\n❌ Property not found`)
      return null
    }
  } catch (error) {
    console.error("Error:", error)
    return null
  }
}

async function testFullFlow(address, postcode) {
  console.log("\n" + "=".repeat(60))
  console.log("Testing Full Flow")
  console.log("=".repeat(60))
  console.log(`Address: ${address}`)
  console.log(`Postcode: ${postcode}`)
  
  // Step 1: Search for properties
  const propertyId = await testSearchProperties(postcode)
  
  if (propertyId) {
    // Step 2: Fetch property details
    await testFetchProperty(propertyId)
  } else {
    console.log("\n⚠️ Cannot test property fetch - no property ID found")
  }
}

// Test with the user's address
const testAddress = "20 Maude Court"
const testPostcode = "N7 8TY"

testFullFlow(testAddress, testPostcode)
  .then(() => {
    console.log("\n" + "=".repeat(60))
    console.log("Test Complete")
    console.log("=".repeat(60))
  })
  .catch(console.error)

