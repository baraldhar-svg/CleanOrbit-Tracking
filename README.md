# CleanOrbit Tracking - Full-Stack Monorepo

CleanOrbit-Tracking is a modern, full-stack fleet and bus tracking platform organized as a monorepo, designed for deployment on **Vercel** (Frontend & Serverless API) and **Supabase** (PostgreSQL Database).

## 🏗️ Architecture & Structure

```
CleanOrbit-Tracking/
├── apps/
│   ├── backend/         # Express API Server & Business Logic (@workspace/api-server)
│   └── frontend/        # React + Vite Web Application (@workspace/fleetsaas)
├── api/                 # Vercel Serverless Function Entry Point for Express
├── lib/
│   ├── api-client-react # React Query Hooks for API
│   ├── api-spec         # OpenAPI Specification & Codegen
│   ├── api-zod          # Zod Schemas
│   └── db               # Drizzle ORM Database Client & Supabase Connection
├── vercel.json          # Vercel Deployment Configuration
├── pnpm-workspace.yaml  # Monorepo Workspace Definitions
└── package.json         # Root Workspace Scripts
```

## 🛠️ Tech Stack

- **Frontend**: React, TypeScript, TailwindCSS, Leaflet Maps, Wouter, TanStack Query
- **Backend**: Node.js, Express, Drizzle ORM, Zod, Pino Logging
- **Database**: Supabase PostgreSQL
- **Hosting**: Vercel (Frontend & Serverless API)

## 🚀 Quick Start (Development)

1. **Install Dependencies**:
   ```bash
   pnpm install
   ```

2. **Environment Variables**:
   Copy `.env.example` to `.env` and set your Supabase PostgreSQL connection string:
   ```env
   DATABASE_URL="postgresql://postgres:[password]@db.[project-id].supabase.co:5432/postgres"
   SESSION_SECRET="your-secret-key"
   ```

3. **Push Database Schema to Supabase**:
   ```bash
   pnpm --filter @workspace/db run push
   ```

4. **Run Development Mode**:
   ```bash
   pnpm run dev
   ```

## 🌐 Deployment to Vercel

1. Import this repository into **Vercel**.
2. Add Environment Variables (`DATABASE_URL`, `SESSION_SECRET`, etc.).
3. Vercel automatically builds and hosts the React Frontend and `/api/*` Serverless Backend functions.
