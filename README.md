# Class LMS – Attendance, Assignments, Video Lessons, and Student Management

A production-grade, secure Class Learning & Student Management System (LMS) built with **Node.js, Express, TypeScript, MongoDB (Mongoose)** on the backend, and **React, TypeScript, Vite, and Tailwind CSS** on the frontend.

---

## 🚀 Key Features

### 1. Role-Based Access Control (RBAC) & Authentication
- Secure authentication using **JWT** tokens and **bcryptjs** password hashing (salt rounds: 10).
- Student logins must link to a student profile. Roles and account statuses are normalized case-insensitively; for legacy accounts missing a profile link, authentication repairs it only when the account email matches exactly one active student profile and no other student login already owns that profile. Ambiguous or unmatched records require administrator correction.
- Strict role boundaries:
  - **Administrator**: Full CRUD over classes, students, parent contacts, teacher accounts, system settings, and audit logs.
  - **Teacher**: Restricted to assigned classes and students; can record attendance registers, review histories, and view notification delivery statuses.
- Protection against brute-force login attacks using **express-rate-limit** (window: 15m, max: 10 attempts).
- Security headers enforced with **Helmet** and parameterized validation preventing NoSQL injection.

### 2. Class & Student Management
- **Classes**: Unique class codes (e.g. `G10-MATH-SAT`), subject classification, teacher assignments, and active/inactive status toggling. Hard-deletion of classes with historical attendance is prohibited.
- **Students**: Unique student admission numbers (sparse indexed), full contact details, emergency notes, and active enrollment periods.
- **Enrollments**: Connects students to classes with start/end dates. Student access checks recognize active status case-insensitively and treat a missing legacy start date as already effective; end dates are still enforced. Historical attendance is preserved upon withdrawal.

### 3. Parent / Guardian Management & Email Absence Notifications
- Many-to-many relationship: One student can have multiple guardians, and a guardian can have multiple children.
- Per-guardian preference flag: `receivesAttendanceEmails` (boolean) and `isPrimaryContact`.
- **Automated Absence Notification Queue**:
  - Automatically triggers when an attendance register is submitted/finalized.
  - Filters strictly for students marked **ABSENT** (Present, Late, and Excused do not trigger standard absence emails).
  - Deduplication key prevents duplicate emails even if attendance is submitted multiple times.
  - Background worker with exponential backoff retries (up to 3 retries) and manual retry trigger from staff dashboard.
  - Alerts staff immediately if an enrolled absent student lacks an active guardian contact email (`SKIPPED` warning).

### 4. Interactive Attendance Register & Audit History
- Administrators and assigned teachers create attendance sessions for a class, with date, time zone, opening/closing times, and topic. Sessions start unpublished and must be published before students can see or check in.
- Student sessions are loaded by the authenticated student ID and current, effective class enrollments. Check-in is verified on the server, is available only during the open window, and cannot be repeated.
- Staff attendance updates validate each student against the class roster and session date. Attendance sessions can be deleted only by administrators.
- Fast, intuitive register:
  - Quick **"Mark Unmarked as Present"** button.
  - Radio status controls: **Present**, **Absent**, **Late** (with arrival time input), and **Excused**.
  - Live counter pills updating in real time.
  - Warning modal if teacher attempts submission with unmarked students.
  - **Attendance Correction Protocol**: Submitted sessions lock regular inputs. Correcting any record requires a **mandatory explanation reason**, logged permanently to `AttendanceChangeLog`.
- **Attendance Percentage Formula (Section 9.7)**:
  $$\text{Attendance \%} = \frac{\text{Present} + \text{Late}}{\text{Present} + \text{Late} + \text{Absent}} \times 100$$
  *(Excused absences are excluded from denominator).*

### 5. Reports & Audit Logs
- **Performance Summary**: Class attendance breakdown and individual rates with CSV export.
- **Absence Log**: Audit trail of every absence incident with guardian dispatch status and CSV download.
- **Missing Guardian Contacts Audit**: Immediate identification of students who cannot receive emergency alerts.
- **Audit Logs**: Immutable log recording logins, session submissions, attendance corrections, and account modifications.

### 6. Assignments & Coursework
- **Teacher/Admin authoring**: Create and edit assignments for an authorized class, provide instructions, maximum marks, due dates, and up to 10 named learning resources.
- **Recipient targeting**: Publish to all active enrollees or select specific active students. Students only receive assignments addressed to them.
- **Publication lifecycle**: Save drafts, publish immediately, or schedule publication. Scheduled assignments are published by a server worker (checked every 30 seconds); a schedule is returned to draft if its due date passes before publication.
- **Submission rules**: Accept text, HTTP(S) links, uploaded files, or combinations according to assignment settings; configure late acceptance and resubmission limits. Each new attempt preserves the previous attempt record.
- **Private file storage**: Assignment resources and student submissions accept PDF, DOCX, JPG, PNG, and WEBP files, up to 10 MB per file (5 files per request and 25 MB combined). Files are stored outside MongoDB in `server/private-uploads` and are served only through authenticated, permission-checked download routes. Production deployments must persist and protect this directory.
- **Review and grading**: Teachers and administrators can review submissions, return eligible work for revision, and enter marks and feedback. Revision notes are shown to the student; marks and grading feedback remain hidden from students and parents until staff explicitly releases the grade.
- **Authorization and audit**: Class access and active enrollment are checked by the API. Assignment changes, submissions, grading, and publication actions are recorded in the audit log.

### 7. Video Lessons
- Teachers can manage lessons only for their assigned classes; administrators can manage all classes. Lessons include HTTPS video links, descriptions, chapter/topic and sequence metadata, resource links, and private uploaded learning files.
- New lessons can be saved as drafts, published when ready, edited, or archived. Archiving preserves progress history; student lesson lists and progress APIs expose published lessons only.
- Lesson lists, progress updates, and private resource downloads enforce the signed-in user's class access or current student enrollment on the backend. Video files are not stored in MongoDB or uploaded to the LMS; third-party video hosting is referenced by HTTPS URL. Public video-host URLs remain governed by the hosting provider's own access controls.

---

## 🛠️ Tech Stack

- **Backend**: Node.js v22+, Express.js, TypeScript, Mongoose ODM, Nodemailer, Bcryptjs, JSONWebTokens, Helmet, Express-Rate-Limit.
- **Frontend**: React 18, TypeScript, Vite, Tailwind CSS, Lucide React, React Router v6, Axios.
- Frontend HTTP requests are centralized in feature-specific TypeScript services under `client/src/api`; UI components use those services and the shared authenticated Axios client.
- **Database**: MongoDB (Server running locally or via MongoDB Atlas URI).

---

## 🏁 Quick Start Guide

### 1. Prerequisites
- Node.js (v18 or higher recommended)
- MongoDB instance running locally on `mongodb://127.0.0.1:27017` or configured via `server/.env`.

### 2. Install Dependencies
```bash
# From the project root:
npm run install:all
```

### 3. Populate Demo Database (Seed)
Run the seed script to automatically create sample administrators, teachers, classes, students, linked guardians, attendance sessions, and audit records:
```bash
npm run seed
```

### 4. Start Development Servers
Run both backend API (`http://localhost:5000`) and frontend Vite dev server (`http://localhost:5173`) concurrently:
```bash
npm run dev
```

Visit **`http://localhost:5173`** in your browser.

---

## 🔑 Default Test Credentials

| Role | Email | Password | Assigned Classes |
| :--- | :--- | :--- | :--- |
| **Administrator** | `admin@school.com` | `Admin@123456` | Full Academy Access |
| **Teacher** | `john.doe@school.com` | `Teacher@123456` | Grade 10 Math, Grade 12 Computer Science |
| **Teacher** | `sarah.connor@school.com` | `Teacher@123456` | Grade 11 Physics |

*(Quick autofill buttons are built directly into the login page for convenience).*

---

## 📡 REST API Endpoints Overview

| Method | Endpoint | Description | Access |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/auth/login` | Authenticate user & receive JWT | Public |
| `POST` | `/api/auth/logout` | Invalidate session | Authenticated |
| `GET` | `/api/auth/me` | Current profile information | Authenticated |
| `POST` | `/api/auth/change-password`| Update current user password | Authenticated |
| `GET` | `/api/users` | List teacher and admin accounts | Admin |
| `POST` | `/api/users` | Create staff account | Admin |
| `GET` | `/api/classes` | Get classes (filtered by teacher if not admin) | Teacher / Admin |
| `POST` | `/api/classes` | Create new class with unique code | Admin |
| `GET` | `/api/classes/:id/students` | Get enrolled student roster for class | Teacher / Admin |
| `GET` | `/api/classes/:id/sessions` | List attendance sessions for class | Teacher / Admin |
| `POST` | `/api/classes/:id/sessions` | Create new attendance session | Teacher / Admin |
| `POST` | `/api/classes/:id/sessions/:sessionId/publish` | Publish an attendance session to enrolled students | Assigned Teacher / Admin |
| `GET` | `/api/sessions/:id/attendance`| Get attendance register & roster | Teacher / Admin |
| `PUT` | `/api/sessions/:id/attendance`| Save register draft without finalizing | Teacher / Admin |
| `POST` | `/api/sessions/:id/submit` | Finalize register & queue parent absence emails | Teacher / Admin |
| `GET` | `/api/student/attendance/sessions` | List published sessions for the signed-in student's active enrollments | Student |
| `POST` | `/api/student/attendance/sessions/:sessionId/check-in` | Check in once during an open attendance window | Enrolled Student |
| `PATCH`| `/api/attendance/:id` | Correct attendance record with mandatory reason | Teacher / Admin |
| `GET` | `/api/notifications` | View parent absence email dispatch logs | Teacher / Admin |
| `POST` | `/api/notifications/:id/retry`| Manually retry failed email job | Staff |
| `GET` | `/api/reports/summary` | Attendance performance summary report | Staff |
| `GET` | `/api/reports/export-csv` | Stream CSV file download | Staff |
| `GET` | `/api/audit-logs` | View immutable security audit logs | Admin |
| `GET` | `/api/assignments/class/:classId` | List assignments visible to the signed-in user for a class | Authorized class member / Staff |
| `POST` | `/api/assignments` | Create a draft, published, or scheduled assignment | Teacher / Admin |
| `PATCH` | `/api/assignments/:id` | Edit assignment details and submission rules | Assigned Teacher / Admin |
| `POST` | `/api/assignments/:id/publish` | Publish a draft or scheduled assignment now | Assigned Teacher / Admin |
| `POST` | `/api/assignments/:id/cancel-schedule` | Cancel scheduled publication and return to draft | Assigned Teacher / Admin |
| `POST` | `/api/assignments/:id/archive` | Archive an assignment | Assigned Teacher / Admin |
| `POST` | `/api/assignments/:id/submit` | Submit or resubmit permitted text, link, and/or file work | Eligible Student |
| `GET` | `/api/assignments/:id/submissions` | Review submissions for an assignment | Assigned Teacher / Admin |
| `PATCH` | `/api/assignments/submissions/:submissionId/grade` | Save marks and feedback, not yet visible to student | Assigned Teacher / Admin |
| `POST` | `/api/assignments/submissions/:submissionId/release-grade` | Release saved marks and feedback | Assigned Teacher / Admin |
| `POST` | `/api/assignments/submissions/:submissionId/return` | Return eligible ungraded work with revision feedback | Assigned Teacher / Admin |
| `GET` | `/api/assignments/files/:fileId` | Download an assignment resource after access checks | Eligible Student / Assigned Teacher / Admin |
| `GET` | `/api/assignments/submission-files/:fileId` | Download a submission after access checks | Owner Student / Assigned Teacher / Admin |
| `GET` | `/api/lessons/class/:classId` | List authorized lessons for a class | Enrolled Student / Assigned Teacher / Admin |
| `POST` | `/api/lessons` | Create a draft or published lesson and upload learning resources | Assigned Teacher / Admin |
| `PATCH` | `/api/lessons/:id` | Edit or publish a lesson | Assigned Teacher / Admin |
| `DELETE` | `/api/lessons/:id` | Archive a lesson without deleting progress history | Assigned Teacher / Admin |
| `GET` | `/api/lessons/files/:fileId` | Download an uploaded lesson resource after access checks | Enrolled Student / Assigned Teacher / Admin |
| `POST` | `/api/lessons/:id/progress` | Toggle completion for an enrolled student's published lesson | Enrolled Student |
