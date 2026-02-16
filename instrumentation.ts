export async function register() {
  // Only run scheduler on the server (not in edge runtime)
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startScheduler } = await import("./lib/scrapers/scheduler")
    startScheduler()
  }
}
