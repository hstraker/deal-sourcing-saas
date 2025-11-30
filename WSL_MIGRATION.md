# WSL Migration Checklist

## After Moving Project to `/home/projects/deal-sourcing-saas`

### 1. Verify Project Location
```bash
cd /home/projects/deal-sourcing-saas
pwd  # Should show: /home/projects/deal-sourcing-saas
```

### 2. Reinstall Dependencies
Since you're in a new environment, it's best to reinstall:

```bash
# Remove node_modules and lock file (optional but recommended)
rm -rf node_modules package-lock.json

# Reinstall dependencies
npm install
```

### 3. Regenerate Prisma Client
```bash
npm run db:generate
```

### 4. Check Environment Variables
Make sure your `.env` file is in place and has correct paths:

```bash
# Verify .env exists
ls -la .env

# Check DATABASE_URL (if using local PostgreSQL in WSL)
# Should be something like:
# DATABASE_URL="postgresql://user:password@localhost:5432/deal_sourcing?schema=public"
```

### 5. Update Database Connection (if needed)
If your PostgreSQL is running in WSL, update DATABASE_URL to use `localhost` instead of Windows hostname.

### 6. Clear Next.js Cache
```bash
rm -rf .next
```

### 7. Verify Node.js Version
```bash
node --version  # Should be >= 18.17.0 (ideally 20.9.0+)
npm --version
```

### 8. Test Database Connection
```bash
# Start PostgreSQL if not running
sudo service postgresql status
sudo service postgresql start  # if needed

# Test with Prisma Studio
npm run db:studio
```

### 9. Start Development Server
```bash
npm run dev
```

---

## Common Issues After WSL Migration

### Issue: Permission Errors
If you see permission errors:
```bash
# Fix ownership if files were copied from Windows
sudo chown -R $USER:$USER /home/projects/deal-sourcing-saas
```

### Issue: Line Endings (CRLF vs LF)
Windows uses CRLF, Linux uses LF. Git should handle this, but if you see issues:
```bash
# Ensure Git handles line endings correctly
git config core.autocrlf input
```

### Issue: PostgreSQL Not Running
```bash
# Check status
sudo service postgresql status

# Start PostgreSQL
sudo service postgresql start

# Enable auto-start on boot
sudo systemctl enable postgresql
```

### Issue: Port Already in Use
If port 3000 is already in use:
```bash
# Find process using port 3000
lsof -i :3000

# Kill the process
kill -9 <PID>

# Or use a different port
PORT=3001 npm run dev
```

---

## Benefits of Using WSL Native Filesystem

✅ **Much faster** file operations (10-20x faster)
✅ **Better compatibility** with Unix tools
✅ **No path issues** with slashes (/ vs \)
✅ **Native symlinks** support
✅ **Better performance** with node_modules

---

## Recommended WSL Setup

### Install Node Version Manager (nvm) - Recommended
```bash
# Install nvm
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash

# Reload shell
source ~/.bashrc

# Install Node.js 20 LTS
nvm install 20
nvm use 20
nvm alias default 20
```

### Set Up PostgreSQL in WSL
```bash
# Install PostgreSQL
sudo apt update
sudo apt install postgresql postgresql-contrib

# Start PostgreSQL
sudo service postgresql start

# Create database user (optional)
sudo -u postgres psql
# Then in psql:
# CREATE USER your_user WITH PASSWORD 'your_password';
# CREATE DATABASE deal_sourcing OWNER your_user;
# \q
```

### Useful Aliases (add to ~/.bashrc)
```bash
# Quick navigation
alias projects='cd /home/projects'
alias dev='cd /home/projects/deal-sourcing-saas && npm run dev'
alias db-studio='cd /home/projects/deal-sourcing-saas && npm run db:studio'
```

---

## Quick Verification Commands

Run these to verify everything is working:

```bash
# Check Node.js
node --version
npm --version

# Check PostgreSQL
sudo service postgresql status
psql --version

# Check Prisma
npx prisma --version

# Check project files
ls -la
cat package.json | grep name

# Test database connection (update with your credentials)
psql -h localhost -U your_user -d deal_sourcing -c "SELECT 1;"
```

---

## After Migration is Complete

Once everything is working:

1. ✅ Commit any changes to Git
2. ✅ Update your `.gitignore` if needed
3. ✅ Test creating a deal (when you build that feature)
4. ✅ Test photo uploads (when you build that feature)

Your project should now perform much better in the WSL native filesystem! 🚀


