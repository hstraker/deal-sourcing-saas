import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3"
import { getSignedUrl } from "@aws-sdk/s3-request-presigner"

const requiredAwsEnvVars = [
  "AWS_ACCESS_KEY_ID",
  "AWS_SECRET_ACCESS_KEY",
  "AWS_REGION",
  "AWS_S3_BUCKET_NAME",
]

requiredAwsEnvVars.forEach((name) => {
  if (!process.env[name]) {
    throw new Error(
      `Missing required AWS environment variable: ${name}. Please set it in your .env file.`
    )
  }
})

const s3Client = new S3Client({
  region: process.env.AWS_REGION!,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
})

const BUCKET_NAME = process.env.AWS_S3_BUCKET_NAME!

export interface UploadFileParams {
  key: string
  body: Buffer | Uint8Array | string
  contentType: string
  metadata?: Record<string, string>
}

export async function uploadFile({
  key,
  body,
  contentType,
  metadata,
}: UploadFileParams): Promise<string> {
  const command = new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
    Body: body,
    ContentType: contentType,
    Metadata: metadata,
  })

  await s3Client.send(command)

  return getPublicUrl(key)
}

export async function deleteFile(key: string): Promise<void> {
  const command = new DeleteObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
  })

  await s3Client.send(command)
}

export async function getSignedDownloadUrl(
  key: string,
  expiresIn: number = 3600
): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
  })

  return await getSignedUrl(s3Client, command, { expiresIn })
}

export function generateS3Key(folder: string, filename: string): string {
  const timestamp = Date.now()
  const random = Math.random().toString(36).substring(2, 15)
  const sanitizedFilename = filename.replace(/[^a-zA-Z0-9.-]/g, "_")
  return `${folder}/${timestamp}-${random}-${sanitizedFilename}`
}

export function getPublicUrl(key: string) {
  return `https://${BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`
}

export async function getSignedUploadUrl(
  key: string,
  contentType: string,
  expiresIn: number = 300
) {
  try {
    const command = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
      ContentType: contentType,
    })

    const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn })
    console.log("Generated presigned URL:", {
      bucket: BUCKET_NAME,
      region: process.env.AWS_REGION,
      key,
      expiresIn,
      urlPreview: uploadUrl.substring(0, 100) + "...",
    })
    return uploadUrl
  } catch (error) {
    console.error("Error generating presigned URL:", error)
    throw new Error(
      `Failed to generate presigned URL: ${error instanceof Error ? error.message : "Unknown error"}`
    )
  }
}


