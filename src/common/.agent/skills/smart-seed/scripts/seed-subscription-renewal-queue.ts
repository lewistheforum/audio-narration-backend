import { DataSource, In } from 'typeorm';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../../../../../app.module';
import { ClinicSubscriptionRenewalQueue } from '../../../../../modules/subscriptions/entities/clinic-subscription-renewal-queue.entity';
import { Account } from '../../../../../modules/accounts/entities/accounts.entity';
import { SubscriptionService } from '../../../../../modules/subscriptions/entities/subscription-service.entity';
import { AccountRole } from '../../../../../modules/accounts/enums/account-role.enum';
import { faker } from '@faker-js/faker';

async function bootstrap() {
    const app = await NestFactory.createApplicationContext(AppModule);
    const dataSource = app.get(DataSource);

    const queueRepo = dataSource.getRepository(ClinicSubscriptionRenewalQueue);
    const accountRepo = dataSource.getRepository(Account);
    const serviceRepo = dataSource.getRepository(SubscriptionService);

    console.log('🌱 Seeding Clinic Subscription Renewal Queue...');

    // 1. Get Clinics (CLINIC_MANAGER or CLINIC_ADMIN)
    const clinics = await accountRepo.find({
        where: [
            { role: AccountRole.CLINIC_MANAGER },
            { role: AccountRole.CLINIC_ADMIN }
        ]
    });

    if (clinics.length === 0) {
        console.warn('⚠️ No clinics found (CLINIC_MANAGER or CLINIC_ADMIN). Please seed accounts first.');
        await app.close();
        return;
    }

    // 2. Get Subscription Services
    const services = await serviceRepo.find();
    if (services.length === 0) {
        console.warn('⚠️ No subscription services found. Please seed services first.');
        await app.close();
        return;
    }

    console.log(`ℹ️ Found ${clinics.length} clinics and ${services.length} services.`);

    let createdCount = 0;

    for (const clinic of clinics) {
        // Check if already in queue
        const existing = await queueRepo.findOne({ where: { clinicId: clinic._id } });
        if (existing) {
            console.log(`ℹ️ Clinic ${clinic.email} already in renewal queue.`);
            continue;
        }

        // Randomly pick a next service
        const randomService = services[Math.floor(Math.random() * services.length)];

        // Generate random future dates
        const targetStartDate = faker.date.future({ years: 0.1 }); // Within next ~36 days
        const targetEndDate = new Date(targetStartDate);
        targetEndDate.setDate(targetEndDate.getDate() + 30); // +30 days duration

        const queueItem = queueRepo.create({
            clinicId: clinic._id,
            nextServiceId: randomService._id,
            targetStartDate: targetStartDate,
            targetEndDate: targetEndDate,
        });

        await queueRepo.save(queueItem);
        console.log(`✅ Added to Queue: Clinic ${clinic.email} -> Service ${randomService.serviceName}`);
        createdCount++;
    }

    console.log(`🎉 Finished! Created ${createdCount} renewal queue entries.`);

    await app.close();
}

bootstrap();
