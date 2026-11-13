import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createTransport, Transporter } from 'nodemailer';
import { Notification } from './notification.entity';

const DELIVERY_TIMEOUT_MS = 5000;

/** Performs the actual send: EMAIL over SMTP (MailHog), PUSH as an HTTP POST to an ntfy topic. */
@Injectable()
export class NotificationDeliveryService implements OnModuleDestroy {
  private readonly mailer: Transporter;
  private readonly mailFrom: string;
  private readonly ntfyUrl: string;

  constructor(config: ConfigService) {
    this.mailer = createTransport({
      host: config.getOrThrow<string>('SMTP_HOST'),
      port: config.getOrThrow<number>('SMTP_PORT'),
      secure: false,
      ignoreTLS: true,
      connectionTimeout: DELIVERY_TIMEOUT_MS,
      greetingTimeout: DELIVERY_TIMEOUT_MS,
      socketTimeout: DELIVERY_TIMEOUT_MS,
    });
    this.mailFrom = config.getOrThrow<string>('MAIL_FROM');
    this.ntfyUrl = config.getOrThrow<string>('NTFY_URL').replace(/\/+$/, '');
  }

  async sendEmail(notification: Notification): Promise<void> {
    await this.mailer.sendMail({
      from: this.mailFrom,
      to: notification.recipient,
      subject: 'Notification',
      text: notification.content,
    });
  }

  // For PUSH the recipient is the ntfy topic name.
  async sendPush(notification: Notification): Promise<void> {
    const response = await fetch(`${this.ntfyUrl}/${encodeURIComponent(notification.recipient)}`, {
      method: 'POST',
      body: notification.content,
      signal: AbortSignal.timeout(DELIVERY_TIMEOUT_MS),
    });
    if (!response.ok) throw new Error(`ntfy responded with HTTP ${response.status}`);
  }

  onModuleDestroy(): void {
    this.mailer.close();
  }
}
