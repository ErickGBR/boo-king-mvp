import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ApiError } from '../../common/errors/api-error';
import { buildSlug } from './slug.util';

/**
 * BusinessesService — handler bodies MOVED VERBATIM from `routes/businesses.js`.
 * Slug generation, the dedupe loop and the schedule upsert loop are unchanged.
 */
@Injectable()
export class BusinessesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: number): Promise<any> {
    const businesses = await this.prisma.business.findMany({
      where: { userId },
      include: { category: true },
    });
    return businesses;
  }

  async get(userId: number, rawId: string): Promise<any> {
    const id = Number(rawId);
    const business = await this.prisma.business.findFirst({
      where: { id, userId },
      include: { category: true, schedules: true },
    });
    if (!business) throw new ApiError(404, { error: 'Not found' });
    return business;
  }

  async create(userId: number, body: any): Promise<any> {
    const categoryId = Number(body.categoryId);
    const category = await this.prisma.category.findUnique({ where: { id: categoryId } });
    if (!category) throw new ApiError(422, { error: 'Category not found' });

    // D17.2 — slug allocation is auto-suffixing (`name`, `name-1`, `name-2`, …),
    // that is this endpoint's existing contract (pinned by the e2e test
    // "POST dedupes slugs when the name collides"), NOT an error. The old
    // findUnique-then-create loop raced: when two creates picked the same free
    // slug, the loser's INSERT hit the DB `slug @unique` as Prisma P2002 and
    // surfaced as a raw 500. We now catch P2002, recompute the next suffix and
    // retry a bounded number of times. The 409 below is only the pathological
    // exhaustion guard (10 lost races in a row) — no invalid data is ever
    // written, because the unique index remains the source of truth.
    const baseSlug = buildSlug(body.name);
    const MAX_SLUG_ATTEMPTS = 10;
    let finalSlug = baseSlug;
    let suffix = 0;
    let business: any = null;

    for (let attempt = 0; attempt < MAX_SLUG_ATTEMPTS && !business; attempt += 1) {
      while (await this.prisma.business.findUnique({ where: { slug: finalSlug } })) {
        finalSlug = `${baseSlug}-${++suffix}`;
      }
      try {
        business = await this.prisma.business.create({
          data: {
            userId,
            name: body.name,
            slug: finalSlug,
            categoryId,
            description: body.description || null,
            durationMinutes: Number(body.durationMinutes),
            locationType: body.locationType || 'presencial',
            address: body.address || null,
            meetingUrl: body.meetingUrl || null,
            timezone: body.timezone || 'America/Mexico_City',
          },
          include: { category: true },
        });
      } catch (err: any) {
        if (err?.code === 'P2002') continue; // lost the slug race: recompute + retry
        throw err;
      }
    }
    if (!business) {
      throw new ApiError(409, { error: 'Could not allocate a unique slug, please retry' });
    }
    const schedule = body.schedule || {};
    for (const [day, hours] of Object.entries<any>(schedule)) {
      const d = Number(day);
      if (d < 0 || d > 6) continue;
      const start = hours.start?.slice(0, 5);
      const end = hours.end?.slice(0, 5);
      if (start && end && end > start) {
        await this.prisma.businessSchedule.create({
          data: { businessId: business.id, dayOfWeek: d, startTime: start, endTime: end },
        });
      }
    }
    return business;
  }

  async update(userId: number, rawId: string, body: any): Promise<any> {
    const id = Number(rawId);
    const business = await this.prisma.business.findFirst({ where: { id, userId } });
    if (!business) throw new ApiError(404, { error: 'Not found' });
    const categoryId = Number(body.categoryId);
    const category = await this.prisma.category.findUnique({ where: { id: categoryId } });
    if (!category) throw new ApiError(422, { error: 'Category not found' });
    await this.prisma.business.update({
      where: { id },
      data: {
        name: body.name,
        categoryId,
        description: body.description ?? business.description,
        durationMinutes: Number(body.durationMinutes),
        locationType: body.locationType ?? business.locationType,
        address: body.address ?? business.address,
        meetingUrl: body.meetingUrl ?? business.meetingUrl,
        timezone: body.timezone || business.timezone,
        brandingFont: body.brandingFont ?? business.brandingFont,
        brandingHeaderBg: body.brandingHeaderBg ?? business.brandingHeaderBg,
        brandingHeaderText: body.brandingHeaderText ?? business.brandingHeaderText,
      },
    });
    await this.prisma.businessSchedule.deleteMany({ where: { businessId: id } });
    const schedule = body.schedule || {};
    for (const [day, hours] of Object.entries<any>(schedule)) {
      const d = Number(day);
      if (d < 0 || d > 6) continue;
      const start = hours.start?.slice(0, 5);
      const end = hours.end?.slice(0, 5);
      if (start && end && end > start) {
        await this.prisma.businessSchedule.create({
          data: { businessId: id, dayOfWeek: d, startTime: start, endTime: end },
        });
      }
    }
    const updated = await this.prisma.business.findUnique({
      where: { id },
      include: { category: true, schedules: true },
    });
    return updated;
  }

  async remove(userId: number, rawId: string): Promise<any> {
    const id = Number(rawId);
    const business = await this.prisma.business.findFirst({ where: { id, userId } });
    if (!business) throw new ApiError(404, { error: 'Not found' });
    await this.prisma.business.delete({ where: { id } });
    return { ok: true };
  }
}
