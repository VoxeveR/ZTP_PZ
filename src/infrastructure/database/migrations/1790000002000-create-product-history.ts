import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateProductHistory1790000002000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE product_history (
        id SERIAL PRIMARY KEY,
        product_id INTEGER NOT NULL,
        action VARCHAR(10) NOT NULL CHECK (action IN ('CREATE', 'REPLACE', 'UPDATE', 'DELETE')),
        previous_state JSONB NOT NULL CHECK (jsonb_typeof(previous_state) = 'object'),
        current_state JSONB NOT NULL CHECK (jsonb_typeof(current_state) = 'object'),
        changed_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
      )
    `);
    await queryRunner.query(`
      CREATE INDEX product_history_product_changed_idx
      ON product_history (product_id, changed_at DESC, id DESC)
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE product_history');
  }
}
