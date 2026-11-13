import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateNotifications1790000003000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE notifications (
        id SERIAL PRIMARY KEY,
        content TEXT NOT NULL CHECK (btrim(content) <> ''),
        channel VARCHAR(10) NOT NULL CHECK (channel IN ('EMAIL', 'PUSH')),
        recipient VARCHAR(255) NOT NULL CHECK (btrim(recipient) <> ''),
        scheduled_at TIMESTAMPTZ NOT NULL,
        timezone VARCHAR(64) NOT NULL,
        status VARCHAR(10) NOT NULL DEFAULT 'PENDING'
          CHECK (status IN ('PENDING', 'SENT', 'FAILED', 'CANCELLED')),
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE notifications');
  }
}
