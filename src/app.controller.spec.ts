import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { AppService } from './app.service';

describe('AppController', () => {
  let appController: AppController;

  let appServiceStub: sinon.SinonStubbedInstance<AppService>;

  beforeEach(async () => {

    appServiceStub = sinon.createStubInstance(AppService);

    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [AppService],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe('root', () => {
    it('should return "Hello World!"', () => {

      appServiceStub.getHello.returns('Hello World!');
      const helloWorld = appController.getHello();
      expect(helloWorld).equal('Hello World!');
    });
  });
});
