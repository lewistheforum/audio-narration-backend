import 'reflect-metadata';
import 'dotenv/config';
import { DataSource } from 'typeorm';
import { Query } from 'typeorm/driver/Query';
import { join } from 'path';
import * as fs from 'fs';

interface DiffSummary {
  hasDrift: boolean;
  tables: string[];
  columns: string[];
  constraints: string[];
  indexes: string[];
  enums: string[];
}

interface SyncSql {
  upQueries: Query[];
  downQueries: Query[];
}

const REQUIRED_ENV_VARS = [
  'POSTGRES_HOST',
  'POSTGRES_PORT',
  'POSTGRES_USERNAME',
  'POSTGRES_PASSWORD',
  'POSTGRES_DATABASE',
];

async function main(): Promise<void> {
  console.log('='.repeat(80));
  console.log('LOCAL DATABASE SYNC SCRIPT');
  console.log('='.repeat(80));
  console.log('');

  // Validate environment variables
  const missingVars = REQUIRED_ENV_VARS.filter((v) => !process.env[v]);
  if (missingVars.length > 0) {
    console.error('❌ Missing required environment variables:');
    for (const v of missingVars) {
      console.error(`   - ${v}`);
    }
    console.error('');
    console.error('Please set these environment variables and try again.');
    process.exit(1);
  }

  const nodeEnv = process.env.NODE_ENV || 'development';
  const dbReset = process.env.DB_RESET === 'true';

  console.log(`Environment: ${nodeEnv}`);
  console.log(`Destructive reset allowed: ${dbReset ? 'YES' : 'NO'}`);
  console.log('');

  // Create DataSource with synchronize: false to prevent auto-sync
  const dataSource = new DataSource({
    type: 'postgres',
    host: process.env.POSTGRES_HOST!,
    port: parseInt(process.env.POSTGRES_PORT || '5432', 10),
    username: process.env.POSTGRES_USERNAME!,
    password: process.env.POSTGRES_PASSWORD!,
    database: process.env.POSTGRES_DATABASE!,
    entities: [join(__dirname, '../../**/*.entity{.ts,.js}')],
    migrations: [join(__dirname, '../../database/migrations/*{.ts,.js}')],
    synchronize: false,
    logging: false,
    ssl:
      process.env.POSTGRES_SSL === 'true'
        ? {
          rejectUnauthorized: false,
        }
        : false,
  });

  try {
    console.log('Connecting to database...');
    await dataSource.initialize();
    console.log('✓ Connected successfully');
    console.log('');

    // Check schema drift
    console.log('Computing schema differences...');
    const schemaBuilder = dataSource.driver.createSchemaBuilder();
    const syncSql: SyncSql = await schemaBuilder.log();

    // Parse the SQL queries to identify differences
    const diff = parseSchemaDiff(syncSql.upQueries, syncSql.downQueries);

    if (!diff.hasDrift) {
      console.log('✅ DB is already in sync');
      console.log('No schema differences detected between entities and database.');
      console.log('');
      process.exit(0);
    }

    // Schema drift detected
    console.log('❌ SCHEMA DRIFT DETECTED');
    console.log('');
    printDiffSummary(diff);
    console.log('');

    // Check if we can apply migrations
    const migrationsPath = join(__dirname, '../../database/migrations');
    const hasMigrationsConfigured = fs.existsSync(migrationsPath);
    const migrationFiles = hasMigrationsConfigured
      ? fs.readdirSync(migrationsPath).filter((f) => !f.endsWith('.map'))
      : [];

    // Check for pending migrations
    const pendingMigrations = await dataSource.showMigrations();

    if (pendingMigrations && migrationFiles.length > 0) {
      console.log('📋 Pending migrations detected.');
      console.log(`   Found ${migrationFiles.length} migration file(s)`);
      console.log('');

      if (nodeEnv === 'production') {
        console.log('⚠️  Running in production mode.');
        console.log('   Migrations will NOT be applied automatically.');
        console.log('   Please review and apply migrations manually.');
        console.log('');
        console.log('To apply migrations manually, run:');
        console.log('   npx typeorm migration:run -d src/config/typeorm.config.ts');
        console.log('');
        process.exit(1);
      }

      console.log('Applying pending migrations...');
      await dataSource.runMigrations();
      console.log('✓ Migrations applied successfully');
      console.log('');

      // Check if sync is still needed after migrations
      const syncSqlAfterMigrations: SyncSql = await schemaBuilder.log();
      const diffAfterMigrations = parseSchemaDiff(
        syncSqlAfterMigrations.upQueries,
        syncSqlAfterMigrations.downQueries,
      );

      if (!diffAfterMigrations.hasDrift) {
        console.log('✅ DB is now in sync after migrations');
        console.log('');
        process.exit(0);
      }

      console.log('⚠️  Schema drift still exists after migrations.');
      console.log('');
      printDiffSummary(diffAfterMigrations);
      console.log('');
    } else {
      console.log('ℹ️  No pending migrations found.');
      console.log('   Migration files exist:', hasMigrationsConfigured);
      console.log('   Migration file count:', migrationFiles.length);
      console.log('');
    }

    // If we still have drift, consider destructive sync
    if (nodeEnv === 'production') {
      console.log('❌ Running in production mode.');
      console.log('   Destructive operations are NOT allowed.');
      console.log('   Please create and apply migrations to resolve schema drift.');
      console.log('');
      console.log('To create a migration, run:');
      console.log('   npx typeorm migration:generate -d src/config/typeorm.config.ts src/database/migrations/MigrationName');
      console.log('');
      process.exit(1);
    }

    if (!dbReset) {
      console.log('⚠️  Schema drift detected but destructive reset is not enabled.');
      console.log('');
      console.log('To allow destructive reset, set:');
      console.log('   DB_RESET=true');
      console.log('');
      console.log('⚠️  WARNING: This will DROP ALL TABLES and recreate the schema.');
      console.log('   All data will be lost!');
      console.log('');
      console.log('Alternatively, create a migration to apply changes safely:');
      console.log('   npx typeorm migration:generate -d src/config/typeorm.config.ts src/database/migrations/MigrationName');
      console.log('');
      process.exit(1);
    }

    // Destructive reset
    console.log('='.repeat(80));
    console.log('⚠️  DESTRUCTIVE DATABASE RESET');
    console.log('='.repeat(80));
    console.log('');
    console.log('This operation will:');
    console.log('  1. DROP ALL TABLES in the database');
    console.log('  2. Recreate the schema from entity definitions');
    console.log('  3. ALL DATA WILL BE LOST');
    console.log('');
    console.log('Environment:', nodeEnv);
    console.log('Database:', process.env.POSTGRES_DATABASE);
    console.log('');

    // Drop all tables
    console.log('Dropping all tables...');
    const queryRunner = dataSource.createQueryRunner();
    try {
      const tables = await queryRunner.getTables(['public']);
      for (const table of tables) {
        await queryRunner.dropTable(table.name, true);
        console.log(`  ✓ Dropped table: ${table.name}`);
      }
    } finally {
      await queryRunner.release();
    }
    console.log('✓ All tables dropped');
    console.log('');

    // Synchronize schema
    console.log('Synchronizing schema from entities...');
    await dataSource.synchronize();
    console.log('✓ Schema synchronized successfully');
    console.log('');

    // Verify sync
    const syncSqlFinal: SyncSql = await schemaBuilder.log();
    const diffFinal = parseSchemaDiff(
      syncSqlFinal.upQueries,
      syncSqlFinal.downQueries,
    );

    if (diffFinal.hasDrift) {
      console.log('⚠️  Warning: Schema drift still exists after sync.');
      console.log('   This may indicate an issue with entity definitions.');
      console.log('');
      printDiffSummary(diffFinal);
      process.exit(1);
    }

    console.log('✅ Database synchronized successfully!');
    console.log('');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error during database sync:');
    console.error('');
    if (error instanceof Error) {
      console.error(error.message);
      console.error('');
      console.error('Stack trace:');
      console.error(error.stack);
    } else {
      console.error(error);
    }
    console.error('');
    process.exit(1);
  } finally {
    if (dataSource.isInitialized) {
      await dataSource.destroy();
    }
  }
}

function parseSchemaDiff(upQueries: Query[], downQueries: Query[]): DiffSummary {
  const summary: DiffSummary = {
    hasDrift: false,
    tables: [],
    columns: [],
    constraints: [],
    indexes: [],
    enums: [],
  };

  const allQueries = [...upQueries, ...downQueries];

  if (allQueries.length === 0) {
    return summary;
  }

  summary.hasDrift = true;

  // Parse each query to identify what type of change it is
  for (const queryObj of allQueries) {
    const query = typeof queryObj === 'string' ? queryObj : queryObj.query;
    const normalizedQuery = query.toUpperCase().trim();

    // Table operations
    if (normalizedQuery.includes('CREATE TABLE')) {
      const tableMatch = query.match(
        /CREATE TABLE\s+(?:IF NOT EXISTS\s+)?["']?(\w+)["']?/i,
      );
      if (tableMatch) {
        const tableName = tableMatch[1];
        if (!summary.tables.includes(tableName)) {
          summary.tables.push(tableName);
        }
      }
    } else if (normalizedQuery.includes('DROP TABLE')) {
      const tableMatch = query.match(
        /DROP TABLE\s+(?:IF EXISTS\s+)?["']?(\w+)["']?/i,
      );
      if (tableMatch) {
        const tableName = tableMatch[1];
        if (!summary.tables.includes(tableName)) {
          summary.tables.push(tableName);
        }
      }
    }

    // Column operations
    if (
      normalizedQuery.includes('ALTER TABLE') &&
      normalizedQuery.includes('ADD COLUMN')
    ) {
      const tableMatch = query.match(/ALTER TABLE\s+["']?(\w+)["']?/i);
      const columnMatch = query.match(/ADD COLUMN\s+["']?(\w+)["']?/i);
      if (tableMatch && columnMatch) {
        summary.columns.push(`${tableMatch[1]}.${columnMatch[1]} (MISSING)`);
      }
    } else if (
      normalizedQuery.includes('ALTER TABLE') &&
      normalizedQuery.includes('DROP COLUMN')
    ) {
      const tableMatch = query.match(/ALTER TABLE\s+["']?(\w+)["']?/i);
      const columnMatch = query.match(/DROP COLUMN\s+["']?(\w+)["']?/i);
      if (tableMatch && columnMatch) {
        summary.columns.push(`${tableMatch[1]}.${columnMatch[1]} (EXTRA)`);
      }
    } else if (
      normalizedQuery.includes('ALTER TABLE') &&
      normalizedQuery.includes('ALTER COLUMN')
    ) {
      const tableMatch = query.match(/ALTER TABLE\s+["']?(\w+)["']?/i);
      const columnMatch = query.match(/ALTER COLUMN\s+["']?(\w+)["']?/i);
      if (tableMatch && columnMatch) {
        summary.columns.push(`${tableMatch[1]}.${columnMatch[1]} (TYPE MODIFIED)`);
      }
    }

    // Constraint operations
    if (
      normalizedQuery.includes('ALTER TABLE') &&
      normalizedQuery.includes('ADD CONSTRAINT')
    ) {
      const tableMatch = query.match(/ALTER TABLE\s+["']?(\w+)["']?/i);
      const constraintMatch = query.match(/ADD CONSTRAINT\s+["']?(\w+)["']?/i);
      if (tableMatch && constraintMatch) {
        const constraintType = normalizedQuery.includes('FOREIGN KEY')
          ? 'FK'
          : normalizedQuery.includes('UNIQUE')
            ? 'UNIQUE'
            : normalizedQuery.includes('PRIMARY KEY')
              ? 'PK'
              : 'CHECK';
        summary.constraints.push(
          `${tableMatch[1]}.${constraintMatch[1]} (${constraintType} - MISSING)`,
        );
      }
    } else if (
      normalizedQuery.includes('ALTER TABLE') &&
      normalizedQuery.includes('DROP CONSTRAINT')
    ) {
      const tableMatch = query.match(/ALTER TABLE\s+["']?(\w+)["']?/i);
      const constraintMatch = query.match(/DROP CONSTRAINT\s+["']?(\w+)["']?/i);
      if (tableMatch && constraintMatch) {
        summary.constraints.push(`${tableMatch[1]}.${constraintMatch[1]} (EXTRA)`);
      }
    }

    // Index operations
    if (
      normalizedQuery.includes('CREATE INDEX') ||
      normalizedQuery.includes('CREATE UNIQUE INDEX')
    ) {
      const tableMatch = query.match(/ON\s+["']?(\w+)["']?/i);
      const indexMatch = query.match(
        /CREATE\s+(?:UNIQUE\s+)?INDEX\s+(?:IF NOT EXISTS\s+)?["']?(\w+)["']?/i,
      );
      if (tableMatch && indexMatch) {
        summary.indexes.push(`${tableMatch[1]}.${indexMatch[1]} (MISSING)`);
      }
    } else if (normalizedQuery.includes('DROP INDEX')) {
      const indexMatch = query.match(
        /DROP INDEX\s+(?:IF EXISTS\s+)?["']?(\w+)["']?/i,
      );
      if (indexMatch) {
        summary.indexes.push(`${indexMatch[1]} (EXTRA)`);
      }
    }

    // Enum type operations
    if (normalizedQuery.includes('CREATE TYPE') && normalizedQuery.includes('AS ENUM')) {
      const typeMatch = query.match(
        /CREATE TYPE\s+(?:IF NOT EXISTS\s+)?["']?(\w+)["']?/i,
      );
      if (typeMatch) {
        summary.enums.push(`${typeMatch[1]} (MISSING)`);
      }
    } else if (normalizedQuery.includes('DROP TYPE')) {
      const typeMatch = query.match(
        /DROP TYPE\s+(?:IF EXISTS\s+)?["']?(\w+)["']?/i,
      );
      if (typeMatch) {
        summary.enums.push(`${typeMatch[1]} (EXTRA)`);
      }
    } else if (normalizedQuery.includes('ALTER TYPE') && normalizedQuery.includes('ADD VALUE')) {
      const typeMatch = query.match(/ALTER TYPE\s+["']?(\w+)["']?/i);
      if (typeMatch) {
        summary.enums.push(`${typeMatch[1]} (VALUE ADDED)`);
      }
    }
  }

  return summary;
}

function printDiffSummary(diff: DiffSummary): void {
  console.log('SUMMARY OF CHANGES:');
  console.log('-'.repeat(80));

  if (diff.tables.length > 0) {
    console.log(`\n📋 Tables (${diff.tables.length}):`);
    for (const table of diff.tables) {
      console.log(`  - ${table}`);
    }
  }

  if (diff.columns.length > 0) {
    console.log(`\n📝 Columns (${diff.columns.length}):`);
    for (const column of diff.columns) {
      console.log(`  - ${column}`);
    }
  }

  if (diff.constraints.length > 0) {
    console.log(`\n🔗 Constraints (${diff.constraints.length}):`);
    for (const constraint of diff.constraints) {
      console.log(`  - ${constraint}`);
    }
  }

  if (diff.indexes.length > 0) {
    console.log(`\n📊 Indexes (${diff.indexes.length}):`);
    for (const index of diff.indexes) {
      console.log(`  - ${index}`);
    }
  }

  if (diff.enums.length > 0) {
    console.log(`\n🏷️  Enums (${diff.enums.length}):`);
    for (const enumType of diff.enums) {
      console.log(`  - ${enumType}`);
    }
  }

  console.log('');
}

// Run the script
main().catch((error) => {
  console.error('Unhandled error:');
  console.error(error);
  process.exit(1);
});
