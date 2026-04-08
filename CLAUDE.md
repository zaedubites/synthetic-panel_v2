# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Synthetic Panel is an AI-powered focus group simulation platform. Users create synthetic personas with detailed psychological profiles, organize them into panels, and run moderated discussions to gather qualitative research insights. The system uses Azure OpenAI for persona responses, ElevenLabs for voice synthesis, and Replicate for avatar generation.

## Repository Structure

This is a monorepo with two independent applications:

- **`synthetic-panel-api/`** — Python/FastAPI backend (port 8003)
- **`synthetic-panel-fe/`** — React/Vite frontend (port 3004)

## Development Commands

### Backend (synthetic-panel-api/)

```bash
# Install dependencies
pip install -r requirements.txt

# Run dev server
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8003

# Database migrations
alembic upgrade head              # Apply all migrations
alembic revision --autogenerate -m "description"  # Create migration
alembic downgrade -1              # Rollback one migration

# API docs available at http://localhost:8003/docs
```

### Frontend (synthetic-panel-fe/)

```bash
npm install
npm run dev       # Dev server on port 3004
npm run build     # Production build
npm run lint      # ESLint (zero warnings enforced)
```

### Environment Setup

Both apps require `.env` files — copy from `.env.example` in each directory.

## Architecture

### Backend

**Framework:** FastAPI with async SQLAlchemy 2.0, asyncpg, PostgreSQL with pgvector.

**Multi-tenancy:** All resources are scoped by `organization_id`. The `OrganizationFilter` dependency (in `auth.py`) enforces org-level isolation on every query. Super admins bypass filtering.

**Authentication:** JWT with RS256 public key validation. Tokens come from an external auth-service. The `TokenPayload` carries org context, roles, and permissions.

**Database:** Uses PostgreSQL multi-schema design — tables live in `synthetic_panel` schema, with cross-schema references to `platform.knowledge_groups` and `platform.knowledge_group_analyses`. Connection uses `NullPool` for Supabase/serverless compatibility. Alembic manages migrations with async support.

**Core domain flow (panel conversation):**
1. `PanelConversationEngine.process_user_message()` receives user input
2. `_select_responders()` picks personas using weighted randomness with diversity scoring
3. `PersonaContextBuilder` assembles detailed system prompts (identity, personality, archetype, psychological framework, knowledge context)
4. Persona responses generated concurrently via `AIService` (Azure OpenAI GPT-4o)
5. Optional moderator interventions (introductions, follow-ups)
6. All messages persisted with role tagging (USER, MODERATOR, PERSONA)

**Service layer:** Services in `app/services/` encapsulate external integrations (AI, voice, avatar, knowledge) and domain logic. They are instantiated per-request or as module-level singletons.

**Key patterns:**
- Database sessions via `Depends(get_db)` or `get_db_context()` context manager
- Pydantic schemas in `app/schemas/` for request/response validation
- Pagination: `page`/`page_size` query params with offset calculation
- Usage tracking for billing (tokens, voice synthesis, avatar generation)

### Frontend

**Stack:** React 18, Vite, Tailwind CSS, Zustand (available but unused), Axios. Plain JavaScript (no TypeScript). Uses `@eduBITES/edubites-design-system` component library.

**Auth model:** Designed to run embedded in an iframe within the EduBites platform. `AuthContext` handles PostMessage-based token exchange with the parent window, with fallback to standalone mode. Tokens stored in localStorage with automatic refresh (8-minute expiry buffer).

**API layer:** Centralized Axios client in `services/api.js` with request interceptor for auth headers and response interceptor for 401 handling. API functions grouped by domain (`personasApi`, `panelsApi`, etc.).

**Routing:** React Router v6 with a `Layout` component providing sidebar navigation. Major routes: Dashboard, Personas, Panels (including live discussion view), Moderators, Discussion Guides, Archetypes.

**Path alias:** `@` maps to `src/` (configured in vite.config.js).

**Panel session lifecycle:** Draft → Prepare → Ready → Start → Active → End → Completed. The `/panels/:id/live` route provides real-time messaging with role-differentiated message display.
