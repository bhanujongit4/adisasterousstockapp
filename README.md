# IN$JAM - Stock Intelligence Platform

IN$JAM is a full-stack stock analysis application designed to combine charting, watchlist workflows, and explainable ML signals in a single trading workspace.

**Live Demo:** [https://adisasterousstockapp.vercel.app/](https://adisasterousstockapp.vercel.app/)

## Overview

This project demonstrates:

- End-to-end product engineering (frontend, backend, data, and ML service integration)
- Secure user authentication and session management
- Real-time-style market data workflows with multi-timeframe chart support
- Explainable signal generation for regime, microstructure, and anomaly detection
- Persistent user features such as watchlists and chart annotations

## Key Features

- User authentication (signup, login, logout, session validation)
- Personalized watchlist management with symbol lookup
- Market quote aggregation and OHLCV history retrieval
- Interactive charting with technical indicators
- On-demand signal generation across three models:
  - Regime classification
  - Microstructure analysis
  - Anomaly detection
- Annotation APIs for notes, markers, and trendline data

## System Architecture

```text
Client (React / Next.js UI)
  -> Next.js API Routes (auth, watchlist, quotes, signal proxies)
  -> FastAPI Intelligence Service (Python ML models)
  -> Market Data Source + Postgres persistence
```

## Tech Stack

- Frontend: Next.js, React, TypeScript, CSS Modules
- Charting: lightweight-charts
- Web Backend: Next.js Route Handlers
- Intelligence Service: FastAPI, pandas, NumPy, scikit-learn, hmmlearn, statsmodels
- Database: Postgres (Neon serverless driver)
- Authentication: bcrypt + signed JWT session cookies
- Deployment/Infra: Vercel, Docker Compose, Render configuration

## API Surfaces

### Next.js routes

- `/api/health`
- `/api/quotes`
- `/api/watchlist`
- `/api/annotations`
- `/api/signals`
- `/api/signals/regime`
- `/api/signals/microstructure`
- `/api/signals/anomaly`
- `/api/auth/signup`
- `/api/auth/login`
- `/api/auth/logout`
- `/api/auth/session`

### Intelligence service routes

- `GET /health`
- `GET /api/regime/{ticker}`
- `GET /api/microstructure/{ticker}`
- `GET /api/anomaly/{ticker}`
- `GET /api/signal/{ticker}`

## Local Setup

### Prerequisites

- Node.js 20+
- npm
- Python 3.11+
- PostgreSQL-compatible database

### 1. Install dependencies

```bash
npm install
python -m venv services/stock-intelligence/.venv
services/stock-intelligence/.venv/Scripts/python -m pip install --upgrade pip
services/stock-intelligence/.venv/Scripts/python -m pip install -r services/stock-intelligence/requirements.txt
```

### 2. Configure environment

Create local environment configuration files for runtime settings such as:

- database connection
- authentication secret
- intelligence service base URL

Do not commit local secret files.

### 3. Run services

Terminal 1:

```bash
cd services/stock-intelligence
.venv/Scripts/python -m uvicorn api.main:app --host 127.0.0.1 --port 8000 --reload
```

Terminal 2:

```bash
npm run dev
```

Local endpoints:

- App: `http://localhost:3000`
- Intelligence service health: `http://127.0.0.1:8000/health`

## Optional: Docker

```bash
docker compose up --build
```

## Project Intent

This project is built as a portfolio-grade system to demonstrate practical full-stack engineering, service-oriented architecture, and ML-assisted decision tooling for market analysis workflows.

## Disclaimer

This software is provided for educational and technical demonstration purposes only and does not constitute financial advice.
