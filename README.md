# Class LMS – Phase 1: Login, Class & Student Management, Attendance, and Parent Email Notifications

A production-grade, secure Class Learning & Student Management System (LMS) built with **Node.js, Express, TypeScript, MongoDB (Mongoose)** on the backend, and **React, TypeScript, Vite, and Tailwind CSS** on the frontend.

---

## 🚀 Key Features

### 1. Role-Based Access Control (RBAC) & Authentication
- Secure authentication using **JWT** tokens and **bcryptjs** password hashing (salt rounds: 10).
- Strict role boundaries:
  - **Administrator**: Full CRUD over classes, students, parent contacts, teacher accounts, system settings, and audit logs.
  - **Teacher**: Restricted to assigned classes and students; can record attendance registers, review histories, and view notification delivery statuses.
- Protection against brute-force login attacks using **express-rate-limit** (window: 15m, max: 10 attempts).
- Security headers enforced with **Helmet** and parameterized validation preventing NoSQL injection.

### 2. Class & Student Management
- **Classes**: Unique class codes (e.g. `G10-MATH-SAT`), subject classification, teacher assignments, and active/inactive status toggling. Hard-deletion of classes with historical attendance is prohibited.
- **Students**: Unique student admission numbers (sparse indexed), full contact details, emergency notes, and active enrollment periods.
- **Enrollments**: Connects students to classes with start/end dates. Preserves historical attendance upon withdrawal.

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
- Session creation with date, optional time slot, and session topic.
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

---

## 🛠️ Tech Stack

- **Backend**: Node.js v22+, Express.js, TypeScript, Mongoose ODM, Nodemailer, Bcryptjs, JSONWebTokens, Helmet, Express-Rate-Limit.
- **Frontend**: React 18, TypeScript, Vite, Tailwind CSS, Lucide React, React Router v6, Axios.
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
| `GET` | `/api/sessions/:id/attendance`| Get attendance register & roster | Teacher / Admin |
| `PUT` | `/api/sessions/:id/attendance`| Save register draft without finalizing | Teacher / Admin |
| `POST` | `/api/sessions/:id/submit` | Finalize register & queue parent absence emails | Teacher / Admin |
| `PATCH`| `/api/attendance/:id` | Correct attendance record with mandatory reason | Teacher / Admin |
| `GET` | `/api/notifications` | View parent absence email dispatch logs | Teacher / Admin |
| `POST` | `/api/notifications/:id/retry`| Manually retry failed email job | Staff |
| `GET` | `/api/reports/summary` | Attendance performance summary report | Staff |
| `GET` | `/api/reports/export-csv` | Stream CSV file download | Staff |
| `GET` | `/api/audit-logs` | View immutable security audit logs | Admin |
