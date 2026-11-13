import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';
import { ProductHistoryState } from './product-history-state';

export enum ProductHistoryAction {
  CREATE = 'CREATE',
  REPLACE = 'REPLACE',
  UPDATE = 'UPDATE',
  DELETE = 'DELETE',
}

@Entity('product_history')
export class ProductHistory {
  @PrimaryGeneratedColumn()
  id!: number;

  // No foreign key: the audit trail must survive deletion of the product.
  @Column({ name: 'product_id', type: 'integer' })
  productId!: number;

  @Column({ type: 'varchar', length: 10 })
  action!: ProductHistoryAction;

  @Column({ name: 'previous_state', type: 'jsonb' })
  previousState!: ProductHistoryState;

  @Column({ name: 'current_state', type: 'jsonb' })
  currentState!: ProductHistoryState;

  @CreateDateColumn({ name: 'changed_at', type: 'timestamptz', default: () => 'clock_timestamp()' })
  changedAt!: Date;
}
