# FlowMerce

**AI-Powered E-Commerce Website Builder**

A full-stack platform that enables merchants to create, customize, and manage online stores with AI-powered assistance, secure payments, real-time notifications, and scalable cloud-native architecture.

![CI](https://github.com/Kareemahmed2/FlowMerce/actions/workflows/ci.yml/badge.svg)

---

## 🌐 Live Demo

|                | |
|----------------|--|
| **Website**    | https://flowmerce.tech |
| **API Health** | https://api.flowmerce.tech/api/v1/actuator/health |
| **Demo Video** | https://drive.google.com/drive/folders/19xq7_59KWsOkEdQ-FLjNVEoPkeDI3EkD |
---

## Table of Contents

- [Overview](#overview)
- [Key Features](#key-features)
- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [System Modules](#system-modules)
- [AI Features](#ai-features)
- [Security](#security)
- [Infrastructure & DevOps](#infrastructure--devops)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [Docker Deployment](#docker-deployment)
- [CI Pipeline](#ci-pipeline)
- [Cloudflare Production Setup](#cloudflare-production-setup)
- [Engineering Decisions](#engineering-decisions)
- [Future Improvements](#future-improvements)
- [Team](#team)

---

## Overview

FlowMerce is a graduation project that simplifies the process of creating and managing e-commerce websites. Instead of building an online store from scratch, merchants can generate and customize a professional storefront while managing products, orders, payments, shipping, analytics, notifications, and customers through one platform.

The project follows a modular backend architecture with a modern React-based frontend and production-ready DevOps practices — deployed on a real public domain with HTTPS.

---

## Key Features

**Authentication & User Management**
- JWT Authentication + 30-day refresh tokens
- Google OAuth & Facebook OAuth
- Email verification & password reset
- Role-based access control (Admin / Merchant / Customer)
- Scoped httpOnly cookies preventing session collision

**Merchant Dashboard**
- 5-step store builder with AI design review
- Product & inventory management
- Order tracking & customer insights
- Sales dashboard & analytics

**Customer Features**
- Product browsing, search, cart, wishlist
- Checkout, order tracking, reviews & ratings
- Customer wallet & notification center

**Payments**
- Paymob, Stripe, Fawry — Strategy Pattern for easy extensibility
- Redis idempotency keys blocking duplicate charges
- Wallet simulation & payment status tracking

**Shipping**
- DHL, Aramex, Bosta integration
- Label generation & delivery tracking
- Shipping cost calculation

**Notifications**
- Real-time SSE push notifications
- Email notifications via Gmail SMTP
- RabbitMQ async event messaging — persisted before delivery so nothing is lost on disconnect

**File Storage**
- MinIO S3-compatible object storage
- Product images & store logos served via `media.flowmerce.tech`

**Analytics**
- Sales reports, revenue statistics
- Customer analytics & merchant dashboard metrics

---

## Architecture

```
User
 │
 ▼
Cloudflare DNS + SSL (HTTPS)
 │
 ▼
Cloudflare Tunnel
 │
 ▼
Host Machine (Server)
 │
 ├── Next.js Frontend      :3000
 └── Spring Boot Backend   :8080
          │
          ├── PostgreSQL   (Supabase — Frankfurt)
          ├── Redis        :6379   (cache + rate limiting)
          ├── RabbitMQ     :5672   (async notifications)
          └── MinIO        :9000   (file storage)
```

**Subdomain structure:**

| Subdomain | Service |
|-----------|---------|
| `flowmerce.tech` | Next.js Frontend |
| `api.flowmerce.tech` | Spring Boot API |
| `media.flowmerce.tech` | MinIO File Storage |
| `*.flowmerce.tech` | Dynamic store storefronts |

---

## Tech Stack

**Frontend**
- Next.js 14 · React · TypeScript · Tailwind CSS · Shadcn UI

**Backend**
- Java 21 · Spring Boot 3 · Spring Security · Spring Data JPA · Hibernate · Maven

**Database & Storage**
- PostgreSQL (Supabase) · Redis · RabbitMQ · MinIO

**Authentication**
- JWT · OAuth2 · Google Login · Facebook Login

**DevOps**
- Docker · Docker Compose · GitHub Actions · Cloudflare Tunnel · Namecheap Domain

---

## Project Structure

```
FlowMerce/
│
├── frontend/
│   ├── app/
│   │   ├── dashboard/          # Merchant dashboard
│   │   ├── store/[slug]/       # Customer storefront
│   │   └── admin/              # Admin panel
│   ├── components/
│   ├── hooks/
│   ├── lib/
│   ├── middleware.ts            # Subdomain → /store/[slug] rewrite
│   └── Dockerfile
│
├── Back end/
│   ├── src/main/java/com/example/flowmerceproject/
│   │   ├── UserManagement/         # Auth, JWT, OAuth2, sessions
│   │   ├── StoreManagement/        # Stores, settings, integrations
│   │   ├── ProductManagement/      # Products, categories, media
│   │   ├── InventoryManagement/    # Stock, transactions
│   │   ├── OrderManagement/        # Orders, items, lifecycle
│   │   ├── PaymentManagement/      # Gateways, invoices, wallet
│   │   ├── ShippingManagement/     # Carriers, shipments
│   │   ├── NotificationManagement/ # SSE, email, RabbitMQ
│   │   ├── StorefrontCustomization/# Pages, components, themes
│   │   └── FileManagement/         # MinIO integration
│   ├── Dockerfile
│   ├── compose.yaml
│   └── .env.example
│
└── .github/
    └── workflows/
        └── ci.yml
```

---

## System Modules

- Authentication & Session Management
- User Management (Admin / Merchant / Customer)
- Store & Settings Management
- Product & Category Management
- Inventory Management
- Cart & Wishlist
- Order Management
- Payment Management
- Shipping Management
- Notification Management (SSE + Email + RabbitMQ)
- Storefront Customization
- File Storage (MinIO)
- Analytics & Reporting
- Integration Management (per-store payment & shipping credentials)

---

## AI Features

FlowMerce integrates AI to enhance the merchant experience:

- **AI Store Design Review** — Groq-powered analysis of brand colors and layout during onboarding
- **AI Design Suggestions** — Real-time recommendations for storefront customization
- **AI-Generated Content Support** — Assistance for product descriptions and store copy

---

## Security

- JWT stateless authentication + 30-day refresh tokens
- Scoped httpOnly cookies — prevents merchant/customer session collision in one browser
- Role re-checked from DB on every request → instant token revocation
- BCrypt password hashing
- Role-based authorization (ADMIN / MERCHANT / CUSTOMER)
- Redis rate limiting on all API endpoints
- Environment variable secrets — nothing committed to source code
- HTTPS enforced via Cloudflare on all subdomains
- Optimistic locking (JPA `@Version`) prevents overselling under concurrency
- Redis idempotency keys block duplicate payment charges

---

## Infrastructure & DevOps

**Containerization**
- Docker + Docker Compose — all 5 services start with one command
- Identical environment between development and production

**Continuous Integration (GitHub Actions)**

Every push to `master` automatically runs:
1. Backend build & test (Java 21 + Maven)
2. Frontend build (Node 20 + Next.js)
3. Docker Compose config validation

**Production Deployment**

```
Internet
    │
Cloudflare (DNS + SSL)
    │
Cloudflare Tunnel
    │
Host Machine
    │
Docker Compose
    │
Backend + Frontend + Redis + RabbitMQ + MinIO
```

Benefits: HTTPS, domain mapping, hidden origin IP, secure tunnel, no port-forwarding required.

---

## Getting Started

```bash
# 1. Clone the repo
git clone https://github.com/Kareemahmed2/FlowMerce.git
cd FlowMerce

# 2. Set up environment variables
cp "Back end/.env.example" "Back end/.env"
# Fill in the required secrets

# 3. Start all services
cd "Back end"
docker compose up --build
```

**Available at:**

| Service | URL |
|---------|-----|
| Frontend | http://localhost:3000 |
| Backend API | http://localhost:8080/api/v1 |
| MinIO Console | http://localhost:9001 |
| RabbitMQ UI | http://localhost:15672 |

---

## Docker Deployment

```bash
# Start all services
docker compose up -d --build

# Stop all services
docker compose down

# View logs
docker compose logs -f

# View specific service logs
docker logs backend-backend-1
```

---

## CI Pipeline

GitHub Actions runs on every push to `master`:

```
Push to master
      │
      ▼
Backend Build & Test  (Java 21 + Maven)
      │
      ▼
Frontend Build        (Node 20 + Next.js)
      │
      ▼
Docker Compose Validate
      │
      ▼
✅ Pipeline passes
```

Pipeline status is visible under the repository's **Actions** tab.

---

## Cloudflare Production Setup

**Live domain:** https://flowmerce.tech

Setup includes:
- Namecheap domain registration (`flowmerce.tech`)
- Cloudflare DNS management + nameserver delegation
- Cloudflare Tunnel (`cloudflared`) running as a Windows service
- Automatic HTTPS / SSL for all subdomains
- Wildcard DNS record (`*.flowmerce.tech`) for dynamic store subdomains

---

## Future Improvements

- Kubernetes deployment & auto-scaling
- Terraform infrastructure as code
- AWS / Hetzner VPS migration
- Monitoring with Prometheus & Grafana
- AI store generation from text prompt
- Mobile application (React Native)
- Multi-currency support

---

**Supervisors:** Prof. Khaled Wassif · Dr. Rasha Elbanna

---

## 🔗 Project Links

| | |
|---|---|
| 🌍 Website | https://flowmerce.tech |
| 💻 Repository | https://github.com/Kareemahmed2/FlowMerce |
| ⚙️ API Health | https://api.flowmerce.tech/api/v1/actuator/health |

---