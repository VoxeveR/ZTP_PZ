import { PartialType } from '@nestjs/swagger';
import { ProductWriteDto } from './product-write.dto';

// Omitted fields are allowed; explicit null must still fail the original validators.
export class ProductPatchDto extends PartialType(ProductWriteDto, { skipNullProperties: false }) {}
