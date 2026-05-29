# Architecture & Tech Stack

## Tech Stack

### Frontend (Client)
- **Framework**: React.js with Vite
- **Routing**: React Router DOM
- **State Management**: React Context API (`AuthContext` for authentication)
- **Styling**: Vanilla CSS (`index.css`) utilizing CSS variables, glassmorphism, and a modern dark/light-compatible design system.
- **HTTP Client**: Axios (configured with interceptors for global authentication handling)
- **Icons**: Google Material Symbols & react-icons

### Backend (Server)
- **Framework**: Node.js with Express.js
- **Database ORM**: Prisma Client
- **Database**: PostgreSQL (hosted/local)
- **Authentication**: JSON Web Tokens (JWT) & bcryptjs for password hashing
- **File Uploads**: Multer (configured for local disk storage with 100MB limits)
- **Background Jobs**: BullMQ and Redis for asynchronous task processing
- **AI Integration**: Google Gemini API (Multimodal) with Groq (Llama-3) fallback

---

## Directory Structure

```
ai-document-manager/
├── client/                     # Frontend Vite + React application
│   ├── src/
│   │   ├── components/         # Reusable UI components (Layouts, Modals, Previews)
│   │   ├── context/            # React Contexts (AuthContext.jsx)
│   │   ├── pages/              # Main route views (Drive, AdminPanel, Profile, Auth)
│   │   ├── utils/              # Helper functions, Axios configuration (api.js)
│   │   ├── App.jsx             # Route definitions and application entry
│   │   └── index.css           # Global design system & styles
│   └── package.json
├── server/                     # Backend Express.js application
│   ├── controllers/            # Request handlers (auth, resources, structure)
│   ├── middleware/             # Express middlewares (auth.js, role.js, upload.js)
│   ├── prisma/                 # Prisma ORM schema and seed files
│   │   └── schema.prisma       # Database schema definition
│   ├── routes/                 # Express route definitions
│   ├── uploads/                # Local directory for uploaded files
│   ├── server.js               # Express application entry point
│   └── package.json
├── docs/                       # Project documentation
└── package.json                # Root package.json (concurrently scripts)
```

---

## Database Schema (Prisma)

The application uses a highly relational PostgreSQL schema to represent the structural hierarchy of a university.

### Core Entities:

1. **User**: Represents registered accounts. Can be `STUDENT` (default), `SENIOR`, or `ADMIN`. Seniors are created with a `PENDING` status until an Admin approves them. Users can optionally be linked to a `College`.
2. **College**: The top-level structural entity. 
3. **Department**: Belongs to a College.
4. **Semester**: Belongs to a Department.
5. **Subject**: Belongs to a Semester and Department.
6. **Resource**: The uploaded files. Resources retain foreign keys to parent hierarchical entities (Semester, Department, College, User) and have a **many-to-many relationship with Subjects**. This allows a single uploaded file to be tagged to multiple subjects simultaneously, avoiding duplication.

> **Note on Cascading Deletes**: If a higher-level entity (e.g., a Department) is deleted, all its nested Semesters, Subjects, and uploaded Resources are automatically deleted via Prisma's `onDelete: Cascade` rules.

---

## Background Services (Auto-Sort)

The Auto-Sort feature uses a dedicated background worker to process large files without blocking the main Express API:
- **Queue System**: BullMQ powered by Redis handles job retries, concurrency limits (to respect LLM API limits), and state management.
- **Multimodal Parser**: Extracts raw text from PDFs (`pdf-parse`) and Office documents (`officeparser`). If a PDF is scanned (low text count), it generates images of the pages (`pdf2pic`) to feed into the multimodal LLM.
- **Classification Engine**: Prompts the LLM with the extracted content and the database's available subjects. It resolves the document to an array of Subject IDs and assigns an AI Confidence score.

---

## Frontend Navigation Architecture

The core file browsing experience (`Drive.jsx`) avoids a traditional heavy sidebar tree. Instead, it utilizes a drill-down state navigation:

1. **Root State**: Admins see a list of `Colleges`. Normal users start directly at their assigned College's `Departments`.
2. **Drill-down**: Double-clicking a card pushes the entity to the `path` state array.
3. **Breadcrumbs**: Users navigate back up the hierarchy via the breadcrumb bar at the top of the page.
4. **Data Fetching**: The component dynamically resolves the `currentLevel` (e.g., "department", "semester", "subject") based on the end of the `path` array and fetches the corresponding children from the backend.
