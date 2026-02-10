import { DataSource } from 'typeorm';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../../../../../app.module';
import { TransactionType } from '../../../../../modules/transactions/entities/transaction-type.entity';

async function bootstrap() {
    const app = await NestFactory.createApplicationContext(AppModule);
    const dataSource = app.get(DataSource);
    const repo = dataSource.getRepository(TransactionType);

    console.log('🌱 Seeding Transaction Types...');

    const types = [
        { name: 'SUBSCRIPTION', code: 'SUBSCRIPTION' },
        { name: 'VERIFICATION', code: 'VERIFICATION' },
        { name: 'ONLINE', code: 'ONLINE' },
    ];

    for (const t of types) {
        const exists = await repo.findOne({ where: { name: t.name } });
        if (!exists) {
            await repo.save(t);
            console.log(`✅ Created Transaction Type: ${t.name}`);
        } else {
            console.log(`ℹ️ Transaction Type ${t.name} already exists.`);
        }
    }

    await app.close();
}

bootstrap();
