import 'reflect-metadata';
import 'dotenv/config';
import { DataSource } from 'typeorm';
import { Query } from 'typeorm/driver/Query';
import { join } from 'path';

interface DiffSummary {
  hasDrift: boolean;
  tables: string[];
  columns: string[];
  constraints: string[];
  indexes: string[];
  enums: string[];
}

async function checkSchemaDiff(): Promise<void> {
  console.log('='.repeat(80));
  console.log('SCHEMA DIFF CHECKER');
  console.log('='.repeat(80));
  console.log('');

  // Create DataSource with synchronize: false to prevent auto-sync
  const dataSource = new DataSource({
    type: 'postgres',
    host: process.env.POSTGRES_HOST || '',
    port: parseInt(process.env.POSTGRES_PORT || '5432'),
    username: process.env.POSTGRES_USERNAME || '',
    password: process.env.POSTGRES_PASSWORD || '',
    database: process.env.POSTGRES_DATABASE || '',
    entities: [join(__dirname, '../../**/*.entity{.ts,.js}')],
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

    console.log('Computing schema differences...');
    const schemaBuilder = dataSource.driver.createSchemaBuilder();

    // Get the sync SQL queries
    const syncSql = await schemaBuilder.log();

    // Parse the SQL queries to identify differences
    const diff = parseSchemaDiff(syncSql.upQueries, syncSql.downQueries);

    if (!diff.hasDrift) {
      console.log('✅ DATABASE IS IN SYNC');
      console.log('No schema differences detected between entities and database.');
      console.log('');
      process.exit(0);
    }

    // Schema drift detected
    console.log('❌ SCHEMA DRIFT DETECTED');
    console.log('');
    printDiffSummary(diff);
    printDetailedQueries(syncSql.upQueries, syncSql.downQueries);

    process.exit(1);
  } catch (error) {
    console.error('Error checking schema diff:');
    console.error(error);
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
      const tableMatch = query.match(/CREATE TABLE\s+(?:IF NOT EXISTS\s+)?["']?(\w+)["']?/i);
      if (tableMatch) {
        const tableName = tableMatch[1];
        if (!summary.tables.includes(tableName)) {
          summary.tables.push(tableName);
        }
      }
    } else if (normalizedQuery.includes('DROP TABLE')) {
      const tableMatch = query.match(/DROP TABLE\s+(?:IF EXISTS\s+)?["']?(\w+)["']?/i);
      if (tableMatch) {
        const tableName = tableMatch[1];
        if (!summary.tables.includes(tableName)) {
          summary.tables.push(tableName);
        }
      }
    }

    // Column operations
    if (normalizedQuery.includes('ALTER TABLE') && normalizedQuery.includes('ADD COLUMN')) {
      const tableMatch = query.match(/ALTER TABLE\s+["']?(\w+)["']?/i);
      const columnMatch = query.match(/ADD COLUMN\s+["']?(\w+)["']?/i);
      if (tableMatch && columnMatch) {
        summary.columns.push(`${tableMatch[1]}.${columnMatch[1]} (MISSING)`);
      }
    } else if (normalizedQuery.includes('ALTER TABLE') && normalizedQuery.includes('DROP COLUMN')) {
      const tableMatch = query.match(/ALTER TABLE\s+["']?(\w+)["']?/i);
      const columnMatch = query.match(/DROP COLUMN\s+["']?(\w+)["']?/i);
      if (tableMatch && columnMatch) {
        summary.columns.push(`${tableMatch[1]}.${columnMatch[1]} (EXTRA)`);
      }
    } else if (normalizedQuery.includes('ALTER TABLE') && (normalizedQuery.includes('ALTER COLUMN'))) {
      const tableMatch = query.match(/ALTER TABLE\s+["']?(\w+)["']?/i);
      const columnMatch = query.match(/ALTER COLUMN\s+["']?(\w+)["']?/i);
      if (tableMatch && columnMatch) {
        summary.columns.push(`${tableMatch[1]}.${columnMatch[1]} (TYPE MODIFIED)`);
      }
    }

    // Constraint operations
    if (normalizedQuery.includes('ALTER TABLE') && normalizedQuery.includes('ADD CONSTRAINT')) {
      const tableMatch = query.match(/ALTER TABLE\s+["']?(\w+)["']?/i);
      const constraintMatch = query.match(/ADD CONSTRAINT\s+["']?(\w+)["']?/i);
      if (tableMatch && constraintMatch) {
        const constraintType = normalizedQuery.includes('FOREIGN KEY') ? 'FK' :
                            normalizedQuery.includes('UNIQUE') ? 'UNIQUE' :
                            normalizedQuery.includes('PRIMARY KEY') ? 'PK' : 'CHECK';
        summary.constraints.push(`${tableMatch[1]}.${constraintMatch[1]} (${constraintType} - MISSING)`);
      }
    } else if (normalizedQuery.includes('ALTER TABLE') && normalizedQuery.includes('DROP CONSTRAINT')) {
      const tableMatch = query.match(/ALTER TABLE\s+["']?(\w+)["']?/i);
      const constraintMatch = query.match(/DROP CONSTRAINT\s+["']?(\w+)["']?/i);
      if (tableMatch && constraintMatch) {
        summary.constraints.push(`${tableMatch[1]}.${constraintMatch[1]} (EXTRA)`);
      }
    }

    // Index operations
    if (normalizedQuery.includes('CREATE INDEX') || normalizedQuery.includes('CREATE UNIQUE INDEX')) {
      const tableMatch = query.match(/ON\s+["']?(\w+)["']?/i);
      const indexMatch = query.match(/CREATE\s+(?:UNIQUE\s+)?INDEX\s+(?:IF NOT EXISTS\s+)?["']?(\w+)["']?/i);
      if (tableMatch && indexMatch) {
        summary.indexes.push(`${tableMatch[1]}.${indexMatch[1]} (MISSING)`);
      }
    } else if (normalizedQuery.includes('DROP INDEX')) {
      const indexMatch = query.match(/DROP INDEX\s+(?:IF EXISTS\s+)?["']?(\w+)["']?/i);
      if (indexMatch) {
        summary.indexes.push(`${indexMatch[1]} (EXTRA)`);
      }
    }

    // Enum type operations
    if (normalizedQuery.includes('CREATE TYPE') && normalizedQuery.includes('AS ENUM')) {
      const typeMatch = query.match(/CREATE TYPE\s+(?:IF NOT EXISTS\s+)?["']?(\w+)["']?/i);
      if (typeMatch) {
        summary.enums.push(`${typeMatch[1]} (MISSING)`);
      }
    } else if (normalizedQuery.includes('DROP TYPE')) {
      const typeMatch = query.match(/DROP TYPE\s+(?:IF EXISTS\s+)?["']?(\w+)["']?/i);
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

function printDetailedQueries(upQueries: Query[], downQueries: Query[]): void {
  console.log('='.repeat(80));
  console.log('DETAILED SQL QUERIES');
  console.log('='.repeat(80));

  if (upQueries.length > 0) {
    console.log('\n📤 UP QUERIES (to sync DB with entities):');
    console.log('-'.repeat(80));
    for (let i = 0; i < upQueries.length; i++) {
      const query = typeof upQueries[i] === 'string' ? upQueries[i] : upQueries[i].query;
      console.log(`\n${i + 1}. ${query}`);
    }
  }

  if (downQueries.length > 0) {
    console.log('\n\n📥 DOWN QUERIES (to revert changes):');
    console.log('-'.repeat(80));
    for (let i = 0; i < downQueries.length; i++) {
      const query = typeof downQueries[i] === 'string' ? downQueries[i] : downQueries[i].query;
      console.log(`\n${i + 1}. ${query}`);
    }
  }

  console.log('');
  console.log('='.repeat(80));
  console.log('RECOMMENDATION:');
  console.log('-'.repeat(80));
  console.log('1. Review the differences above');
  console.log('2. If changes are expected, consider creating a migration');
  console.log('3. If changes are unexpected, check your entity definitions');
  console.log('4. Be careful with data loss when applying changes');
  console.log('='.repeat(80));
  console.log('');
}

// Run the schema diff check
checkSchemaDiff();
