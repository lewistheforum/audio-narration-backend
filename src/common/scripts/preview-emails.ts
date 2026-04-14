import fs from 'fs';
import path from 'path';

type TemplateMap = Record<string, string>;

type HandlebarsLike = {
  compile: (source: string) => (context: unknown) => string;
};

const rootDir = process.cwd();
const templatesDir = path.join(rootDir, 'src', 'modules', 'mailer', 'templates');
const previewDir = path.join(rootDir, '.preview');

const mockData: TemplateMap = {
  logoUrl: 'https://via.placeholder.com/120x40?text=Medicare',
  brandName: 'Medicare',
  appName: 'Medicare',
  companyName: 'Medicare Healthcare',
  userName: 'Nguyen Van A',
  fullName: 'Nguyen Van A',
  patientName: 'Nguyen Van A',
  clinicName: 'Phong kham Medicare',
  clinicAddress: '123 Nguyen Hue, Quan 1, TP.HCM',
  clinicPhone: '0901 234 567',
  planName: 'Premium Care',
  currentPlan: 'Standard Care',
  nextPlan: 'Premium Care',
  oldPlan: 'Standard Care',
  newPlan: 'Premium Care',
  expirationDate: '31/12/2026',
  renewalDate: '01/01/2027',
  startDate: '01/01/2026',
  endDate: '31/12/2026',
  renewalLink: 'http://localhost:5173/subscription',
  invoiceLink: 'http://localhost:5173/invoices/INV-0001',
  appointmentDate: '30/03/2026',
  appointmentHour: '09:30',
  doctorName: 'Dr. Tran Minh',
  doctorSpecialization: 'Tim mach',
  serviceName: 'Kham tong quat',
  serviceType: 'CONSULTATION',
  supportEmail: 'support@medicare.com',
  totalAmount: '$1,200.00',
  amount: '$1,200.00',
  price: '$299.00',
  otp: '123456',
  code: '123456',
  verificationCode: '123456',
  transactionId: 'TXN-123456',
  username: 'nguyenvana',
  email: 'nguyenvana@example.com',
  password: 'TempPass@123',
  temporaryPassword: 'TempPass@123',
  phone: '0901 234 567',
  dob: '01/01/1995',
  reason: 'Thong tin bo sung can duoc xac minh them.',
  status: 'PENDING_PAYMENT',
  responseDescription: 'Bao cao da duoc tiep nhan va xu ly. Cam on ban da dong gop.',
  managerName: 'Le Thi B',
  signerName: 'Tran Van C',
  contractCode: 'CTR-2026-001',
  contractId: 'ctr-2026-001',
};

const mockContext = {
  ...mockData,
  services: [
    { serviceName: 'Kham tong quat', serviceType: 'CONSULTATION' },
    { serviceName: 'Xet nghiem mau', serviceType: 'LAB' },
  ],
};

function collectTemplates(directory: string): string[] {
  const entries = fs.readdirSync(directory, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      files.push(...collectTemplates(fullPath));
      continue;
    }

    if (entry.isFile() && entry.name.endsWith('.hbs')) {
      files.push(fullPath);
    }
  }

  return files;
}

function ensureDirectory(targetDir: string): void {
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }
}

function loadHandlebars(): HandlebarsLike {
  const directPath = path.join(rootDir, 'node_modules', 'handlebars');
  if (fs.existsSync(directPath)) {
    return require(directPath) as HandlebarsLike;
  }

  const pnpmStoreDir = path.join(rootDir, 'node_modules', '.pnpm');
  if (fs.existsSync(pnpmStoreDir)) {
    for (const entry of fs.readdirSync(pnpmStoreDir)) {
      const candidatePath = path.join(pnpmStoreDir, entry, 'node_modules', 'handlebars');
      if (fs.existsSync(candidatePath)) {
        return require(candidatePath) as HandlebarsLike;
      }
    }
  }

  throw new Error('Cannot resolve handlebars. Install it with pnpm add -D handlebars.');
}

function renderTemplates(): void {
  if (!fs.existsSync(templatesDir)) {
    throw new Error('Template directory not found: ' + templatesDir);
  }

  const handlebars = loadHandlebars();
  ensureDirectory(previewDir);
  const templates = collectTemplates(templatesDir);

  if (templates.length === 0) {
    console.log('No .hbs templates found.');
    return;
  }

  for (const templatePath of templates) {
    const source = fs.readFileSync(templatePath, 'utf8');
    const template = handlebars.compile(source);
    const rendered = template(mockContext);
    const outputName = path.basename(templatePath, '.hbs') + '.html';
    const outputPath = path.join(previewDir, outputName);

    fs.writeFileSync(outputPath, rendered, 'utf8');
    console.log('Rendered:', path.relative(rootDir, outputPath));
  }

  console.log('Preview generation complete.');
}

renderTemplates();
