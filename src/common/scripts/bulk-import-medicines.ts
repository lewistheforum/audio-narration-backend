import { DataSource } from 'typeorm';
import { Medicine } from '../../modules/prescriptions/entities/medicine.entity';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import { parse } from 'csv-parse';

dotenv.config();

/**
 * Bulk Import Medicines from CSV
 * 
 * Imports large datasets (250k+ rows) efficiently using:
 * - Batch processing (1000 records per batch)
 * - Transaction support
 * - Progress tracking
 * - Error handling
 * 
 * Usage:
 * 1. Place CSV file in: data/medicines.csv
 * 2. Run: npx ts-node src/common/scripts/bulk-import-medicines.ts
 */

interface MedicineRow {
  name: string;
  subtitle0?: string;
  subtitle1?: string;
  subtitle2?: string;
  subtitle3?: string;
  subtitle4?: string;
  fullSideEffect?: string;
  fullUse?: string;
  chemicalClass?: string;
  habitForming?: string;
  therapeuticClass?: string;
  actionClass?: string;
}

const BATCH_SIZE = 1000; // Process 1000 records at a time
const CSV_FILE_PATH = path.join(process.cwd(), 'data', 'medicines.csv');

async function importMedicines() {
  console.log('🚀 Starting bulk import...\n');

  // Check if CSV file exists
  if (!fs.existsSync(CSV_FILE_PATH)) {
    console.error(`❌ CSV file not found: ${CSV_FILE_PATH}`);
    console.log('\n📝 Please create the file with the following structure:');
    console.log('name,subtitle0,subtitle1,subtitle2,subtitle3,subtitle4,fullSideEffect,fullUse,chemicalClass,habitForming,therapeuticClass,actionClass\n');
    process.exit(1);
  }

  // Initialize database connection
  const dataSource = new DataSource({
    type: 'postgres',
    host: process.env.POSTGRES_HOST,
    port: parseInt(process.env.POSTGRES_PORT || '5432'),
    username: process.env.POSTGRES_USERNAME,
    password: process.env.POSTGRES_PASSWORD,
    database: process.env.POSTGRES_DATABASE,
    entities: [Medicine],
    synchronize: false, // Don't auto-sync in production
  });

  try {
    await dataSource.initialize();
    console.log('✅ Database connected\n');

    const repository = dataSource.getRepository(Medicine);

    // Clear existing data (optional - comment out if you want to append)
    const existingCount = await repository.count();
    if (existingCount > 0) {
      console.log(`⚠️  Found ${existingCount} existing medicines`);
      console.log('🗑️  Clearing existing data...');
      await repository.clear();
      console.log('✅ Cleared successfully\n');
    }

    // Read and parse CSV
    let batch: Medicine[] = [];
    let totalProcessed = 0;
    let totalInserted = 0;
    let errorCount = 0;
    const startTime = Date.now();

    const parser = fs.createReadStream(CSV_FILE_PATH).pipe(
      parse({
        columns: true, // First row is header
        skip_empty_lines: true,
        trim: true,
        relax_column_count: true, // Handle inconsistent column counts
      })
    );

    console.log('📥 Reading CSV file...\n');

    for await (const row of parser) {
      try {
        const medicineRow = row as MedicineRow;

        // Skip if name is empty
        if (!medicineRow.name || medicineRow.name.trim() === '') {
          continue;
        }

        // Helper: convert empty strings and "NA" to null
        const toNullIfEmpty = (value?: string): string | null => {
          if (!value) return null;
          const trimmed = value.trim();
          if (trimmed === '' || trimmed.toUpperCase() === 'NA') return null;
          return trimmed;
        };

        const medicine = repository.create({
          name: medicineRow.name.trim(),
          subtitle0: toNullIfEmpty(medicineRow.subtitle0),
          subtitle1: toNullIfEmpty(medicineRow.subtitle1),
          subtitle2: toNullIfEmpty(medicineRow.subtitle2),
          subtitle3: toNullIfEmpty(medicineRow.subtitle3),
          subtitle4: toNullIfEmpty(medicineRow.subtitle4),
          sideEffect: toNullIfEmpty(medicineRow.fullSideEffect),
          used: toNullIfEmpty(medicineRow.fullUse),
          chemicalClass: toNullIfEmpty(medicineRow.chemicalClass),
          habitForming: medicineRow.habitForming?.toLowerCase() === 'yes' || medicineRow.habitForming?.toLowerCase() === 'true',
          therapeuticClass: toNullIfEmpty(medicineRow.therapeuticClass),
          actionClass: toNullIfEmpty(medicineRow.actionClass),
        });

        batch.push(medicine);
        totalProcessed++;

        // Insert batch when it reaches BATCH_SIZE
        if (batch.length >= BATCH_SIZE) {
          await insertBatch(repository, batch);
          totalInserted += batch.length;

          // Progress update
          const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
          const rate = (totalProcessed / parseFloat(elapsed)).toFixed(0);
          console.log(`✅ Processed: ${totalProcessed.toLocaleString()} | Inserted: ${totalInserted.toLocaleString()} | Rate: ${rate} rec/sec | Errors: ${errorCount}`);

          batch = []; // Clear batch
        }
      } catch (error) {
        errorCount++;
        console.error(`❌ Error processing row ${totalProcessed}:`, error.message);
      }
    }

    // Insert remaining records
    if (batch.length > 0) {
      await insertBatch(repository, batch);
      totalInserted += batch.length;
    }

    // Final summary
    const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
    const avgRate = (totalInserted / parseFloat(totalTime)).toFixed(0);

    console.log('\n' + '='.repeat(60));
    console.log('🎉 IMPORT COMPLETE');
    console.log('='.repeat(60));
    console.log(`✅ Total processed: ${totalProcessed.toLocaleString()} rows`);
    console.log(`✅ Total inserted: ${totalInserted.toLocaleString()} medicines`);
    console.log(`❌ Errors: ${errorCount}`);
    console.log(`⏱️  Time: ${totalTime}s`);
    console.log(`📊 Average rate: ${avgRate} records/second`);
    console.log('='.repeat(60) + '\n');

    // Verify final count
    const finalCount = await repository.count();
    console.log(`📊 Database count: ${finalCount.toLocaleString()} medicines\n`);

  } catch (error) {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  } finally {
    await dataSource.destroy();
    console.log('🔌 Database connection closed');
  }
}

/**
 * Insert batch with transaction support
 */
async function insertBatch(repository: any, batch: Medicine[]): Promise<void> {
  const queryRunner = repository.manager.connection.createQueryRunner();

  try {
    await queryRunner.connect();
    await queryRunner.startTransaction();

    await queryRunner.manager.save(Medicine, batch);

    await queryRunner.commitTransaction();
  } catch (error) {
    await queryRunner.rollbackTransaction();
    throw error;
  } finally {
    await queryRunner.release();
  }
}

// Run import
importMedicines()
  .then(() => {
    console.log('✨ Import script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Import failed:', error);
    process.exit(1);
  });
