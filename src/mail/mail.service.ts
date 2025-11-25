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
import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';

@Injectable()
export class MailService implements OnModuleInit {
  private inboxClient: ImapFlow;
  private sentClient: ImapFlow;

  constructor(private config: ConfigService) {
    // 1️⃣ INBOX CLIENT
    this.inboxClient = new ImapFlow({
      host: this.config.get('IMAP_HOST')!,
      port: 993,
      secure: true,
      auth: {
        user: this.config.get('CLIENT_EMAIL')!,
        pass: this.config.get('CLIENT_PASSWORD'),
      },
    });

    // 2️⃣ SENT MAIL CLIENT (separate connection)
    this.sentClient = new ImapFlow({
      host: this.config.get('IMAP_HOST')!,
      port: 993,
      secure: true,
      auth: {
        user: this.config.get('CLIENT_EMAIL')!,
        pass: this.config.get('CLIENT_PASSWORD'),
      },
    });
  }

  async onModuleInit() {
    await this.startInboxListener();
    await this.startSentListener();
  }

  // 📥 LISTEN INCOMING
  private async startInboxListener() {
    await this.inboxClient.connect();
    await this.inboxClient.mailboxOpen('INBOX');

    console.log('📥 INBOX Listener Active');

    this.inboxClient.on('exists', async () => {
      const msg = await this.inboxClient.fetchOne('*', { source: true });
      if (!msg) return;

      const parsed = await simpleParser(msg.source);

      console.log('📩 Incoming Email:', parsed.subject);
    });
  }

  // 📤 LISTEN SENT MAIL
  private async startSentListener() {
    await this.sentClient.connect();

    const sentFolder = await this.findSentFolder(this.sentClient);

    if (!sentFolder) {
      console.log('⚠ No Sent Folder Found');
      return;
    }

    await this.sentClient.mailboxOpen(sentFolder);

    console.log('📤 SENT MAIL Listener Active:', sentFolder);

    this.sentClient.on('exists', async () => {
      const msg = await this.sentClient.fetchOne('*', { source: true });
      if (!msg) return;

      const parsed = await simpleParser(msg.source);

      console.log('📤 Sent Email:', parsed.subject);
    });
  }

  // 🔍 AUTO-DETECT SENT FOLDER
  private async findSentFolder(client: ImapFlow) {
    const boxes = await client.list();
    const names = boxes.map(b => b.path.toLowerCase());

    const possible = [
      '[gmail]/sent mail',
      '[gmail]/sent',
      'sent',
      'sent items',
      'sent messages',
      'inbox.sent',
      'inbox.sent items',
    ];

    for (const name of possible) {
      const match = boxes.find(b => b.path.toLowerCase() === name);
      if (match) return match.path;
    }

    return null;
  }
}
