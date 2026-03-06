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
  console.log('CREATE ALL TABLES');
  console.log('='.repeat(80));
  console.log('');

  // Validate environment variables
  const missingVars = REQUIRED_ENV_VARS.filter((v) => !process.env[v]);
  if (missingVars.length > 0) {
    console.error('❌ Missing required environment variables:');
    for (const v of missingVars) {
      console.error(`   - ${v}`);
    }
    process.exit(1);
  }

  const dataSource = new DataSource({
    type: 'postgres',
    host: process.env.POSTGRES_HOST!,
    port: parseInt(process.env.POSTGRES_PORT || '5432', 10),
    username: process.env.POSTGRES_USERNAME!,
    password: process.env.POSTGRES_PASSWORD!,
    database: process.env.POSTGRES_DATABASE!,
    ssl:
      process.env.POSTGRES_SSL === 'true'
        ? { rejectUnauthorized: false }
        : false,
    entities: [join(__dirname, '../../**/*.entity{.ts,.js}')],
    synchronize: false,
    logging: false,
  });

  try {
    console.log('Connecting to database...');
    await dataSource.initialize();
    console.log('✓ Connected successfully');
    console.log('');

    console.log('Creating/synchronizing all tables from entities...');
    await dataSource.synchronize();
    console.log('✅ All tables created successfully!');
    console.log('');
  } catch (error) {
    console.error('❌ Error creating tables:');
    if (error instanceof Error) {
      console.error(error.message);
      console.error(error.stack);
    } else {
      console.error(error);
    }
    process.exit(1);
  } finally {
    if (dataSource.isInitialized) {
      await dataSource.destroy();
    }
  }
}

main().catch((error) => {
  console.error('Unhandled error:');
  console.error(error);
  process.exit(1);
});
