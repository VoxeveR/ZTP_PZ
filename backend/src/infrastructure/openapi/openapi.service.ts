import { Injectable, INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerDocumentOptions, SwaggerModule } from '@nestjs/swagger';
import { ProductsModule } from '../../features/products/products.module';
import { ProductHistoryModule } from '../../features/product-history/product-history.module';
import { NotificationsModule } from '../../features/notifications/notifications.module';

@Injectable()
export class OpenApiService {
  setup(app: INestApplication): void {
    // /docs documents the whole API; the other pages show one functional area each.
    this.publish(app, 'docs', 'ZTP API', 'Products, product history and notifications');
    this.publish(app, 'products-docs', 'Products API', 'Products CRUD, validation, PATCH and product history', [
      ProductsModule,
      ProductHistoryModule,
    ]);
    this.publish(app, 'notifications-docs', 'Notifications API', 'Scheduled notifications with UTC times', [
      NotificationsModule,
    ]);
  }

  private publish(
    app: INestApplication,
    path: string,
    title: string,
    description: string,
    include?: SwaggerDocumentOptions['include'],
  ) {
    const config = new DocumentBuilder().setTitle(title).setDescription(description).setVersion('2.1').build();
    SwaggerModule.setup(path, app, SwaggerModule.createDocument(app, config, { include }));
  }
}
