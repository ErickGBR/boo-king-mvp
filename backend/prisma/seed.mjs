import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const categories = [
  ['Peluquerías', 1], ['Barberías', 2], ['Salones de uñas / manicure / pedicure', 3], ['Estéticas', 4],
  ['Maquilladores', 5], ['Spa', 6], ['Depilación / láser', 7], ['Masajistas', 8], ['Tatuadores / piercers', 9],
  ['Niñeras', 10], ['Psicólogos', 11], ['Dentistas', 12], ['Fisioterapeutas', 13], ['Nutricionistas', 14],
  ['Médicos generales', 15], ['Oftalmólogos', 16], ['Veterinarias', 17], ['Clínicas estéticas', 18],
  ['Entrenadores personales', 19], ['Gimnasios', 20], ['Yoga / pilates', 21], ['Crossfit', 22],
  ['Artes marciales', 23], ['Clases de baile', 24], ['Profesores particulares', 25], ['Coaches', 26],
  ['Consultores', 27], ['Clases de idiomas', 28], ['Academias', 29], ['Tutorías', 30], ['Mecánicos', 31],
  ['Electricistas', 32], ['Plomeros', 33], ['Técnicos de PC / celulares', 34], ['Instaladores de internet / CCTV', 35],
  ['Servicio de aire acondicionado', 36], ['Fotógrafos', 37], ['Organizadores de eventos', 38], ['DJs', 39],
  ['Decoradores', 40], ['Limpieza a domicilio', 41], ['Jardineros', 42], ['Entrenadores de perros', 43],
  ['Veterinarios', 44], ['Cuidadores de mascotas', 45],
];

function slug(s) {
  return s.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
}

/**
 * Seed demo user, businesses, schedules, and appointments.
 * All operations use upsert / idempotent checks so the seed is safe to run
 * multiple times without duplicating data.
 */
async function seedDemo() {
  // ── Demo user ──────────────────────────────────────────────────────────
  const hashedPassword = await bcrypt.hash('Demo1234!', 10);
  const demoUser = await prisma.user.upsert({
    where: { email: 'demo@boo-king.app' },
    update: { name: 'Carlos García', password: hashedPassword, role: 'owner' },
    create: {
      name: 'Carlos García',
      email: 'demo@boo-king.app',
      password: hashedPassword,
      role: 'owner',
    },
  });
  console.log(`  ✔ Usuario demo: ${demoUser.email} (id: ${demoUser.id})`);

  // ── Helper to look up a category by slug ───────────────────────────────
  const catByName = (s) => prisma.category.findFirst({ where: { name: s } });

  const estetica = await catByName('Estéticas');
  const barberia = await catByName('Barberías');
  const dentista = await catByName('Dentistas');

  // ── Business 1 — Estética Bella Vista ──────────────────────────────────
  const biz1 = await prisma.business.upsert({
    where: { slug: 'estetica-bella-vista' },
    update: {},
    create: {
      userId: demoUser.id,
      categoryId: estetica.id,
      name: 'Estética Bella Vista',
      slug: 'estetica-bella-vista',
      description: 'Centro de estética integral con servicios de faciales, corporales y tratamientos anti-edad. Atención personalizada en un ambiente relajado y acogedor.',
      durationMinutes: 60,
      locationType: 'presencial',
      address: 'Av. Reforma 245, Col. Juárez, Ciudad de México, CP 06600',
      timezone: 'America/Mexico_City',
    },
  });

  // Schedule: Lun–Sáb 9:00–18:00 (Mon=1 .. Sat=6)
  for (let day = 1; day <= 6; day++) {
    await prisma.businessSchedule.upsert({
      where: { businessId_dayOfWeek: { businessId: biz1.id, dayOfWeek: day } },
      update: { startTime: '09:00', endTime: '18:00' },
      create: { businessId: biz1.id, dayOfWeek: day, startTime: '09:00', endTime: '18:00' },
    });
  }

  // ── Business 2 — Barbería El Clásico ──────────────────────────────────
  const biz2 = await prisma.business.upsert({
    where: { slug: 'barberia-el-clasico' },
    update: {},
    create: {
      userId: demoUser.id,
      categoryId: barberia.id,
      name: 'Barbería El Clásico',
      slug: 'barberia-el-clasico',
      description: 'Barbería tradicional con corte de cabello, barba y afeitado clásico. Estilo vintage, servicio de primera. Café y ambiente cómodo.',
      durationMinutes: 30,
      locationType: 'presencial',
      address: 'Calle Madero 89, Col. Centro, Ciudad de México, CP 06000',
      timezone: 'America/Mexico_City',
    },
  });

  // Schedule: Lun–Vie 8:00–21:00, Sáb 9:00–19:00
  for (let day = 1; day <= 5; day++) {
    await prisma.businessSchedule.upsert({
      where: { businessId_dayOfWeek: { businessId: biz2.id, dayOfWeek: day } },
      update: { startTime: '08:00', endTime: '21:00' },
      create: { businessId: biz2.id, dayOfWeek: day, startTime: '08:00', endTime: '21:00' },
    });
  }
  await prisma.businessSchedule.upsert({
    where: { businessId_dayOfWeek: { businessId: biz2.id, dayOfWeek: 6 } },
    update: { startTime: '09:00', endTime: '19:00' },
    create: { businessId: biz2.id, dayOfWeek: 6, startTime: '09:00', endTime: '19:00' },
  });

  // ── Business 3 — Consultorio Dental Sonrisa ────────────────────────────
  const biz3 = await prisma.business.upsert({
    where: { slug: 'consultorio-dental-sonrisa' },
    update: {},
    create: {
      userId: demoUser.id,
      categoryId: dentista.id,
      name: 'Consultorio Dental Sonrisa',
      slug: 'consultorio-dental-sonrisa',
      description: 'Consultorio dental con servicios de limpieza, blanqueamiento, ortodoncia y consultas generales. Atención presencial y online para seguimiento post-tratamiento.',
      durationMinutes: 45,
      locationType: 'online',
      meetingUrl: 'https://meet.google.com/abc-defg-hij',
      timezone: 'America/Mexico_City',
    },
  });

  // Schedule: Lun–Vie 8:00–20:00
  for (let day = 1; day <= 5; day++) {
    await prisma.businessSchedule.upsert({
      where: { businessId_dayOfWeek: { businessId: biz3.id, dayOfWeek: day } },
      update: { startTime: '08:00', endTime: '20:00' },
      create: { businessId: biz3.id, dayOfWeek: day, startTime: '08:00', endTime: '20:00' },
    });
  }

  console.log(`  ✔ Negocios: ${biz1.name}, ${biz2.name}, ${biz3.name}`);

  // ── Appointments (6-8 across the 3 businesses, next 7 days) ────────────
  // Delete previous demo appointments to keep the seed idempotent
  await prisma.appointment.deleteMany({
    where: { businessId: { in: [biz1.id, biz2.id, biz3.id] } },
  });

  const now = new Date();
  const dayMs = 86_400_000;

  /** Helper: create a Date at HH:MM on a given day offset from now */
  const at = (offsetDays, h, m) => {
    const d = new Date(now.getTime() + offsetDays * dayMs);
    d.setHours(h, m, 0, 0);
    return d;
  };

  const guestNames = [
    { name: 'María López', email: 'maria.lopez@email.com', phone: '5551234567' },
    { name: 'Juan Pérez', email: 'juan.perez@email.com', phone: '5552345678' },
    { name: 'Ana Martínez', email: 'ana.martinez@email.com', phone: '5553456789' },
    { name: 'Roberto Sánchez', email: 'roberto.sanchez@email.com', phone: '5554567890' },
    { name: 'Laura Hernández', email: 'laura.hernandez@email.com', phone: '5555678901' },
    { name: 'Pedro Ramírez', email: 'pedro.ramirez@email.com', phone: '5556789012' },
    { name: 'Sofía Torres', email: 'sofia.torres@email.com', phone: '5557890123' },
    { name: 'Diego Flores', email: 'diego.flores@email.com', phone: '5558901234' },
  ];

  const appointments = [
    // biz1 — Estética Bella Vista (60 min)
    { bizId: biz1.id, dur: 60, offset: 1, startH: 10, startM: 0, ...guestNames[0], status: 'confirmed' },
    { bizId: biz1.id, dur: 60, offset: -3, startH: 14, startM: 0, ...guestNames[1], status: 'completed' },
    { bizId: biz1.id, dur: 60, offset: 5, startH: 11, startM: 0, ...guestNames[2], status: 'confirmed' },

    // biz2 — Barbería El Clásico (30 min)
    { bizId: biz2.id, dur: 30, offset: 1, startH: 9, startM: 0, ...guestNames[3], status: 'confirmed' },
    { bizId: biz2.id, dur: 30, offset: 2, startH: 16, startM: 30, ...guestNames[4], status: 'cancelled' },
    { bizId: biz2.id, dur: 30, offset: 4, startH: 11, startM: 0, ...guestNames[5], status: 'confirmed' },

    // biz3 — Consultorio Dental Sonrisa (45 min)
    { bizId: biz3.id, dur: 45, offset: -2, startH: 10, startM: 0, ...guestNames[6], status: 'completed' },
    { bizId: biz3.id, dur: 45, offset: 6, startH: 15, startM: 30, ...guestNames[7], status: 'confirmed' },
  ];

  let apptCount = 0;
  for (const a of appointments) {
    const startsAt = at(a.offset, a.startH, a.startM);
    const endsAt = new Date(startsAt.getTime() + a.dur * 60_000);
    await prisma.appointment.create({
      data: {
        businessId: a.bizId,
        guestName: a.name,
        guestEmail: a.email,
        guestPhone: a.phone,
        startsAt,
        endsAt,
        status: a.status,
        notifyByEmail: true,
      },
    });
    apptCount++;
  }

  console.log(`  ✔ Citas creadas: ${apptCount}`);

  // ── Services (idempotent: only seed if no services exist for the business) ──
  const serviceDefs = {
    [biz1.id]: [
      { name: 'Masaje relajante', price: 350, durationMinutes: 60 },
      { name: 'Masaje + manicura', price: 500, durationMinutes: 90 },
      { name: 'Manicura', price: 150, durationMinutes: 30 },
    ],
    [biz2.id]: [
      { name: 'Corte de cabello', price: 120, durationMinutes: 30 },
      { name: 'Corte + diseño', price: 180, durationMinutes: 45 },
      { name: 'Corte + barba', price: 200, durationMinutes: 45 },
      { name: 'Barba', price: 80, durationMinutes: 20 },
    ],
    [biz3.id]: [
      { name: 'Limpieza dental', price: 400, durationMinutes: 45 },
      { name: 'Blanqueamiento', price: 1200, durationMinutes: 60 },
      { name: 'Revisión', price: 200, durationMinutes: 30 },
    ],
  };

  let serviceCount = 0;
  for (const [bizIdStr, defs] of Object.entries(serviceDefs)) {
    const bizId = Number(bizIdStr);
    const existing = await prisma.service.count({ where: { businessId: bizId } });
    if (existing > 0) continue;
    for (const svc of defs) {
      await prisma.service.create({
        data: {
          businessId: bizId,
          name: svc.name,
          price: svc.price,
          durationMinutes: svc.durationMinutes,
          active: true,
        },
      });
      serviceCount++;
    }
  }
  if (serviceCount > 0) {
    console.log(`  ✔ Servicios creados: ${serviceCount}`);
  } else {
    console.log('  ✔ Servicios: ya existían, sin cambios');
  }
}

async function main() {
  console.log('Seed: creando categorías…');
  for (const [name, sort] of categories) {
    await prisma.category.upsert({
      where: { slug: slug(name) },
      update: { name, sort },
      create: { name, slug: slug(name), sort },
    });
  }
  console.log('Seed: creando datos demo…');
  await seedDemo();
  console.log('Seed completado ✔');
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
