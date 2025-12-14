import * as XLSX from 'xlsx';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Convert Excel to CSV for Medicine Import
 * 
 * Converts Excel file (.xlsx, .xls) to CSV format
 * Maps columns from dataset to expected format
 * 
 * Usage:
 * 1. Place Excel file in: data/medicines-raw.xlsx
 * 2. Run: npx ts-node src/common/scripts/convert-excel-to-csv.ts
 * 3. Output: data/medicines.csv
 */

const INPUT_FILE = path.join(process.cwd(), 'data', 'medicines-raw.xlsx');
const OUTPUT_FILE = path.join(process.cwd(), 'data', 'medicines.csv');

// Column mapping from your dataset to our schema
// Excel structure:
//   - name, substitute0-4, fullSideEffect, sideEffect0-2, fullUse, use0
//   - Chemical Class, Habit Forming, Therapeutic Class, Action Class
// We want:
//   - name, subtitle0-4 (from substitute0-4)
//   - fullSideEffect, fullUse (NOT the individual sideEffect0-2, use0)
//   - chemicalClass, habitForming, therapeuticClass, actionClass
const COLUMN_MAPPING = {
  // Basic info
  'name': 'name',
  
  // Subtitles (map from substitute to subtitle)
  'substitute0': 'subtitle0',
  'substitute1': 'subtitle1', 
  'substitute2': 'subtitle2',
  'substitute3': 'subtitle3',
  'substitute4': 'subtitle4',
  
  // Merged side effects and uses (ignore individual sideEffect0-2 and use0)
  'fullSideEffect': 'fullSideEffect',
  'fullUse': 'fullUse',
  
  // Classifications (note: Excel has spaces in column names)
  'Chemical Class': 'chemicalClass',
  'Habit Forming': 'habitForming',
  'Therapeutic Class': 'therapeuticClass',
  'Action Class': 'actionClass',
};

async function convertExcelToCSV() {
  console.log('🔄 Converting Excel to CSV...\n');

  // Check if input file exists
  if (!fs.existsSync(INPUT_FILE)) {
    console.error(`❌ Input file not found: ${INPUT_FILE}`);
    console.log('\n📝 Please place your Excel file at: data/medicines-raw.xlsx');
    console.log('   Supported formats: .xlsx, .xls, .csv\n');
    process.exit(1);
  }

  try {
    // Read Excel file
    console.log(`📖 Reading: ${INPUT_FILE}`);
    const workbook = XLSX.readFile(INPUT_FILE);
    
    // Get first sheet
    const sheetName = workbook.SheetNames[0];
    console.log(`📄 Sheet: ${sheetName}`);
    
    const worksheet = workbook.Sheets[sheetName];
    
    // Convert to JSON first to inspect data
    const jsonData = XLSX.utils.sheet_to_json(worksheet);
    console.log(`📊 Total rows: ${jsonData.length.toLocaleString()}\n`);

    if (jsonData.length === 0) {
      console.error('❌ No data found in Excel file');
      process.exit(1);
    }

    // Display sample row
    console.log('🔍 Sample row (first record):');
    const firstRow = jsonData[0] as any;
    console.log('Available columns in Excel:');
    Object.keys(firstRow).forEach((col, idx) => {
      if (idx < 20) { // Show first 20 columns
        console.log(`   ${idx + 1}. "${col}"`);
      }
    });
    console.log(`   ... and ${Object.keys(firstRow).length - 20} more columns\n`);

    // Map columns
    console.log('🗺️  Mapping columns...');
    console.log('📋 Looking for these columns:');
    Object.entries(COLUMN_MAPPING).forEach(([source, target]) => {
      console.log(`   "${source}" → "${target}"`);
    });
    console.log('');

    const mappedData = jsonData.map((row: any) => {
      const mapped: any = {};
      
      for (const [sourceCol, targetCol] of Object.entries(COLUMN_MAPPING)) {
        // Try exact match first, then case variations
        let value = row[sourceCol];
        
        if (value === undefined) {
          // Try case-insensitive search
          const keys = Object.keys(row);
          const foundKey = keys.find(k => k.toLowerCase() === sourceCol.toLowerCase());
          value = foundKey ? row[foundKey] : '';
        }
        
        mapped[targetCol] = value || '';
      }
      
      return mapped;
    });

    // Create data directory if not exists
    const dataDir = path.join(process.cwd(), 'data');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
      console.log('📁 Created data directory');
    }

    // Convert to CSV
    console.log('💾 Writing CSV file...');
    const newWorksheet = XLSX.utils.json_to_sheet(mappedData);
    const csv = XLSX.utils.sheet_to_csv(newWorksheet);
    
    fs.writeFileSync(OUTPUT_FILE, csv, 'utf-8');
    
    console.log('\n' + '='.repeat(60));
    console.log('✅ CONVERSION COMPLETE');
    console.log('='.repeat(60));
    console.log(`📥 Input:  ${INPUT_FILE}`);
    console.log(`📤 Output: ${OUTPUT_FILE}`);
    console.log(`📊 Rows:   ${jsonData.length.toLocaleString()}`);
    console.log('='.repeat(60) + '\n');

    console.log('✨ Next steps:');
    console.log('   1. Verify the CSV file: data/medicines.csv');
    console.log('   2. Run import: npx ts-node src/common/scripts/bulk-import-medicines.ts\n');

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

convertExcelToCSV();
