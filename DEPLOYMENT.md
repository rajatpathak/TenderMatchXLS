# TenderMatch - Production Deployment Guide

This guide covers deploying TenderMatch on a VPS server.

## Prerequisites

- Node.js 20.x or later
- PostgreSQL 14.x or later
- npm or yarn
- (Optional) Nginx for reverse proxy
- (Optional) PM2 for process management

## Quick Start

### 1. Clone and Install

```bash
git clone <your-repo-url> tendermatch
cd tendermatch
npm install
```

### 2. Set Up PostgreSQL

```bash
# Create database
sudo -u postgres createdb tendermatch
sudo -u postgres createuser tendermatch_user -P

# Grant privileges
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE tendermatch TO tendermatch_user;"
```

### 3. Configure Environment

```bash
# Copy example environment file
cp .env.example .env

# Generate session secret
openssl rand -base64 32
# Copy the output to SESSION_SECRET in .env

# Generate admin password hash
node scripts/generate-password-hash.js your-secure-password
# Copy the output to ADMIN_PASSWORD_HASH in .env

# Edit .env with your database credentials
nano .env
```

### 4. Initialize Database

```bash
# Push schema to database
npm run db:push

# Seed initial data
npx tsx scripts/seed.ts
```

### 5. Build and Start

```bash
# Build production bundle
npm run build

# Start production server
npm start
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `SESSION_SECRET` | Yes | Random string for session encryption (32+ chars) |
| `ADMIN_PASSWORD_HASH` | Yes* | Bcrypt hash of admin password |
| `ADMIN_USERNAME` | No | Admin username (default: admin) |
| `ADMIN_EMAIL` | No | Admin email address |
| `NODE_ENV` | No | Set to "production" for production mode |
| `PORT` | No | Server port (default: 5000) |

*In development, you can use `ADMIN_PASSWORD` instead of hash.

## Production Setup with PM2

```bash
# Install PM2 globally
npm install -g pm2

# Start with PM2
pm2 start dist/index.js --name tendermatch

# Enable startup script
pm2 startup
pm2 save

# Monitor
pm2 logs tendermatch
pm2 monit
```

## Nginx Reverse Proxy

Create `/etc/nginx/sites-available/tendermatch`:

```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://127.0.0.1:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        
        # File upload size limit (100MB for Excel files)
        client_max_body_size 100M;
    }
}
```

Enable and restart:

```bash
sudo ln -s /etc/nginx/sites-available/tendermatch /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

## SSL with Certbot

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
```

## Updating the Application

```bash
# Pull latest changes
git pull origin main

# Install any new dependencies
npm install

# Rebuild
npm run build

# Push any schema changes
npm run db:push

# Restart with PM2
pm2 restart tendermatch
```

## Troubleshooting

### Database Connection Issues

```bash
# Test connection
psql $DATABASE_URL -c "SELECT 1"

# Check PostgreSQL status
sudo systemctl status postgresql
```

### Application Won't Start

```bash
# Check logs
pm2 logs tendermatch

# Verify environment
node -e "console.log(process.env.DATABASE_URL ? 'DB OK' : 'DB Missing')"
```

### Session Issues

- Ensure `SESSION_SECRET` is set
- Check that PostgreSQL session table exists:
  ```sql
  SELECT * FROM sessions LIMIT 1;
  ```

## Security Checklist

- [ ] Strong admin password (8+ chars, mixed case, numbers, symbols)
- [ ] Unique SESSION_SECRET (generated, not default)
- [ ] PostgreSQL user has minimal required privileges
- [ ] Firewall configured (only 80/443 open)
- [ ] SSL/TLS enabled
- [ ] Regular backups configured
- [ ] Environment file permissions restricted (`chmod 600 .env`)

## Backup and Restore

### Backup

```bash
# Database backup
pg_dump $DATABASE_URL > backup_$(date +%Y%m%d).sql

# Application backup
tar -czf tendermatch_backup.tar.gz --exclude=node_modules --exclude=dist .
```

### Restore

```bash
# Restore database
psql $DATABASE_URL < backup_20241126.sql
```
