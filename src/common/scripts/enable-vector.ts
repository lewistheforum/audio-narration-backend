import { Client } from 'pg';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

async function enableVectorExtension() {
  const client = new Client({
    host: process.env.POSTGRES_HOST,
    port: parseInt(process.env.POSTGRES_PORT || '5432'),
    user: process.env.POSTGRES_USERNAME,
    password: process.env.POSTGRES_PASSWORD,
    database: process.env.POSTGRES_DATABASE,
    ssl:
      process.env.POSTGRES_SSL === 'true'
        ? { rejectUnauthorized: false }
        : false,
  });

  console.log('Connection Config:', {
    host: process.env.POSTGRES_HOST,
    port: process.env.POSTGRES_PORT,
    user: process.env.POSTGRES_USERNAME,
    database: process.env.POSTGRES_DATABASE,
  });

  try {
    console.log('Connecting to database...');
    await client.connect();

    console.log('Enabling "vector" extension...');
    await client.query('CREATE EXTENSION IF NOT EXISTS vector;');

    console.log('✅ "vector" extension enabled successfully.');
  } catch (error) {
    console.error('❌ Failed to enable "vector" extension:', error);
  } finally {
    await client.end();
  }
}

enableVectorExtension();
