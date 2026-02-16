/**
 * File-based debug logger for the Rightmove scraper.
 *
 * Writes to logs/rightmove-debug.log in the project root so you can inspect
 * exactly what happens when the scraper runs from the UI (where console output
 * goes to the Next.js server terminal but may be hard to correlate).
 *
 * Usage: import { debugLog, debugLogFlush } from "./scraper-debug-logger"
 */

import * as fs from "fs"
import * as path from "path"

const LOG_PATH = path.join(process.cwd(), "logs", "rightmove-debug.log")
const MAX_SIZE_BYTES = 5 * 1024 * 1024 // 5 MB — rotate after this

/** Write a timestamped line to the debug log file (synchronous so nothing is lost). */
export function debugLog(jobId: string, message: string): void {
  try {
    const ts = new Date().toISOString()
    const line = `[${ts}] [${jobId}] ${message}\n`

    // Rotate if too large
    try {
      const stat = fs.statSync(LOG_PATH)
      if (stat.size > MAX_SIZE_BYTES) {
        const rotated = LOG_PATH.replace(".log", `.${Date.now()}.log`)
        fs.renameSync(LOG_PATH, rotated)
      }
    } catch {
      // File doesn't exist yet — that's fine
    }

    fs.appendFileSync(LOG_PATH, line, "utf8")
  } catch {
    // Never crash the scraper due to logging failures
  }
}

/** Write a separator line to make different job runs easy to distinguish. */
export function debugLogStart(jobId: string, source: string): void {
  debugLog(jobId, "=".repeat(72))
  debugLog(jobId, `JOB START  source=${source}  cwd=${process.cwd()}`)
  debugLog(jobId, "=".repeat(72))
}

export function debugLogEnd(jobId: string, totalFound: number, successful: number): void {
  debugLog(jobId, `JOB END  totalFound=${totalFound}  successful=${successful}`)
  debugLog(jobId, "=".repeat(72))
}
