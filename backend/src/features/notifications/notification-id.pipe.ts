import { BadRequestException, Injectable, PipeTransform } from '@nestjs/common';

@Injectable()
export class NotificationIdPipe implements PipeTransform<string, number> {
  transform(value: string): number {
    const id = Number(value);
    if (!/^\d+$/.test(value) || !Number.isInteger(id) || id < 1 || id > 2147483647) {
      throw new BadRequestException('Notification ID must be an integer between 1 and 2147483647');
    }
    return id;
  }
}
