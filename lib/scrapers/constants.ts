// ============================================================================
// SCRAPER CONSTANTS
// ============================================================================

// Real browser user-agents for rotation
export const USER_AGENTS = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:122.0) Gecko/20100101 Firefox/122.0",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15",
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36 Edg/121.0.0.0",
]

// ---- BMV Keyword Lists ----

export const NEEDS_WORK_KEYWORDS = [
  "needs modernisation",
  "modernisation required",
  "renovation",
  "renovation project",
  "in need of updating",
  "refurbishment",
  "needs work",
  "needs updating",
  "fixer-upper",
  "fixer upper",
  "requires updating",
  "requires modernisation",
  "project",
  "development opportunity",
  "improvement",
  "cosmetic updating",
  "structural work",
  "damp",
  "no central heating",
  "rewire",
  "re-wire",
  "re-plumb",
  "requires attention",
  "in need of repair",
  "doer upper",
]

export const MOTIVATED_SELLER_KEYWORDS = [
  "motivated seller",
  "quick sale",
  "must sell",
  "price reduced",
  "reduced for quick sale",
  "open to offers",
  "price negotiable",
  "vendor relocating",
  "relocation",
  "divorce",
  "probate",
  "deceased estate",
  "inheritance",
  "repossession",
  "repossessed",
  "bank sale",
  "below market value",
  "bmv",
  "chain free",
  "no chain",
  "investment opportunity",
  "below asking",
  "serious offers",
  "executor sale",
  "executor's sale",
  "executors sale",
]

export const AUCTION_KEYWORDS = [
  "auction",
  "guide price",
  "unconditional",
  "modern method of auction",
  "online auction",
  "conditional auction",
  "auctioneer",
  "going to auction",
]

export const CASH_BUYER_KEYWORDS = [
  "cash buyers only",
  "cash only",
  "cash purchasers",
  "not suitable for mortgage",
  "unmortgageable",
  "cash purchase",
]

export const PROBATE_KEYWORDS = [
  "probate",
  "deceased estate",
  "executor sale",
  "executor's sale",
  "executors sale",
  "estate sale",
  "grant of probate",
]

// ---- Rightmove Configuration ----

export const RIGHTMOVE_BASE_URL = "https://www.rightmove.co.uk"
export const RIGHTMOVE_RESIDENTIAL_SEARCH = "/property-for-sale/find.html"
export const RIGHTMOVE_COMMERCIAL_SEARCH =
  "/commercial-property-for-sale/find.html"
export const RIGHTMOVE_PROPERTY_DETAIL = "/properties/"

export const RESULTS_PER_PAGE = 24
export const MAX_PAGES = 42 // Rightmove caps at ~1000 results

// Common UK Rightmove outcode identifiers
// To find more: search on Rightmove, extract locationIdentifier from URL
export const RIGHTMOVE_OUTCODES: Record<string, string> = {
  "Birmingham (B)": "2245",
  "London (E)": "87490",
  "London (N)": "87498",
  "London (NW)": "87499",
  "London (SE)": "87502",
  "London (SW)": "87504",
  "London (W)": "87506",
  "London (WC)": "87507",
  "London (EC)": "87489",
  "Manchester (M)": "904",
  "Leeds (LS)": "787",
  "Liverpool (L)": "791",
  "Sheffield (S)": "1335",
  "Bristol (BS)": "219",
  "Nottingham (NG)": "1024",
  "Leicester (LE)": "770",
  "Coventry (CV)": "405",
  "Bradford (BD)": "153",
  "Newcastle (NE)": "1007",
  "Sunderland (SR)": "1440",
  "Glasgow (G)": "550",
  "Edinburgh (EH)": "475",
  "Cardiff (CF)": "289",
  "Belfast (BT)": "233",
  "Wolverhampton (WV)": "1631",
  "Derby (DE)": "424",
  "Stoke-on-Trent (ST)": "1407",
  "Southampton (SO)": "1372",
  "Portsmouth (PO)": "1167",
  "Plymouth (PL)": "1148",
  "Reading (RG)": "1207",
  "Milton Keynes (MK)": "942",
  "Luton (LU)": "808",
  "Northampton (NN)": "1033",
  "Newport (NP)": "REGION^991",
  "Swansea (SA)": "REGION^1305",
  "Swindon (SN)": "1361",
  "Peterborough (PE)": "1098",
  // South West
  "Bath (BA)": "95",
  "Exeter (EX)": "490",
  "Bournemouth (BH)": "190",
  "Gloucester (GL)": "547",
  // South East
  "Brighton/Hove (BN)": "213",
  "Oxford (OX)": "1063",
  "Guildford (GU)": "571",
  "Southend-on-Sea (SS)": "1385",
  "Slough/Windsor (SL)": "1346",
  // East of England
  "Cambridge (CB)": "271",
  "Norwich (NR)": "1020",
  "Ipswich (IP)": "635",
  "Chelmsford (CM)": "358",
  "Colchester (CO)": "385",
  // East Midlands
  "Lincoln (LN)": "790",
  // West Midlands
  "Telford (TF)": "1471",
  "Shrewsbury (SY)": "1362",
  // Yorkshire
  "York (YO)": "1671",
  "Hull (HU)": "613",
  "Doncaster (DN)": "445",
  "Huddersfield (HD)": "592",
  "Wakefield (WF)": "1561",
  "Harrogate (HG)": "583",
  // North East
  "Middlesbrough (TS)": "982",
  // North West
  "Bolton (BL)": "144",
  "Blackpool (FY)": "513",
  "Preston (PR)": "1172",
  "Wigan (WN)": "1609",
  "Warrington (WA)": "1541",
  "Chester (CH)": "338",
  "Stockport (SK)": "1348",
  "Oldham (OL)": "1057",
  // Scotland
  "Aberdeen (AB)": "1",
  "Dundee (DD)": "418",
  "Inverness (IV)": "649",
  // Wales
  "Wrexham/N. Wales (LL)": "REGION^1304",
  "Powys (LD)": "764",
  // Outer London
  "Harrow (HA)": "587",
  "Romford (RM)": "1257",
  "Twickenham (TW)": "1518",
  "Kingston (KT)": "710",
  "Croydon (CR)": "407",
  "Bromley (BR)": "218",
  "Dartford (DA)": "415",
  "Enfield (EN)": "482",
  "Watford (WD)": "1554",
}

// Rightmove addedSince parameter mapping
export const ADDED_SINCE_MAP: Record<string, string> = {
  "24hours": "1",
  "3days": "3",
  "7days": "7",
  "14days": "14",
}

// Rightmove search results selectors (may change — document for maintenance)
export const RIGHTMOVE_SELECTORS = {
  // Search results page
  resultsContainer: "#l-searchResults",
  propertyCard: ".l-searchResult",
  propertyLink: 'a[href*="/properties/"]',
  resultCount: ".searchHeader-resultCount",
  paginationNext: ".pagination-button.pagination-direction--next",

  // Cookie consent
  cookieAccept: "#onetrust-accept-btn-handler",
  cookieAcceptAlt: 'button[title="Accept All Cookies"]',
}

// ---- Zoopla Configuration ----

export const ZOOPLA_BASE_URL = "https://www.zoopla.co.uk"
export const ZOOPLA_SALE_SEARCH = "/for-sale/property/"
export const ZOOPLA_COMMERCIAL_SEARCH = "/for-sale/commercial/property/"

export const ZOOPLA_SELECTORS = {
  propertyLink: 'a[href*="/details/"]',
  paginationNext: 'a[data-testid="pagination-next"]',
  paginationNextAlt: 'a[rel="next"]',
  nextData: "#__NEXT_DATA__",
  // Zoopla uses Usercentrics CMP for cookie consent
  cookieAccept: 'button[data-testid="accept-all-cookies"]',
  cookieAcceptAlt: "#save-consent-button",
}

// ---- OnTheMarket Configuration ----

export const ONTHEMARKET_BASE_URL = "https://www.onthemarket.com"
export const ONTHEMARKET_SALE_SEARCH = "/for-sale/property/"
export const ONTHEMARKET_COMMERCIAL_SEARCH = "/for-sale/commercial-property/"

export const ONTHEMARKET_SELECTORS = {
  propertyLink: 'a[href*="/details/"]',
  paginationNext: 'a.pagination-next',
  paginationNextAlt: 'a[rel="next"]',
  cookieAccept: "#accept-cookies-button",
  cookieAcceptAlt: 'button[class*="accept"]',
}

// ---- Location slugs for Zoopla/OnTheMarket ----
// Maps display names to area slugs used in URLs

export const LOCATION_SLUGS: Record<string, string> = {
  "Birmingham (B)": "birmingham",
  "London (E)": "east-london",
  "London (N)": "north-london",
  "London (NW)": "north-west-london",
  "London (SE)": "south-east-london",
  "London (SW)": "south-west-london",
  "London (W)": "west-london",
  "London (WC)": "central-london",
  "London (EC)": "city-of-london",
  "Manchester (M)": "manchester",
  "Leeds (LS)": "leeds",
  "Liverpool (L)": "liverpool",
  "Sheffield (S)": "sheffield",
  "Bristol (BS)": "bristol",
  "Nottingham (NG)": "nottingham",
  "Leicester (LE)": "leicester",
  "Coventry (CV)": "coventry",
  "Bradford (BD)": "bradford",
  "Newcastle (NE)": "newcastle-upon-tyne",
  "Sunderland (SR)": "sunderland",
  "Glasgow (G)": "glasgow",
  "Edinburgh (EH)": "edinburgh",
  "Cardiff (CF)": "cardiff",
  "Belfast (BT)": "belfast",
  "Wolverhampton (WV)": "wolverhampton",
  "Derby (DE)": "derby",
  "Stoke-on-Trent (ST)": "stoke-on-trent",
  "Southampton (SO)": "southampton",
  "Portsmouth (PO)": "portsmouth",
  "Plymouth (PL)": "plymouth",
  "Reading (RG)": "reading",
  "Milton Keynes (MK)": "milton-keynes",
  "Luton (LU)": "luton",
  "Northampton (NN)": "northampton",
  "Newport (NP)": "newport",
  "Swansea (SA)": "swansea",
  "Swindon (SN)": "swindon",
  "Peterborough (PE)": "peterborough",
  // South West
  "Bath (BA)": "bath",
  "Exeter (EX)": "exeter",
  "Bournemouth (BH)": "bournemouth",
  "Gloucester (GL)": "gloucester",
  // South East
  "Brighton/Hove (BN)": "brighton",
  "Oxford (OX)": "oxford",
  "Guildford (GU)": "guildford",
  "Southend-on-Sea (SS)": "southend-on-sea",
  "Slough/Windsor (SL)": "slough",
  // East of England
  "Cambridge (CB)": "cambridge",
  "Norwich (NR)": "norwich",
  "Ipswich (IP)": "ipswich",
  "Chelmsford (CM)": "chelmsford",
  "Colchester (CO)": "colchester",
  // East Midlands
  "Lincoln (LN)": "lincoln",
  // West Midlands
  "Telford (TF)": "telford",
  "Shrewsbury (SY)": "shrewsbury",
  // Yorkshire
  "York (YO)": "york",
  "Hull (HU)": "hull",
  "Doncaster (DN)": "doncaster",
  "Huddersfield (HD)": "huddersfield",
  "Wakefield (WF)": "wakefield",
  "Harrogate (HG)": "harrogate",
  // North East
  "Middlesbrough (TS)": "middlesbrough",
  // North West
  "Bolton (BL)": "bolton",
  "Blackpool (FY)": "blackpool",
  "Preston (PR)": "preston",
  "Wigan (WN)": "wigan",
  "Warrington (WA)": "warrington",
  "Chester (CH)": "chester",
  "Stockport (SK)": "stockport",
  "Oldham (OL)": "oldham",
  // Scotland
  "Aberdeen (AB)": "aberdeen",
  "Dundee (DD)": "dundee",
  "Inverness (IV)": "inverness",
  // Wales
  "Wrexham/N. Wales (LL)": "wrexham",
  "Powys (LD)": "llandrindod-wells",
  // Outer London
  "Harrow (HA)": "harrow",
  "Romford (RM)": "romford",
  "Twickenham (TW)": "twickenham",
  "Kingston (KT)": "kingston-upon-thames",
  "Croydon (CR)": "croydon",
  "Bromley (BR)": "bromley",
  "Dartford (DA)": "dartford",
  "Enfield (EN)": "enfield",
  "Watford (WD)": "watford",
}

// ---- PrimeLocation Configuration ----

export const PRIMELOCATION_BASE_URL = "https://www.primelocation.com"
export const PRIMELOCATION_SALE_SEARCH = "/for-sale/property/"
export const PRIMELOCATION_COMMERCIAL_SEARCH = "/for-sale/commercial-property/"

export const PRIMELOCATION_SELECTORS = {
  propertyLink: 'a[href*="/details/"]',
  paginationNext: 'a[data-testid="pagination-next"]',
  paginationNextAlt: 'a[rel="next"]',
  nextData: "#__NEXT_DATA__",
  cookieAccept: '#save-consent-button',
  cookieAcceptAlt: 'button[data-testid="accept-all-cookies"]',
}
