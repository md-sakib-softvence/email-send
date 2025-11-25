// import { Injectable, OnModuleInit } from '@nestjs/common';
// import { ConfigService } from '@nestjs/config';
// import { ImapFlow, FetchMessageObject } from 'imapflow';

// @Injectable()
// export class MailService implements OnModuleInit {
//   private client: ImapFlow;

//   constructor(private config: ConfigService) {
//     this.client = new ImapFlow({
//       host: this.config.get<string>('IMAP_HOST')!,   // FIX: ! ensures string
//       port: 993,
//       secure: true,
//       auth: {
//         user: this.config.get<string>('CLIENT_EMAIL')!, // FIX: !
//         pass: this.config.get<string>('CLIENT_PASSWORD')!, // FIX: !
//       },
//     });
//   }

//   async onModuleInit() {
//     await this.startListener();
//   }

//   private async startListener() {
//     await this.client.connect();
//     await this.client.mailboxOpen('INBOX');

//     console.log('📨 IMAP Listener Started...');

//     this.client.on('exists', async () => {
//       const message = await this.client.fetchOne('*', {
//         envelope: true,
//         source: true,
//       });

//       // FIX: message === false
//       if (!message || typeof message !== 'object') {
//         console.log('Message not found');
//         return;
//       }

//       const env = message.envelope;
//       if (!env) return;

//       console.log('FROM:', env.from?.[0]?.address || 'Unknown');
//       console.log('SUBJECT:', env.subject || 'No subject');
//       console.log('DATE:', env.date || 'Unknown');
//     });
//   }
// }
import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ImapFlow, ListResponse } from 'imapflow';
import { simpleParser } from 'mailparser';

@Injectable()
export class MailService implements OnModuleInit {
  private client: ImapFlow;

  constructor(private config: ConfigService) {
    this.client = new ImapFlow({
      host: this.config.get<string>('IMAP_HOST')!,
      port: 993,
      secure: true,
      auth: {
        user: this.config.get<string>('CLIENT_EMAIL')!,
        pass: this.config.get<string>('CLIENT_PASSWORD')!,
      },
    });
  }

  async onModuleInit() {
    await this.client.connect();
    console.log('📡 Connected to IMAP Server');

    // Show all mailboxes
    await this.listMailboxes();

    // Start listeners
    this.listenInbox();
    this.listenSent();
  }

  // ---------------------------------------------------------------------
  // 📂 LIST AVAILABLE MAILBOXES
  // ---------------------------------------------------------------------
  private async listMailboxes() {
    console.log('📂 Mailboxes:');

    const list: ListResponse[] = await this.client.list();
    for (const box of list) {
      console.log(' →', box.path);
    }
  }

  // ---------------------------------------------------------------------
  // 📌 Detect Gmail “Sent Mail” folder
  // ---------------------------------------------------------------------
  private async findSentFolder(): Promise<string | null> {
    const possibleNames = [
      '[Gmail]/Sent Mail',
      '[Gmail]/Sent',
      'Sent',
      'Sent Mail',
      'Sent Items',
      'Sent Messages',
      'OUTBOX',
      'Outbox',
    ];

    const list: ListResponse[] = await this.client.list();

    for (const box of list) {
      if (possibleNames.includes(box.path)) {
        console.log('📌 Sent folder detected:', box.path);
        return box.path;
      }
    }

    console.log('⚠ No sent folder detected');
    return null;
  }

  // ---------------------------------------------------------------------
  // 📥 LISTEN TO INCOMING EMAILS
  // ---------------------------------------------------------------------
  private async listenInbox() {
    await this.client.mailboxOpen('INBOX');

    console.log('📥 INBOX Listener active...');

    this.client.on('exists', async () => {
      const message = await this.client.fetchOne('*', { source: true });
      if (!message) return;

      const parsed = await simpleParser(message.source);

      console.log('📩 Incoming Email:', {
        from: parsed.from?.text,
        subject: parsed.subject,
      });

      // Save to DB here
      // await EmailModel.create({...})
    });
  }

  // ---------------------------------------------------------------------
  // 📤 LISTEN TO OUTGOING (“SENT”) EMAILS
  // ---------------------------------------------------------------------
  private async listenSent() {
    const sentFolder = await this.findSentFolder();

    if (!sentFolder) {
      console.log('⚠ Cannot start Sent Mail listener — folder not found');
      return;
    }

    await this.client.mailboxOpen(sentFolder);

    console.log('📤 SENT MAIL Listener active...');

    this.client.on('exists', async () => {
      const message = await this.client.fetchOne('*', { source: true });
      if (!message) return;

      const parsed = await simpleParser(message.source);

      console.log('📤 Sent Email:', {
        to: parsed.to?.text,
        subject: parsed.subject,
      });

      // Save to DB
      // await EmailModel.create({...})
    });
  }
}
