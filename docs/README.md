# Academic Resource Hub

A comprehensive platform designed for academic institutions to manage, share, and organize educational resources. The platform allows students to access materials and seniors/admins to upload resources, organized hierarchically by College > Department > Semester > Subject.

## Overview

The Academic Resource Hub (formerly known as "AI Document Manager") is a full-stack web application built with a modern technology stack. It provides a Google Drive-like interface for navigating and managing academic resources such as Notes, Books, PYQs (Previous Year Question Papers), Assignments, Lab manuals, and Miscellaneous reference materials.

## Features

- **Hierarchical Organization**: Navigate resources smoothly through a drill-down architecture (Colleges → Departments → Semesters → Subjects → Files).
- **Role-Based Access Control (RBAC)**:
  - **Student**: Can browse and download resources. Auto-approved upon registration.
  - **Senior**: Can upload, rename, and manage their own resources. Requires Admin approval upon registration.
  - **Admin**: Full control over all colleges, departments, subjects, users, and files. Can delete any file and approve/reject pending Senior accounts.
- **Resource Management**: 
  - Upload files up to 100MB. Batch upload up to 50 files.
  - Automatic file categorization based on extensions (PDF, Images, Documents, Code, etc.).
  - Grid and List views with sorting capabilities (Size, Name, Date).
  - Search functionality to easily find files across the entire platform.
- **AI Auto-Sort**: 
  - Bulk upload academic materials and let AI automatically organize them.
  - Powered by Google Gemini (with Groq fallback) to classify files into correct subjects and categories.
  - Handles multi-subject overlap, extracts text from PDFs/Office docs, and falls back to image-based context for scanned documents.
- **AI Study Assistant (RAG Pipeline)**:
  - Dedicated full-page chat interface to ask questions directly about uploaded documents.
  - **Local Embeddings**: Uses `Transformers.js` (`Xenova/all-MiniLM-L6-v2`) locally, ensuring zero API costs for vector embeddings.
  - **Vector Search**: Utilizes PostgreSQL's `pgvector` extension for high-performance cosine similarity semantic search.
  - **Persistent Sessions**: Chat history is saved to the database, allowing users to resume past conversations.
- **Admin Dashboard**: Manage the structure of the institution, including adding/removing Colleges, Departments, Semesters, and Subjects.

## Documentation Index

- [Architecture & Tech Stack](./architecture.md)
- [API Reference](./api.md)
- [Local Setup Guide](./setup.md)

## Tech Stack Highlights

- **Frontend**: React (Vite), React Router, Axios, CSS Modules (Custom Design System).
- **Backend**: Node.js, Express, Prisma ORM, PostgreSQL, JSON Web Tokens (JWT), Multer for file uploads.
- **Tools**: Concurrently (running both servers), Nodemon.
