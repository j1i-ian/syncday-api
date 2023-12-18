import { Test, TestingModule } from '@nestjs/testing';
import { Repository } from 'typeorm';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Product } from '@entity/products/product.entity';
import { ProductsService } from './products.service';

describe('ProductsService', () => {
    let service: ProductsService;

    let productRepositoryStub: sinon.SinonStubbedInstance<Repository<Product>>;

    before(async () => {
        productRepositoryStub = sinon.createStubInstance<Repository<Product>>(Repository);

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                ProductsService,
                {
                    provide: getRepositoryToken(Product),
                    useValue: productRepositoryStub
                }
            ]
        }).compile();

        service = module.get<ProductsService>(ProductsService);
    });

    it('should be defined', () => {
        expect(service).ok;
    });
});
