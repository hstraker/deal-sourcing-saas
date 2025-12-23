/**
 * Vendor Pipeline Service Runner
 * Run this script to start the background pipeline service
 * 
 * Usage:
 *   tsx scripts/start-pipeline-service.ts
 * 
 * Or add to package.json:
 *   "pipeline:start": "tsx scripts/start-pipeline-service.ts"
 */

import { getPipelineService } from "@/lib/vendor-pipeline/pipeline-service"

const service = getPipelineService()

console.log("🚀 Starting Vendor Pipeline Service...")
console.log("Press Ctrl+C to stop")

service.start()

// Handle graceful shutdown
process.on("SIGTERM", () => {
  console.log("\n🛑 Received SIGTERM, stopping pipeline service...")
  service.stop()
  process.exit(0)
})

process.on("SIGINT", () => {
  console.log("\n🛑 Received SIGINT, stopping pipeline service...")
  service.stop()
  process.exit(0)
})

// Keep process alive
process.on("unhandledRejection", (reason, promise) => {
  console.error("Unhandled Rejection at:", promise, "reason:", reason)
})

process.on("uncaughtException", (error) => {
  console.error("Uncaught Exception:", error)
  service.stop()
  process.exit(1)
})

