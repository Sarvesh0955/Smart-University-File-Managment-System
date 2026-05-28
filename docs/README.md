# Academic Resource Hub

A comprehensive platform designed for academic institutions to manage, share, and organize educational resources. The platform allows students to access materials and seniors/admins to upload resources, organized hierarchically by College > Department > Semester > Subject.

## Overview

The Academic Resource Hub (formerly known as "AI Document Manager") is a full-stack web application built with a modern technology stack. It provides a Google Drive-like interface for navigating and managing academic resources such as notes, previous year question papers (PYQs), lab manuals, assignments, and reference materials.

## Features

- **Hierarchical Organization**: Navigate resources smoothly through a drill-down architecture (Colleges → Departments → Semesters → Subjects → Files).
- **Role-Based Access Control (RBAC)**:
  - **Student**: Can browse and download resources. Auto-approved upon registration.
  - **Senior**: Can upload, rename, and manage their own resources. Requires Admin approval upon registration.
  - **Admin**: Full control over all colleges, departments, subjects, users, and files. Can delete any file and approve/reject pending Senior accounts.
- **Resource Management**: 
  - Upload files up to 100MB.
  - Automatic file categorization based on extensions (PDF, Images, Documents, Code, etc.).
  - Grid and List views with sorting capabilities (Size, Name, Date).
  - Search functionality to easily find files across the entire platform.
- **Admin Dashboard**: Manage the structure of the institution, including adding/removing Colleges, Departments, Semesters, and Subjects.

## Documentation Index

- [Architecture & Tech Stack](./architecture.md)
- [API Reference](./api.md)
- [Local Setup Guide](./setup.md)

## Tech Stack Highlights

- **Frontend**: React (Vite), React Router, Axios, CSS Modules (Custom Design System).
- **Backend**: Node.js, Express, Prisma ORM, PostgreSQL, JSON Web Tokens (JWT), Multer for file uploads.
- **Tools**: Concurrently (running both servers), Nodemon.
