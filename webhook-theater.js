// webhook-theater.js — Alter Egos Get Their Own Face
// ═══════════════════════════════════════════════════════════════
// Uses Discord webhooks to post messages AS different alter egos,
// with unique avatars and display names. Jenkins fractures visually.

const { WebhookClient } = require('discord.js');
const log = require('./logger').child('Theater');

// Alter ego avatar URLs (generated/placeholder — replace with real ones)
const EGO_AVATARS = {
  'Jenkins Prime':   'https://i.imgur.com/8Yf0Nmh.png',
  'Brother Jerome':  'https://i.imgur.com/QvKzGZy.png',
  'The Accountant':  'https://i.imgur.com/DXq8z5r.png',
  'Uncle Jenk':      'https://i.imgur.com/VcGz4xN.png',
  'The Prosecutor':  'https://i.imgur.com/7YwZ7kO.png',
  'Stavros Mode':    'https://i.imgur.com/LkNpY8a.png',
  'The React Lord':  'https://i.imgur.com/wX2nR3m.png',
};

// Cache webhooks per channel to avoid recreating
const webhookCache = new Map(); // channelId -> Webhook

class WebhookTheater {
  constructor(client) {
    this.client = client; // Discord.js Client
  }

  /**
   * Get or create a webhook for a channel.
   * Reuses Jenkins' existing webhook if one exists.
   */
  async getWebhook(channel) {
    if (webhookCache.has(channel.id)) {
      return webhookCache.get(channel.id);
    }

    try {
      // Look for an existing Jenkins webhook
      const webhooks = await channel.fetchWebhooks();
      let webhook = webhooks.find(w => w.owner?.id === this.client.user.id);

      if (!webhook) {
        // Create one
        webhook = await channel.createWebhook({
          name: 'Jenkins Theater',
          reason: 'Alter ego personality system',
        });
        log.info({ channelId: channel.id }, 'Created theater webhook');
      }

      webhookCache.set(channel.id, webhook);
      return webhook;
    } catch (err) {
      log.warn({ err, channelId: channel.id }, 'Failed to get/create webhook');
      return null;
    }
  }

  /**
   * Send a message as a specific alter ego.
   * Falls back to regular message if webhook fails.
   *
   * @param {TextChannel} channel - Discord channel
   * @param {string} egoName - Alter ego name (e.g. 'Brother Jerome')
   * @param {string} content - Message content
   * @param {object} [opts] - Additional options (embeds, reply, etc.)
   * @returns {Promise<Message|null>}
   */
  async sendAs(channel, egoName, content, opts = {}) {
    const webhook = await this.getWebhook(channel);

    if (!webhook) {
      // Fallback: regular message with personality tag
      return channel.send(`*[${egoName} has surfaced]*\n\n${content}`);
    }

    try {
      const avatarURL = EGO_AVATARS[egoName] || EGO_AVATARS['Jenkins Prime'];

      const webhookOpts = {
        content,
        username: egoName,
        avatarURL,
        ...opts,
      };

      // If replying to a message, we need to use the webhook's send method
      if (opts.reply) {
        // Webhooks can't directly reply, so prepend a quote
        const replyRef = opts.reply;
        delete webhookOpts.reply;
        // Just send as-is — webhook messages don't support reply threading
      }

      const msg = await webhook.send(webhookOpts);
      log.debug({ ego: egoName, channelId: channel.id }, 'Theater message sent');
      return msg;
    } catch (err) {
      log.warn({ err, ego: egoName }, 'Webhook send failed, falling back');
      // Invalidate cache on failure
      webhookCache.delete(channel.id);
      return channel.send(`*[${egoName} has surfaced]*\n\n${content}`);
    }
  }

  /**
   * Send a council deliberation where each ego posts as themselves.
   * @param {TextChannel} channel - Discord channel
   * @param {Array<{name: string, text: string}>} statements - Each ego's statement
   * @param {string} verdict - Jenkins Prime's final verdict
   */
  async sendCouncil(channel, statements, verdict) {
    for (const { name, text } of statements) {
      await this.sendAs(channel, name, text);
      // Small delay between messages for dramatic effect
      await new Promise(r => setTimeout(r, 1500));
    }

    // Jenkins Prime delivers the verdict
    await new Promise(r => setTimeout(r, 2000));
    await this.sendAs(channel, 'Jenkins Prime', `**═══ THE VERDICT ═══**\n\n${verdict}`);
  }

  /**
   * Clear webhook cache for a channel (e.g., if permissions change).
   */
  clearCache(channelId) {
    webhookCache.delete(channelId);
  }
}

module.exports = { WebhookTheater, EGO_AVATARS };
