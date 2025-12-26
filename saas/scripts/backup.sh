#!/bin/sh
# PTAR SaaS Platform - Automated Backup Script
# Runs daily via Docker container

set -e

# Configuration
BACKUP_DIR="/backups"
DATA_DIR="/data"
RETENTION_DAYS=30
DATE=$(date +%Y-%m-%d_%H-%M-%S)
BACKUP_NAME="ptar-saas-backup-${DATE}"

echo "=========================================="
echo "PTAR SaaS Backup - $(date)"
echo "=========================================="

# Create backup directory if not exists
mkdir -p "${BACKUP_DIR}"

# Create temporary directory for this backup
TEMP_DIR="${BACKUP_DIR}/${BACKUP_NAME}"
mkdir -p "${TEMP_DIR}"

# Backup SQLite database
echo "Backing up database..."
if [ -f "${DATA_DIR}/ptar-saas.db" ]; then
    # Use SQLite's backup command for safe backup
    sqlite3 "${DATA_DIR}/ptar-saas.db" ".backup '${TEMP_DIR}/ptar-saas.db'"
    echo "  Database backed up successfully"
else
    echo "  WARNING: Database not found at ${DATA_DIR}/ptar-saas.db"
fi

# Backup uploads if they exist
if [ -d "/app/uploads" ]; then
    echo "Backing up uploads..."
    cp -r /app/uploads "${TEMP_DIR}/uploads"
    echo "  Uploads backed up successfully"
fi

# Create compressed archive
echo "Creating compressed archive..."
cd "${BACKUP_DIR}"
tar -czf "${BACKUP_NAME}.tar.gz" "${BACKUP_NAME}"
rm -rf "${TEMP_DIR}"

# Get file size
SIZE=$(du -h "${BACKUP_DIR}/${BACKUP_NAME}.tar.gz" | cut -f1)
echo "  Archive created: ${BACKUP_NAME}.tar.gz (${SIZE})"

# Cleanup old backups
echo "Cleaning up old backups (older than ${RETENTION_DAYS} days)..."
find "${BACKUP_DIR}" -name "ptar-saas-backup-*.tar.gz" -type f -mtime +${RETENTION_DAYS} -delete
REMAINING=$(ls -1 "${BACKUP_DIR}"/ptar-saas-backup-*.tar.gz 2>/dev/null | wc -l)
echo "  ${REMAINING} backups remaining"

# List current backups
echo ""
echo "Current backups:"
ls -lh "${BACKUP_DIR}"/ptar-saas-backup-*.tar.gz 2>/dev/null || echo "  No backups found"

echo ""
echo "=========================================="
echo "Backup completed successfully!"
echo "=========================================="
