import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { Category } from './category.entity';

@Injectable()
export class CategoriesRepository {
  constructor(@InjectRepository(Category) private readonly categories: Repository<Category>) {}

  findById(id: number, manager?: EntityManager): Promise<Category | null> {
    return (manager?.getRepository(Category) ?? this.categories).findOneBy({ id });
  }
}
