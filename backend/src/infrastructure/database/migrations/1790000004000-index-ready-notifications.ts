import { MigrationInterface, QueryRunner } from 'typeorm';

export class IndexReadyNotifications1790000004000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    // Supports the worker query: PENDING notifications whose scheduled_at has passed.
    await queryRunner.query(`
      CREATE INDEX notifications_pending_scheduled_idx
      ON notifications (scheduled_at, id)
      WHERE status = 'PENDING'
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX notifications_pending_scheduled_idx');
  }
}
