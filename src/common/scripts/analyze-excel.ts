import * as XLSX from 'xlsx';
import * as path from 'path';

/**
 * Analyze Excel Structure
 * 
 * Shows all column names in the Excel file to help with mapping
 */

const INPUT_FILE = path.join(process.cwd(), 'data', 'medicines-raw.xlsx');

async function analyzeExcel() {
  console.log('🔍 Analyzing Excel structure...\n');

  try {
    const workbook = XLSX.readFile(INPUT_FILE);
    const sheetName = workbook.SheetNames[0];
    console.log(`📄 Sheet: ${sheetName}\n`);
    
    const worksheet = workbook.Sheets[sheetName];
    const jsonData = XLSX.utils.sheet_to_json(worksheet);
    
    console.log(`📊 Total rows: ${jsonData.length.toLocaleString()}\n`);

    if (jsonData.length > 0) {
      const firstRow = jsonData[0] as any;
      const columns = Object.keys(firstRow);
      
      console.log(`📋 Total columns: ${columns.length}\n`);
      console.log('=' .repeat(80));
      console.log('COLUMN LIST:');
      console.log('='.repeat(80));
      
      columns.forEach((col, idx) => {
        const value = firstRow[col];
        const preview = typeof value === 'string' && value.length > 50 
          ? value.substring(0, 50) + '...' 
          : value;
        console.log(`${(idx + 1).toString().padStart(3)}. ${col.padEnd(30)} = ${preview}`);
      });
      
      console.log('='.repeat(80) + '\n');
      
      // Identify patterns
      console.log('🔎 Pattern Analysis:');
      const sideEffectCols = columns.filter(c => c.startsWith('sideEffect'));
      const useCols = columns.filter(c => c.startsWith('use'));
      const substituteCols = columns.filter(c => c.startsWith('substitute') || c.startsWith('subtitle'));
      
      console.log(`   - sideEffect columns: ${sideEffectCols.length} (${sideEffectCols.slice(0, 3).join(', ')}...)`);
      console.log(`   - use columns: ${useCols.length} (${useCols.slice(0, 3).join(', ')}...)`);
      console.log(`   - substitute/subtitle columns: ${substituteCols.length} (${substituteCols.join(', ')})`);
      console.log(`   - Has "fullSideEffect"?: ${columns.includes('fullSideEffect')}`);
      console.log(`   - Has "fullUse"?: ${columns.includes('fullUse')}`);
      console.log(`   - Has "Chemical Class"?: ${columns.includes('Chemical Class')}`);
      console.log(`   - Has "Therapeutic Class"?: ${columns.includes('Therapeutic Class')}`);
      console.log(`   - Has "Action Class"?: ${columns.includes('Action Class')}`);
      console.log(`   - Has "Habit Forming"?: ${columns.includes('Habit Forming')}`);
      console.log('');
      
      // Show first 3 data rows for context
      console.log('📝 First 3 medicine names:');
      jsonData.slice(0, 3).forEach((row: any, idx) => {
        console.log(`   ${idx + 1}. ${row.name || row.Name || '<no name>'}`);
      });
      console.log('');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.log('\n💡 Make sure the file exists at: data/medicines-raw.xlsx');
  }
}

analyzeExcel();
