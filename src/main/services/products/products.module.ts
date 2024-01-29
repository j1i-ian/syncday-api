import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Product } from '@entity/products/product.entity';
import { ProductsService } from './products.service';

@Module({
    imports: [TypeOrmModule.forFeature([Product])],
    providers: [ProductsService],
    exports: [ProductsService]
})
export class ProductsModule {}
