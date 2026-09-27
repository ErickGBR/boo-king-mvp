import { Controller, Get } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

/** `routes/categories.js` → CategoriesController. PUBLIC (no auth). */
@Controller('categories')
export class CategoriesController {
  constructor(private readonly prisma: PrismaService) {}

  /** #26 GET /api/categories */
  @Get()
  async list() {
    const categories = await this.prisma.category.findMany({
      orderBy: { sort: 'asc' },
    });
    return categories;
  }
}
