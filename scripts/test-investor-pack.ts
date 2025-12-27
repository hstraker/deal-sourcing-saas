import { prisma } from '../lib/db'
import { generateInvestorPack } from '../lib/investor-pack-generator'
import fs from 'fs'

async function testGeneration() {
  const vendorLeadId = '9478b157-a91e-4b38-9275-e6fcd5998271' // Patience Straker

  console.log('🎨 Testing Investor Pack Generation...\n')

  // Get template
  const template = await prisma.investorPackTemplate.findFirst({
    where: { isDefault: true, isActive: true },
  })

  if (!template) {
    console.error('❌ No default template found!')
    process.exit(1)
  }

  console.log(`✓ Using template: ${template.name}`)
  console.log(`  Color scheme: ${template.colorScheme}`)
  console.log(`  Sections: ${Array.isArray(template.sections) ? template.sections.filter((s: any) => s.enabled).length : 0} enabled\n`)

  // Get vendor lead
  const vendorLead = await prisma.vendorLead.findUnique({
    where: { id: vendorLeadId },
  })

  if (!vendorLead) {
    console.error('❌ Vendor lead not found!')
    process.exit(1)
  }

  console.log(`✓ Vendor lead: ${vendorLead.vendorName}`)
  console.log(`  Property: ${vendorLead.propertyAddress}`)
  console.log(`  Price: £${Number(vendorLead.askingPrice).toLocaleString()}\n`)

  // Check for existing deal
  const existingVendor = await prisma.vendor.findFirst({
    where: { phone: vendorLead.vendorPhone },
    include: { deal: true },
  })

  let dealId: string

  if (existingVendor?.dealId && existingVendor.deal) {
    dealId = existingVendor.dealId
    console.log(`✓ Using existing deal: ${dealId}\n`)
  } else {
    console.log('Creating new deal from vendor lead...')

    // Calculate rental yields
    const monthlyRent = vendorLead.estimatedMonthlyRent ? Number(vendorLead.estimatedMonthlyRent) : 0
    const annualRent = vendorLead.estimatedAnnualRent ? Number(vendorLead.estimatedAnnualRent) : monthlyRent * 12
    const askingPriceNum = Number(vendorLead.askingPrice)
    const grossYield = askingPriceNum > 0 && annualRent > 0 ? (annualRent / askingPriceNum) * 100 : 0
    const netYield = grossYield * 0.85

    const newDeal = await prisma.deal.create({
      data: {
        address: vendorLead.propertyAddress!,
        postcode: vendorLead.propertyPostcode || undefined,
        propertyType: vendorLead.propertyType || undefined,
        bedrooms: vendorLead.bedrooms || undefined,
        bathrooms: vendorLead.bathrooms || undefined,
        squareFeet: vendorLead.squareFeet || undefined,
        askingPrice: vendorLead.askingPrice!,
        marketValue: vendorLead.estimatedMarketValue || undefined,
        estimatedRefurbCost: vendorLead.estimatedRefurbCost || undefined,
        estimatedMonthlyRent: vendorLead.estimatedMonthlyRent || undefined,
        bmvPercentage: vendorLead.bmvScore ? Number(vendorLead.bmvScore) : undefined,
        grossYield: grossYield > 0 ? grossYield : undefined,
        netYield: netYield > 0 ? netYield : undefined,
        status: 'review',
        dataSource: 'vendor_pipeline',
        agentName: vendorLead.vendorName,
        agentPhone: vendorLead.vendorPhone,
        createdById: 'test-user',
        assignedToId: 'test-user',
      },
    })

    dealId = newDeal.id
    console.log(`✓ Created deal: ${dealId}\n`)
  }

  // Generate PDF
  console.log('📄 Generating PDF...')
  const startTime = Date.now()

  try {
    const pdfBuffer = await generateInvestorPack(dealId, template)
    const duration = Date.now() - startTime

    console.log(`✓ PDF generated successfully!`)
    console.log(`  Size: ${(pdfBuffer.length / 1024).toFixed(2)} KB`)
    console.log(`  Time: ${duration}ms\n`)

    // Save to temp file
    const filename = '/tmp/test-investor-pack.pdf'
    fs.writeFileSync(filename, pdfBuffer)
    console.log(`✓ Saved to: ${filename}\n`)

    // Log generation to database
    await prisma.investorPackGeneration.create({
      data: {
        templateId: template.id,
        vendorLeadId: vendorLeadId,
        dealId: dealId,
        propertyAddress: vendorLead.propertyAddress!,
        askingPrice: vendorLead.askingPrice!,
        generatedById: 'test-user',
        fileSize: pdfBuffer.length,
      },
    })

    // Update template stats
    await prisma.investorPackTemplate.update({
      where: { id: template.id },
      data: {
        usageCount: { increment: 1 },
        lastUsedAt: new Date(),
      },
    })

    console.log('✓ Generation logged to database')
    console.log('✓ Template usage stats updated\n')

    console.log('✅ Test completed successfully!')

  } catch (error) {
    console.error('❌ Error generating PDF:', error)
    throw error
  }

  await prisma.$disconnect()
}

testGeneration()
