import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from './infrastructure/database/database.module';
import { validateEnvironment } from './config/environment';
import { ProductsModule } from './features/products/products.module';
import { CategoriesModule } from './features/categories/categories.module';
import { ProductHistoryModule } from './features/product-history/product-history.module';
import { NotificationsModule } from './features/notifications/notifications.module';
import { OpenApiModule } from './infrastructure/openapi/openapi.module';
import { LifecycleModule } from './infrastructure/lifecycle/lifecycle.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnvironment }),
    DatabaseModule,
    LifecycleModule,
    OpenApiModule,
    CategoriesModule,
    ProductHistoryModule,
    ProductsModule,
    NotificationsModule,
  ],
})
export class AppModule {}
