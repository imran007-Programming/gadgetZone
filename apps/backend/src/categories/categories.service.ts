import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  /** Flat list (top-level and subcategories); clients build the tree from parentId. */
  async findAll() {
    return this.prisma.category.findMany({
      orderBy: [{ position: 'asc' }, { name: 'asc' }],
      include: { _count: { select: { products: true } } },
    });
  }
}
