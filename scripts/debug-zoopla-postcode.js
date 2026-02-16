#!/usr/bin/env node
/**
 * Zoopla Postcode Debug - plain JS to avoid tsx transform issues
 * Usage: node scripts/debug-zoopla-postcode.js --url https://www.zoopla.co.uk/for-sale/details/NNNNN/
 */
const puppeteer = require('puppeteer')
const fs = require('fs')
const path = require('path')

function getArg(name, defaultValue) {
  const args = process.argv.slice(2)
  const idx = args.indexOf('--' + name)
  if (idx !== -1 && args[idx + 1] && !args[idx + 1].startsWith('--')) return args[idx + 1]
  return defaultValue
}

const targetUrl = getArg('url')
const LOG_DIR = path.join(process.cwd(), 'logs')
if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true })

async function main() {
  console.log('='.repeat(70))
  console.log('[PostcodeDebug] Zoopla Postcode Extraction Debugger')
  console.log('='.repeat(70))

  const browser = await puppeteer.launch({
    headless: true,
    args: [
      '--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage',
      '--disable-gpu', '--disable-blink-features=AutomationControlled',
      '--window-size=1920,1080',
    ],
    defaultViewport: { width: 1920, height: 1080 },
  })

  try {
    const page = await browser.newPage()

    // Same stealth as the real scraper
    await page.evaluateOnNewDocument(function() {
      Object.defineProperty(navigator, 'webdriver', { get: function() { return false } })
      Object.defineProperty(navigator, 'languages', { get: function() { return ['en-GB','en-US','en'] } })
      window.chrome = { runtime: {}, loadTimes: function() {}, csi: function() {} }
    })

    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36')
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'en-GB,en;q=0.9',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    })

    // Intercept requests to block images/fonts like the real scraper does
    await page.setRequestInterception(true)
    page.on('request', function(req) {
      var t = req.resourceType()
      if (t === 'image' || t === 'font' || t === 'media') req.abort()
      else req.continue()
    })

    var propertyUrl = targetUrl

    if (!propertyUrl) {
      console.log('[PostcodeDebug] No --url, searching Swansea on Zoopla...')
      var searchUrl = 'https://www.zoopla.co.uk/for-sale/property/swansea/?q=swansea&price_max=200000&pn=1&page_size=25'
      await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 45000 })
      await new Promise(function(r) { setTimeout(r, 3000) })

      // Accept cookies
      await page.evaluate(function() {
        var btns = Array.from(document.querySelectorAll('button'))
        for (var i = 0; i < btns.length; i++) {
          if (/accept all/i.test(btns[i].textContent || '')) { btns[i].click(); return }
        }
      })
      await new Promise(function(r) { setTimeout(r, 2000) })

      // Try __NEXT_DATA__ first
      var ids = await page.evaluate(function() {
        var nd = document.querySelector('#__NEXT_DATA__')
        if (!nd || !nd.textContent) return []
        try {
          var data = JSON.parse(nd.textContent)
          var listings = (data && data.props && data.props.pageProps && data.props.pageProps.regularListingsFormatted) || []
          return listings.slice(0, 3).map(function(l) { return l.listingId }).filter(Boolean)
        } catch(e) { return [] }
      })
      console.log('[PostcodeDebug] IDs from search __NEXT_DATA__:', ids)

      if (ids.length === 0) {
        // DOM fallback
        ids = await page.evaluate(function() {
          var links = Array.from(document.querySelectorAll('a[href*="/details/"]'))
          var found = []
          links.forEach(function(a) {
            var m = (a.getAttribute('href') || '').match(/\/details\/(\d+)/)
            if (m && found.indexOf(m[1]) === -1) found.push(m[1])
          })
          return found.slice(0, 3)
        })
        console.log('[PostcodeDebug] IDs from DOM:', ids)
      }

      if (ids.length === 0) {
        console.log('[PostcodeDebug] Zoopla blocked the search page. Trying a known Swansea ID directly...')
        // Use a known recent Swansea listing ID as fallback test
        propertyUrl = 'https://www.zoopla.co.uk/for-sale/details/70750926/'
      } else {
        propertyUrl = 'https://www.zoopla.co.uk/for-sale/details/' + ids[0] + '/'
      }
    }

    console.log('\n[PostcodeDebug] Testing:', propertyUrl)
    console.log('-'.repeat(70))

    await page.goto(propertyUrl, { waitUntil: 'domcontentloaded', timeout: 45000 })
    await new Promise(function(r) { setTimeout(r, 3000) })

    // Accept cookies
    await page.evaluate(function() {
      var btns = Array.from(document.querySelectorAll('button'))
      for (var i = 0; i < btns.length; i++) {
        if (/accept all/i.test(btns[i].textContent || '')) { btns[i].click(); return }
      }
    })
    await new Promise(function(r) { setTimeout(r, 1500) })

    // Dump everything
    var result = await page.evaluate(function() {
      // __NEXT_DATA__
      var nd = document.querySelector('#__NEXT_DATA__')
      var nextDataRaw = null
      var nextDataExists = false
      if (nd && nd.textContent) {
        try { nextDataRaw = JSON.parse(nd.textContent); nextDataExists = true } catch(e) {}
      }

      // Collect address fields from __NEXT_DATA__ using a stack
      var nextDataAddressFields = {}
      if (nextDataExists && nextDataRaw && nextDataRaw.props && nextDataRaw.props.pageProps) {
        var stack = [{ obj: nextDataRaw.props.pageProps, path: 'pageProps', depth: 0 }]
        while (stack.length > 0) {
          var item = stack.pop()
          var obj = item.obj, p = item.path, depth = item.depth
          if (!obj || typeof obj !== 'object' || depth > 8) continue
          Object.keys(obj).forEach(function(k) {
            var v = obj[k]
            var fullPath = p + '.' + k
            if (/post|outc|inc(?!lud)|addr|town|county|uprn|lati|longi|coord/i.test(k)) {
              nextDataAddressFields[fullPath] = typeof v === 'string' ? v : JSON.stringify(v)
            }
            if (v && typeof v === 'object' && !Array.isArray(v) && depth < 7) {
              stack.push({ obj: v, path: fullPath, depth: depth + 1 })
            }
          })
        }
      }

      // Meta tags
      function getMeta(prop) {
        var el = document.querySelector('meta[property="' + prop + '"]') ||
                 document.querySelector('meta[name="' + prop + '"]')
        return el ? el.getAttribute('content') || '' : ''
      }

      // DOM selectors
      var sels = ['h1','[data-testid="address-label"]','[data-testid="listing-address"]',
                  '[data-testid="address"]','[itemprop="address"]','[class*="address"]']
      var domTexts = {}
      sels.forEach(function(s) {
        var el = document.querySelector(s)
        if (el && el.textContent && el.textContent.trim()) {
          domTexts[s] = el.textContent.trim().substring(0, 200)
        }
      })

      // ld+json
      var ldItems = []
      document.querySelectorAll('script[type="application/ld+json"]').forEach(function(s) {
        try {
          var d = JSON.parse(s.textContent || '')
          if (d.address || d.geo || d['@type']) ldItems.push({ type: d['@type'], address: d.address, geo: d.geo })
        } catch(e) {}
      })

      // All postcodes in page body
      var bodyText = (document.body && document.body.textContent) || ''
      var allMatches = bodyText.match(/\b[A-Z]{1,2}\d{1,2}\s?\d[A-Z]{2}\b/gi) || []
      var uniquePostcodes = allMatches.map(function(m) { return m.toUpperCase().replace(/\s+/g,' ').trim() })
        .filter(function(v,i,a) { return a.indexOf(v) === i })

      return {
        nextDataExists: nextDataExists,
        nextDataAddressFields: nextDataAddressFields,
        nextDataPagePropsKeys: nextDataExists && nextDataRaw && nextDataRaw.props && nextDataRaw.props.pageProps
          ? Object.keys(nextDataRaw.props.pageProps) : [],
        pageTitle: document.title.substring(0, 150),
        ogTitle: getMeta('og:title').substring(0, 150),
        ogUrl: getMeta('og:url'),
        geoLat: getMeta('place:location:latitude') || getMeta('geo.position').split(';')[0],
        geoLng: getMeta('place:location:longitude') || getMeta('geo.position').split(';')[1],
        domTexts: domTexts,
        ldItems: ldItems,
        uniquePostcodes: uniquePostcodes,
        bodySnippet: bodyText.substring(0, 500).replace(/\s+/g,' '),
      }
    })

    console.log('\n[1] __NEXT_DATA__ exists:', result.nextDataExists)
    console.log('    pageProps keys:', result.nextDataPagePropsKeys)

    console.log('\n[2] __NEXT_DATA__ address/location fields:')
    var addrKeys = Object.keys(result.nextDataAddressFields)
    if (addrKeys.length === 0) {
      console.log('    (none)')
    } else {
      addrKeys.forEach(function(k) { console.log('    ' + k + ':', result.nextDataAddressFields[k]) })
    }

    console.log('\n[3] Page metadata:')
    console.log('    title:', result.pageTitle)
    console.log('    og:title:', result.ogTitle)
    console.log('    og:url:', result.ogUrl)
    console.log('    geo lat:', result.geoLat, ' lng:', result.geoLng)

    console.log('\n[4] DOM address selectors:')
    Object.keys(result.domTexts).forEach(function(s) { console.log('    ' + s + ': "' + result.domTexts[s] + '"') })

    console.log('\n[5] ld+json items:')
    result.ldItems.forEach(function(l) { console.log('    ', JSON.stringify(l)) })

    console.log('\n[6] ALL POSTCODES found in page body:', result.uniquePostcodes)

    console.log('\n[7] Body snippet:', result.bodySnippet)

    // Save to file
    var ts = new Date().toISOString().replace(/[:.]/g,'-').substring(0,19)
    var logFile = path.join(LOG_DIR, 'debug-zoopla-postcode-' + ts + '.json')
    fs.writeFileSync(logFile, JSON.stringify({ url: propertyUrl, result: result }, null, 2))
    console.log('\n[PostcodeDebug] Saved to:', logFile)

  } finally {
    await browser.close()
  }
}

main().catch(function(err) {
  console.error('[PostcodeDebug] Fatal:', err.message)
  process.exit(1)
})
