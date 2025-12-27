import { prisma } from '../lib/db'

async function checkStats() {
  console.log('📊 Checking Investor Pack Statistics...\n')

  // Get total generated
  const totalGenerated = await prisma.investorPackGeneration.count()

  // Get last 30 days
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
  const last30Days = await prisma.investorPackGeneration.count({
    where: { createdAt: { gte: thirtyDaysAgo } },
  })

  // Get last 7 days
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
  const last7Days = await prisma.investorPackGeneration.count({
    where: { createdAt: { gte: sevenDaysAgo } },
  })

  console.log('Generation Statistics:')
  console.log(`  Total generated: ${totalGenerated}`)
  console.log(`  Last 30 days: ${last30Days}`)
  console.log(`  Last 7 days: ${last7Days}\n`)

  // Get most used template
  const templatesUsage = await prisma.investorPackGeneration.groupBy({
    by: ['templateId'],
    _count: true,
    orderBy: { _count: { templateId: 'desc' } },
    take: 1,
  })

  if (templatesUsage.length > 0 && templatesUsage[0].templateId) {
    const template = await prisma.investorPackTemplate.findUnique({
      where: { id: templatesUsage[0].templateId },
      select: { name: true, usageCount: true },
    })

    console.log('Most Used Template:')
    console.log(`  Name: ${template?.name}`)
    console.log(`  Times used: ${templatesUsage[0]._count}`)
    console.log(`  Usage count field: ${template?.usageCount}\n`)
  }

  // Get recent generations
  const recentGenerations = await prisma.investorPackGeneration.findMany({
    orderBy: { createdAt: 'desc' },
    take: 5,
    include: {
      template: { select: { name: true } },
    },
  })

  console.log('Recent Generations:')
  recentGenerations.forEach((gen, i) => {
    const fileSize = gen.fileSize ? (gen.fileSize / 1024).toFixed(2) : 'N/A'
    console.log(`  ${i + 1}. ${gen.propertyAddress}`)
    console.log(`     Template: ${gen.template?.name || 'N/A'}`)
    console.log(`     Price: £${Number(gen.askingPrice).toLocaleString()}`)
    console.log(`     Size: ${fileSize} KB`)
    console.log(`     Generated: ${gen.createdAt.toLocaleString()}`)
    console.log('')
  })

  await prisma.$disconnect()
}

checkStats()
