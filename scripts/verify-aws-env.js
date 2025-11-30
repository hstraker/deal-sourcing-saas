#!/usr/bin/env node

/**
 * Script to verify AWS environment variables are set correctly
 * Run with: node scripts/verify-aws-env.js
 */

const fs = require("fs")
const path = require("path")

// Load .env file if it exists
function loadEnvFile() {
  const envPaths = [".env.local", ".env"]
  for (const envPath of envPaths) {
    const fullPath = path.join(process.cwd(), envPath)
    if (fs.existsSync(fullPath)) {
      const content = fs.readFileSync(fullPath, "utf8")
      const lines = content.split("\n")
      for (const line of lines) {
        const trimmed = line.trim()
        // Skip comments and empty lines
        if (!trimmed || trimmed.startsWith("#")) continue
        
        const match = trimmed.match(/^([^=]+)=(.*)$/)
        if (match) {
          const key = match[1].trim()
          let value = match[2].trim()
          // Remove quotes if present
          if ((value.startsWith('"') && value.endsWith('"')) || 
              (value.startsWith("'") && value.endsWith("'"))) {
            value = value.slice(1, -1)
          }
          // Only set if not already in process.env (env vars take precedence)
          if (!process.env[key]) {
            process.env[key] = value
          }
        }
      }
      console.log(`📁 Loaded environment variables from ${envPath}\n`)
      return true
    }
  }
  return false
}

loadEnvFile()

const requiredVars = [
  "AWS_ACCESS_KEY_ID",
  "AWS_SECRET_ACCESS_KEY",
  "AWS_REGION",
  "AWS_S3_BUCKET_NAME",
]

console.log("🔍 Verifying AWS Environment Variables...\n")

let allPresent = true
const missing = []
const present = []

for (const varName of requiredVars) {
  const value = process.env[varName]
  if (!value || value.trim() === "") {
    allPresent = false
    missing.push(varName)
    console.log(`❌ ${varName}: MISSING`)
  } else {
    present.push(varName)
    // Mask sensitive values
    if (varName.includes("SECRET") || varName.includes("KEY")) {
      const masked = value.substring(0, 4) + "..." + value.substring(value.length - 4)
      console.log(`✅ ${varName}: ${masked}`)
    } else {
      console.log(`✅ ${varName}: ${value}`)
    }
  }
}

console.log("\n" + "=".repeat(50))

if (allPresent) {
  console.log("✅ All AWS environment variables are set!")
  console.log("\n📋 Next steps:")
  console.log("1. Verify your S3 bucket CORS configuration (see below)")
  console.log("2. Test the upload functionality")
  console.log("3. Check browser console for detailed error messages")
} else {
  console.log("❌ Missing required AWS environment variables:")
  missing.forEach((name) => console.log(`   - ${name}`))
  console.log("\n📝 To fix:")
  console.log("1. Copy env.example to .env.local if you haven't already")
  console.log("2. Add the missing variables to your .env.local file")
  console.log("3. Restart your development server")
}

console.log("\n" + "=".repeat(50))
console.log("\n📚 S3 CORS Configuration Guide:")
console.log("\nYour S3 bucket needs CORS configured to allow uploads from your app.")
console.log("Add this CORS configuration to your S3 bucket:")
console.log("\n```json")
console.log(`{
  "CORSRules": [
    {
      "AllowedOrigins": [
        "http://localhost:3000",
        "https://your-production-domain.com"
      ],
      "AllowedMethods": ["GET", "PUT", "POST", "DELETE", "HEAD"],
      "AllowedHeaders": ["*"],
      "ExposeHeaders": ["ETag"],
      "MaxAgeSeconds": 3000
    }
  ]
}`)
console.log("```\n")
console.log("To configure CORS:")
console.log("1. Go to AWS S3 Console")
console.log("2. Select your bucket:", process.env.AWS_S3_BUCKET_NAME || "[your-bucket-name]")
console.log("3. Go to 'Permissions' tab")
console.log("4. Scroll to 'Cross-origin resource sharing (CORS)'")
console.log("5. Click 'Edit' and paste the configuration above")
console.log("6. Replace 'your-production-domain.com' with your actual domain")
console.log("7. Save changes\n")

process.exit(allPresent ? 0 : 1)

