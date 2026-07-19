# Smart Cemetery Navigation and Monitoring Platform

Digitalizing burial records with multi-platform access, interactive map navigation, smart monitoring, and secure record management for **Bolonsori Public Cemetery**.

The platform replaces manual, paper-based cemetery record-keeping with a centralized, searchable system. Visitors can locate graves through an interactive map guide without staff assistance, while staff and administrators manage burial records, monitor plot availability, process requests, and generate reports through role-based dashboards secured with authentication, encryption, and audit logging.

> Aligned with **SDG 9 — Industry, Innovation, and Infrastructure** through the digital transformation of civic cemetery infrastructure.

## Overview

Cemetery record-keeping is commonly handled through physical logbooks, aging maps, and memory-based tracking, which leads to misplaced documents, inaccurate data, and difficulty locating graves — especially during peak periods such as All Saints' and All Souls' Days. This platform addresses those problems by providing:

- A centralized, searchable database of burial records (deceased name, burial date, plot number).
- An interactive visual map guide with highlighted grave markers, section/plot identifiers, and route cues.
- Smart monitoring of plot status and operational activity.
- Multi-platform access across web, mobile, and on-site kiosks.
- Secure, role-based data management with a defined records lifecycle.

## Roles and Capabilities

| Role | Capabilities |
| --- | --- |
| **Admin** | Manage cemetery layout, update grave records, approve or reject requests, send notifications, generate and export reports, manage users, oversee data security and verification. |
| **Staff** | Update and verify burial records, monitor plots, respond to record and verification needs. |
| **Client / Visitor** | Search graves, view the interactive map guide with directions, submit requests, track request status, and provide feedback. |

## Key Features

- **Searchable directory** with exact and phonetic ("fuzzy") matching by name, grave ID, or year of burial.
- **Interactive map** built on the Google Maps API with plot markers, section/plot identifiers, and pedestrian route overlays.
- **Kiosk mode** for on-site self-service navigation.
- **Role-based dashboards** for records, plots, locations, requests, verification, broadcasts, notifications, analytics, and reports.
- **Reports and exports** in CSV, PDF, and XLSX formats.
- **Notifications and broadcasts** with optional email delivery.
- **Records lifecycle policy**: records remain active for a defined retention period, then transition to a protected archive (never deleted) while staying searchable for authorized users.
- **Security controls**: authentication, role-based access control, field-level encryption for sensitive details, rate limiting, and audit logging.
- **Light and dark themes** across public and authenticated interfaces.

## Technology Stack

| Layer | Technology |
| --- | --- |
| Framework | Next.js (App Router) with React |
| Language | JavaScript |
| Styling | CSS design system (dark/light theming via CSS variables) |
| Authentication | NextAuth |
| Database | MySQL |
| ORM | Prisma |
| Mapping | Google Maps API (`@react-google-maps/api`) |
| Charts | Recharts |
| Notifications | Sonner (toasts), Nodemailer (email) |
| Testing | Vitest (unit/integration), Playwright (end-to-end) |

## Getting Started

### Prerequisites

- Node.js 18+ and npm
- A running MySQL instance (e.g., XAMPP or Laragon for local development)
- A Google Maps API key

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment variables

Copy the template and fill in your values:

```bash
cp .env.example .env.local
```

Environment variables are documented in `.env.example` (database connection, authentication secret, Google Maps API key, map center, mail settings, and seed accounts). Never commit real secrets — `.env` and `.env.local` are ignored by Git.

### 3. Set up the database

One command creates the database, applies migrations, generates the Prisma client, and seeds baseline data:

```bash
npm run db:setup
```

Individual steps are also available:

```bash
npm run db:migrate      # apply migrations
npm run db:generate     # generate Prisma client
npm run db:seed         # seed baseline data
```

### 4. Run the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Available Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start the development server |
| `npm run build` | Create a production build |
| `npm run start` | Start the production server |
| `npm run lint` | Run ESLint |
| `npm test` | Run unit and integration tests (Vitest) |
| `npm run test:e2e` | Run end-to-end tests (Playwright) |
| `npm run db:setup` | Create DB, migrate, generate client, and seed |
| `npm run db:rotate-encryption` | Rotate the encryption key for sensitive fields |

## Project Structure

```text
src/
  app/                 # App Router routes (public, dashboard, API handlers)
    api/               # Route handlers (graves, plots, reports, auth, etc.)
    dashboard/         # Authenticated role-based dashboards
    login/  search/    # Public authentication and directory search
  components/          # Shared UI, dashboard shell, map, and primitives
  lib/                 # Business logic (auth, search, encryption, analytics)
prisma/                # Prisma schema, migrations, and seed script
scripts/               # Operational scripts (db setup, encryption rotation)
e2e/                   # Playwright end-to-end tests
infrastructure/        # Routing/walkway schema and infrastructure notes
```

## Architecture

The system follows a three-tier structure within the Next.js framework:

- **Presentation tier** — role-aware React interfaces for Admin, Staff, and Client across web, mobile, and kiosk, including the interactive map.
- **Application tier** — Next.js route handlers and server logic for authentication, validation, business rules, and geospatial processing, backed by Prisma.
- **Data tier** — MySQL relational database storing graves, plots, locations, users, requests, and audit logs, with integrity enforced through indexes and relationship constraints.

## Security and Privacy

- Authentication and role-based access control (Admin, Staff, Client).
- Field-level encryption for sensitive burial details, with a key-rotation utility.
- Database-backed rate limiting on public endpoints.
- Audit logging of record changes and key interactions.
- Privacy-safe analytics that avoid exposing personal identifiers.

## License

This project is developed as an academic capstone for Bolonsori Public Cemetery. Usage and distribution are subject to the project owners' terms.
