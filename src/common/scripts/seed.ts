import { DataSource, EntityMetadata, Repository } from 'typeorm';
import { NestFactory } from '@nestjs/core';
import { faker } from '@faker-js/faker';
import { AppModule } from '../../app.module';
import { formatToVietnamTime } from '../utils/date.util';

// Command line arguments parsing
const args = process.argv.slice(2);
const entityNameArg = args.find((arg) => !arg.startsWith('--')); // Simple arg parsing
const countArg = args.find((arg) => !isNaN(Number(arg)));
const TARGET_ENTITY = entityNameArg || 'Transaction';
const COUNT = countArg ? Number(countArg) : 1;

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const dataSource = app.get(DataSource);

  console.log(
    `🌱 Smart Seeding: ${COUNT} records for entity '${TARGET_ENTITY}'...`,
  );

  try {
    const metadata = dataSource.entityMetadatas.find(
      (m) => m.name === TARGET_ENTITY || m.tableName === TARGET_ENTITY,
    );

    if (!metadata) {
      throw new Error(
        `Instance '${TARGET_ENTITY}' not found in DataSource metadata.`,
      );
    }

    const repo = dataSource.getRepository(metadata.target);
    const createdRecords = [];

    for (let i = 0; i < COUNT; i++) {
      const record = await recursiveSeed(dataSource, metadata);
      const saved = await repo.save(record);
      createdRecords.push(saved);
      console.log(`✅ Created ${TARGET_ENTITY} ID: ${saved.id || saved._id}`);
    }
  } catch (error) {
    console.error('❌ Seeding Failed:', error);
  } finally {
    await app.close();
  }
}

// Hàm đệ quy sinh dữ liệu
async function recursiveSeed(
  dataSource: DataSource,
  metadata: EntityMetadata,
  depth = 0,
): Promise<any> {
  if (depth > 5) {
    throw new Error(
      'Maximum recursion depth exceeded (Circular dependency detected?)',
    );
  }

  const data: any = {};

  // 1. Xử lý các cột thường (Regular Columns)
  for (const column of metadata.columns) {
    if (column.isGenerated || column.isPrimary) continue;
    if (column.isCreateDate || column.isUpdateDate || column.isDeleteDate)
      continue;

    // Bỏ qua nếu là cột quan hệ (sẽ xử lý ở bước 2)
    if (column.relationMetadata) continue;

    // Chỉ sinh dữ liệu nếu bắt buộc (nullable = false) HOẶC ngẫu nhiên 50/50
    if (!column.isNullable || Math.random() > 0.5) {
      data[column.propertyName] = generateFakeData(column);
    }
  }

  // 2. Xử lý quan hệ (Relations - Foreign Keys)
  for (const relation of metadata.relations) {
    // Chỉ quan tâm ManyToOne hoặc OneToOne (Owning side)
    if (!relation.isManyToOne && !relation.isOneToOne) continue;

    const relatedRepo = dataSource.getRepository(relation.type);

    // Chiến thuật: "Pick Existing" (Lấy random 1 dòng có sẵn)
    const existing = await relatedRepo
      .createQueryBuilder('e')
      .orderBy('RANDOM()')
      .limit(1)
      .getOne();

    if (existing) {
      data[relation.propertyName] = existing;
    } else {
      // Chiến thuật: "Create New" (Đệ quy tạo mới)
      console.log(
        `   ⚠️ Table '${relation.inverseEntityMetadata.tableName}' empty. Recursively creating dependency...`,
      );
      const newData = await recursiveSeed(
        dataSource,
        relation.inverseEntityMetadata,
        depth + 1,
      );
      const savedDependency = await relatedRepo.save(newData);
      data[relation.propertyName] = savedDependency;
    }
  }

  return data;
}

function generateFakeData(column: any): any {
  const type = column.type;
  const propName = column.propertyName;
  const name = propName.toLowerCase();

  // Logic đoán kiểu dữ liệu dựa trên tên cột
  if (name.includes('email')) return faker.internet.email();
  if (name.includes('phone')) return generateVietnamPhone();
  if (name.includes('name')) return faker.person.fullName();
  if (name.includes('address')) return faker.location.streetAddress();
  if (name.includes('url') || name.includes('link'))
    return faker.internet.url();
  if (name.includes('currency')) return 'VND';
  if (
    name.includes('amount') ||
    name.includes('price') ||
    name.includes('total')
  )
    return faker.number.int({ min: 10000, max: 10000000 });

  // Logic dựa trên TypeORM type
  if (type === 'uuid') return faker.string.uuid();
  if (type === 'boolean') return faker.datatype.boolean();
  if (type === 'date' || type === 'timestamptz') return formatToVietnamTime(faker.date.recent());
  if (type === 'int' || type === 'integer' || type === 'bigint')
    return faker.number.int({ max: 100 });

  // Fix: Handle numeric/decimal types explicitly
  if (
    type === 'numeric' ||
    type === 'decimal' ||
    type === 'float' ||
    type === 'double'
  )
    return faker.number.int({ min: 0, max: 10000 });

  // Fix: Handle Enums
  if (type === 'enum' && column.enum) {
    const enumValues = Object.values(column.enum);
    return enumValues[Math.floor(Math.random() * enumValues.length)];
  }

  return faker.lorem.word();
}

function generateVietnamPhone(): string {
  return `0${faker.string.numeric(9)}`;
}

bootstrap();
