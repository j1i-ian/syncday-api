import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Product } from '@entity/products/product.entity';

@Injectable()
export class ProductsService {

    constructor(
        @InjectRepository(Product) private readonly productRepository: Repository<Product>
    ) {}

    async findTeamPlanProduct(productId: number): Promise<Product> {
        const loadedProduct = await this.productRepository.findOneByOrFail({
            id: productId
        });

        return loadedProduct;
    }
}
