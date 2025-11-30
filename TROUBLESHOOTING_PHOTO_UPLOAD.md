# Photo Upload Troubleshooting Guide

## Quick Diagnosis Steps

### 1. Verify AWS Environment Variables
Run the verification script:
```bash
npm run verify:aws
```

This will check if all required AWS variables are set in your `.env` file.

### 2. Check Browser Console
When you try to upload a photo, open your browser's Developer Console (F12) and look for:
- **Step 1**: "Requesting presigned URL for [filename]"
- **Step 2**: "Got presigned URL, uploading to S3"
- **Step 3**: "Upload to S3 successful, saving photo metadata"
- **Step 4**: "Photo X/Y completed"

If it fails at **Step 2**, the issue is likely **CORS configuration** on your S3 bucket.

### 3. Common Error Messages

#### "Network error while uploading. Check your internet connection and S3 CORS configuration."
**Cause**: CORS is not configured or incorrectly configured on your S3 bucket.

**Solution**: See "S3 CORS Configuration" below.

#### "Upload failed: 403 Forbidden"
**Cause**: AWS credentials don't have permission to upload to S3, or the presigned URL is invalid.

**Solution**: 
- Verify your AWS credentials have `s3:PutObject` permission
- Check that your bucket name matches `AWS_S3_BUCKET_NAME` in `.env`
- Ensure your region matches `AWS_REGION` in `.env`

#### "Upload failed: 404 Not Found"
**Cause**: The S3 bucket doesn't exist or the bucket name is incorrect.

**Solution**: Verify the bucket name in AWS S3 Console matches your `.env` file.

#### "Failed to get upload URL: 500"
**Cause**: Server-side error generating the presigned URL.

**Solution**: 
- Check server logs for detailed error messages
- Verify AWS credentials are correct
- Ensure the S3 bucket exists in the specified region

## S3 CORS Configuration

This is the **most common cause** of upload failures. Your S3 bucket must allow cross-origin requests from your application.

### Step-by-Step CORS Setup

1. **Go to AWS S3 Console**: https://s3.console.aws.amazon.com/

2. **Select your bucket**: `deal-sourcing-uploads` (or whatever you set in `AWS_S3_BUCKET_NAME`)

3. **Go to the "Permissions" tab**

4. **Scroll down to "Cross-origin resource sharing (CORS)"**

5. **Click "Edit"**

6. **Paste this configuration**:

```json
[
  {
    "AllowedOrigins": [
      "http://localhost:3000",
      "http://127.0.0.1:3000"
    ],
    "AllowedMethods": [
      "GET",
      "PUT",
      "POST",
      "DELETE",
      "HEAD"
    ],
    "AllowedHeaders": [
      "*"
    ],
    "ExposeHeaders": [
      "ETag",
      "x-amz-server-side-encryption",
      "x-amz-request-id",
      "x-amz-id-2"
    ],
    "MaxAgeSeconds": 3000
  }
]
```

**Important**: If you're deploying to production, add your production domain:
```json
"AllowedOrigins": [
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  "https://your-production-domain.com"
]
```

7. **Click "Save changes"**

### Verify CORS is Working

After configuring CORS, test the upload again. If you still get errors:

1. **Clear browser cache** and try again
2. **Check browser Network tab**:
   - Look for the PUT request to S3
   - Check the response headers - you should see CORS headers like `Access-Control-Allow-Origin`
3. **Check AWS CloudWatch** for S3 access logs (if enabled)

## AWS IAM Permissions

Your AWS credentials need the following permissions:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:PutObject",
        "s3:GetObject",
        "s3:DeleteObject"
      ],
      "Resource": "arn:aws:s3:::deal-sourcing-uploads/*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "s3:ListBucket"
      ],
      "Resource": "arn:aws:s3:::deal-sourcing-uploads"
    }
  ]
}
```

Replace `deal-sourcing-uploads` with your actual bucket name.

## Testing the Upload Flow

1. **Start your dev server**: `npm run dev`

2. **Navigate to a deal edit page**: `/dashboard/deals/[id]/edit`

3. **Open browser console** (F12 → Console tab)

4. **Click "Upload Photos"** and select an image

5. **Watch the console** for step-by-step logs:
   - Step 1: Requesting presigned URL
   - Step 2: Got presigned URL, uploading to S3
   - Step 3: Upload to S3 successful
   - Step 4: Photo completed

6. **Check the Network tab** (F12 → Network tab):
   - Look for `POST /api/deals/[id]/photos/presign` - should return 200
   - Look for `PUT` request to S3 (the presigned URL) - should return 200
   - Look for `POST /api/deals/[id]/photos` - should return 200

## File Size and Type Limits

- **Maximum file size**: 12 MB
- **Allowed types**: JPEG, PNG, WEBP only
- **Validation**: Happens client-side before upload

If you need to change these limits, edit:
- `components/deals/deal-photo-manager.tsx`: `MAX_FILE_SIZE_MB` and `ALLOWED_FILE_TYPES`
- `app/api/deals/[id]/photos/presign/route.ts`: `ALLOWED_FILE_TYPES`

## Still Having Issues?

1. **Check server logs**: Look at your terminal where `npm run dev` is running
2. **Check browser console**: Look for detailed error messages
3. **Verify AWS credentials**: Use AWS CLI to test:
   ```bash
   aws s3 ls s3://deal-sourcing-uploads --region eu-west-1
   ```
4. **Test presigned URL manually**: The server logs will show the presigned URL preview - you can test it with curl:
   ```bash
   curl -X PUT "PRESIGNED_URL_HERE" -H "Content-Type: image/jpeg" --data-binary @test.jpg
   ```

## Next Steps After Fixing

Once uploads are working:
1. Test with multiple photos
2. Test with different file sizes (small and large)
3. Test setting a cover photo
4. Test deleting photos
5. Verify photos appear correctly in the deal detail view

