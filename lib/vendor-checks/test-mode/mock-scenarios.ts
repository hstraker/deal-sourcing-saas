/**
 * Mock scenarios for vendor portal check test mode.
 * Selectable from the simulator dropdowns on the settings page.
 */

export type MockScenarioId =
  | 'CLEAR_NEVER_LISTED'
  | 'CAUTION_RECENTLY_DELISTED'
  | 'CAUTION_LONG_ON_MARKET'
  | 'RED_CURRENTLY_LISTED'
  | 'RED_PRICE_DISCREPANCY'

export interface MockScenario {
  id: MockScenarioId
  label: string           // shown in the simulator dropdown
  description: string     // one-line description of what this tests
  expectedRisk: 'clear' | 'caution' | 'red_flag'
  expectedFlags: string[] // flag codes expected to be generated
}

export const MOCK_SCENARIOS: Record<MockScenarioId, MockScenario> = {
  CLEAR_NEVER_LISTED: {
    id: 'CLEAR_NEVER_LISTED',
    label: '✅ Clear — Never Listed',
    description: 'No portal history, no active listings. Tests green state.',
    expectedRisk: 'clear',
    expectedFlags: ['NEVER_LISTED'],
  },

  CAUTION_RECENTLY_DELISTED: {
    id: 'CAUTION_RECENTLY_DELISTED',
    label: '⚠️ Caution — Recently Delisted (12 days ago)',
    description: 'Was on Rightmove, removed 12 days ago. Tests sole agency amber flag.',
    expectedRisk: 'caution',
    expectedFlags: ['RECENTLY_DELISTED', 'SOLE_AGENCY_RISK'],
  },

  CAUTION_LONG_ON_MARKET: {
    id: 'CAUTION_LONG_ON_MARKET',
    label: '⚠️ Caution — Listed 120 Days, Price Reduced',
    description: 'Active but reduced listing — vendor may be motivated. Tests amber state.',
    expectedRisk: 'caution',
    expectedFlags: ['CURRENTLY_LISTED_REDUCED', 'LONG_TIME_ON_MARKET', 'SOLE_AGENCY_RISK'],
  },

  RED_CURRENTLY_LISTED: {
    id: 'RED_CURRENTLY_LISTED',
    label: '🚨 Red Flag — Currently Listed at Full Price',
    description: 'Live on Rightmove and Zoopla at asking price. Tests red banner + badge.',
    expectedRisk: 'red_flag',
    expectedFlags: ['CURRENTLY_LISTED_FULL_PRICE', 'SOLE_AGENCY_RISK'],
  },

  RED_PRICE_DISCREPANCY: {
    id: 'RED_PRICE_DISCREPANCY',
    label: '🚨 Red Flag — Price Discrepancy >10%',
    description: 'Vendor said £85k, portal shows £110k. Tests discrepancy detection.',
    expectedRisk: 'red_flag',
    expectedFlags: ['PRICE_DISCREPANCY_HIGH', 'CURRENTLY_LISTED_FULL_PRICE'],
  },
}

export const MOCK_SCENARIO_IDS = Object.keys(MOCK_SCENARIOS) as MockScenarioId[]

export function isMockScenarioId(value: string): value is MockScenarioId {
  return value in MOCK_SCENARIOS
}
