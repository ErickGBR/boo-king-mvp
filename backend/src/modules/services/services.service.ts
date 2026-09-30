import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ApiError } from '../../common/errors/api-error';

/** `routes/services.js` handler bodies MOVED VERBATIM. */
@Injectable()
export class ServicesService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * GET / — lista servicios del negocio (active + inactive, para gestión).
   * Ordenados por name asc.
   */
  async list(business: any): Promise<any> {
    const services = await this.prisma.service.findMany({
      where: { businessId: business.id },
      orderBy: { name: 'asc' },
      select: {
        id: true,
        businessId: true,
        name: true,
        price: true,
        durationMinutes: true,
        active: true,
        createdAt: true,
      },
    });
    return { services };
  }

  /** POST / — crear servicio. → 201 */
  async create(business: any, body: any): Promise<any> {
    const service = await this.prisma.service.create({
      data: {
        businessId: business.id,
        name: body.name.trim(),
        price: Number(body.price),
        durationMinutes: body.durationMinutes ? Number(body.durationMinutes) : null,
        active: body.active !== undefined ? Boolean(body.active) : true,
      },
    });
    return service;
  }

  /** PUT /:id — actualizar servicio (campos opcionales). */
  async update(business: any, rawId: string, body: any): Promise<any> {
    const id = Number(rawId);
    if (!Number.isInteger(id) || id <= 0) {
      throw new ApiError(404, { error: 'Not found' });
    }

    const existing = await this.prisma.service.findFirst({
      where: { id, businessId: business.id },
    });
    if (!existing) throw new ApiError(404, { error: 'Not found' });

    const data: any = {};
    if (body.name !== undefined) data.name = body.name.trim();
    if (body.price !== undefined) data.price = Number(body.price);
    if (body.durationMinutes !== undefined) {
      data.durationMinutes =
        body.durationMinutes === null ? null : Number(body.durationMinutes);
    }
    if (body.active !== undefined) data.active = Boolean(body.active);

    const updated = await this.prisma.service.update({ where: { id }, data });
    return updated;
  }

  /** DELETE /:id — hard delete. */
  async remove(business: any, rawId: string): Promise<any> {
    const id = Number(rawId);
    if (!Number.isInteger(id) || id <= 0) {
      throw new ApiError(404, { error: 'Not found' });
    }

    const existing = await this.prisma.service.findFirst({
      where: { id, businessId: business.id },
    });
    if (!existing) throw new ApiError(404, { error: 'Not found' });

    await this.prisma.service.delete({ where: { id } });
    return { success: true };
  }
}
