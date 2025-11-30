# Setup Instructions

## Quick Start Commands

Run these commands in your WSL Ubuntu terminal:

### 1. Install Dependencies

```bash
npm install
```

### 2. Set Up Environment Variables

Copy the example environment file:

```bash
cp env.example .env
```

Edit `.env` and fill in:
- `DATABASE_URL` - Your PostgreSQL connection string
- `NEXTAUTH_SECRET` - Generate with: `openssl rand -base64 32`
- AWS credentials (for S3)
- Other service keys

### 3. Set Up Database

Generate Prisma Client:

```bash
npm run db:generate
```

Push schema to database:

```bash
npm run db:push
```

Or create a migration:

```bash
npm run db:migrate
```

### 4. Create Admin User

Create an initial admin user:

```bash
# Set environment variables (optional, defaults provided)
export ADMIN_EMAIL="admin@dealstack.com"
export ADMIN_PASSWORD="Admin123!"

# Run seed script
npm run seed:admin
```

Or create manually via Prisma Studio:

```bash
npm run db:studio
```

Then create a user with:
- Email: `admin@dealstack.com`
- Password: Hash with bcrypt (use online tool or script)
- Role: `admin`
- isActive: `true`

### 5. Start Development Server

```bash
npm run dev
```

Visit http://localhost:3000

## Troubleshooting

### Node Version Warning

If you see a warning about Node version (need >=20.9.0 for Next.js 16):
- Current: Node 18.19.1 (should work but may show warnings)
- Recommended: Upgrade to Node 20.9.0+ using nvm

To upgrade Node:
```bash
# Install nvm if not already installed
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash

# Install and use Node 20
nvm install 20
nvm use 20
```

### Database Connection Issues

Make sure PostgreSQL is running:

```bash
# Check PostgreSQL status (on Ubuntu)
sudo systemctl status postgresql

# Start PostgreSQL if not running
sudo systemctl start postgresql
```

### Prisma Issues

If you encounter Prisma errors:

```bash
# Regenerate Prisma Client
npm run db:generate

# Reset database (CAUTION: deletes all data)
npx prisma migrate reset

# Or push schema again
npm run db:push
```

### AWS S3 Setup

For development, you can use local storage or mock S3. For production:
1. Create an S3 bucket in AWS
2. Create IAM user with S3 permissions
3. Add credentials to `.env`

### NextAuth Secret

Generate a secure secret:

```bash
openssl rand -base64 32
```

Copy the output to `NEXTAUTH_SECRET` in `.env`

## Project Structure Overview

- `/app` - Next.js App Router pages and API routes
- `/components` - React components (UI and dashboard)
- `/lib` - Utility functions (auth, db, s3)
- `/prisma` - Database schema
- `/types` - TypeScript definitions
- `/scripts` - Utility scripts (seed, etc.)

## Next Steps

1. ✅ Project initialized
2. ✅ Database schema created
3. ✅ Authentication set up
4. ⏳ Create first admin user
5. ⏳ Build deal CRUD functionality
6. ⏳ Set up photo upload
7. ⏳ Create deal pipeline (Kanban board)

