# Local Setup Guide

Follow these instructions to run the Academic Resource Hub locally on your machine.

## Prerequisites

- **Node.js** (v18 or higher recommended)
- **PostgreSQL** (with `pgvector` extension installed. Running locally or via a cloud provider like Supabase/Neon)
- **Docker** (Highly recommended for running Redis for the Auto-Sort worker)
- **API Keys**: Google Gemini API key and Groq API key for AI classification

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

# Redis Connection (Required for Auto-Sort Background Worker)
REDIS_URL="redis://localhost:6379"

# AI Classification API Keys
GEMINI_API_KEY="your_gemini_key_here"
GROQ_API_KEY="your_groq_key_here"
AI_CONFIDENCE_THRESHOLD=80
```

### Frontend (`client/.env` - Optional)
Vite automatically proxies `/api` requests to `http://localhost:5001` (configured in `vite.config.js`), so you usually don't need a `.env` file for local development.

## 3. Database & Infrastructure Setup

If you want to use the AI Auto-Sort feature, you need a running Redis instance. You can start one using the provided Docker Compose file from the root directory:
```bash
docker compose up -d
```

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

**(Optional) Re-Embed Existing Resources**:
If you are upgrading an existing database and need to generate vector embeddings for already classified resources, run:
```bash
cd server
node scripts/reEmbed.js
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
