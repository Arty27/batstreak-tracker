# 🦇 Bat Streak - Gotham Discipline Tracker

[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![React](https://img.shields.io/badge/React-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://react.dev)
[![Vite](https://img.shields.io/badge/Vite-646CFF?style=for-the-badge&logo=vite&logoColor=white)](https://vitejs.dev)
[![Postgres](https://img.shields.io/badge/Neon_Postgres-008bb9?style=for-the-badge&logo=postgresql&logoColor=white)](https://neon.tech)
[![Vercel](https://img.shields.io/badge/Vercel-000000?style=for-the-badge&logo=vercel&logoColor=white)](https://vercel.com)

🔗 **Live Demo:** [batstreak.vercel.app](https://batstreak.vercel.app)

---

## Overview

**Bat Streak** is a Batman-themed daily discipline tracker. Every day is a mission - create your tasks, complete them all, and add a note to each one to lock the day into your streak. Miss a task or skip the evidence, and the streak breaks.

> *"Every mission needs evidence. Finish every active task and add a note to lock the day into your streak."*

The app is built with React and TypeScript on the frontend, backed by a **Neon (serverless Postgres)** database and deployed to **Vercel** using serverless API functions.

---

## Features

- **🦇 Daily Mission System** — Each day is an "Active Mission Day" with a set of tasks to complete
- **📋 Task Management** — Add, view, and complete tasks for the current day
- **📝 Evidence Notes** — Every task requires a written note as proof of completion; only then does it count
- **🔥 Streak Tracking** — Current streak and best streak are tracked and displayed; the day only locks in when all tasks are completed with notes
- **📊 Daily Progress Ring** — A visual percentage ring shows how much of the day's mission is done
- **📅 Weekly Calendar View** — Navigate through the week and see which days were completed
- **🌑 Batman Theme** — Dark gold-and-black UI styled around the Gotham Discipline aesthetic

---

## How It Works

```
Add tasks, they are stored permanently
        ↓
Complete each task + write a note (evidence)
        ↓
All tasks done with notes? → Day is locked ✅ → Streak increments
        ↓
Any task incomplete or missing a note? → Streak resets to 0
```

The streak only counts if **every active task has been completed AND has a note attached**. Partial completion doesn't count.

---

## Project Structure

```
batstreak-tracker/
├── api/            # Vercel serverless functions (DB queries, streak logic)
├── dist/           # Production build output
├── public/
│   └── assets/     # Static assets (bat logo, icons)
├── server/         # Node server (local dev / preview)
├── src/            # React + TypeScript frontend (entry: src/main.tsx)
├── index.html      # Vite HTML entry point
├── vite.config.ts  # Vite configuration
└── tsconfig.json   # TypeScript configuration
```

---

## Tech Stack

| Layer      | Technology                                         |
| ---------- | -------------------------------------------------- |
| Frontend   | React · TypeScript · Vite · Custom CSS             |
| Backend    | Vercel Serverless Functions (`/api`)               |
| Database   | Neon (serverless Postgres)                         |
| Dev Server | Node.js · Express                                  |
| Deployment | Vercel                                             |

---

## Getting Started

```bash
git clone https://github.com/Arty27/batstreak-tracker.git
cd batstreak-tracker
npm install
```

Create a `.env` file and add your Neon Postgres connection string:

```env
DATABASE_URL=your_neon_postgres_connection_string
```

Run the development server:

```bash
npm run dev        # http://localhost:5173
```

Build for production:

```bash
npm run build
```

---

## Deployment

Deployed on **Vercel**. The `/api` directory is automatically treated as Vercel Serverless Functions — no separate server configuration needed in production. Add `DATABASE_URL` to your Vercel project environment variables and push to `main` to deploy.

---

## Author

**Vinay N** · [LinkedIn](https://linkedin.com/in/vinayn027) · [GitHub](https://github.com/Arty27)
