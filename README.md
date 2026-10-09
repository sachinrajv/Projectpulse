# ProjectPulse

```
ProjectPulse/
├── backend/    Express + SQL Server API (replaces the Power Automate flows)
├── frontend/   React + Vite app (ProjectPulse v7)
├── start-backend.bat    Windows: double-click to run the API
└── start-frontend.bat   Windows: double-click to run the app
```

## One-time setup

1. Install Node.js 20+ (LTS) from https://nodejs.org
2. In `backend/`, copy `.env.example` to `.env` and fill in your SQL Server details
   (`DB_SERVER`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`).
3. Be on the VPN / network that can reach the SQL Server.

## Run (two terminals, or the two .bat files)

```bash
# terminal 1
cd backend
npm install
npm start            # http://localhost:3001  — check http://localhost:3001/api/health

# terminal 2
cd frontend
npm install
npm run dev          # http://localhost:5173
```

The frontend's dev server forwards `/flow`, `/flow2` and `/auditflow` to the backend on port 3001
(see `frontend/vite.config.js`). No Power Automate is used any more.

## Migration status

| Step | Scope | State |
|---|---|---|
| 1 | API skeleton, SQL pool, health check | done |
| 2 | Department, ProjectCategory, Role, DealStatus, BillingType, ApprovalStatus, ProjectStatus, InvoiceStatus, Country, Designation, Location, Currency | done |
| 3 | User, Client, ClientContacts, Project, ProjectResource, PipelineProject, UserRoles, ProjectResourceTxn | next |
| 4 | Billing, BillingPeriod, BillingResource, Invoice, Timesheet, Holiday, ProjectApproval | |
| 5 | ProjectDocument + file download | |
| 6 | Auth (sign-in, reset) and Permission | |
| 7 | AuditLog, NotificationLog, email | |

Screens for entities not built yet show an error (the API answers 501). Sign-in needs step 6.
