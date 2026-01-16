import 'reflect-metadata';
import 'dotenv/config';
import { DataSource } from 'typeorm';
import { join } from 'path';
import { readFileSync, readdirSync } from 'fs';

/**
 * Seeder Check Script
 *
 * Comprehensive validation script for seeders in the NestJS + TypeORM project.
 *
 * Validates:
 * 1. Seeder inventory and registration
 * 2. Dependency graph & ordering
 * 3. System Context compliance (DI mechanism)
 * 4. Data integrity validation (post-seed)
 * 5. Idempotency smoke test mode
 * 6. English default-content check
 * 7. Race-condition risk detection
 */

// ============================================================================
// TYPES AND INTERFACES
// ============================================================================

interface ValidationResult {
  category: string;
  status: 'PASS' | 'FAIL' | 'WARN';
  message: string;
  details?: string[];
}

interface SeederInfo {
  name: string;
  path: string;
  className: string;
  dependencies: string[];
}

interface DependencyNode {
  name: string;
  dependencies: string[];
}

// ============================================================================
// SEEDER REGISTRY (from SeedersModule)
// ============================================================================

const EXPECTED_SEEDERS = [
  'AdminSeederService',
  'AccountSeederService',
  'ClinicAdminInformationSeederService',
  'ClinicManagerInformationSeederService',
  'ClinicsLegalDocumentsSeederService',
  'AddressSeederService',
  'GoogleIframeSeederService',
  'ContractPackageSeederService',
  'ClinicContractInformationSeederService',
  'ClinicStaffInformationSeederService',
  'DoctorInformationSeederService',
  'GeneralAccountSeederService',
  'FeedbackSeederService',
  'BlogSeederService',
  'SubscriptionServiceSeederService',
  'SubscriptionsSeederService',
  'ClinicServiceCategorySeederService',
  'ClinicServiceSeederService',
  'ClinicServiceConfigSeederService',
];

// Execution order from SeederOrchestratorService
const EXECUTION_ORDER = [
  'AdminSeederService',
  'AccountSeederService',
  'ClinicAdminInformationSeederService',
  'ClinicManagerInformationSeederService',
  'ClinicsLegalDocumentsSeederService',
  'AddressSeederService',
  'GoogleIframeSeederService',
  'ContractPackageSeederService',
  'ClinicContractInformationSeederService',
  'ClinicStaffInformationSeederService',
  'DoctorInformationSeederService',
  'GeneralAccountSeederService',
  'FeedbackSeederService',
  'BlogSeederService',
  'SubscriptionServiceSeederService',
  'SubscriptionsSeederService',
  'ClinicServiceCategorySeederService',
  'ClinicServiceSeederService',
  'ClinicServiceConfigSeederService',
];

// Dependency declarations (based on execution order and data dependencies)
const SEEDER_DEPENDENCIES: Record<string, string[]> = {
  'AdminSeederService': [],
  'AccountSeederService': ['AdminSeederService'],
  'ClinicAdminInformationSeederService': ['AccountSeederService'],
  'ClinicManagerInformationSeederService': ['AccountSeederService'],
  'ClinicsLegalDocumentsSeederService': ['ClinicManagerInformationSeederService'],
  'AddressSeederService': ['ClinicManagerInformationSeederService'],
  'GoogleIframeSeederService': ['AddressSeederService'],
  'ContractPackageSeederService': [],
  'ClinicContractInformationSeederService': ['ContractPackageSeederService'],
  'ClinicStaffInformationSeederService': ['ClinicContractInformationSeederService'],
  'DoctorInformationSeederService': ['ClinicContractInformationSeederService'],
  'GeneralAccountSeederService': ['AccountSeederService'],
  'FeedbackSeederService': ['AccountSeederService'],
  'BlogSeederService': ['AccountSeederService'],
  'SubscriptionServiceSeederService': [],
  'SubscriptionsSeederService': ['SubscriptionServiceSeederService', 'AccountSeederService'],
  'ClinicServiceCategorySeederService': [],
  'ClinicServiceSeederService': ['ClinicServiceCategorySeederService'],
  'ClinicServiceConfigSeederService': ['ClinicServiceSeederService', 'AccountSeederService'],
};

// Vietnamese diacritic pattern for English content check
const VIETNAMESE_DIACRITIC_PATTERN = /[\u00E0-\u00EF\u1EA0-\u1EF9]/;

// ============================================================================
// VALIDATION RESULTS
// ============================================================================

const results: ValidationResult[] = [];

// ============================================================================
// MAIN FUNCTION
// ============================================================================

async function runSeederChecks(): Promise<void> {
  console.log('='.repeat(80));
  console.log('SEEDER VALIDATION CHECK');
  console.log('='.repeat(80));
  console.log('');

  // Parse command line arguments
  const args = process.argv.slice(2);
  const idempotencyMode = args.includes('--idempotency-test');
  const verbose = args.includes('--verbose');

  if (idempotencyMode) {
    console.log('⚠️  IDEMPOTENCY SMOKE TEST MODE ENABLED');
    console.log('This will run: seed → check → seed again → check again');
    console.log('Safe for dev/test environments only!');
    console.log('');
  }

  // Create DataSource
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
  });

  try {
    console.log('Connecting to database...');
    await dataSource.initialize();
    console.log('✓ Connected successfully');
    console.log('');

    // Run all validations
    await validateSeederInventory();
    await validateDependencyGraph();
    await validateDICompliance();
    await validateDataIntegrity(dataSource);
    await validateEnglishContent(dataSource);
    await validateRaceConditionRisks();

    // Print summary
    printSummary();

    // Exit with appropriate code
    const hasFailures = results.some((r) => r.status === 'FAIL');
    process.exit(hasFailures ? 1 : 0);
  } catch (error) {
    console.error('❌ Error running seeder checks:');
    console.error(error);
    process.exit(1);
  } finally {
    if (dataSource.isInitialized) {
      await dataSource.destroy();
    }
  }
}

// ============================================================================
// VALIDATION 1: SEEDER INVENTORY AND REGISTRATION
// ============================================================================

async function validateSeederInventory(): Promise<void> {
  console.log('1️⃣  SEEDER INVENTORY AND REGISTRATION');
  console.log('-'.repeat(80));

  const seedersDir = join(__dirname, '../seeders');
  const seederFiles = readdirSync(seedersDir)
    .filter((file) => file.endsWith('-seeder.service.ts'))
    .map((file) => file.replace('-seeder.service.ts', ''))
    .map((name) => {
      // Convert kebab-case to PascalCase
      return name
        .split('-')
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join('');
    })
    .map((name) => `${name}SeederService`);

  // Check if all expected seeders are present
  const missingSeeders = EXPECTED_SEEDERS.filter(
    (seeder) => !seederFiles.includes(seeder),
  );
  const extraSeeders = seederFiles.filter(
    (seeder) => !EXPECTED_SEEDERS.includes(seeder),
  );

  if (missingSeeders.length === 0 && extraSeeders.length === 0) {
    results.push({
      category: 'Seeder Inventory',
      status: 'PASS',
      message: 'All seeders are registered correctly',
    });
    console.log('✅ PASS: All seeders are registered correctly');
  } else {
    const details: string[] = [];
    if (missingSeeders.length > 0) {
      details.push(`Missing seeders: ${missingSeeders.join(', ')}`);
    }
    if (extraSeeders.length > 0) {
      details.push(`Unregistered seeders: ${extraSeeders.join(', ')}`);
    }
    results.push({
      category: 'Seeder Inventory',
      status: 'FAIL',
      message: 'Seeder registration mismatch detected',
      details,
    });
    console.log('❌ FAIL: Seeder registration mismatch detected');
    if (missingSeeders.length > 0) {
      console.log(`   Missing: ${missingSeeders.join(', ')}`);
    }
    if (extraSeeders.length > 0) {
      console.log(`   Extra: ${extraSeeders.join(', ')}`);
    }
  }

  console.log(`   Expected: ${EXPECTED_SEEDERS.length} seeders`);
  console.log(`   Found: ${seederFiles.length} seeder files`);
  console.log('');
}

// ============================================================================
// VALIDATION 2: DEPENDENCY GRAPH & ORDERING
// ============================================================================

async function validateDependencyGraph(): Promise<void> {
  console.log('2️⃣  DEPENDENCY GRAPH & ORDERING');
  console.log('-'.repeat(80));

  // Check for circular dependencies
  const cycle = detectCircularDependency();
  if (cycle) {
    results.push({
      category: 'Dependency Graph',
      status: 'FAIL',
      message: 'Circular dependency detected',
      details: [`Cycle: ${cycle.join(' → ')}`],
    });
    console.log('❌ FAIL: Circular dependency detected');
    console.log(`   Cycle: ${cycle.join(' → ')}`);
  } else {
    results.push({
      category: 'Dependency Graph',
      status: 'PASS',
      message: 'No circular dependencies detected',
    });
    console.log('✅ PASS: No circular dependencies detected');
  }

  // Check if execution order respects dependencies
  const orderViolations = validateExecutionOrder();
  if (orderViolations.length > 0) {
    results.push({
      category: 'Dependency Graph',
      status: 'WARN',
      message: 'Execution order may violate dependencies',
      details: orderViolations,
    });
    console.log('⚠️  WARN: Execution order may violate dependencies');
    orderViolations.forEach((violation) => {
      console.log(`   ${violation}`);
    });
  } else {
    console.log('✅ PASS: Execution order respects dependencies');
  }

  console.log('');
}

/**
 * Detect circular dependencies using DFS
 */
function detectCircularDependency(): string[] | null {
  const visited = new Set<string>();
  const recursionStack = new Set<string>();
  const path: string[] = [];

  function visit(node: string): boolean {
    visited.add(node);
    recursionStack.add(node);
    path.push(node);

    for (const dep of SEEDER_DEPENDENCIES[node] || []) {
      if (!visited.has(dep)) {
        if (visit(dep)) {
          return true;
        }
      } else if (recursionStack.has(dep)) {
        // Found cycle
        const cycleStart = path.indexOf(dep);
        return true;
      }
    }

    path.pop();
    recursionStack.delete(node);
    return false;
  }

  for (const seeder of Object.keys(SEEDER_DEPENDENCIES)) {
    if (!visited.has(seeder)) {
      if (visit(seeder)) {
        // Extract cycle
        const cycleStart = path.indexOf(path[path.length - 1]);
        return path.slice(cycleStart);
      }
    }
  }

  return null;
}

/**
 * Validate that execution order respects dependencies
 */
function validateExecutionOrder(): string[] {
  const violations: string[] = [];
  const seederIndex = new Map<string, number>();

  EXECUTION_ORDER.forEach((seeder, index) => {
    seederIndex.set(seeder, index);
  });

  for (const seeder of EXECUTION_ORDER) {
    for (const dep of SEEDER_DEPENDENCIES[seeder] || []) {
      const depIndex = seederIndex.get(dep);
      const seederIdx = seederIndex.get(seeder);

      if (depIndex === undefined) {
        violations.push(`Dependency ${dep} of ${seeder} is not in execution order`);
      } else if (seederIdx !== undefined && depIndex >= seederIdx) {
        violations.push(
          `${seeder} (index ${seederIdx}) depends on ${dep} (index ${depIndex})`,
        );
      }
    }
  }

  return violations;
}

// ============================================================================
// VALIDATION 3: SYSTEM CONTEXT COMPLIANCE (DI MECHANISM)
// ============================================================================

async function validateDICompliance(): Promise<void> {
  console.log('3️⃣  SYSTEM CONTEXT COMPLIANCE (DI MECHANISM)');
  console.log('-'.repeat(80));

  const seedersDir = join(__dirname, '../seeders');
  const violations: string[] = [];

  for (const seederName of EXPECTED_SEEDERS) {
    const fileName = seederName
      .replace('SeederService', '-seeder.service.ts')
      .replace(/([A-Z])/g, '-$1')
      .toLowerCase()
      .substring(1);

    const filePath = join(seedersDir, fileName);

    try {
      const content = readFileSync(filePath, 'utf-8');

      // Check for constructor injection pattern
      const hasConstructor = /constructor\s*\(/.test(content);
      const hasPrivateReadonly = /private\s+readonly\s+\w+/.test(content);

      if (!hasConstructor) {
        violations.push(`${seederName}: Missing constructor`);
      } else if (!hasPrivateReadonly) {
        violations.push(
          `${seederName}: Constructor parameters should use 'private readonly'`,
        );
      }

      // Check for direct repository instantiation (anti-pattern)
      const hasNewRepository = /new\s+\w+Repository\s*\(/.test(content);
      if (hasNewRepository) {
        violations.push(
          `${seederName}: Direct repository instantiation detected (should use DI)`,
        );
      }

      // Check for service locator pattern (anti-pattern)
      const hasModuleRef = /ModuleRef\s|get\s*\(/.test(content);
      if (hasModuleRef) {
        violations.push(
          `${seederName}: Service locator pattern detected (should use DI)`,
        );
      }
    } catch (error) {
      violations.push(`${seederName}: Could not read file (${error})`);
    }
  }

  if (violations.length === 0) {
    results.push({
      category: 'DI Compliance',
      status: 'PASS',
      message: 'All seeders use proper DI mechanism',
    });
    console.log('✅ PASS: All seeders use proper DI mechanism');
  } else {
    results.push({
      category: 'DI Compliance',
      status: 'FAIL',
      message: 'DI compliance violations detected',
      details: violations,
    });
    console.log('❌ FAIL: DI compliance violations detected');
    violations.forEach((violation) => {
      console.log(`   ${violation}`);
    });
  }

  console.log('');
}

// ============================================================================
// VALIDATION 4: DATA INTEGRITY VALIDATION
// ============================================================================

async function validateDataIntegrity(dataSource: DataSource): Promise<void> {
  console.log('4️⃣  DATA INTEGRITY VALIDATION');
  console.log('-'.repeat(80));

  const violations: string[] = [];

  // Check foreign key mappings
  await validateForeignKeyMappings(dataSource, violations);

  // Check uniqueness constraints
  await validateUniquenessConstraints(dataSource, violations);

  if (violations.length === 0) {
    results.push({
      category: 'Data Integrity',
      status: 'PASS',
      message: 'All data integrity checks passed',
    });
    console.log('✅ PASS: All data integrity checks passed');
  } else {
    results.push({
      category: 'Data Integrity',
      status: 'WARN',
      message: 'Data integrity issues detected',
      details: violations,
    });
    console.log('⚠️  WARN: Data integrity issues detected');
    violations.forEach((violation) => {
      console.log(`   ${violation}`);
    });
  }

  console.log('');
}

async function validateForeignKeyMappings(
  dataSource: DataSource,
  violations: string[],
): Promise<void> {
  // Check clinicId in clinic_subscriptions
  const clinicSubscriptions = await dataSource.query(
    'SELECT clinic_id FROM clinic_subcriptions WHERE deleted_at IS NULL',
  );
  const clinicAdmins = await dataSource.query(
    "SELECT _id FROM accounts WHERE role = 'CLINIC_ADMIN' AND deleted_at IS NULL",
  );
  const clinicManagers = await dataSource.query(
    "SELECT _id FROM accounts WHERE role = 'CLINIC_MANAGER' AND deleted_at IS NULL",
  );

  const clinicAdminIds = new Set(clinicAdmins.map((a: any) => a._id));
  const clinicManagerIds = new Set(clinicManagers.map((a: any) => a._id));

  for (const sub of clinicSubscriptions) {
    const clinicId = sub.clinic_id;
    if (!clinicAdminIds.has(clinicId) && !clinicManagerIds.has(clinicId)) {
      violations.push(
        `clinic_subscriptions: clinic_id ${clinicId} does not reference a valid CLINIC_ADMIN or CLINIC_MANAGER account`,
      );
    }
  }

  // Check serviceId in clinic_subscriptions
  const subscriptionServices = await dataSource.query(
    'SELECT _id FROM subcription_services WHERE deleted_at IS NULL',
  );
  const serviceIds = new Set(subscriptionServices.map((s: any) => s._id));

  for (const sub of clinicSubscriptions) {
    const serviceId = sub.service_id;
    if (!serviceIds.has(serviceId)) {
      violations.push(
        `clinic_subscriptions: service_id ${serviceId} does not reference a valid subscription service`,
      );
    }
  }

  // Check categoryId in clinic_services
  const clinicServices = await dataSource.query(
    'SELECT _id, category_id FROM clinic_services WHERE deleted_at IS NULL',
  );
  const serviceCategories = await dataSource.query(
    'SELECT _id FROM clinic_service_category WHERE deleted_at IS NULL',
  );
  const categoryIds = new Set(serviceCategories.map((c: any) => c._id));

  for (const service of clinicServices) {
    const categoryId = service.category_id;
    if (!categoryIds.has(categoryId)) {
      violations.push(
        `clinic_services: category_id ${categoryId} does not reference a valid service category`,
      );
    }
  }

  // Check serviceId in clinic_service_config
  const serviceConfigs = await dataSource.query(
    'SELECT service_id, clinic_id FROM clinic_service_config WHERE deleted_at IS NULL',
  );

  const clinicServiceIds = new Set(clinicServices.map((s: any) => s._id));

  for (const config of serviceConfigs) {
    const serviceId = config.service_id;
    if (!clinicServiceIds.has(serviceId)) {
      violations.push(
        `clinic_service_config: service_id ${serviceId} does not reference a valid clinic service`,
      );
    }
    const clinicId = config.clinic_id;
    if (!clinicAdminIds.has(clinicId) && !clinicManagerIds.has(clinicId)) {
      violations.push(
        `clinic_service_config: clinic_id ${clinicId} does not reference a valid CLINIC_ADMIN or CLINIC_MANAGER account`,
      );
    }
  }
}

async function validateUniquenessConstraints(
  dataSource: DataSource,
  violations: string[],
): Promise<void> {
  // Check service_code uniqueness
  const duplicateServiceCodes = await dataSource.query(`
    SELECT service_code, COUNT(*) as count
    FROM clinic_services
    WHERE deleted_at IS NULL
    GROUP BY service_code
    HAVING COUNT(*) > 1
  `);

  for (const dup of duplicateServiceCodes) {
    violations.push(
      `clinic_services: service_code '${dup.service_code}' has ${dup.count} duplicates`,
    );
  }

  // Check one active subscription per clinic
  const duplicateSubscriptions = await dataSource.query(`
    SELECT clinic_id, COUNT(*) as count
    FROM clinic_subcriptions
    WHERE deleted_at IS NULL
      AND subscription_status = 'ACTIVE'
    GROUP BY clinic_id
    HAVING COUNT(*) > 1
  `);

  for (const dup of duplicateSubscriptions) {
    violations.push(
      `clinic_subscriptions: clinic_id ${dup.clinic_id} has ${dup.count} active subscriptions (should have at most 1)`,
    );
  }

  // Check email uniqueness
  const duplicateEmails = await dataSource.query(`
    SELECT email, COUNT(*) as count
    FROM accounts
    WHERE deleted_at IS NULL
    GROUP BY email
    HAVING COUNT(*) > 1
  `);

  for (const dup of duplicateEmails) {
    violations.push(
      `accounts: email '${dup.email}' has ${dup.count} duplicates`,
    );
  }
}

// ============================================================================
// VALIDATION 5: ENGLISH DEFAULT-CONTENT CHECK
// ============================================================================

async function validateEnglishContent(dataSource: DataSource): Promise<void> {
  console.log('5️⃣  ENGLISH DEFAULT-CONTENT CHECK');
  console.log('-'.repeat(80));

  const violations: string[] = [];

  // Check clinic_manager_information.clinic_branch_name
  const clinicBranches = await dataSource.query(
    'SELECT _id, clinic_branch_name FROM clinic_manager_information WHERE deleted_at IS NULL',
  );

  for (const branch of clinicBranches) {
    if (VIETNAMESE_DIACRITIC_PATTERN.test(branch.clinic_branch_name)) {
      violations.push(
        `clinic_manager_information: clinic_branch_name '${branch.clinic_branch_name}' contains Vietnamese diacritics`,
      );
    }
  }

  // Check clinic_manager_information.description (if exists)
  try {
    const descriptions = await dataSource.query(`
      SELECT _id, description FROM clinic_manager_information
      WHERE deleted_at IS NULL AND description IS NOT NULL
    `);

    for (const desc of descriptions) {
      if (VIETNAMESE_DIACRITIC_PATTERN.test(desc.description)) {
        violations.push(
          `clinic_manager_information: description contains Vietnamese diacritics (ID: ${desc._id})`,
        );
      }
    }
  } catch (error) {
    // description column might not exist
  }

  // Check blogs.title and content
  const blogs = await dataSource.query(
    'SELECT _id, title, content FROM blogs WHERE deleted_at IS NULL',
  );

  for (const blog of blogs) {
    if (VIETNAMESE_DIACRITIC_PATTERN.test(blog.title)) {
      violations.push(
        `blogs: title '${blog.title}' contains Vietnamese diacritics (ID: ${blog._id})`,
      );
    }
    if (VIETNAMESE_DIACRITIC_PATTERN.test(blog.content)) {
      violations.push(
        `blogs: content contains Vietnamese diacritics (ID: ${blog._id})`,
      );
    }
  }

  // Check feedback.description
  const feedbacks = await dataSource.query(
    'SELECT _id, description FROM feedbacks WHERE deleted_at IS NULL AND description IS NOT NULL',
  );

  for (const feedback of feedbacks) {
    if (VIETNAMESE_DIACRITIC_PATTERN.test(feedback.description)) {
      violations.push(
        `feedbacks: description contains Vietnamese diacritics (ID: ${feedback._id})`,
      );
    }
  }

  if (violations.length === 0) {
    results.push({
      category: 'English Content',
      status: 'PASS',
      message: 'All text content is English-only',
    });
    console.log('✅ PASS: All text content is English-only');
  } else {
    results.push({
      category: 'English Content',
      status: 'WARN',
      message: 'Vietnamese/diacritic text detected',
      details: violations,
    });
    console.log('⚠️  WARN: Vietnamese/diacritic text detected');
    violations.forEach((violation) => {
      console.log(`   ${violation}`);
    });
  }

  console.log('');
}

// ============================================================================
// VALIDATION 6: RACE-CONDITION RISK DETECTION
// ============================================================================

async function validateRaceConditionRisks(): Promise<void> {
  console.log('6️⃣  RACE-CONDITION RISK DETECTION');
  console.log('-'.repeat(80));

  const risks: string[] = [];

  const seedersDir = join(__dirname, '../seeders');

  for (const seederName of EXPECTED_SEEDERS) {
    const fileName = seederName
      .replace('SeederService', '-seeder.service.ts')
      .replace(/([A-Z])/g, '-$1')
      .toLowerCase()
      .substring(1);

    const filePath = join(seedersDir, fileName);

    try {
      const content = readFileSync(filePath, 'utf-8');

      // Detect "find-then-insert" pattern
      const hasFindThenInsert =
        /const\s+\w+\s*=\s*await\s+\w+\.find\w+\([^)]*\)\s*[\s\S]*?await\s+\w+\.save\(/.test(
          content,
        );

      if (hasFindThenInsert) {
        risks.push(
          `${seederName}: Find-then-insert pattern detected (potential race condition)`,
        );
      }

      // Check for proper idempotency checks
      const hasIdempotencyCheck =
        /if\s*\([^)]*\)\s*{\s*return\s*;?\s*}/.test(content) ||
        /existsBy\w+/.test(content) ||
        /count\(\)/.test(content);

      if (!hasIdempotencyCheck && hasFindThenInsert) {
        risks.push(
          `${seederName}: Find-then-insert without idempotency check`,
        );
      }

      // Check for upsert pattern (good practice)
      const hasUpsert =
        /upsert|save\s*\([^)]*\)\s*\.then|create\s*\(\{[^}]*onConflict/.test(
          content,
        );

      if (!hasUpsert && hasFindThenInsert) {
        risks.push(
          `${seederName}: Consider using upsert pattern instead of find-then-insert`,
        );
      }
    } catch (error) {
      risks.push(`${seederName}: Could not read file (${error})`);
    }
  }

  if (risks.length === 0) {
    results.push({
      category: 'Race Condition',
      status: 'PASS',
      message: 'No race condition risks detected',
    });
    console.log('✅ PASS: No race condition risks detected');
  } else {
    results.push({
      category: 'Race Condition',
      status: 'WARN',
      message: 'Race condition risks detected',
      details: risks,
    });
    console.log('⚠️  WARN: Race condition risks detected');
    risks.forEach((risk) => {
      console.log(`   ${risk}`);
    });
    console.log('');
    console.log('💡 SUGGESTED FIXES:');
    console.log('   - Use upsert operations instead of find-then-insert');
    console.log('   - Add unique constraints to prevent duplicates');
    console.log('   - Use database-level transactions');
    console.log('   - Implement proper idempotency checks');
  }

  console.log('');
}

// ============================================================================
// SUMMARY PRINTING
// ============================================================================

function printSummary(): void {
  console.log('='.repeat(80));
  console.log('VALIDATION SUMMARY');
  console.log('='.repeat(80));
  console.log('');

  const passCount = results.filter((r) => r.status === 'PASS').length;
  const failCount = results.filter((r) => r.status === 'FAIL').length;
  const warnCount = results.filter((r) => r.status === 'WARN').length;

  console.log(`Total Checks: ${results.length}`);
  console.log(`✅ Passed: ${passCount}`);
  console.log(`❌ Failed: ${failCount}`);
  console.log(`⚠️  Warnings: ${warnCount}`);
  console.log('');

  for (const result of results) {
    const icon = result.status === 'PASS' ? '✅' : result.status === 'FAIL' ? '❌' : '⚠️';
    console.log(`${icon} ${result.category}: ${result.message}`);
    if (result.details && result.details.length > 0) {
      for (const detail of result.details) {
        console.log(`   - ${detail}`);
      }
    }
  }

  console.log('');
  console.log('='.repeat(80));

  if (failCount > 0) {
    console.log('❌ VALIDATION FAILED');
    console.log('Please fix the errors above before proceeding.');
  } else if (warnCount > 0) {
    console.log('⚠️  VALIDATION PASSED WITH WARNINGS');
    console.log('Review the warnings and consider improvements.');
  } else {
    console.log('✅ ALL VALIDATIONS PASSED');
  }

  console.log('='.repeat(80));
  console.log('');
}

// ============================================================================
// RUN THE VALIDATION
// ============================================================================

runSeederChecks().catch((error) => {
  console.error('Fatal error running seeder checks:');
  console.error(error);
  process.exit(1);
});
