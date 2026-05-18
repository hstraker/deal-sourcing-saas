// lib/deals/investor-matcher.ts

export interface InvestorCriteria {
  id: string
  name: string
  preferredAreas: string[]
  minBudget: number | null
  maxBudget: number | null
  minYield: number | null
  minBmv: number | null
  strategy: string[]
}

export interface DealForMatching {
  postcode: string | null
  propertyAddress?: string | null   // used for city-name area matching
  askingPrice: number
  bmvPercentage: number | null
  grossYield: number | null
  recommendedStrategy: string | null
}

export interface MatchResult {
  investorId: string
  name: string
  /** 0–1 */
  score: number
  matched: string[]
  /** e.g. "BTL/BRRRR · SA1, SA2 · £60k–£100k" */
  criteriaLine: string
}

// ─── Area matching helpers ─────────────────────────────────────────────────────
//
// Investors often enter city/town names ("Swansea", "Cardiff") rather than
// postcode outcodes ("SA1", "CF24"). This map lets us match either way.
//
// Keys = postcode area letters (uppercase, no digits).
// Values = lowercase city/town/county names that are commonly used to refer
//          to properties within that postcode area.

const POSTCODE_AREA_CITIES: Record<string, string[]> = {
  // Wales
  SA: ["swansea", "neath", "port talbot", "llanelli", "carmarthen", "ammanford", "bridgend swansea"],
  CF: ["cardiff", "pontypridd", "barry", "penarth", "caerphilly"],
  NP: ["newport", "cwmbran", "pontypool", "abergavenny"],
  LL: ["wrexham", "rhyl", "colwyn bay", "bangor", "llandudno", "holyhead"],
  SY: ["shrewsbury", "oswestry", "welshpool", "newtown"],
  LD: ["llandrindod wells", "brecon", "builth wells"],
  // South West England
  BS: ["bristol", "bath north east somerset"],
  BA: ["bath", "frome", "glastonbury", "wells", "shepton mallet"],
  BN: ["brighton", "hove", "worthing", "eastbourne"],
  EX: ["exeter", "exmouth", "sidmouth"],
  PL: ["plymouth", "saltash"],
  TR: ["truro", "cornwall", "penzance", "falmouth", "newquay"],
  TQ: ["torquay", "newton abbot", "paignton", "totnes"],
  GL: ["gloucester", "cheltenham", "stroud", "cirencester"],
  SN: ["swindon"],
  SP: ["salisbury", "andover", "amesbury"],
  SO: ["southampton", "eastleigh", "fareham", "romsey"],
  PO: ["portsmouth", "havant", "gosport"],
  BH: ["bournemouth", "poole", "christchurch"],
  DT: ["dorchester", "weymouth", "bridport"],
  TA: ["taunton", "bridgwater", "yeovil"],
  // South East England
  GU: ["guildford", "woking", "farnham", "aldershot"],
  RH: ["redhill", "crawley", "horsham", "reigate"],
  KT: ["kingston", "surbiton", "epsom", "leatherhead"],
  TW: ["twickenham", "richmond", "hounslow", "feltham"],
  SL: ["slough", "windsor", "maidenhead"],
  RG: ["reading", "wokingham", "bracknell"],
  OX: ["oxford", "abingdon", "witney", "banbury"],
  HP: ["hemel hempstead", "high wycombe", "aylesbury"],
  AL: ["st albans", "harpenden", "hatfield"],
  SG: ["stevenage", "hitchin", "letchworth"],
  LU: ["luton", "dunstable"],
  MK: ["milton keynes"],
  NN: ["northampton", "wellingborough", "kettering", "corby"],
  PE: ["peterborough", "stamford", "spalding"],
  CB: ["cambridge", "ely"],
  CO: ["colchester", "clacton"],
  CM: ["chelmsford", "brentwood"],
  SS: ["southend", "basildon", "rayleigh"],
  ME: ["medway", "maidstone", "gillingham", "chatham"],
  CT: ["canterbury", "folkestone", "dover", "margate", "ramsgate"],
  TN: ["tunbridge wells", "hastings", "crowborough", "tonbridge"],
  EN: ["enfield", "barnet", "potters bar"],
  WD: ["watford", "bushey", "rickmansworth"],
  // London
  E: ["east london", "stratford", "hackney", "bow", "walthamstow"],
  EC: ["city of london", "clerkenwell"],
  N: ["north london", "islington", "highbury", "holloway", "finsbury park"],
  NW: ["north west london", "camden", "hampstead", "kilburn", "cricklewood"],
  SE: ["south east london", "greenwich", "lewisham", "deptford", "peckham"],
  SW: ["south west london", "clapham", "brixton", "wandsworth", "tooting"],
  W: ["west london", "ealing", "chiswick", "shepherd's bush", "notting hill"],
  WC: ["west central london", "holborn", "bloomsbury"],
  // East Midlands
  NG: ["nottingham", "mansfield", "newark"],
  LE: ["leicester", "loughborough", "hinckley", "coalville"],
  DE: ["derby", "matlock", "ashbourne"],
  // West Midlands
  B: ["birmingham", "solihull", "west midlands", "sutton coldfield"],
  CV: ["coventry", "kenilworth", "rugby"],
  WV: ["wolverhampton", "west bromwich"],
  DY: ["dudley", "stourbridge", "halesowen"],
  WS: ["walsall", "lichfield"],
  ST: ["stoke", "staffordshire", "stoke-on-trent", "newcastle under lyme"],
  WR: ["worcester", "malvern", "droitwich"],
  HR: ["hereford"],
  // East England
  NR: ["norwich", "norfolk"],
  IP: ["ipswich", "bury st edmunds", "lowestoft"],
  // East of England
  LN: ["lincoln", "gainsborough"],
  // North West England
  M: ["manchester", "salford", "eccles"],
  SK: ["stockport", "macclesfield", "congleton"],
  WA: ["warrington", "widnes", "runcorn"],
  CH: ["chester", "ellesmere port", "crewe", "nantwich"],
  CW: ["crewe", "nantwich", "sandbach"],
  L: ["liverpool", "bootle", "crosby"],
  PR: ["preston", "leyland", "chorley"],
  BB: ["blackburn", "accrington", "clitheroe"],
  BL: ["bolton", "horwich"],
  OL: ["oldham", "rochdale", "saddleworth"],
  WN: ["wigan", "leigh"],
  FY: ["blackpool", "lytham", "fylde", "fleetwood"],
  LA: ["lancaster", "kendal", "morecambe"],
  // Yorkshire
  LS: ["leeds", "morley", "pudsey"],
  BD: ["bradford", "keighley", "ilkley", "shipley"],
  HD: ["huddersfield", "holmfirth"],
  HX: ["halifax", "brighouse"],
  WF: ["wakefield", "pontefract", "castleford"],
  DN: ["doncaster", "rotherham"],
  S: ["sheffield", "barnsley", "chesterfield"],
  HG: ["harrogate", "ripon", "knaresborough"],
  YO: ["york", "scarborough", "filey", "whitby", "pickering"],
  HU: ["hull", "beverley", "goole"],
  // North East England
  NE: ["newcastle", "gateshead", "sunderland", "north east", "tyneside"],
  SR: ["sunderland", "seaham", "houghton le spring"],
  DH: ["durham", "chester le street", "consett"],
  DL: ["darlington", "stockton", "richmond"],
  TS: ["middlesbrough", "stockton", "teesside", "hartlepool", "redcar"],
  CA: ["carlisle", "penrith", "whitehaven", "workington"],
  // Scotland
  EH: ["edinburgh", "musselburgh", "dalkeith", "livingston"],
  FK: ["stirling", "falkirk", "alloa"],
  G: ["glasgow", "east kilbride"],
  PA: ["paisley", "greenock", "inverclyde"],
  KA: ["kilmarnock", "ayr", "irvine", "troon"],
  AB: ["aberdeen", "peterhead", "inverurie"],
  DD: ["dundee", "arbroath", "montrose"],
  PH: ["perth", "pitlochry", "crieff"],
  KY: ["kirkcaldy", "dunfermline", "glenrothes"],
  ML: ["motherwell", "hamilton", "coatbridge", "wishaw"],
  TD: ["berwick", "galashiels", "hawick"],
  // Northern Ireland
  BT: ["belfast", "northern ireland", "lisburn", "londonderry", "derry"],
}

// Extract the letter-only prefix from an outcode (e.g. "SA11" → "SA", "SW1A" → "SW")
function outcodeArea(outcode: string): string {
  return outcode.replace(/\d.*$/, "").toUpperCase()
}

// Three-strategy area check:
//  1. Outcode prefix  — investor stores "SA" or "SA11", deal postcode is "SA11 1PB"
//  2. Address text    — investor stores "Neath", it appears in the full address string
//  3. Area-city map   — investor stores "Swansea", which maps to SA* postcodes
function areaMatches(
  investorArea: string,
  postcode: string,
  address: string | null | undefined
): boolean {
  const areaUpper = investorArea.toUpperCase().trim()
  const areaLower = investorArea.toLowerCase().trim()
  const outcode   = postcode.split(" ")[0].toUpperCase()  // "SA11"

  // 1. Outcode prefix match (e.g. "SA" matches "SA11", "SA1" matches "SA1x")
  if (outcode.startsWith(areaUpper)) return true

  // 2. Address text match (e.g. "Neath" appears in "30 Brookdale, Neath, SA11 1PB")
  if (address && address.toLowerCase().includes(areaLower)) return true

  // 3. City-to-postcode-area map
  //    e.g. investor stores "Swansea" → area = "SA" → POSTCODE_AREA_CITIES["SA"] includes "swansea"
  const area = outcodeArea(outcode)                       // "SA"
  const knownCities = POSTCODE_AREA_CITIES[area] ?? []
  if (knownCities.some((city) =>
    areaLower.includes(city) || city.includes(areaLower)
  )) return true

  return false
}

// ─── Strategy helpers ──────────────────────────────────────────────────────────

function dealStrategies(recommendedStrategy: string | null): string[] {
  if (recommendedStrategy === "flip") return ["Flip"]
  if (recommendedStrategy === "hold") return ["BTL", "BRRRR"]
  if (recommendedStrategy === "both") return ["Flip", "BTL", "BRRRR"]
  return []
}

// ─── Main matcher ──────────────────────────────────────────────────────────────

export function matchInvestors(
  investors: InvestorCriteria[],
  deal: DealForMatching
): MatchResult[] {
  const results: MatchResult[] = []

  for (const investor of investors) {
    const checks: Array<{ label: string; pass: boolean }> = []

    // 1. Area — three strategies: outcode prefix, address text, city→postcode map
    if (investor.preferredAreas.length > 0 && deal.postcode) {
      const pass = investor.preferredAreas.some((a) =>
        areaMatches(a, deal.postcode!, deal.propertyAddress)
      )
      checks.push({ label: "area", pass })
    }

    // 2. Budget — max is a hard cap; min filters out deals too small to interest the investor
    if (investor.minBudget !== null && investor.maxBudget !== null) {
      const pass =
        deal.askingPrice >= investor.minBudget &&
        deal.askingPrice <= investor.maxBudget
      checks.push({ label: "budget", pass })
    }

    // 3. BMV
    if (investor.minBmv !== null && deal.bmvPercentage !== null) {
      checks.push({ label: "BMV", pass: deal.bmvPercentage >= investor.minBmv })
    }

    // 4. Yield
    if (investor.minYield !== null && deal.grossYield !== null) {
      checks.push({ label: "yield", pass: deal.grossYield >= investor.minYield })
    }

    // 5. Strategy (only checked when deal has a known strategy value)
    if (investor.strategy.length > 0 && deal.recommendedStrategy) {
      const ds = dealStrategies(deal.recommendedStrategy)
      if (ds.length > 0) {
        const pass = ds.some((s) => investor.strategy.includes(s))
        checks.push({ label: "strategy", pass })
      }
    }

    if (checks.length === 0) continue

    const matchedLabels = checks.filter((c) => c.pass).map((c) => c.label)
    const score = matchedLabels.length / checks.length
    if (score === 0) continue

    // Build one-line criteria summary
    const parts: string[] = []
    if (investor.strategy.length > 0) parts.push(investor.strategy.join("/"))
    if (investor.preferredAreas.length > 0)
      parts.push(investor.preferredAreas.join(", "))
    if (investor.minBudget !== null && investor.maxBudget !== null) {
      const min = (investor.minBudget / 1000).toFixed(0)
      const max = (investor.maxBudget / 1000).toFixed(0)
      parts.push(`£${min}k–£${max}k`)
    }

    results.push({
      investorId: investor.id,
      name: investor.name,
      score,
      matched: matchedLabels,
      criteriaLine: parts.join(" · "),
    })
  }

  return results.sort((a, b) => b.score - a.score)
}
