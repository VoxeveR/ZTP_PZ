import { Injectable, INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

@Injectable()
export class OpenApiService {
  setup(app: INestApplication): void {
    const config = new DocumentBuilder()
      .setTitle('Products API')
      .setDescription('Etapy 1.1–1.3 — Products CRUD, validation, PATCH and transactional product history')
      .setVersion('1.3')
      .build();

    SwaggerModule.setup('docs', app, SwaggerModule.createDocument(app, config));
  }
}
