# ProjectPulse API

Local Express + SQL Server API that replaces the Power Automate flows behind ProjectPulse v7.
It keeps the flows' contract (`POST /flow`, `/flow2`, `/auditflow` with `{ entity, action, ... }`),
so the React app needs no code changes — only its proxy target.

## Run

```bash
npm install
cp .env.example .env      # fill in DB_SERVER, DB_NAME, DB_USER, DB_PASSWORD
npm start                 # http://localhost:3001
curl http://localhost:3001/api/health
npm run test:smoke        # offline checks, no database needed
```

The machine running this must be able to reach the SQL Server (inside the VPN / network).

## Point the frontend at it

Replace `v7/vite.config.js` with `frontend-patches/vite.config.js` (dev), then `npm run dev` in `v7/`.
For a hosted build, run `npm run build` in `v7/` and set `FRONTEND_DIST` in `.env` to the `dist` folder —
the API then serves the app and the API from one origin.

## Status

| Step | Scope | State |
|---|---|---|
| 1 | Skeleton, SQL pool, routes, health | done |
| 2 | Department, ProjectCategory, Role, DealStatus, BillingType, ApprovalStatus, ProjectStatus, InvoiceStatus, Country, Designation, Location, Currency | done |
| 3 | User, UserRoles, Client, ClientContacts, Project, ProjectResource, PipelineProject, ProjectResourceTxn | done |
| 4 | Holiday, ProjectApproval, BillingPeriod, Billing, BillingResource, Invoice, Timesheet | done |
| 5 | ProjectDocument + file download | done |
| 6 | Auth, Permission | done |
| 7 | AuditLog, NotificationLog, e-mail sending (`/auditflow`, SMTP) | done — needs `sql/001_NotificationLog.sql` run once and SMTP_* in `.env` |

Entities not built yet answer `501` with a clear message.
