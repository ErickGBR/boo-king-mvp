# 📅 Boo-king — Smart Appointment Booking System

![GitHub stars](https://img.shields.io/github/stars/ErickGBR/boo-king-mvp?style=social)
![GitHub forks](https://img.shields.io/github/forks/ErickGBR/boo-king-mvp?style=social)
![GitHub issues](https://img.shields.io/github/issues/ErickGBR/boo-king-mvp)
![GitHub license](https://img.shields.io/github/license/ErickGBR/boo-king-mvp)
![GitHub last commit](https://img.shields.io/github/last-commit/ErickGBR/boo-king-mvp)

![Node.js](https://img.shields.io/badge/Node.js-22-339933?logo=node.js&logoColor=white)
![Next.js](https://img.shields.io/badge/Next.js-15-000000?logo=next.js&logoColor=white)
![NestJS](https://img.shields.io/badge/NestJS-10-E0234E?logo=nestjs&logoColor=white)
![Prisma](https://img.shields.io/badge/Prisma-5-2D3748?logo=prisma&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4-06B6D4?logo=tailwindcss&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15-4169E1?logo=postgresql&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-2496ED?logo=docker&logoColor=white)
![Jest](https://img.shields.io/badge/Jest-29-C21325?logo=jest&logoColor=white)
![Playwright](https://img.shields.io/badge/Playwright-1.42-2EAD33?logo=playwright&logoColor=white)

**GitHub Topics:**
`nestjs` `nextjs` `booking` `scheduler` `appointment` `booking-system` `appointment-scheduling` `booking-platform` `saas` `multi-tenant` `booking-app` `appointment-booking` `calendar` `booking-management` `reservation-system` `reservation-app` `booking-software` `appointment-scheduler` `multi-tenant-saas` `nestjs-api` `nextjs-app-router` `prisma-orm` `tailwindcss` `fullcalendar` `recharts` `pdf-generation` `qr-code` `qr-attendance` `i18n` `multi-language` `multi-currency` `pwa` `pwa-ready` `pwa-app` `docker` `docker-compose` `render` `postgresql` `sqlite` `prisma-orm` `nestjs-modules` `nextjs-app-router` `react` `react-19` `tailwindcss-v4` `fullcalendar-6` `recharts` `jsPDF` `qrcode` `jsQR` `sheetjs` `next-pwa` `jwt` `bcrypt` `google-oauth` `nodemailer` `class-validator` `class-transformer` `google-auth-library` `nodemailer`

> 💼 **This project is part of my developer portfolio** — it is fully open source under the [MIT License](./LICENSE). See [Author & Collaboration](#-author--collaboration).

---

## ✨ Features

- **Multi-business management** — Register and manage multiple businesses (barbershops, clinics, gyms, etc.) under a single account
- **Public booking flow** — Clients can browse available time slots and book appointments without signing up (rate-limited)
- **Services catalog** — Per-business service offerings with prices and durations, selectable during public booking
- **PDF tickets with QR codes** — Every booking generates a downloadable ticket with a scannable QR code (client-side jsPDF + qrcode)
- **QR attendance** — Staff scan ticket QRs to check in / no-show appointments in real time (camera-based via jsQR)
- **Interactive calendar** — FullCalendar integration for daily/weekly/monthly views of all appointments
- **Smart scheduling** — Configurable duration (15, 30, 45, 60, 90, 120 min), custom weekly schedules per business
- **Appointment management** — View, confirm, cancel, reschedule, and filter appointments by status
- **Reports & analytics** — Dashboard with charts (Recharts), date-range filtering with timezone-safe queries, and Excel export (SheetJS)
- **Staff management** — Add staff members with role-based access (Owner, Admin, Staff) — staff can manage appointments for their business
- **Location support** — In-person (with address display) and online (with meeting link) appointment types
- **Multi-language** — Built-in i18n with 8 languages (ES, EN, FR, DE, PT, IT, NL, CA) via i18next
- **16 Currencies** — MXN, USD, EUR, GBP, JPY, CAD, AUD, CHF, BRL, ARS, COP, CLP, PEN, UYU, CRC, DOP
- **Responsive design** — Mobile-first sidebar, responsive layouts, PWA-ready
- **Secure auth** — JWT-based authentication (HS256, 7d expiry) with bcrypt password hashing + Google OAuth
- **Forgot password flow** — Email with generated secure password (CSPRNG, 16 chars), bcrypt-hashed, fire-and-forget email
- **API protection** — Rate limiting on auth, public booking, and ticket endpoints
- **Collapsible sidebar** — Desktop collapsible (w-64 ↔ w-16), mobile drawer with scrim, accessible burger menu
- **8 Languages** — ES, EN, FR, DE, PT, IT, NL, CA (i18next)
- **PWA-ready** — Service worker, manifest, install prompt

---

## 🧱 Tech Stack

### Backend (`/backend`)

| Layer | Technology |
|---|---|
| Runtime | Node.js 22 |
| Framework | **NestJS 10** (Fastify) |
| ORM | **Prisma 5** + SQLite / PostgreSQL |
| Auth | **JWT (jsonwebtoken) HS256** + bcryptjs |
| Validation | class-validator + class-transformer |
| Email | Nodemailer |
| Google Auth | google-auth-library |
| Tests | Jest 29 + Supertest (268 tests passing) |

### Frontend (`/frontend`)

| Layer | Technology |
|---|---|
| Framework | **Next.js 15** (App Router, Server Components) |
| Styling | Tailwind CSS v4 |
| Routing | Next.js App Router (Server Components + Client Components) |
| Calendar | FullCalendar 6 |
| Charts | Recharts |
| i18n | i18next + react-i18next |
| PDF tickets | jsPDF + qrcode |
| QR scanning | jsQR |
| Excel export | SheetJS (xlsx) |
| PWA | next-pwa |
| Tests | Jest 29 + React Testing Library + Playwright (718 tests passing) |
| Icons | Custom SVG Icon system (28 icons) |

---

## 🚀 Running Locally

### Prerequisites

- Node.js >= 20
- npm / yarn

### 1. Backend

```bash
cd backend
cp .env.example .env
# Edit .env and configure at least:
# DATABASE_URL="file:./prisma/dev.db"
# JWT_SECRET=your-secret-key
# SMTP_* (optional, for email)

yarn install
yarn prisma generate
yarn prisma migrate dev
yarn run db:seed
yarn start:dev
```

The API starts at **http://localhost:4000**.

### 2. Frontend (in a separate terminal)

```bash
cd frontend
cp .env.example .env  # if exists
yarn install
yarn dev
```

The app runs at **http://localhost:3000** (Next.js proxies `/api` requests to the backend).

---

## 🐳 Docker

### Development (two containers)

```bash
# Start backend + frontend in dev mode with hot reload
docker compose up --build -d

# Backend: http://localhost:4000
# Frontend: http://localhost:3000
```

The `docker-compose.yml` mounts the source directories so changes reflect instantly via NestJS watch mode and Next.js Fast Refresh.

### Production (single container)

The root `Dockerfile` (multi-stage) builds frontend + backend into a single optimized standalone image:

```bash
# Uses the "production" profile
docker compose --profile production up --build -d

# App: http://localhost:8080
```

---

## ☁️ Render Deployment

The project ships with a `render.yaml` Blueprint for one-click deployment on [Render](https://render.com) using PostgreSQL with persistent disk.

1. Connect your GitHub repo to Render.
2. Render auto-detects `render.yaml` — create services via "New > Blueprint".
3. The root `Dockerfile` builds frontend + backend into a single container.
3. PostgreSQL is stored on a persistent disk.
4. `JWT_SECRET` is auto-generated; you can set it manually in the Dashboard.

---

## 📁 Project Structure

```
boo-king-mvp/
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma    # Data model (User, Business, Appointment, etc.)
│   │   └── seed.mjs         # Category seeder
│   ├── src/
│   │   ├── common/          # Guards, filters, decorators, validation, auth utils
│   │   ├── config/          # Configuration module
│   │   ├── middleware/      # Rate limiting middleware
│   │   ├── modules/         # Feature modules (auth, businesses, appointments, booking, calendar, categories, google, mailer, reports, services, staff, tickets)
│   │   ├── prisma/          # Prisma module & service
│   │   ├── app.module.ts    # Root module
│   │   ├── app.controller.ts
│   │   └── main.ts          # NestJS bootstrap (Fastify)
│   ├── test/                # 268 unit + e2e tests (Jest + Supertest)
│   ├── test/                # Unit & e2e tests
│   └── ...
├── frontend/
│   ├── app/                 # Next.js App Router pages & layouts
│   │   ├── (auth)/          # Auth route group (login, register)
│   │   ├── dashboard/       # Dashboard pages (appointments, businesses, calendar, etc.)
│   │   ├── b/[slug]/        # Public booking pages
│   │   ├── t/[id]/          # Public ticket pages
│   │   └── ...
│   ├── src/
│   │   ├── components/      # Reusable UI components
│   │   │   ├── ui/          # UI kit (Button, Card, Input, Modal, etc.)
│   │   │   └── shell/       # DashboardShell (sidebar, header, layout)
│   │   ├── context/         # AuthContext (client-side auth state)
│   │   ├── api/             # API client (fetch wrapper)
│   │   ├── hooks/           # Custom hooks (useMediaQuery, useIsMobile)
│   │   ├── utils/           # Utilities (ticketPdf, etc.)
│   │   ├── i18n.js          # i18n configuration (8 languages)
│   │   ├── components/ui/   # UI kit (Logo, Icon, etc.)
│   │   └── ...
│   ├── public/              # Static assets (icon, manifest)
│   ├── tests/               # 718 unit + e2e tests (Jest + Playwright)
│   └── ...
├── docker-compose.yml
├── Dockerfile               # Multi-stage (builder + standalone runner)
├── render.yaml              # Render Blueprint
└── ...
```

---

## 🔌 API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/auth/register` | Register a new user |
| POST | `/api/auth/login` | Login |
| POST | `/api/auth/forgot-password` | Request password reset (email with generated password) |
| GET | `/api/auth/me` | Get current user (JWT required) |
| PUT | `/api/auth/me` | Update profile / change password |
| POST | `/api/auth/google` | Google OAuth login |
| POST | `/api/auth/logout` | Logout (clears cookie) |
| GET | `/api/businesses` | List user's businesses |
| POST | `/api/businesses` | Create a business |
| PUT | `/api/businesses/:id` | Update business + schedule |
| GET/POST/PUT/DELETE | `/api/services` | Manage services per business (owner/admin) |
| GET/POST/DELETE | `/api/staff` | Manage staff members (owner/admin) |
| GET | `/api/appointments` | List appointments (filterable) |
| PATCH | `/api/appointments/:id/status` | Update appointment status |
| PUT | `/api/appointments/:id/reschedule` | Reschedule an appointment |
| POST | `/api/appointments/:id/checkin` | QR check-in (staff/owner) |
| POST | `/api/appointments/:id/no-show` | Mark no-show via QR scan (staff/owner) |
| GET | `/api/calendar/events` | Calendar events in date range |
| GET | `/api/reports/summary` | Statistics with date-range filtering + Excel-ready data |
| GET | `/api/tickets/:id` | Public ticket data for PDF generation |
| GET | `/api/booking/business/:slug` | Public: get business info + services |
| GET | `/api/booking/business/:slug/services` | Public: list active services |
| GET | `/api/booking/business/:slug/calendar-slots` | Public: available slots |
| POST | `/api/booking/business/:slug/reserve` | Public: book an appointment |

> Public booking and ticket endpoints are protected with rate limiting (5/15min for forgot-password, 20/15min for auth).

---

## 📊 Data Model

- **User** — account owners, admins, and staff
- **Business** — service locations with schedules and branding settings
- **BusinessSchedule** — weekly operating hours per business
- **BusinessStaff** — staff assignments with roles (Owner / Admin / Staff)
- **Service** — bookable services per business (name, price, duration)
- **Appointment** — bookings with guest info, status, and meeting links
- **Category** — business categories (e.g. Barbershop, Spa, Clinic)
- **Ticket** — PDF tickets with QR codes for appointments

---

## 🧪 Testing

```bash
# Backend (268 tests)
cd backend && yarn test

# Frontend (718 tests)
cd frontend && yarn test

# E2E (Playwright)
cd frontend && yarn test:e2e
```

---

## 📄 License

This project is licensed under the [MIT License](./LICENSE) — free to use, modify, and distribute, including commercial use.

---

## 👤 Author & Collaboration

I'm **Erick Burgos**, a Full Stack Developer from El Salvador. This project is a demonstration of my capabilities as a software developer — it is not a commercial product.

If this code helps you build something (even commercially), I'd simply love some credit for advancing the work — a mention in your project, a ⭐ on the repo, or a link back means a lot. 🙏

Interested in collaborating, contributing, or hiring me? Get in touch:

- **GitHub**: [@ErickGBR](https://github.com/ErickGBR)
- **LinkedIn**: [erickgbr](https://www.linkedin.com/in/erickgbr/)
- **Email**: [eburgos.web.developer@gmail.com](mailto:eburgos.web.developer@gmail.com)