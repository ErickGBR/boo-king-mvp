import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ApiError } from '../../common/errors/api-error';

/** `routes/staff.js` handler bodies MOVED VERBATIM. */
@Injectable()
export class StaffService {
  constructor(private readonly prisma: PrismaService) {}

  /** #28 GET /api/staff */
  async list(business: any): Promise<any> {
    const staff = await this.prisma.businessStaff.findMany({
      where: { businessId: business.id },
      include: { user: { select: { id: true, name: true, email: true, role: true } } },
    });
    return staff;
  }

  /** #29 POST /api/staff → 201 */
  async create(business: any, user: any, body: any): Promise<any> {
    const { email, role } = body;

    // Only owners can assign the 'owner' role
    if (role === 'owner' && user.role !== 'owner') {
      throw new ApiError(403, { error: 'Only owners can assign the owner role' });
    }

    const target = await this.prisma.user.findUnique({ where: { email } });
    if (!target) throw new ApiError(404, { error: 'User not found' });

    const finalRole = role || 'staff';

    try {
      const member = await this.prisma.businessStaff.create({
        data: { businessId: business.id, userId: target.id, role: finalRole },
        include: {
          user: { select: { id: true, name: true, email: true, role: true } },
        },
      });
      return member;
    } catch (err: any) {
      if (err.code === 'P2002') {
        throw new ApiError(409, { error: 'Already a member' });
      }
      throw err;
    }
  }

  /** #30 DELETE /api/staff/:id */
  async remove(business: any, rawId: string): Promise<any> {
    const id = Number(rawId);
    const member = await this.prisma.businessStaff.findFirst({
      where: { id, businessId: business.id },
    });
    if (!member) throw new ApiError(404, { error: 'Not found' });
    await this.prisma.businessStaff.delete({ where: { id } });
    return { ok: true };
  }
}
