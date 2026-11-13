import { Injectable } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { Category } from './category.entity';
import { CategoriesRepository } from './categories.repository';

@Injectable()
export class CategoriesService {
  constructor(private readonly categories: CategoriesRepository) {}

  findById(id: number, manager?: EntityManager): Promise<Category | null> {
    return this.categories.findById(id, manager);
  }
}
