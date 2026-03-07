export { MOCK_SCENARIOS, MOCK_SCENARIO_IDS, isMockScenarioId } from './mock-scenarios'
export type { MockScenarioId, MockScenario } from './mock-scenarios'
export { getMockForSaleResult, getMockListingHistoryResult, getMockOwnershipData } from './mock-responses'
export type { MockOwnershipData } from './mock-responses'

/** Returns true when the lead was created by either simulator */
export function isTestLead(lead: { isTest?: boolean; leadSource?: string }): boolean {
  return lead.isTest === true || lead.leadSource === 'simulator'
}

/** Returns the validated scenario ID from a lead, or null */
export function getTestScenario(
  lead: { testScenario?: string | null }
): import('./mock-scenarios').MockScenarioId | null {
  if (!lead.testScenario) return null
  const { isMockScenarioId } = require('./mock-scenarios')
  return isMockScenarioId(lead.testScenario) ? lead.testScenario as import('./mock-scenarios').MockScenarioId : null
}

/** True when the orchestrator should return mock data instead of calling real APIs */
export function shouldUseMockData(lead: {
  isTest?: boolean
  leadSource?: string
  testScenario?: string | null
}): boolean {
  return isTestLead(lead) && lead.testScenario != null
}
