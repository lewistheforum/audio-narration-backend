import { Client } from 'pg';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

/**
 * Enable pgvector extension for PostgreSQL
 * Supports both local Docker and production (Aiven) databases
 */
async function enableVectorExtension() {
  // Configure SSL for production (Aiven) or local (Docker)
  const sslConfig =
    process.env.POSTGRES_SSL === 'true'
      ? { rejectUnauthorized: false }
      : false;

  const client = new Client({
    host: process.env.POSTGRES_HOST,
    port: parseInt(process.env.POSTGRES_PORT || '5432'),
    user: process.env.POSTGRES_USERNAME,
    password: process.env.POSTGRES_PASSWORD,
    database: process.env.POSTGRES_DATABASE,
    ssl: sslConfig,
  });

  console.log('Connection Config:', {
    host: process.env.POSTGRES_HOST,
    port: process.env.POSTGRES_PORT,
    user: process.env.POSTGRES_USERNAME,
    database: process.env.POSTGRES_DATABASE,
    ssl: !!sslConfig,
  });

  try {
    console.log('Connecting to database...');
    await client.connect();

    // Check if pgvector extension is available
    const availableResult = await client.query(
      "SELECT * FROM pg_available_extensions WHERE name = 'vector'",
    );

    if (availableResult.rows.length === 0) {
      console.error(
        '⚠️  pgvector extension is not available on this database.',
      );
      console.log('\nTroubleshooting:');
      console.log(
        '- Docker: Ensure using pgvector/pgvector image (not plain postgres)',
      );
      console.log(
        '- Aiven: Enable pgvector from Console → Service → Extensions',
      );
      console.log('- Local: Build and install pgvector from source');
      return;
    }

    console.log('✅ pgvector extension is available');

    // Enable vector extension
    console.log('Enabling "vector" extension...');
    await client.query('CREATE EXTENSION IF NOT EXISTS vector');

    // Verify installation
    const installedResult = await client.query(
      "SELECT extname, extversion FROM pg_extension WHERE extname = 'vector'",
    );

    if (installedResult.rows.length > 0) {
      const { extversion } = installedResult.rows[0];
      console.log('✅ "vector" extension enabled successfully');
      console.log(`   Version: ${extversion}`);

      // Test vector functionality
      await client.query("SELECT '[1,2,3]'::vector(3)");
      console.log('✅ Vector functionality verified');
    } else {
      console.error('⚠️  Extension created but not found in pg_extension');
    }
  } catch (error) {
    console.error('❌ Failed to enable "vector" extension');
    console.error('Error:', error.message);

    if (error.code === 'ECONNREFUSED') {
      console.log('\n→ Database connection refused. Is the database running?');
    } else if (error.code === '42704') {
      console.log('\n→ Vector type not found. Extension may not be installed.');
    } else if (error.code === '28P01') {
      console.log('\n→ Authentication failed. Check credentials in .env');
    }
  } finally {
    await client.end();
  }
}

enableVectorExtension();
