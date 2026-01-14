# Bonix (Backend)

A NestJS-based backend API for the Bonix healthcare management platform, providing comprehensive services for appointments, prescriptions, clinic management, and user authentication.

## Tech Stack

- **Framework**: NestJS with TypeScript
- **Web Server**: Fastify
- **Databases**:
  - PostgreSQL (TypeORM) - Primary relational database
  - MongoDB (Mongoose) - Document storage
- **Authentication**: JWT + Google OAuth 2.0
- **Real-time**: Socket.IO
- **Email**: Nodemailer
- **Package Manager**: pnpm

## Requirements

- Node.js (v22 or later recommended)
- pnpm
- PostgreSQL
- MongoDB (optional, if using MongoDB features)

## Setup

1. **Clone the repository and navigate to the project directory**

2. **Install dependencies**:
   ```bash
   pnpm install
   ```

3. **Configure environment variables**:
   ```bash
   cp .env.example .env
   ```
   Edit `.env` with your actual configuration values.

## Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `PORT` | Backend server port | `3000` |
| `NODE_ENV` | Environment mode | `development` / `production` |
| `FRONTEND_URL` | Frontend application URL | `http://localhost:5173` |
| `JWT_SECRET` | Secret key for JWT signing | `your-secret` |
| `MONGO_URI` | MongoDB connection string | `mongodb://localhost:27017` |
| `MONGO_DATABASE` | MongoDB database name | `mongo-database` |
| `POSTGRES_HOST` | PostgreSQL host | `localhost` |
| `POSTGRES_PORT` | PostgreSQL port | `5432` |
| `POSTGRES_USERNAME` | PostgreSQL username | `postgres` |
| `POSTGRES_PASSWORD` | PostgreSQL password | `your-password` |
| `POSTGRES_DATABASE` | PostgreSQL database name | `capstone_db` |
| `POSTGRES_SSL` | Enable SSL for PostgreSQL | `false` / `true` |
| `EMAIL_USER` | Gmail address for sending emails | `your-email@example.com` |
| `MAIL_TO` | Default recipient email | `your-email@example.com` |
| `EMAIL_PASSWORD` | Gmail app password | `your-email-password` |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID | `your-google-client-id` |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret | `your-secret` |
| `GOOGLE_URL` | Google login URL | `google-login-url` |
| `GOOGLE_CALLBACK_URL` | Google OAuth callback URL | `google-callback-url` |
| `ENCRYPTION_KEY` | 64-character hex string for data encryption | `your-64-character-hex-string-here` |

## Running the App

### Development Mode
```bash
pnpm start:dev
```
Starts the server with hot-reload using nodemon.

### Production Mode
```bash
pnpm build
pnpm start:prod
```
Builds the TypeScript code to the `dist/` directory and runs the compiled application.

### Build Only
```bash
pnpm build
```
Compiles TypeScript to JavaScript without starting the server.

## Database Workflow

The project uses TypeORM with PostgreSQL. The database schema is defined in entity files located in `src/modules/**/entities/`.

### Schema Drift Check

Check for differences between your entity definitions and the actual database schema:

```bash
pnpm run script:schema-diff
```

**What it does**:
- Compares entity definitions with the database schema
- Reports missing tables, columns, constraints, indexes, and enums
- Exits with code `0` if in sync, `1` if drift detected

**When to use**:
- After modifying entity files
- Before deploying to production
- When troubleshooting database-related errors

### Local Database Sync

Synchronize your local database with entity definitions:

```bash
pnpm run script:sync-local-db
```

**What it does**:
- Checks for schema drift
- Applies pending migrations if available
- If drift persists and `DB_RESET=true` is set, performs a destructive reset (drops all tables and recreates schema)
- Exits with code `0` if successful, `1` on error

**When to use**:
- After pulling changes with entity modifications
- When `script:schema-diff` reports drift
- For local development database resets

**Important Notes**:
- In production mode, destructive operations are blocked
- To enable destructive reset locally: `DB_RESET=true pnpm run script:sync-local-db`
- **WARNING**: Destructive reset will delete all data in the database

### Check and Sync (Combined)

Run schema diff check followed by sync in one command:

```bash
pnpm run script:check-and-sync
```

This is equivalent to running:
```bash
pnpm run script:schema-diff && pnpm run script:sync-local-db
```

## Migrations

The project is configured to use TypeORM migrations (see [`src/config/typeorm.config.ts`](src/config/typeorm.config.ts:34)), but currently uses schema synchronization (`synchronize: true`) for development.

**TODO**: Set up proper migration workflow for production deployments.

To create a migration:
```bash
npx typeorm migration:generate -d src/config/typeorm.config.ts src/database/migrations/MigrationName
```

To run migrations:
```bash
npx typeorm migration:run -d src/config/typeorm.config.ts
```

## Utility Scripts

### Generate Encryption Key
Generate a new 64-character hex encryption key for data encryption:

```bash
pnpm run script:generate-encryption-key
```

### Analyze Excel File
Analyze an Excel file structure:

```bash
pnpm run script:analyze-excel
```

### Bulk Import Medicines
Import medicines from an Excel file:

```bash
pnpm run script:bulk-import-medicines
```

### Convert Excel to CSV
Convert an Excel file to CSV format:

```bash
pnpm run script:convert-excel-to-csv
```

## Common Issues / Troubleshooting

### "DB schema drift detected"

**Cause**: Database schema does not match entity definitions.

**Solution**:
1. Run the schema diff check to see what changed:
   ```bash
   pnpm run script:schema-diff
   ```
2. For local development, sync the database:
   ```bash
   pnpm run script:sync-local-db
   ```
3. If destructive reset is needed:
   ```bash
   DB_RESET=true pnpm run script:sync-local-db
   ```

### "Cannot connect to DB / wrong credentials"

**Cause**: Incorrect database configuration or credentials.

**Solution**:
1. Verify PostgreSQL is running: `pg_isready` (or check your PostgreSQL service)
2. Check `.env` file for correct values:
   - `POSTGRES_HOST`
   - `POSTGRES_PORT`
   - `POSTGRES_USERNAME`
   - `POSTGRES_PASSWORD`
   - `POSTGRES_DATABASE`
3. Test connection manually using `psql` or a database client
4. Ensure the database exists and user has proper permissions

### "Fresh machine / no DB yet"

**Solution**:
1. Create the PostgreSQL database:
   ```sql
   CREATE DATABASE capstone_db;
   ```
2. Configure your `.env` file with proper database credentials
3. Run the sync script to create all tables:
   ```bash
   pnpm run script:sync-local-db
   ```
4. Start the development server:
   ```bash
   pnpm start:dev
   ```

### Module import errors

**Cause**: TypeScript compilation issues or missing dependencies.

**Solution**:
1. Clean and reinstall dependencies:
   ```bash
   rm -rf node_modules pnpm-lock.yaml
   pnpm install
   ```
2. Rebuild the project:
   ```bash
   pnpm build
   ```

## Project Structure

```
medicare-backend/
├── src/
│   ├── common/              # Shared utilities, guards, interceptors
│   │   ├── scripts/         # Utility scripts (schema sync, Excel tools, etc.)
│   │   ├── seeders/         # Database seeders
│   │   ├── guards/          # Route guards (e.g., roles)
│   │   ├── interceptors/    # Response transformation
│   │   └── health/          # Health check endpoints
│   ├── config/              # Configuration files (TypeORM, JWT, etc.)
│   ├── modules/             # Feature modules
│   │   ├── accounts/        # User accounts and doctor info
│   │   ├── appointments/    # Appointment management
│   │   ├── auth/            # Authentication (JWT, Google OAuth)
│   │   ├── prescriptions/   # E-prescriptions and medical records
│   │   ├── schedules/       # Clinic schedules and shifts
│   │   ├── transactions/    # Payment transactions
│   │   ├── conversations/   # Chat conversations
│   │   ├── messages/        # Chat messages
│   │   ├── mailer/          # Email service
│   │   └── ...              # Other feature modules
│   ├── app.module.ts        # Root application module
│   └── main.ts              # Application entry point
├── test/                    # E2E tests
├── .env.example             # Environment variables template
├── package.json             # Dependencies and scripts
└── README.md                # This file
```

## Contributing / Notes

- The project uses Fastify instead of Express for better performance
- TypeORM synchronization is enabled in development (`synchronize: true`)
- Socket.IO is configured for real-time features (chat, notifications)
- Google OAuth 2.0 is configured for social authentication
- Data encryption is supported via the `ENCRYPTION_KEY` environment variable
- The project follows NestJS best practices with modular architecture

## License

UNLICENSED
