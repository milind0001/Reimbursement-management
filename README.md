# Reimbursement Management System

Full-stack reimbursement platform built for hackathon evaluation. It covers company onboarding, role-based access, expense submission, multi-step approvals, OCR receipt parsing, and currency conversion.

## What Is Implemented

### Authentication and Company Onboarding
- Signup creates both a new company and its admin user in one transaction.
- Company default currency is stored during onboarding.
- JWT-based authentication for protected APIs.

### User and Role Management
- Admin can create/update/delete users.
- Supported roles: `admin`, `manager`, `employee`.
- Employee-to-manager relationship is configurable.

### Expense Submission
- Employees can submit:
  - amount and currency
  - category and description
  - expense date
  - receipt file
  - optional line items
- Expense list supports status-based and role-based visibility.

### Multi-Step Approval Workflow
- Admin defines workflows with ordered steps.
- Each step is assigned to a specific approver user.
- Approval is strictly sequential (turn-order enforced server-side).
- Approvers can approve/reject with comments.
- Every decision is recorded as an approval record (audit trail).

### Conditional Approval Rules
- Percentage threshold rule
- Specific approver rule
- Hybrid rule

### OCR and Currency Handling
- OCR via Tesseract.js to prefill expense fields from receipts.
- Currency conversion using ExchangeRate API with cache fallback.
- Converted amount is stored in company default currency for consistency.

## Workflow Clarification

The system has 3 platform roles (`admin`, `manager`, `employee`). Labels like `Finance` or `Director` are configured as approval step labels, while the underlying approver is still a real user (typically `manager` or `admin`) assigned to that step.

## Tech Stack

### Frontend
- React
- Vite
- Tailwind CSS
- Axios
- Tesseract.js

### Backend
- Node.js + Express
- Prisma ORM
- PostgreSQL
- JWT + bcrypt
- Supabase (receipt storage)

## API Summary

### Auth
- `POST /api/auth/signup`
- `POST /api/auth/login`
- `GET /api/auth/me`

### Users
- `GET /api/users`
- `POST /api/users`
- `PUT /api/users/:id`
- `DELETE /api/users/:id`

### Expenses
- `GET /api/expenses`
- `POST /api/expenses`
- `PUT /api/expenses/:id`
- `DELETE /api/expenses/:id`

### Workflows
- `GET /api/workflows`
- `POST /api/workflows`
- `PUT /api/workflows/:id`
- `DELETE /api/workflows/:id`

### Approvals
- `GET /api/approvals`
- `POST /api/approvals/:recordId/approve`
- `POST /api/approvals/:recordId/reject`

### Currencies
- `GET /api/currencies`
- `GET /api/currencies/rates/:currency`

## Local Development

### Prerequisites
- Node.js 16+
- PostgreSQL

### 1) Install Dependencies

```bash
# backend
cd server
npm install

# frontend
cd ../client
npm install
```

### 2) Configure Environment Files

Server `.env`:

```env
DATABASE_URL="postgresql://USER:PASSWORD@HOST:5432/DB_NAME"
SUPABASE_URL="https://YOUR_PROJECT.supabase.co"
SUPABASE_KEY="YOUR_SUPABASE_ANON_OR_PUBLISHABLE_KEY"
SUPABASE_SECRET="YOUR_SUPABASE_SERVICE_ROLE_OR_SECRET"
EXCHANGE_RATE_API="https://api.exchangerate-api.com/v4/latest"
PORT=5000
```

Client `.env.local`:

```env
VITE_API_URL=http://localhost:5000
```

### 3) Initialize Database

```bash
cd server
npx prisma db push
```

### 4) Run the Project

```bash
# terminal 1
cd server
npm run dev

# terminal 2
cd client
npm run dev
```

Frontend: `http://localhost:5173`
Backend: `http://localhost:5000`

## Quick API Smoke Tests

### Health Check

```bash
curl -X GET http://localhost:5000/api/health
```

### Signup

```bash
curl -X POST http://localhost:5000/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Admin User",
    "email": "admin@demo.com",
    "password": "password123",
    "companyName": "Demo Corp",
    "country": "India",
    "currencyCode": "INR",
    "currencySymbol": "₹"
  }'
```

### Login

```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@demo.com",
    "password": "password123"
  }'
```

## Evaluation Notes
- Multi-tenant boundaries are company-scoped.
- Authorization is enforced at middleware and endpoint level.
- Approval order is validated server-side (not only in UI).
- Approval actions are fully auditable via approval records.

