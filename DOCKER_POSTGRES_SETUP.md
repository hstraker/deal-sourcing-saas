# Docker PostgreSQL Setup for WSL

## Your Docker PostgreSQL Container

Based on `docker-start.sh`, your container uses:
- **Container name:** `dealstack-postgres`
- **User:** `dealstack`
- **Password:** `dev_password_123`
- **Database:** `dealstack`
- **Port:** `5432` (mapped to host)

## DATABASE_URL for .env

Your `.env` file should have:

```env
DATABASE_URL="postgresql://dealstack:dev_password_123@localhost:5432/dealstack?schema=public"
```

## Starting PostgreSQL Docker Container

```bash
# Start the container (if not running)
./docker-start.sh

# Or manually:
docker run --name dealstack-postgres \
  -e POSTGRES_USER=dealstack \
  -e POSTGRES_PASSWORD=dev_password_123 \
  -e POSTGRES_DB=dealstack \
  -p 5432:5432 \
  -d postgres:15
```

## Managing the Container

```bash
# Check if container is running
docker ps | grep dealstack-postgres

# Start container (if stopped)
docker start dealstack-postgres

# Stop container
docker stop dealstack-postgres

# Restart container
docker restart dealstack-postgres

# View logs
docker logs dealstack-postgres

# Remove container (to start fresh)
docker rm -f dealstack-postgres
```

## Testing Connection from WSL

```bash
# Install PostgreSQL client in WSL (if not installed)
sudo apt update
sudo apt install -y postgresql-client

# Test connection
psql -h localhost -p 5432 -U dealstack -d dealstack -c "SELECT version();"
# Password: dev_password_123
```

## Prisma Setup

Once the container is running:

```bash
# Generate Prisma Client
npm run db:generate

# Push schema to database
npm run db:push

# Or create a migration
npm run db:migrate

# Create admin user
npm run seed:admin
```

## Troubleshooting

### Issue: Can't connect to localhost:5432
Make sure Docker is running and the container is started:
```bash
docker ps
docker start dealstack-postgres
```

### Issue: Connection refused
Check if the port is already in use:
```bash
sudo netstat -tulpn | grep 5432
# Or
sudo lsof -i :5432
```

### Issue: Container won't start
Check Docker logs:
```bash
docker logs dealstack-postgres
```

### Issue: "peer authentication failed"
This shouldn't happen with Docker, but if it does, make sure you're using:
- Host: `localhost` (not `127.0.0.1` or Docker container name)
- User: `dealstack`
- Password: `dev_password_123`

