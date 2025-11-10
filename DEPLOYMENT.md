# Santa Priscila PTAR - Deployment Guide

## Production Deployment with Docker

### Prerequisites
- Docker Engine 20.10+
- Docker Compose 2.0+
- At least 2GB RAM
- 10GB disk space

### Quick Start

1. **Clone or copy the application to your server**
   ```bash
   # Example: Copy to /opt/santapriscila
   cd /opt/santapriscila
   ```

2. **Configure environment variables**
   ```bash
   # Copy the example environment file
   cp .env.docker .env

   # IMPORTANT: Edit .env and set your JWT_SECRET
   nano .env

   # Generate a secure JWT_SECRET:
   openssl rand -base64 48
   ```

3. **Build and start the application**
   ```bash
   # Build Docker images
   docker-compose build

   # Start services
   docker-compose up -d

   # View logs
   docker-compose logs -f
   ```

4. **Access the application**
   - Frontend: http://your-server-ip
   - Backend API: http://your-server-ip:5000

5. **First login**
   - Email: `admin@santapriscila.com`
   - Password: `Admin2025!`
   - **CRITICAL: Change this password immediately after first login!**

### Security Checklist

#### Before Production Deployment

- [ ] Change JWT_SECRET in `.env` to a unique value (minimum 32 characters)
- [ ] Change default admin password after first login
- [ ] Set proper file permissions on `.env` file (`chmod 600 .env`)
- [ ] Configure firewall to only allow ports 80 and 443
- [ ] Set up SSL/TLS certificate (see HTTPS Configuration below)
- [ ] Configure regular backups of `/app/data` and `/app/uploads` volumes
- [ ] Review and customize CORS settings in `api/app.ts`
- [ ] Set up monitoring and log aggregation
- [ ] Configure automated security updates

#### Recommended Security Measures

- [ ] Use a reverse proxy (nginx) with SSL termination
- [ ] Implement rate limiting at the network level
- [ ] Set up fail2ban for brute force protection
- [ ] Enable Docker security scanning
- [ ] Regular vulnerability scanning
- [ ] Implement backup encryption
- [ ] Set up intrusion detection system (IDS)

### Database & File Management

#### Database Location
- SQLite database: Docker volume `db-data` → `/app/data/ptar.db`
- Access database:
  ```bash
  docker-compose exec backend sh
  cd data
  sqlite3 ptar.db
  ```

#### File Uploads Location
- Uploaded documents: Docker volume `uploads-data` → `/app/uploads`
- Files organized by plant name (e.g., `/app/uploads/LA LUZ/`)

#### Backup Strategy

**Daily Backups (Recommended)**:
```bash
#!/bin/bash
# backup.sh
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/backups/santapriscila"

# Create backup directory
mkdir -p $BACKUP_DIR

# Backup database
docker-compose exec -T backend sqlite3 /app/data/ptar.db ".backup '/app/data/backup.db'"
docker cp ptar-backend:/app/data/backup.db $BACKUP_DIR/ptar_$DATE.db

# Backup uploads
docker run --rm -v santapriscilaapp-working_uploads-data:/data -v $BACKUP_DIR:/backup alpine tar czf /backup/uploads_$DATE.tar.gz -C /data .

# Keep only last 30 days
find $BACKUP_DIR -type f -mtime +30 -delete

echo "Backup completed: $DATE"
```

Schedule with cron:
```bash
# Run daily at 2 AM
0 2 * * * /opt/santapriscila/backup.sh
```

### HTTPS Configuration

#### Option 1: Let's Encrypt (Recommended)

1. Install certbot:
   ```bash
   sudo apt-get install certbot python3-certbot-nginx
   ```

2. Obtain certificate:
   ```bash
   sudo certbot --nginx -d your-domain.com
   ```

3. Update docker-compose.yml to expose port 443:
   ```yaml
   frontend:
     ports:
       - "80:80"
       - "443:443"
   ```

#### Option 2: Self-Signed Certificate (Development/Testing)

```bash
# Generate self-signed certificate
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout nginx/ssl/selfsigned.key \
  -out nginx/ssl/selfsigned.crt

# Update nginx configuration to use SSL
```

### Monitoring & Maintenance

#### Health Checks
```bash
# Check service status
docker-compose ps

# View logs
docker-compose logs backend
docker-compose logs frontend

# Check health endpoints
curl http://localhost:5000/health
curl http://localhost/
```

#### Resource Monitoring
```bash
# Monitor container resources
docker stats

# Check disk usage
docker system df

# View container logs
docker-compose logs -f --tail=100
```

#### Database Maintenance
```bash
# Vacuum database (monthly recommended)
docker-compose exec backend sqlite3 /app/data/ptar.db "VACUUM;"

# Check database integrity
docker-compose exec backend sqlite3 /app/data/ptar.db "PRAGMA integrity_check;"
```

### Updating the Application

```bash
# 1. Backup current data
./backup.sh

# 2. Pull latest code
git pull origin main

# 3. Rebuild containers
docker-compose down
docker-compose build --no-cache
docker-compose up -d

# 4. Verify deployment
docker-compose logs -f
```

### Troubleshooting

#### Container won't start
```bash
# Check logs
docker-compose logs backend
docker-compose logs frontend

# Check disk space
df -h

# Check Docker resources
docker system df
```

#### Database locked error
```bash
# Stop all services
docker-compose down

# Remove lock file
docker run --rm -v santapriscilaapp-working_db-data:/data alpine rm -f /data/ptar.db-shm /data/ptar.db-wal

# Restart
docker-compose up -d
```

#### Permission issues
```bash
# Fix upload directory permissions
docker-compose exec backend chown -R nodejs:nodejs /app/uploads
docker-compose exec backend chmod 750 /app/uploads
```

#### Reset admin password
```bash
# Access container
docker-compose exec backend sh

# Run password reset script
node --loader tsx scripts/create-admin.ts
```

### Performance Tuning

#### Database Optimization
```bash
# Enable WAL mode for better concurrency
docker-compose exec backend sqlite3 /app/data/ptar.db "PRAGMA journal_mode=WAL;"

# Set cache size (8MB)
docker-compose exec backend sqlite3 /app/data/ptar.db "PRAGMA cache_size=-8000;"
```

#### Docker Resource Limits
```yaml
# Add to docker-compose.yml services
backend:
  deploy:
    resources:
      limits:
        cpus: '1.0'
        memory: 512M
      reservations:
        memory: 256M
```

### Scaling Considerations

For production deployments with high load:

1. **Database**: Consider PostgreSQL instead of SQLite for > 100 concurrent users
2. **File Storage**: Use object storage (S3, MinIO) for document uploads
3. **Load Balancing**: Deploy multiple backend instances behind nginx
4. **Caching**: Implement Redis for session management and caching
5. **CDN**: Use CloudFlare or similar for static asset delivery

### Support & Documentation

- **Admin Credentials**: admin@santapriscila.com / Admin2025! (CHANGE THIS!)
- **Security Audit Report**: See `claudedocs/SECURITY_AUDIT_REPORT.md`
- **API Documentation**: http://your-server:5000/api/docs (if enabled)
- **Frontend**: React 18 + TypeScript + Vite
- **Backend**: Node.js + Express + SQLite

### Emergency Procedures

#### Complete System Reset
```bash
# WARNING: This deletes all data!
docker-compose down -v
docker-compose up -d

# Recreate admin user
docker-compose exec backend node --loader tsx scripts/create-admin.ts

# Re-import documents (if needed)
docker-compose exec backend node --loader tsx scripts/import-documents.ts
```

#### Restore from Backup
```bash
# Stop services
docker-compose down

# Restore database
docker cp /backups/ptar_20250108.db ptar-backend:/app/data/ptar.db

# Restore uploads
docker run --rm -v santapriscilaapp-working_uploads-data:/data -v /backups:/backup alpine \
  tar xzf /backup/uploads_20250108.tar.gz -C /data

# Restart
docker-compose up -d
```

---

## Production Checklist

### Pre-Deployment
- [ ] Environment variables configured
- [ ] JWT_SECRET changed from default
- [ ] SSL certificate obtained
- [ ] Firewall rules configured
- [ ] Backup strategy implemented
- [ ] Monitoring set up

### Post-Deployment
- [ ] Admin password changed
- [ ] Health checks passing
- [ ] Backups tested
- [ ] Logs reviewed
- [ ] Performance tested
- [ ] Security scan completed

### Ongoing Maintenance
- [ ] Daily automated backups
- [ ] Weekly security updates
- [ ] Monthly database vacuum
- [ ] Quarterly security audit
- [ ] Regular backup restoration tests

---

**Last Updated**: 2025-01-08
**Version**: 1.0.0
**Contact**: admin@santapriscila.com
