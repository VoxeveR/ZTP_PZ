import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('categories')
export class Category {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'varchar', length: 100, unique: true })
  name!: string;

  @Column({ name: 'min_price', type: 'numeric', precision: 10, scale: 2 })
  minPrice!: string;

  @Column({ name: 'max_price', type: 'numeric', precision: 10, scale: 2 })
  maxPrice!: string;
}
