/**
 * Seed default investor pack template
 */

import { prisma } from '../lib/db'

async function seedDefaultTemplate() {
  console.log('🎨 Creating default investor pack template...\n')

  // Check if default template already exists
  const existing = await prisma.investorPackTemplate.findFirst({
    where: { isDefault: true },
  })

  if (existing) {
    console.log('✅ Default template already exists')
    console.log(`   Name: ${existing.name}`)
    console.log(`   ID: ${existing.id}`)
    await prisma.$disconnect()
    return
  }

  // Create default template
  const defaultTemplate = await prisma.investorPackTemplate.create({
    data: {
      name: 'Professional Template',
      description: 'Premium investor pack with complete property analysis, rental metrics, and market comparables. Perfect for presenting to serious investors.',
      isDefault: true,
      isActive: true,
      coverStyle: 'modern',
      colorScheme: 'blue',

      // Define sections in order
      sections: [
        { type: 'cover', enabled: true, order: 0, title: 'Property Investment Opportunity' },
        { type: 'metrics', enabled: true, order: 1, title: 'Investment Overview' },
        { type: 'property', enabled: true, order: 2, title: 'Property Details' },
        { type: 'financial', enabled: true, order: 3, title: 'Financial Breakdown' },
        { type: 'returns', enabled: true, order: 4, title: 'Investment Returns' },
        { type: 'comparables', enabled: true, order: 5, title: 'Market Analysis' },
        { type: 'cta', enabled: true, order: 6, title: 'Next Steps' },
      ],

      // Configure which metrics to show in each section
      metricsConfig: {
        cover: ['bmvPercentage', 'profitPotential', 'roi'],
        metrics: [
          'askingPrice',
          'marketValue',
          'bmvPercentage',
          'profitPotential',
          'grossYield',
          'netYield',
          'roi',
          'monthlyRent',
        ],
        financial: [
          'askingPrice',
          'refurbCost',
          'stampDuty',
          'legalFees',
          'totalInvestment',
          'profitPotential',
        ],
        returns: ['monthlyRent', 'annualRent', 'grossYield', 'netYield'],
      },
    },
  })

  console.log('✅ Created default template:')
  console.log(`   Name: ${defaultTemplate.name}`)
  console.log(`   ID: ${defaultTemplate.id}`)
  console.log(`   Sections: ${Array.isArray(defaultTemplate.sections) ? defaultTemplate.sections.length : 7}`)
  console.log('')

  // Create a minimal template
  const minimalTemplate = await prisma.investorPackTemplate.create({
    data: {
      name: 'Quick Overview',
      description: 'Concise 3-page overview focusing on key metrics and property highlights. Ideal for quick assessments.',
      isDefault: false,
      isActive: true,
      coverStyle: 'minimal',
      colorScheme: 'green',

      sections: [
        { type: 'cover', enabled: true, order: 0, title: 'Investment Opportunity' },
        { type: 'metrics', enabled: true, order: 1, title: 'Key Metrics' },
        { type: 'property', enabled: true, order: 2, title: 'Property Info' },
      ],

      metricsConfig: {
        cover: ['bmvPercentage', 'grossYield', 'profitPotential'],
        metrics: [
          'askingPrice',
          'marketValue',
          'bmvPercentage',
          'grossYield',
          'monthlyRent',
          'profitPotential',
        ],
      },
    },
  })

  console.log('✅ Created minimal template:')
  console.log(`   Name: ${minimalTemplate.name}`)
  console.log(`   ID: ${minimalTemplate.id}`)
  console.log(`   Sections: ${Array.isArray(minimalTemplate.sections) ? minimalTemplate.sections.length : 3}`)
  console.log('')

  console.log('🎉 Template seeding complete!')
  await prisma.$disconnect()
}

seedDefaultTemplate().catch((error) => {
  console.error('❌ Error seeding templates:', error)
  process.exit(1)
})
