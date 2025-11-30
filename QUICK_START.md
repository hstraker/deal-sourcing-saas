# Quick Start Guide

## After Installing Dependencies

1. **Clear Next.js cache:**
   ```bash
   rm -rf .next
   ```

2. **Set up your `.env` file:**
   ```bash
   cp env.example .env
   ```
   
   Edit `.env` and set at minimum:
   - `DATABASE_URL` - Your PostgreSQL connection string
   - `NEXTAUTH_SECRET` - Generate with: `openssl rand -base64 32`

3. **Set up database:**
   ```bash
   npm run db:generate
   npm run db:push
   ```

4. **Create admin user:**
   ```bash
   npm run seed:admin
   ```
   
   Or set custom credentials:
   ```bash
   export ADMIN_EMAIL="admin@dealstack.com"
   export ADMIN_PASSWORD="YourSecurePassword123!"
   npm run seed:admin
   ```

5. **Start dev server:**
   ```bash
   npm run dev
   ```

6. **Login:**
   - Go to http://localhost:3000/login
   - Use the admin credentials you created

## Troubleshooting

### Deprecation Warnings
The npm warnings about deprecated packages are harmless. They're from dependencies and don't affect functionality.

### If you see build errors:
```bash
rm -rf .next node_modules
npm install
npm run dev
```

### Database Connection Issues
Make sure PostgreSQL is running:
```bash
sudo systemctl status postgresql
sudo systemctl start postgresql
```

### Missing NEXTAUTH_SECRET
Generate one:
```bash
openssl rand -base64 32
```
Copy the output to your `.env` file.

Not implemented (require projections/time)
These need time projections or mortgage data:
IRR (Internal Rate of Return) — needs 10-year cash flow projections
Equity Multiple — needs total return over holding period
DCR (Debt Coverage Ratio) — needs mortgage payment info
Long Term ROI — needs appreciation projections
Equity in X years — needs property appreciation rates

