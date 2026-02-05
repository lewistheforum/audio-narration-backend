import 'reflect-metadata';
import 'dotenv/config';
import { DataSource } from 'typeorm';
import { join } from 'path';

const REQUIRED_ENV_VARS = [
  'POSTGRES_HOST',
  'POSTGRES_PORT',
  'POSTGRES_USERNAME',
  'POSTGRES_PASSWORD',
  'POSTGRES_DATABASE',
];

async function main(): Promise<void> {
  console.log('='.repeat(80));
  console.log('🗑️  CLEAR DATABASE SCRIPT');
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

  console.log(`Environment: ${nodeEnv}`);
  console.log(`Database: ${process.env.POSTGRES_DATABASE}`);
  console.log('');

  // Warning for production environment
  if (nodeEnv === 'production') {
    console.log('⚠️  WARNING: Running in production mode!');
    console.log('   This will delete ALL data in the database.');
    console.log('   Please confirm you want to proceed.');
    console.log('');
  }

  // Create DataSource
  const dataSource = new DataSource({
    type: 'postgres',
    host: process.env.POSTGRES_HOST!,
    port: parseInt(process.env.POSTGRES_PORT || '5432', 10),
    username: process.env.POSTGRES_USERNAME!,
    password: process.env.POSTGRES_PASSWORD!,
    database: process.env.POSTGRES_DATABASE!,
    entities: [join(__dirname, '../../**/*.entity{.ts,.js}')],
    synchronize: false,
    logging: false,
  });

  const queryRunner = dataSource.createQueryRunner();

  try {
    console.log('🔌 Connecting to database...');
    await dataSource.initialize();
    console.log('✅ Connected successfully');
    console.log('');

    // Connect query runner
    await queryRunner.connect();
    console.log('✅ Query runner connected');
    console.log('');

    // Get all table names from the database
    console.log('📋 Retrieving all tables...');
    const tables = await queryRunner.query(`
      SELECT tablename 
      FROM pg_tables 
      WHERE schemaname = 'public'
      ORDER BY tablename
    `);

    const tableNames = tables.map((t: any) => t.tablename);

    if (tableNames.length === 0) {
      console.log('ℹ️  No tables found in the database');
      console.log('');
      process.exit(0);
    }

    console.log(`✅ Found ${tableNames.length} table(s):`);
    for (const tableName of tableNames) {
      console.log(`   - ${tableName}`);
    }
    console.log('');

    // Disable foreign key constraints by disabling triggers
    console.log('🔓 Disabling foreign key constraints...');
    await queryRunner.query("SET session_replication_role = 'replica';");
    console.log('✅ Foreign key constraints disabled');
    console.log('');

    // Truncate all tables
    console.log('🗑️  Truncating all tables...');
    let truncatedCount = 0;

    for (const tableName of tableNames) {
      try {
        // Use CASCADE to handle dependent rows
        await queryRunner.query(`TRUNCATE TABLE "${tableName}" CASCADE;`);
        console.log(`   ✓ Truncated: ${tableName}`);
        truncatedCount++;
      } catch (error) {
        console.error(`   ✗ Failed to truncate ${tableName}:`, error.message);
        throw error;
      }
    }

    console.log('');
    console.log(`✅ Successfully truncated ${truncatedCount}/${tableNames.length} table(s)`);
    console.log('');

    // Re-enable foreign key constraints
    console.log('🔒 Re-enabling foreign key constraints...');
    await queryRunner.query("SET session_replication_role = 'origin';");
    console.log('✅ Foreign key constraints re-enabled');
    console.log('');

    // Success summary
    console.log('='.repeat(80));
    console.log('✅ DATABASE CLEARED SUCCESSFULLY');
    console.log('='.repeat(80));
    console.log('');
    console.log(`📊 Tables truncated: ${truncatedCount}`);
    console.log(`🗄️  Database: ${process.env.POSTGRES_DATABASE}`);
    console.log('');
    console.log('⚠️  All data has been removed while preserving the schema.');
    console.log('');

    process.exit(0);
  } catch (error) {
    console.error('');
    console.error('='.repeat(80));
    console.error('❌ ERROR: Failed to clear database');
    console.error('='.repeat(80));
    console.error('');
    console.error(error);
    console.error('');

    // Try to re-enable FK constraints even if there was an error
    try {
      console.log('🔒 Attempting to re-enable foreign key constraints...');
      await queryRunner.query("SET session_replication_role = 'origin';");
      console.log('✅ Foreign key constraints re-enabled');
    } catch (fkError) {
      console.error('⚠️  Failed to re-enable foreign key constraints:', fkError.message);
    }

    process.exit(1);
  } finally {
    // Clean up
    if (queryRunner.isReleased === false) {
      await queryRunner.release();
    }
    if (dataSource.isInitialized) {
      await dataSource.destroy();
      console.log('🔌 Database connection closed');
    }
  }
}

// Run the script
main().catch((error) => {
  console.error('Unhandled error:', error);
  process.exit(1);
});
