# Installing PostgreSQL in WSL

## Step 1: Install PostgreSQL

```bash
# Update package list
sudo apt update

# Install PostgreSQL and client tools
sudo apt install postgresql postgresql-contrib

# Verify installation
psql --version
```

## Step 2: Start PostgreSQL Service

```bash
# Start PostgreSQL service
sudo service postgresql start

# Enable PostgreSQL to start on boot (optional)
sudo systemctl enable postgresql

# Check status
sudo service postgresql status
```

## Step 3: Create Database and User

```bash
# Switch to postgres user
sudo -u postgres psql
```

Once in the PostgreSQL prompt (`postgres=#`), run:

```sql
-- Create a database
CREATE DATABASE deal_sourcing;

-- Create a user (replace with your preferred username/password)
CREATE USER dealstack_user WITH PASSWORD 'your_secure_password_here';

-- Grant privileges
GRANT ALL PRIVILEGES ON DATABASE deal_sourcing TO dealstack_user;

-- For PostgreSQL 15+, you may need to grant schema privileges
\c deal_sourcing
GRANT ALL ON SCHEMA public TO dealstack_user;

-- Exit psql
\q
```

## Step 4: Update Your .env File

Update your `DATABASE_URL` in `.env`:

```env
DATABASE_URL="postgresql://dealstack_user:your_secure_password_here@localhost:5432/deal_sourcing?schema=public"
```

Replace:
- `dealstack_user` with your username
- `your_secure_password_here` with your password

## Step 5: Test Connection

```bash
# Test connection (replace with your credentials)
psql -h localhost -U dealstack_user -d deal_sourcing -c "SELECT version();"
```

## Step 6: Set Up Prisma Schema

```bash
# Generate Prisma Client
npm run db:generate

# Push schema to database
npm run db:push

# Or create a migration
npm run db:migrate
```

---

## Troubleshooting

### Issue: "peer authentication failed"
Edit PostgreSQL config to allow password authentication:

```bash
sudo nano /etc/postgresql/*/main/pg_hba.conf
```

Change this line:
```
local   all             all                                     peer
```

To:
```
local   all             all                                     md5
```

Then restart PostgreSQL:
```bash
sudo service postgresql restart
```

### Issue: PostgreSQL won't start
```bash
# Check logs
sudo tail -f /var/log/postgresql/postgresql-*-main.log

# Try starting manually
sudo -u postgres /usr/lib/postgresql/*/bin/pg_ctl -D /var/lib/postgresql/*/main start
```

### Issue: Permission denied
```bash
# Check PostgreSQL data directory permissions
sudo chown -R postgres:postgres /var/lib/postgresql
```

---

## Quick Setup Script

Run this all at once (adjust username/password):

```bash
# Install PostgreSQL
sudo apt update && sudo apt install -y postgresql postgresql-contrib

# Start service
sudo service postgresql start

# Create database and user (one-liner)
sudo -u postgres psql << EOF
CREATE DATABASE deal_sourcing;
CREATE USER dealstack_user WITH PASSWORD 'Admin123!';
GRANT ALL PRIVILEGES ON DATABASE deal_sourcing TO dealstack_user;
\c deal_sourcing
GRANT ALL ON SCHEMA public TO dealstack_user;
\q
EOF

echo "✅ PostgreSQL installed and configured!"
echo "Update your .env DATABASE_URL to:"
echo "DATABASE_URL=\"postgresql://dealstack_user:Admin123!@localhost:5432/deal_sourcing?schema=public\""
```

