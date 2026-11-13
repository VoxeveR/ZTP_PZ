import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateProducts1790000000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE categories (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL UNIQUE
      )
    `);
    await queryRunner.query(`
      CREATE TABLE products (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        price NUMERIC(10, 2) NOT NULL CHECK (price >= 0),
        category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE RESTRICT
      )
    `);
    await queryRunner.query('CREATE INDEX products_category_id_idx ON products(category_id)');
    await queryRunner.query(`
      INSERT INTO categories (name) VALUES ('Electronics'), ('Books'), ('Food')
    `);
    await queryRunner.query(`
      INSERT INTO products (name, price, category_id)
      SELECT seed.name, seed.price, categories.id
      FROM (VALUES
        ('Laptop', 3499.99, 'Electronics'),
        ('Headphones', 199.90, 'Electronics'),
        ('Clean Code', 89.99, 'Books'),
        ('Coffee', 29.50, 'Food')
      ) AS seed(name, price, category_name)
      JOIN categories ON categories.name = seed.category_name
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE products');
    await queryRunner.query('DROP TABLE categories');
  }
}
