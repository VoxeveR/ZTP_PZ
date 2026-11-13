export class ProductDomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

export class ProductValidationError extends ProductDomainError {}
export class ProductConflictError extends ProductDomainError {}
export class ProductRelationNotFoundError extends ProductDomainError {}
export class ProductNotFoundError extends ProductDomainError {}
