import { PrismaClient, StatusCode, SourceType, CarrierType } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Создаём перевозчиков/операторов (источники данных)
  const maerskLine = await prisma.carrier.upsert({
    where: { id: 'carrier-maersk' },
    update: {},
    create: {
      id: 'carrier-maersk',
      name: 'Maersk Line',
      type: CarrierType.SEA_LINE,
      contactEmail: 'tracking@maersk.com',
      description: 'Морская линия. Присылает статусы через личный кабинет и email.',
    },
  });

  const rzd = await prisma.carrier.upsert({
    where: { id: 'carrier-rzd' },
    update: {},
    create: {
      id: 'carrier-rzd',
      name: 'РЖД Логистика',
      type: CarrierType.RAIL,
      contactEmail: 'cargo@rzd.ru',
      description: 'ЖД оператор. Выгружает данные в Excel.',
    },
  });

  const cosco = await prisma.carrier.upsert({
    where: { id: 'carrier-cosco' },
    update: {},
    create: {
      id: 'carrier-cosco',
      name: 'COSCO Shipping',
      type: CarrierType.SEA_LINE,
      contactEmail: 'tracking@cosco.com',
      description: 'Морская линия. API интеграция.',
    },
  });

  console.log('✓ Carriers (operators) created');

  // Создаём клиентов (получатели грузов)
  const client1 = await prisma.client.upsert({
    where: { id: 'client-1' },
    update: {},
    create: {
      id: 'client-1',
      name: 'ООО "ТехИмпорт"',
      email: 'logistics@techimport.ru',
      phone: '+7 (495) 123-45-67',
      inn: '7701234567',
      contactPerson: 'Илья',
    },
  });

  const client2 = await prisma.client.upsert({
    where: { id: 'client-2' },
    update: {},
    create: {
      id: 'client-2',
      name: 'ЗАО "Глобал Трейд"',
      email: 'info@globaltrade.ru',
      phone: '+7 (495) 987-65-43',
      inn: '7709876543',
      contactPerson: 'Анна',
    },
  });

  console.log('✓ Clients created');

  // Очищаем старые данные
  await prisma.statusEvent.deleteMany({});
  await prisma.container.deleteMany({});

  // Контейнер 1: В пути по ЖД (пример из email оператора)
  const container1 = await prisma.container.create({
    data: {
      containerNumber: 'MSKU1234567',
      containerType: '20/24',
      originPoint: 'MUNDRA, India',
      destinationPoint: 'Иня-Восточная',
      finalDestination: 'Орехово-Зуево',
      totalDistanceKm: 3136,
      clientId: client1.id,
      carrierId: maerskLine.id,
    },
  });

  // История статусов для контейнера 1 (данные от разных операторов)
  await prisma.statusEvent.createMany({
    data: [
      {
        containerId: container1.id,
        statusCode: StatusCode.LOADED,
        statusText: 'Загружен',
        location: 'MUNDRA, India',
        eventTime: new Date('2025-10-15'),
        sourceType: SourceType.MANUAL,
        sourceRaw: 'Введено вручную логистом',
      },
      {
        containerId: container1.id,
        statusCode: StatusCode.ON_SHIP,
        statusText: 'Отгружен в море',
        location: 'Порт MUNDRA',
        eventTime: new Date('2025-10-18'),
        sourceType: SourceType.EXCEL,
        sourceRaw: JSON.stringify({ state: 'Отгружен / в пути море', from: 'MUNDRA', date: '18.10.2025' }),
      },
      {
        containerId: container1.id,
        statusCode: StatusCode.ARRIVED_PORT,
        statusText: 'Прибыл в порт назначения',
        location: 'Порт Владивосток',
        eventTime: new Date('2025-11-20'),
        sourceType: SourceType.EXCEL,
        sourceRaw: JSON.stringify({ state: 'Прибыл в порт назначения', port: 'Владивосток', date: '20.11.2025' }),
      },
      {
        containerId: container1.id,
        statusCode: StatusCode.ON_WAREHOUSE,
        statusText: 'Размещен на СВХ',
        location: 'СВХ Владивосток',
        eventTime: new Date('2025-11-22'),
        sourceType: SourceType.EXCEL,
      },
      {
        containerId: container1.id,
        statusCode: StatusCode.ON_RAIL,
        statusText: 'Отгружен на ЖД',
        location: 'ст. Владивосток',
        distanceToDestinationKm: 3136,
        eta: new Date('2025-12-04'),
        eventTime: new Date('2025-11-25'),
        sourceType: SourceType.EXCEL,
      },
      {
        containerId: container1.id,
        statusCode: StatusCode.ON_RAIL,
        statusText: 'В пути по ЖД',
        location: 'ст. Гончарово',
        distanceToDestinationKm: 1857,
        eta: new Date('2025-12-04'),
        eventTime: new Date('2025-11-28'),
        sourceType: SourceType.EMAIL,
        sourceRaw: 'Контейнер MSKU1234567 находится на станции Гончарово, 1857 км до станции Иня-Восточная.\nОжидаемая дата прибытия: 04.12.2025.',
      },
    ],
  });

  // Контейнер 2: Прибыл в порт
  const container2 = await prisma.container.create({
    data: {
      containerNumber: 'TCKU7654321',
      containerType: '40',
      originPoint: 'SHANGHAI, CHINA',
      destinationPoint: 'Москва',
      clientId: client2.id,
      carrierId: cosco.id,
    },
  });

  await prisma.statusEvent.createMany({
    data: [
      {
        containerId: container2.id,
        statusCode: StatusCode.LOADED,
        statusText: 'Загружен',
        location: 'SHANGHAI, CHINA',
        eventTime: new Date('2025-10-25'),
        sourceType: SourceType.EXCEL,
      },
      {
        containerId: container2.id,
        statusCode: StatusCode.ON_SHIP,
        statusText: 'Отгружен в море',
        location: 'Порт Shanghai',
        eventTime: new Date('2025-10-28'),
        sourceType: SourceType.EXCEL,
      },
      {
        containerId: container2.id,
        statusCode: StatusCode.ARRIVED_PORT,
        statusText: 'Прибыл в порт назначения',
        location: 'Порт Владивосток',
        eta: new Date('2025-12-10'),
        eventTime: new Date('2025-11-28'),
        sourceType: SourceType.EMAIL,
        sourceRaw: 'Container TCKU7654321 arrived at Vladivostok port.\nETA Moscow: 10.12.2025',
      },
    ],
  });

  // Контейнер 3: Прибыл в порт (NANSHA)
  const container3 = await prisma.container.create({
    data: {
      containerNumber: 'CMAU9876543',
      containerType: '20/24',
      originPoint: 'NANSHA, CHINA',
      destinationPoint: 'Москва',
      clientId: client1.id,
      carrierId: cosco.id,
    },
  });

  await prisma.statusEvent.createMany({
    data: [
      {
        containerId: container3.id,
        statusCode: StatusCode.ON_SHIP,
        statusText: 'В пути морем',
        location: 'Южно-Китайское море',
        eventTime: new Date('2025-11-04'),
        sourceType: SourceType.EXCEL,
      },
      {
        containerId: container3.id,
        statusCode: StatusCode.ARRIVED_PORT,
        statusText: 'Прибыл в порт назначения',
        location: 'Порт Владивосток',
        eventTime: new Date('2025-11-26'),
        sourceType: SourceType.EXCEL,
      },
    ],
  });

  // Контейнер 4: Скоро прибудет
  const container4 = await prisma.container.create({
    data: {
      containerNumber: 'OOLU5551234',
      containerType: '20/24',
      originPoint: 'SHANGHAI, CHINA',
      destinationPoint: 'Москва',
      clientId: client2.id,
      carrierId: rzd.id,
    },
  });

  await prisma.statusEvent.createMany({
    data: [
      {
        containerId: container4.id,
        statusCode: StatusCode.ON_SHIP,
        statusText: 'Отгружен в море',
        location: 'Порт Shanghai',
        eventTime: new Date('2025-11-06'),
        sourceType: SourceType.EXCEL,
      },
      {
        containerId: container4.id,
        statusCode: StatusCode.ARRIVED_PORT,
        statusText: 'Прибыл в порт',
        location: 'Порт Владивосток',
        eventTime: new Date('2025-11-11'),
        sourceType: SourceType.EXCEL,
      },
      {
        containerId: container4.id,
        statusCode: StatusCode.ON_WAREHOUSE,
        statusText: 'Размещен на СВХ',
        location: 'СВХ Владивосток',
        eventTime: new Date('2025-11-13'),
        sourceType: SourceType.EXCEL,
      },
      {
        containerId: container4.id,
        statusCode: StatusCode.CUSTOMS_CLEARED,
        statusText: 'Склад закрыт',
        location: 'СВХ Владивосток',
        eventTime: new Date('2025-11-18'),
        sourceType: SourceType.EXCEL,
      },
      {
        containerId: container4.id,
        statusCode: StatusCode.ON_RAIL,
        statusText: 'Отгружен на ЖД',
        location: 'ст. Владивосток',
        eta: new Date('2025-12-04'),
        eventTime: new Date('2025-11-21'),
        sourceType: SourceType.EXCEL,
        sourceRaw: JSON.stringify({
          containerNumber: 'OOLU5551234',
          state: 'Отгружен / в пути по ЖД',
          shippedOnRail: '21.11.2025',
          eta: '04.12.2025',
        }),
      },
    ],
  });

  // Контейнер 5: Доставлен
  const container5 = await prisma.container.create({
    data: {
      containerNumber: 'HLBU3332211',
      containerType: '40',
      originPoint: 'XINGANG (TIANJIN), CHINA',
      destinationPoint: 'Артём',
      clientId: client1.id,
      carrierId: maerskLine.id,
    },
  });

  await prisma.statusEvent.createMany({
    data: [
      {
        containerId: container5.id,
        statusCode: StatusCode.ON_SHIP,
        statusText: 'В пути морем',
        location: 'Жёлтое море',
        eventTime: new Date('2025-11-23'),
        sourceType: SourceType.EXCEL,
      },
      {
        containerId: container5.id,
        statusCode: StatusCode.ARRIVED_PORT,
        statusText: 'Прибыл в порт',
        location: 'Порт Владивосток',
        eventTime: new Date('2025-11-28'),
        sourceType: SourceType.EXCEL,
      },
      {
        containerId: container5.id,
        statusCode: StatusCode.DELIVERED,
        statusText: 'Доставлен',
        location: 'Артём',
        eventTime: new Date('2025-11-30'),
        sourceType: SourceType.MANUAL,
        sourceRaw: 'Подтверждение получения от клиента',
      },
    ],
  });

  console.log('✓ Containers and status events created');
  console.log('');
  console.log('📦 Created containers:');
  console.log(`   - MSKU1234567 (В пути по ЖД, ст. Гончарово)`);
  console.log(`   - TCKU7654321 (Прибыл в порт Владивосток)`);
  console.log(`   - CMAU9876543 (Прибыл в порт Владивосток)`);
  console.log(`   - OOLU5551234 (В пути по ЖД)`);
  console.log(`   - HLBU3332211 (Доставлен)`);
  console.log('');
  console.log('🎉 Seed completed successfully!');
}

main()
  .catch((e) => {
    console.error('Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
