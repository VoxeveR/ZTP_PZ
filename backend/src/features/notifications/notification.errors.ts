export class NotificationDomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

export class NotificationValidationError extends NotificationDomainError {}
export class NotificationTransitionError extends NotificationDomainError {}
export class NotificationNotFoundError extends NotificationDomainError {}
