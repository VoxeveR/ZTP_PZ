import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddNotificationIdempotencyKey1790000005000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE notifications ADD COLUMN idempotency_key VARCHAR(255)');
    // Rows created before this stage get a server-style key so the column can become NOT NULL.
    await queryRunner.query(`
      UPDATE notifications
      SET idempotency_key = 'notif_' || replace(gen_random_uuid()::text, '-', '')
      WHERE idempotency_key IS NULL
    `);
    await queryRunner.query('ALTER TABLE notifications ALTER COLUMN idempotency_key SET NOT NULL');
    await queryRunner.query(`
      ALTER TABLE notifications
      ADD CONSTRAINT notifications_idempotency_key_unique UNIQUE (idempotency_key)
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE notifications DROP COLUMN idempotency_key');
  }
}
