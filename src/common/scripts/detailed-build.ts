import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

console.log('=========================================');
console.log('   Starting Detailed Build Process (Cross-Platform)');
console.log('=========================================');

// 1. Environment Info
console.log('\n[1/5] Checking Environment...');
console.log(`Node Version: ${process.version}`);
try {
  const pnpmVersion = execSync('pnpm -v', { encoding: 'utf-8' }).trim();
  console.log(`pnpm Version: ${pnpmVersion}`);
} catch (e) {
  console.log('pnpm Version: Not found or error retrieving version');
}
console.log(`Current Directory: ${process.cwd()}`);

// 2. Clean
console.log('\n[2/5] Cleaning dist directory...');
const distPath = path.join(process.cwd(), 'dist');
try {
  if (fs.existsSync(distPath)) {
    fs.rmSync(distPath, { recursive: true, force: true });
  }
  console.log('✔ dist directory cleaned.');
} catch (e) {
  console.error('✘ Failed to clean dist directory:', e);
  process.exit(1);
}

// 3. Type Check
console.log('\n[3/5] Running Type Check (tsc --noEmit)...');
try {
  execSync('npx tsc --noEmit --pretty', { stdio: 'inherit' });
  console.log('✔ Type check passed.');
} catch (e) {
  console.error('✘ Type check failed.');
  process.exit(1);
}

// 4. Build
console.log('\n[4/5] Running Build (nest build)...');
const startTime = Date.now();
try {
  execSync('nest build', { stdio: 'inherit' });
  const endTime = Date.now();
  console.log(
    `✔ Build completed in ${((endTime - startTime) / 1000).toFixed(2)} seconds.`,
  );
} catch (e) {
  console.error('✘ Build failed.');
  process.exit(1);
}

// 5. Analysis
console.log('\n[5/5] Build Artifacts Analysis...');

function getAllFiles(dirPath: string, arrayOfFiles: string[] = []) {
  const files = fs.readdirSync(dirPath);

  files.forEach(function (file) {
    if (fs.statSync(dirPath + '/' + file).isDirectory()) {
      arrayOfFiles = getAllFiles(dirPath + '/' + file, arrayOfFiles);
    } else {
      arrayOfFiles.push(path.join(dirPath, '/', file));
    }
  });

  return arrayOfFiles;
}

if (fs.existsSync(distPath)) {
  const allFiles = getAllFiles(distPath);
  const totalFiles = allFiles.length;

  // Sort files by size
  const fileStats = allFiles
    .map((file) => {
      const stats = fs.statSync(file);
      return {
        file: path.relative(process.cwd(), file),
        size: stats.size,
      };
    })
    .sort((a, b) => b.size - a.size);

  // Identify empty files (potential failures)
  const emptyFiles = fileStats.filter((f) => f.size === 0);
  const successfulFiles = fileStats.filter((f) => f.size > 0);

  console.log(`\nBuild Summary:`);
  console.log(`Total Files Scanned: ${totalFiles}`);
  console.log(`Successfully Generated: ${successfulFiles.length}`);

  if (emptyFiles.length > 0) {
    console.log(`\nPotential Issues (0-byte files): ${emptyFiles.length}`);
    emptyFiles.forEach((f) => console.log(` - ${f.file}`));
  } else {
    console.log(`Failed/Empty Files: 0`);
  }

  // Helper to format bytes
  const formatBytes = (bytes: number, decimals = 2) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  };

  const totalSize = fileStats.reduce((acc, curr) => acc + curr.size, 0);
  console.log(`\nTotal Build Size: ${formatBytes(totalSize)}`);
} else {
  console.error(
    '✘ dist directory not found. Build might have failed silently.',
  );
  process.exit(1);
}

console.log('\n=========================================');
console.log('   Build Process Completed Successfully');
console.log('=========================================');
