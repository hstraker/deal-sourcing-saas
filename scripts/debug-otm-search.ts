import puppeteer from "puppeteer"

;(async () => {
  const browser = await puppeteer.launch({ headless: true, args: ["--no-sandbox"] })
  const page = await browser.newPage()
  await page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36")
  await page.goto("https://www.onthemarket.com/for-sale/property/birmingham/?page_size=6&view=list", { waitUntil: "networkidle2", timeout: 45000 })
  await new Promise(r => setTimeout(r, 2000))

  const result = await page.evaluate(() => {
    const s = document.querySelector("#__NEXT_DATA__")?.textContent
    if (!s) return { error: "no __NEXT_DATA__" }
    const p = JSON.parse(s)
    const redux = p?.props?.initialReduxState || {}

    // Check all top-level redux keys
    const reduxKeys = Object.keys(redux)

    // Try to find properties array in various paths
    const resultsKeys = Object.keys(redux?.results || {})
    const properties =
      redux?.results?.list ||
      redux?.results?.properties ||
      redux?.results?.listings ||
      redux?.results?.data?.properties ||
      redux?.properties?.properties ||
      p?.props?.pageProps?.properties ||
      []

    if (properties.length === 0) {
      return {
        reduxKeys,
        resultsKeys,
        pagePropsKeys: Object.keys(p?.props?.pageProps || {}),
        resultsSample: JSON.stringify(redux?.results || {}).substring(0, 1500),
      }
    }

    const first = properties[0]
    const dateFields: Record<string, any> = {}
    for (const k of Object.keys(first)) {
      if (/date|time|added|listed|since|reduced|published|created|updated/i.test(k)) {
        dateFields[k] = first[k]
      }
    }

    return {
      propertyCount: properties.length,
      firstPropertyKeys: Object.keys(first),
      dateFields,
      firstPropertySample: JSON.stringify(first).substring(0, 600),
    }
  })

  console.log(JSON.stringify(result, null, 2))
  await browser.close()
})()
