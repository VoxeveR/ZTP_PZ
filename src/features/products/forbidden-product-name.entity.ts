import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('forbidden_product_names')
export class ForbiddenProductName {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'varchar', length: 100, unique: true })
  name!: string;
}
