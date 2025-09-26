# better-t-chat

This project was created with [Better-T-Stack](https://github.com/AmanVarshney01/create-better-t-stack), a modern TypeScript stack that combines React, TanStack Router, Hono, TRPC, and more.

## Features

- **TypeScript** - For type safety and improved developer experience
- **TanStack Router** - File-based routing with full type safety
- **TailwindCSS** - Utility-first CSS for rapid UI development
- **shadcn/ui** - Reusable UI components
- **Hono** - Lightweight, performant server framework
- **tRPC** - End-to-end type-safe APIs
- **workers** - Runtime environment
- **Drizzle** - TypeScript-first ORM
- **SQLite/Turso** - Database engine
- **Authentication** - Email & password authentication with Better Auth
- **Turborepo** - Optimized monorepo build system
- **Biome** - Linting and formatting

## Getting Started

First, install the dependencies:

```bash
bun install
```
## Environment Setup

This project uses Alchemy for deployment with stage-specific environment configurations. You need to set up environment files for different deployment stages.

### Creating Environment Files

1. **Development Environment**: Copy all `.env.example` files to `.env.dev`
   ```bash
   cp .env.example .env.dev
   cp apps/web/.env.example apps/web/.env.dev
   cp apps/server/.env.example apps/server/.env.dev
   ```

2. **Production Environment**: Copy all `.env.example` files to `.env.prod`
   ```bash
   cp .env.example .env.prod
   cp apps/web/.env.example apps/web/.env.prod
   cp apps/server/.env.example apps/server/.env.prod
   ```

3. **Fill in the environment variables** in each file according to your deployment stage requirements. Remember to choose different secrets between dev and prod for security.

### Environment Stages

The `alchemy.run.ts` configuration automatically loads the appropriate environment file based on the `ALCHEMY_STAGE` environment variable:

- **Development** (default): Uses `.env.dev` files
- **Production**: Uses `.env.prod` files when `ALCHEMY_STAGE=prod`

In general, use the dev stage for `alchemy dev` and the prod stage for `alchemy deploy`
```bash
# Launch dev server
"bun a:dev" -> "bun ALCHEMY_STAGE=dev alchemy dev"

# Deploy to production
"bun a:deploy" -> "bun ALCHEMY_STAGE=prod alchemy deploy"
```
## Database Setup

This project uses SQLite with Drizzle ORM.

1. Start the local SQLite database:
Local development for a Cloudflare D1 database will already be running as part of the `wrangler dev` command.

2. Update your `.env` file in the `apps/server` directory with the appropriate connection details if needed.

3. Apply the schema to your database:
```bash
bun db:push
```
Then, run the development server:

```bash
bun dev
```

Open [http://localhost:3001](http://localhost:3001) in your browser to see the web application.
The API is running at [http://localhost:3000](http://localhost:3000).



## Project Structure

```
better-t-chat/
├── apps/
│   ├── web/         # Frontend application (React + TanStack Router)
│   └── server/      # Backend API (Hono, TRPC)
```

## Available Scripts

- `bun a:dev`: Start all applications in development mode with Alchemy
- `bun a:deploy`: Deploy all applications with Alchemy
- `bun build`: Build all applications
- `bun dev:web`: Start only the web application
- `bun dev:server`: Start only the server
- `bun typecheck`: Check TypeScript types across all apps
- `bun db:push`: Push schema changes to database
- `bun db:studio`: Open database studio UI
- `cd apps/server && bun db:local`: Start the local SQLite database
- `bun check`: Run Biome formatting and linting
