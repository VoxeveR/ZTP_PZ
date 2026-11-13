import { MigrationInterface, QueryRunner } from 'typeorm';

export class ExtendProducts1790000001000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE categories
        ADD COLUMN min_price NUMERIC(10,2) NOT NULL DEFAULT 0,
        ADD COLUMN max_price NUMERIC(10,2) NOT NULL DEFAULT 99999999.99,
        ADD CONSTRAINT categories_price_range_check CHECK (min_price >= 0 AND max_price >= min_price)
    `);
    await queryRunner.query(`
      UPDATE categories SET
        min_price = CASE name WHEN 'Electronics' THEN 10 WHEN 'Books' THEN 1 ELSE 0.01 END,
        max_price = CASE name WHEN 'Electronics' THEN 100000 WHEN 'Books' THEN 1000 ELSE 500 END
      WHERE name IN ('Electronics', 'Books', 'Food')
    `);
    // Upgrade the known example from stage 1.1 to the new alphanumeric name policy.
    await queryRunner.query("UPDATE products SET name = 'CleanCode' WHERE name = 'Clean Code'");
    await queryRunner.query(`
      ALTER TABLE products
        ALTER COLUMN name TYPE VARCHAR(20),
        ADD COLUMN quantity INTEGER NOT NULL DEFAULT 0,
        ADD CONSTRAINT products_quantity_check CHECK (quantity >= 0),
        ADD CONSTRAINT products_name_check CHECK (name ~ '^[[:alnum:]]{3,20}$')
    `);
    await queryRunner.query('CREATE UNIQUE INDEX products_name_lower_unique ON products (lower(name))');
    await queryRunner.query(`
      CREATE TABLE forbidden_product_names (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL UNIQUE CHECK (length(trim(name)) > 0)
      )
    `);
    await queryRunner.query(`
      INSERT INTO forbidden_product_names (name) VALUES ('fake'), ('illegal'), ('banned')
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE forbidden_product_names');
    await queryRunner.query('DROP INDEX products_name_lower_unique');
    await queryRunner.query(`
      ALTER TABLE products DROP CONSTRAINT products_name_check,
        DROP COLUMN quantity, ALTER COLUMN name TYPE VARCHAR(100)
    `);
    await queryRunner.query('ALTER TABLE categories DROP COLUMN min_price, DROP COLUMN max_price');
  }
}
