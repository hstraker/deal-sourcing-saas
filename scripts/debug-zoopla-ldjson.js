/**
 * Dump full ld+json from a Zoopla page to see if RealEstateListing has address.postalCode
 */
const puppeteer = require('puppeteer')
const fs = require('fs')
const path = require('path')

const targetUrl = process.argv[2] || 'https://www.zoopla.co.uk/for-sale/details/72394204/'

async function main() {
  console.log('[ldJson] Testing:', targetUrl)
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox','--disable-setuid-sandbox','--disable-dev-shm-usage','--disable-gpu',
           '--disable-blink-features=AutomationControlled','--window-size=1920,1080'],
    defaultViewport: { width: 1920, height: 1080 },
  })
  try {
    const page = await browser.newPage()
    await page.evaluateOnNewDocument(function() {
      Object.defineProperty(navigator,'webdriver',{get:function(){return false}})
      window.chrome={runtime:{},loadTimes:function(){},csi:function(){}}
    })
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36')
    await page.setRequestInterception(true)
    page.on('request',function(r){var t=r.resourceType();if(t==='image'||t==='font'||t==='media')r.abort();else r.continue()})

    await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 45000 })
    await new Promise(function(r){setTimeout(r,3000)})
    await page.evaluate(function(){
      var btns=Array.from(document.querySelectorAll('button'))
      for(var i=0;i<btns.length;i++){if(/accept all/i.test(btns[i].textContent||'')){btns[i].click();return}}
    })
    await new Promise(function(r){setTimeout(r,1500)})

    var result = await page.evaluate(function() {
      // All ld+json blocks - full content
      var ldFull = []
      document.querySelectorAll('script[type="application/ld+json"]').forEach(function(s) {
        try { ldFull.push(JSON.parse(s.textContent||'')) } catch(e) {}
      })

      // Look for Zoopla's internal API calls captured in performance entries
      var performanceEntries = []
      try {
        var entries = performance.getEntriesByType('resource')
        entries.forEach(function(e) {
          if (e.name && /api|zoopla|listing|property|postcode/i.test(e.name) && e.name.indexOf('//') !== -1) {
            performanceEntries.push(e.name)
          }
        })
      } catch(e) {}

      // Check all script tags for embedded data
      var scriptData = []
      document.querySelectorAll('script:not([src]):not([type="application/ld+json"])').forEach(function(s) {
        var t = s.textContent || ''
        if (t.length > 50 && (t.indexOf('postcode') !== -1 || t.indexOf('outcode') !== -1 || t.indexOf('incode') !== -1)) {
          scriptData.push(t.substring(0, 2000))
        }
      })

      // Check all anchor tags with postcode-like hrefs
      var postcodeLinks = []
      document.querySelectorAll('a[href]').forEach(function(a) {
        var href = a.getAttribute('href') || ''
        if (/\/[a-z]{1,2}\d{1,2}[-\/]/i.test(href)) postcodeLinks.push(href)
      })

      // Get the canonical URL
      var canonical = (document.querySelector('link[rel="canonical"]') || {}).href || ''

      return {
        ldFull: ldFull,
        performanceEntries: performanceEntries.slice(0, 20),
        scriptDataSnippets: scriptData.slice(0, 5),
        postcodeLinks: postcodeLinks.slice(0, 20),
        canonical: canonical,
        // Also grab whatever JSON is on the page that has postcode/outcode
        allJsonWithPostcode: (function() {
          var results = []
          document.querySelectorAll('script').forEach(function(s) {
            var t = s.textContent || ''
            var idx = t.indexOf('"outcode"')
            if (idx !== -1) {
              results.push({ type: s.getAttribute('type') || 'text/javascript', snippet: t.substring(Math.max(0, idx-100), idx+200) })
            }
            var idx2 = t.indexOf('"postcode"')
            if (idx2 !== -1) {
              results.push({ type: s.getAttribute('type') || 'text/javascript', snippet: t.substring(Math.max(0, idx2-100), idx2+200) })
            }
          })
          return results.slice(0, 10)
        })(),
      }
    })

    console.log('\n=== ld+json blocks ===')
    result.ldFull.forEach(function(ld, i) {
      console.log('ld+json[' + i + ']:', JSON.stringify(ld, null, 2))
    })

    if (result.performanceEntries.length > 0) {
      console.log('\n=== Performance/API entries ===')
      result.performanceEntries.forEach(function(e) { console.log(' ', e) })
    }

    if (result.postcodeLinks.length > 0) {
      console.log('\n=== Postcode-like hrefs ===')
      result.postcodeLinks.forEach(function(l) { console.log(' ', l) })
    }

    if (result.allJsonWithPostcode.length > 0) {
      console.log('\n=== Script tags containing "outcode"/"postcode" ===')
      result.allJsonWithPostcode.forEach(function(item) {
        console.log('\n  [type=' + item.type + ']:', item.snippet)
      })
    }

    console.log('\n=== Canonical URL:', result.canonical)

    // Save
    var ts = new Date().toISOString().replace(/[:.]/g,'-').substring(0,19)
    var f = path.join(process.cwd(),'logs','debug-zoopla-ldjson-'+ts+'.json')
    fs.writeFileSync(f, JSON.stringify(result, null, 2))
    console.log('Saved to:', f)

  } finally {
    await browser.close()
  }
}

main().catch(function(err) { console.error('Fatal:', err.message); process.exit(1) })
