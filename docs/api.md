# API Reference

The backend exposes a RESTful API with endpoints mapped under `/api`. All protected endpoints require a `Bearer <token>` in the Authorization header.

## Authentication & User Profile (`/api/auth`)

- **POST `/auth/register`** (Public)
  - Registers a new user. Auto-approves `STUDENT`, sets `SENIOR` to `PENDING`.
- **POST `/auth/login`** (Public)
  - Authenticates a user and returns a JWT token. Fails if user is `PENDING`.
- **GET `/auth/me`** (Protected)
  - Returns the currently authenticated user's details.
- **PATCH `/auth/profile`** (Protected)
  - Updates the user's profile (e.g. `collegeId`).
- **GET `/auth/pending`** (Admin Only)
  - Lists all users with a `PENDING` status.
- **PATCH `/auth/approve/:id`** (Admin Only)
  - Approves a pending user account.
- **DELETE `/auth/reject/:id`** (Admin Only)
  - Rejects and deletes a pending user account.

## Structure Management (`/api/colleges`, `/api/departments`, etc.)

These endpoints handle the structural hierarchy of the institution. Fetching (`GET`) is generally available to all authenticated users, while modification (`POST`, `DELETE`) is restricted to Admins.

- **Colleges (`/api/colleges`)**
  - `GET /` (Public) - Fetch all colleges (needed for registration dropdown).
  - `POST /` (Admin) - Create a college.
  - `DELETE /:id` (Admin) - Delete a college.
  
- **Departments (`/api/departments`)**
  - `GET /?collegeId=...` - Fetch departments for a college.
  - `POST /` (Admin) - Create a department.
  - `DELETE /:id` (Admin) - Delete a department.

- **Semesters (`/api/semesters`)**
  - `GET /?departmentId=...` - Fetch semesters for a department.
  - `POST /` (Admin) - Create a semester.
  - `DELETE /:id` (Admin) - Delete a semester.

- **Subjects (`/api/subjects`)**
  - `GET /?semesterId=...` - Fetch subjects for a semester.
  - `POST /` (Admin) - Create a subject.
  - `DELETE /:id` (Admin) - Delete a subject.

## Resources (`/api/resources`)

These endpoints handle the actual uploaded files.

- **POST `/`** (Senior / Admin)
  - Upload a new file. Requires `multipart/form-data`.
  - Body requires: `file`, `subjectId`, `semesterId`, `departmentId`, `collegeId`.
- **GET `/`** (Protected)
  - Fetch resources for a specific subject. Supports query parameters for sorting (`sort`, `order`) and filtering (`category`).
- **GET `/search?q=...`** (Protected)
  - Search resources by name globally.
- **GET `/:id/download`** (Protected)
  - Streams the file for download.
- **PATCH `/:id/rename`** (Senior / Admin)
  - Renames a resource. Seniors can only rename their own files.
- **DELETE `/:id`** (Senior / Admin)
  - Deletes a resource and removes it from the local disk. Seniors can only delete their own files.
