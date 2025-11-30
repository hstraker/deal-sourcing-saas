docker run --name dealstack-postgres \
  -e POSTGRES_USER=dealstack \
  -e POSTGRES_PASSWORD=dev_password_123 \
  -e POSTGRES_DB=dealstack \
  -p 5432:5432 \
  -d postgres:15
