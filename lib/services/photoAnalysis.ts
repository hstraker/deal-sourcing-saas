/**
 * Photo Analysis Service
 * Uses Anthropic Claude Vision to analyse property photos.
 */

import Anthropic from "@anthropic-ai/sdk"
import { fetchS3ObjectAsBase64, fetchUrlAsBase64 } from "@/lib/s3"
import { prisma } from "@/lib/db"

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

const ANALYSIS_PROMPT = `You are a property condition expert. Analyse this property photo and respond with ONLY a JSON object (no markdown, no explanation) with these exact fields:
{
  "roomType": one of "exterior" | "garden" | "kitchen" | "bathroom" | "bedroom" | "reception" | "hallway" | "utility" | "garage" | "loft" | "cellar" | "other",
  "condition": one of "excellent" | "good" | "needs_work" | "needs_modernisation" | "poor",
  "conditionScore": integer 0-100 (100=excellent, 0=derelict),
  "issues": array of short strings describing visible issues e.g. ["dated_units", "cracked_tiles", "damp_staining"],
  "description": 1-2 sentence summary of what you see and why you assigned that condition score
}`

export interface PhotoAnalysisResult {
  roomType: string
  condition: string
  conditionScore: number
  issues: string[]
  description: string
}

async function analyseImageBase64(base64: string, mediaType: string): Promise<PhotoAnalysisResult> {
  const response = await client.messages.create({
    model: "claude-opus-4-5",
    max_tokens: 512,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: {
              type: "base64",
              media_type: mediaType as "image/jpeg" | "image/png" | "image/gif" | "image/webp",
              data: base64,
            },
          },
          { type: "text", text: ANALYSIS_PROMPT },
        ],
      },
    ],
  })

  const raw = response.content.find((c) => c.type === "text")?.text ?? ""
  // Strip markdown code fences if present (e.g. ```json ... ```)
  const text = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "").trim()
  try {
    return JSON.parse(text) as PhotoAnalysisResult
  } catch {
    throw new Error(`Failed to parse AI response: ${raw}`)
  }
}

/**
 * Analyse a PropertyPhoto record (stored in S3).
 */
export async function analysePropertyPhoto(photoId: string): Promise<PhotoAnalysisResult> {
  const photo = await prisma.propertyPhoto.findUniqueOrThrow({ where: { id: photoId } })
  const { base64, contentType } = await fetchS3ObjectAsBase64(photo.s3Key)
  const result = await analyseImageBase64(base64, contentType)

  await prisma.propertyPhoto.update({
    where: { id: photoId },
    data: {
      aiRoomType: result.roomType,
      aiCondition: result.condition,
      aiConditionScore: result.conditionScore,
      aiIssues: result.issues,
      aiDescription: result.description,
      aiAnalysedAt: new Date(),
      aiRawResponse: result as any,
    },
  })

  return result
}

/**
 * Analyse a ScrapedPhoto record (portal URL — no S3 key).
 */
export async function analyseScrapedPhoto(scrapedPhotoId: string): Promise<PhotoAnalysisResult> {
  const photo = await prisma.scrapedPhoto.findUniqueOrThrow({ where: { id: scrapedPhotoId } })
  const { base64, contentType } = await fetchUrlAsBase64(photo.url)
  const result = await analyseImageBase64(base64, contentType)

  await prisma.scrapedPhoto.update({
    where: { id: scrapedPhotoId },
    data: {
      aiRoomType: result.roomType,
      aiCondition: result.condition,
      aiConditionScore: result.conditionScore,
      aiIssues: result.issues,
      aiDescription: result.description,
      aiAnalysedAt: new Date(),
    },
  })

  return result
}

/**
 * Run analysis on ALL unanalysed photos for a vendor lead, then update the lead's
 * aggregate condition score and status.
 */
export async function analyseVendorLeadPhotos(vendorLeadId: string): Promise<void> {
  await prisma.vendorLead.update({
    where: { id: vendorLeadId },
    data: { photoAnalysisStatus: "running" },
  })

  try {
    const photos = await prisma.propertyPhoto.findMany({
      where: { vendorLeadId, isDeleted: false, aiAnalysedAt: null },
    })

    for (const photo of photos) {
      try {
        await analysePropertyPhoto(photo.id)
      } catch (err) {
        console.error(
          `[photoAnalysis] Failed to analyse photo ${photo.id} (s3Key: ${photo.s3Key}):`,
          err instanceof Error ? err.message : err
        )
      }
    }

    // Re-fetch all analysed photos to compute aggregate score
    const allPhotos = await prisma.propertyPhoto.findMany({
      where: { vendorLeadId, isDeleted: false, aiConditionScore: { not: null } },
    })

    let aggregateScore: number | null = null
    if (allPhotos.length > 0) {
      aggregateScore = Math.round(
        allPhotos.reduce((sum, p) => sum + (p.aiConditionScore ?? 0), 0) / allPhotos.length
      )
    }

    await prisma.vendorLead.update({
      where: { id: vendorLeadId },
      data: {
        photoAnalysisStatus: "complete",
        photoConditionScore: aggregateScore,
        photoAnalysisCompletedAt: new Date(),
      },
    })
  } catch (err) {
    await prisma.vendorLead.update({
      where: { id: vendorLeadId },
      data: {
        photoAnalysisStatus: "failed",
        photoAnalysisNotes: err instanceof Error ? err.message : "Unknown error",
      },
    })
    throw err
  }
}

/**
 * Run analysis on ALL unanalysed scraped photos for a property listing.
 */
export async function analysePropertyListingPhotos(propertyListingId: string): Promise<void> {
  const photos = await prisma.scrapedPhoto.findMany({
    where: { propertyListingId, aiAnalysedAt: null },
  })

  for (const photo of photos) {
    try {
      await analyseScrapedPhoto(photo.id)
    } catch (err) {
      console.error(`Failed to analyse scraped photo ${photo.id}:`, err)
    }
  }
}
