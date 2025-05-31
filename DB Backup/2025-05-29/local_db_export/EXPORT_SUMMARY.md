# Local Database Export Summary
**Date:** May 29, 2025  
**Database:** opps_management (PostgreSQL)  
**Host:** localhost:5432  
**User:** reuelrivera

## Exported Files

### SQL Dumps
- **complete_backup.sql** (163 KB) - Complete database backup with schema and data
- **schema.sql** (9.9 KB) - Database schema only (table structures, indexes, constraints)
- **data.sql** (153 KB) - Data only (all table data in INSERT statements)

### CSV Exports
| Table Name | Records | File Size | Description |
|------------|---------|-----------|-------------|
| opps_monitoring | 414 | 134 KB | Main opportunities data |
| users | 10 | 2.2 KB | User accounts and authentication |
| forecast_revisions | 49 | 4.7 KB | Forecast change history |
| user_column_preferences | 3 | 2.4 KB | User column visibility settings |
| opportunity_revisions | 2 | 868 bytes | Opportunity change history |
| user_roles | 3 | 133 bytes | User role assignments |
| roles | 3 | 39 bytes | Role definitions |

## Database Structure
- **Main Table:** opps_monitoring (414 opportunities)
- **User Management:** users, roles, user_roles
- **Audit Trails:** opportunity_revisions, forecast_revisions
- **User Preferences:** user_column_preferences

## Usage
- **complete_backup.sql**: Use with `psql -f complete_backup.sql` to restore entire database
- **CSV files**: Can be imported into Excel, Google Sheets, or other databases
- **schema.sql**: Use to recreate table structures in a new database
- **data.sql**: Use to populate an existing database with current data

## Export Commands Used
```bash
# Schema only
pg_dump -U reuelrivera -h localhost -p 5432 -d opps_management --schema-only -f schema.sql

# Data only
pg_dump -U reuelrivera -h localhost -p 5432 -d opps_management --data-only -f data.sql

# Complete backup
pg_dump -U reuelrivera -h localhost -p 5432 -d opps_management -f complete_backup.sql

# CSV exports
psql -U reuelrivera -h localhost -p 5432 -d opps_management -c "\COPY [table_name] TO '[table_name].csv' CSV HEADER;"
```
