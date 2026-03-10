export interface SmsResult {
  success: boolean
  error?: string
}

export async function sendAlertMatchSms(opts: {
  toPhone: string
  alertName: string
  address: string
  price: number
}): Promise<SmsResult> {
  const { TwilioService } = await import("@/lib/vendor-pipeline/twilio")
  let service: InstanceType<typeof TwilioService>
  try {
    service = new TwilioService()
  } catch {
    return { success: false, error: "Twilio not configured" }
  }

  const priceFormatted = new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    maximumFractionDigits: 0,
  }).format(opts.price)

  const message = `DealStack Alert: New match for "${opts.alertName}" — ${opts.address} at ${priceFormatted}`

  try {
    const result = await service.sendSMS(opts.toPhone, message)
    if (result.error) return { success: false, error: result.error }
    return { success: true }
  } catch (err: any) {
    return { success: false, error: err.message || "Unknown error" }
  }
}

export async function sendPriceChangeSms(opts: {
  toPhone: string
  address: string
  oldPrice: number
  newPrice: number
}): Promise<SmsResult> {
  const { TwilioService } = await import("@/lib/vendor-pipeline/twilio")
  let service: InstanceType<typeof TwilioService>
  try {
    service = new TwilioService()
  } catch {
    return { success: false, error: "Twilio not configured" }
  }

  const fmt = (n: number) =>
    new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 0 }).format(n)
  const direction = opts.newPrice > opts.oldPrice ? "up" : "down"
  const message = `DealStack: Price ${direction} on watchlist property — ${opts.address}. Was ${fmt(opts.oldPrice)}, now ${fmt(opts.newPrice)}`

  try {
    const result = await service.sendSMS(opts.toPhone, message)
    if (result.error) return { success: false, error: result.error }
    return { success: true }
  } catch (err: any) {
    return { success: false, error: err.message || "Unknown error" }
  }
}
