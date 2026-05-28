# Local Setup Guide

Follow these instructions to run the Academic Resource Hub locally on your machine.

## Prerequisites

- **Node.js** (v18 or higher recommended)
- **PostgreSQL** (running locally or via a cloud provider)

## 1. Clone & Install Dependencies

The project uses `concurrently` to run both the frontend and backend servers together from the root directory.

1. Navigate to the root folder:
   ```bash
   cd ai-document-manager
   ```
2. Install root dependencies:
   ```bash
   npm install
   ```
3. Install backend dependencies:
   ```bash
   cd server
   npm install
   ```
4. Install frontend dependencies:
   ```bash
   cd ../client
   npm install
   ```

## 2. Environment Configuration

### Backend (`server/.env`)
Create a `.env` file in the `server` directory:

```env
# Server Port
PORT=5001

# PostgreSQL Connection String
# Replace with your actual database credentials
DATABASE_URL="postgresql://user:password@localhost:5432/academic_hub?schema=public"

# JWT Secret for signing tokens
JWT_SECRET="your_super_secret_jwt_key_here"
```

### Frontend (`client/.env` - Optional)
Vite automatically proxies `/api` requests to `http://localhost:5001` (configured in `vite.config.js`), so you usually don't need a `.env` file for local development.

## 3. Database Setup

From the `server` directory, run Prisma migrations to apply the schema to your PostgreSQL database:

```bash
cd server
npx prisma db push
```

**(Optional) Seed the Database**:
To populate the database with a default Admin account and some initial structural data (Colleges, Departments, etc.), run:
```bash
npm run seed
```

## 4. Run the Development Servers

Return to the root folder (`ai-document-manager`) and run the dev script:

```bash
npm run dev
```

This uses `concurrently` to start:
- Backend Node.js API on `http://localhost:5001`
- Frontend Vite React App on `http://localhost:3000`

## 5. Access the Application

Open your browser and navigate to `http://localhost:3000`. You can now register a new account or log in with the seeded admin credentials.
