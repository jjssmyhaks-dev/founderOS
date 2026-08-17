import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.useGlobalFilters(new GlobalExceptionFilter());

  app.enableCors({
    origin: ['http://localhost:3000', process.env.FRONTEND_URL || 'http://localhost:3000'].filter((v, i, a) => a.indexOf(v) === i),
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    transform: true,
    exceptionFactory: (errors) => {
      const messages = errors.map((e) => {
        const constraints = e.constraints ? Object.values(e.constraints) : [];
        return `${e.property}: ${constraints.join(', ')}`;
      });
      return new Error(messages.join('; '));
    },
  }));

  const config = new DocumentBuilder()
    .setTitle('Helm AI OS')
    .setDescription('AI Operating System for Solo Founders')
    .setVersion('0.1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  const port = process.env.PORT || 3001;
  await app.listen(port);
  console.log(`Helm backend running on port ${port}`);
}
bootstrap();