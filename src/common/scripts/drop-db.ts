import 'reflect-metadata';
import 'dotenv/config';
import { DataSource } from 'typeorm';

const REQUIRED_ENV_VARS = [
    'POSTGRES_HOST',
    'POSTGRES_PORT',
    'POSTGRES_USERNAME',
    'POSTGRES_PASSWORD',
    'POSTGRES_DATABASE',
];

async function main(): Promise<void> {
    console.log('='.repeat(80));
    console.log('🗑️  DROP & RECREATE DATABASE SCRIPT');
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

    const dbToDrop = process.env.POSTGRES_DATABASE!;

    // We MUST connect to the 'postgres' database to drop and recreate others
    const dataSource = new DataSource({
        type: 'postgres',
        host: process.env.POSTGRES_HOST!,
        port: parseInt(process.env.POSTGRES_PORT || '5432', 10),
        username: process.env.POSTGRES_USERNAME!,
        password: process.env.POSTGRES_PASSWORD!,
        database: 'postgres', // Maintenance DB
        synchronize: false,
        logging: false,
    });

    try {
        console.log('🔌 Connecting to maintenance database (postgres)...');
        await dataSource.initialize();
        console.log('✅ Connected successfully');
        console.log('');

        const queryRunner = dataSource.createQueryRunner();

        // 1. Terminate all connections to the target database
        console.log(`📡 Terminating active sessions for database: ${dbToDrop}`);
        await queryRunner.query(`
      SELECT pg_terminate_backend(pg_stat_activity.pid)
      FROM pg_stat_activity
      WHERE pg_stat_activity.datname = '${dbToDrop}'
        AND pid <> pg_backend_pid();
    `);
        console.log('✅ Sessions terminated');

        // 2. Drop the database
        console.log(`🗑️  Dropping database: ${dbToDrop}`);
        await queryRunner.query(`DROP DATABASE IF EXISTS "${dbToDrop}"`);
        console.log('✅ Database dropped');

        // 3. Recreate the database
        console.log(`✨ Recreating database: ${dbToDrop}`);
        await queryRunner.query(`CREATE DATABASE "${dbToDrop}"`);
        console.log('✅ Database recreated');

        console.log('');
        console.log('='.repeat(80));
        console.log('✅ DATABASE DROPPED AND RECREATED SUCCESSFULLY');
        console.log('='.repeat(80));
        console.log('');

        await dataSource.destroy();
        process.exit(0);
    } catch (error) {
        console.error('');
        console.error('❌ ERROR: Failed to drop/recreate database');
        console.error(error);
        process.exit(1);
    }
}

main().catch((error) => {
    console.error('Unhandled error:', error);
    process.exit(1);
});
