import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CreateProducts1790000000000 } from './migrations/1790000000000-create-products';
import { ExtendProducts1790000001000 } from './migrations/1790000001000-extend-products';
import { CreateProductHistory1790000002000 } from './migrations/1790000002000-create-product-history';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres' as const,
        host: config.getOrThrow<string>('DB_HOST'),
        port: config.getOrThrow<number>('DB_PORT'),
        database: config.getOrThrow<string>('DB_NAME'),
        username: config.getOrThrow<string>('DB_USER'),
        password: config.getOrThrow<string>('DB_PASSWORD'),
        autoLoadEntities: true,
        synchronize: false,
        migrations: [CreateProducts1790000000000, ExtendProducts1790000001000, CreateProductHistory1790000002000],
        migrationsRun: true,
        retryAttempts: 3,
        retryDelay: 1000,
      }),
    }),
  ],
})
export class DatabaseModule {}
