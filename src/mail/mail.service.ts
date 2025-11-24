import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ImapFlow, FetchMessageObject } from 'imapflow';

@Injectable()
export class MailService implements OnModuleInit {
  private client: ImapFlow;

  constructor(private config: ConfigService) {
    this.client = new ImapFlow({
      host: this.config.get<string>('IMAP_HOST')!,   // FIX: ! ensures string
      port: 993,
      secure: true,
      auth: {
        user: this.config.get<string>('CLIENT_EMAIL')!, // FIX: !
        pass: this.config.get<string>('CLIENT_PASSWORD')!, // FIX: !
      },
    });
  }

  async onModuleInit() {
    await this.startListener();
  }

  private async startListener() {
    await this.client.connect();
    await this.client.mailboxOpen('INBOX');

    console.log('📨 IMAP Listener Started...');

    this.client.on('exists', async () => {
      const message = await this.client.fetchOne('*', {
        envelope: true,
        source: true,
      });

      // FIX: message === false
      if (!message || typeof message !== 'object') {
        console.log('Message not found');
        return;
      }

      const env = message.envelope;
      if (!env) return;

      console.log('FROM:', env.from?.[0]?.address || 'Unknown');
      console.log('SUBJECT:', env.subject || 'No subject');
      console.log('DATE:', env.date || 'Unknown');
    });
  }
}
