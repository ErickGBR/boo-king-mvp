import bcrypt from 'bcryptjs';
import type { PrismaService } from '../../src/prisma/prisma.service';

export const DEFAULT_PASSWORD = 'Password123';

/**
 * Wipes all mutable tables between suites. Categories are global fixtures
 * seeded by `global-setup.js` and are intentionally preserved.
 * Children are deleted first so the deletes work regardless of FK cascade mode.
 */
export async function resetDb(prisma: PrismaService): Promise<void> {
  await prisma.appointmentService.deleteMany();
  await prisma.appointment.deleteMany();
  await prisma.businessStaff.deleteMany();
  await prisma.businessSchedule.deleteMany();
  await prisma.service.deleteMany();
  await prisma.business.deleteMany();
  await prisma.user.deleteMany();
}

export interface CreateUserOptions {
  name?: string;
  email: string;
  password?: string | null;
  role?: string;
}

/** Creates a user with a real bcrypt hash (password `null` = Google-only user). */
export async function createUser(
  prisma: PrismaService,
  { name = 'Test User', email, password = DEFAULT_PASSWORD, role = 'owner' }: CreateUserOptions,
) {
  return prisma.user.create({
    data: {
      name,
      email,
      role,
      password: password === null ? null : await bcrypt.hash(password, 10),
    },
  });
}

/** Returns the id of a global (seeded) category by slug. */
export async function categoryIdBySlug(
  prisma: PrismaService,
  slug: string,
): Promise<number> {
  const category = await prisma.category.findUnique({ where: { slug } });
  if (!category) throw new Error(`Seed category missing: ${slug}`);
  return category.id;
}

let uniqueCounter = 0;

/** Direct-Prisma business fixture (bypasses the API for suites that need one). */
export async function createBusiness(
  prisma: PrismaService,
  {
    userId,
    categoryId,
    name = 'Fixture Business',
    slug,
    durationMinutes = 30,
    timezone = 'UTC',
    locationType = 'presencial',
  }: {
    userId: number;
    categoryId: number;
    name?: string;
    slug?: string;
    durationMinutes?: number;
    timezone?: string;
    locationType?: string;
  },
) {
  uniqueCounter += 1;
  return prisma.business.create({
    data: {
      userId,
      categoryId,
      name,
      slug: slug ?? `fixture-${Date.now()}-${uniqueCounter}`,
      durationMinutes,
      timezone,
      locationType,
    },
  });
}

/** Adds/updates a weekday schedule window (dayOfWeek 0=Sun … 6=Sat). */
export async function upsertSchedule(
  prisma: PrismaService,
  businessId: number,
  dayOfWeek: number,
  startTime = '08:00',
  endTime = '10:00',
) {
  return prisma.businessSchedule.upsert({
    where: { businessId_dayOfWeek: { businessId, dayOfWeek } },
    update: { startTime, endTime },
    create: { businessId, dayOfWeek, startTime, endTime },
  });
}

export async function createService(
  prisma: PrismaService,
  businessId: number,
  { name = 'Fixture Service', price = 100, durationMinutes = 30 } = {},
) {
  return prisma.service.create({
    data: { businessId, name, price, durationMinutes, active: true },
  });
}

/** Direct-Prisma appointment fixture. */
export async function createAppointment(
  prisma: PrismaService,
  {
    businessId,
    userId = null,
    guestName = 'Guest',
    guestEmail = 'guest@example.com',
    startsAt = new Date('2099-02-01T08:00:00.000Z'),
    endsAt = new Date('2099-02-01T08:30:00.000Z'),
    status = 'confirmed',
    notes = null,
  }: {
    businessId: number;
    userId?: number | null;
    guestName?: string;
    guestEmail?: string;
    startsAt?: Date;
    endsAt?: Date;
    status?: string;
    notes?: string | null;
  },
) {
  return prisma.appointment.create({
    data: { businessId, userId, guestName, guestEmail, startsAt, endsAt, status, notes },
  });
}

/** Links a user to a business as staff (for staff-authorization tests). */
export async function addStaff(
  prisma: PrismaService,
  businessId: number,
  userId: number,
  role = 'staff',
) {
  return prisma.businessStaff.create({ data: { businessId, userId, role } });
}
