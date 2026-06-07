# Database Scripts Guide

This project includes utility scripts to help manage your local database state during development.

## 1. Clearing the Database
If you want to completely wipe all data from your local database (Users, Colleges, Departments, Files, etc.), you can run the clear script.

**Important:** This is irreversible and will delete everything.

From the `server` directory, run:
```bash
npm run clear
```
*Under the hood, this runs `node prisma/clear.js` which safely cascades deletions starting from resources up to colleges and users.*

## 2. Seeding the Database
To populate your empty database with sample data, use the seed script. 

From the `server` directory, run:
```bash
npm run seed
```

This script will automatically create:
- A `System Admin` account (using credentials from `.env` or defaults)
- A base university structure (IIITA College → IT Department → Semester 6 → 5 Subjects)
- A **Temp Senior** account (using credentials from `.env` or defaults) mapped to the college
- A **Temp Junior** (Student) account (using credentials from `.env` or defaults) mapped to the college

These scripts are extremely useful for resetting your environment when testing different user roles and upload features.
