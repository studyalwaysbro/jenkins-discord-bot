// ═══════════════════════════════════════════════════════════════
//  GAME NIGHT UI — Interactive buttons, menus, and modals
//  "The Architect prefers clicking to typing."
// ═══════════════════════════════════════════════════════════════

const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  EmbedBuilder,
} = require('discord.js');

// Game library images (Steam capsule thumbnails — public CDN)
const GAME_IMAGES = {
  'Helldivers 2': 'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/553850/header.jpg',
  'Risk of Rain 2': 'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/632360/header.jpg',
  'Pummel Party': 'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/880940/header.jpg',
  'Hunt Showdown': 'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/594650/header.jpg',
  'Gunfire Reborn': 'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/1217060/header.jpg',
  'The Outlast Trials': 'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/1304930/header.jpg',
  'CS2': 'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/730/header.jpg',
  'Marvel Rivals': 'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/2767030/header.jpg',
  'Rust': 'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/252490/header.jpg',
  'DayZ': 'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/221100/header.jpg',
  'Terraria': 'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/105600/header.jpg',
  'Elden Ring': 'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/1245620/header.jpg',
  'Monster Hunter Wilds': 'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/2246340/header.jpg',
  'Path of Exile 2': 'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/2694490/header.jpg',
  'Slay the Spire 2': 'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/2868840/header.jpg',
  'Barotrauma': 'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/602960/header.jpg',
  'Lethal Company': 'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/1966720/header.jpg',
  'Deep Rock Galactic': 'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/548430/header.jpg',
  'Valheim': 'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/892970/header.jpg',
  'Among Us': 'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/945360/header.jpg',
  'Stardew Valley': 'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/413150/header.jpg',
  'Noita': 'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/881100/header.jpg',
  'Northgard': 'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/466560/header.jpg',
  'PUBG': 'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/578080/header.jpg',
};

// Chunk array into groups of N
function chunk(arr, size) {
  const result = [];
  for (let i = 0; i < arr.length; i += size) {
    result.push(arr.slice(i, i + size));
  }
  return result;
}

class GameNightUI {
  constructor(gameNight) {
    this.gameNight = gameNight;
    // Track which game a user selected in the browse menu (before creating)
    this.userSelections = new Map(); // userId -> { game, page }
  }

  // ── Main Menu Panel ──
  mainMenuEmbed() {
    return new EmbedBuilder()
      .setColor(0xFF6B35)
      .setTitle('🎮 GAME NIGHT — Command Center')
      .setDescription([
        '*"Court is in recess. Game night is in session."*\n',
        '**Browse** the game library, **create** a game night,',
        'or **view** upcoming events — all without typing a single command.',
      ].join('\n'))
      .setFooter({ text: 'Pass The Torch — Game Night System' });
  }

  mainMenuComponents() {
    const row1 = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('gn_browse').setLabel('Browse Games').setEmoji('🎮').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('gn_create_custom').setLabel('Create Game Night').setEmoji('🔥').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId('gn_upcoming').setLabel('View Upcoming').setEmoji('📅').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('gn_vote_create').setLabel('Create Vote').setEmoji('🗳️').setStyle(ButtonStyle.Secondary),
    );
    return [row1];
  }

  // ── Browse Panel with Game Select Dropdown ──
  browseEmbed(page = 0) {
    const library = this.gameNight.constructor === Object
      ? [] : require('./game-night').GameNight ? [] : [];

    return new EmbedBuilder()
      .setColor(0x9B59B6)
      .setTitle('🎮 Game Library — Select a Game')
      .setDescription('Pick a game from the dropdown below, then click **Create Game Night** to host it.')
      .setFooter({ text: 'Page ' + (page + 1) });
  }

  browseComponents(games, page = 0) {
    // Discord select menus max 25 options
    const pageGames = games.slice(page * 25, (page + 1) * 25);
    const totalPages = Math.ceil(games.length / 25);

    const select = new StringSelectMenuBuilder()
      .setCustomId('gn_game_select')
      .setPlaceholder('Choose a game...')
      .addOptions(
        pageGames.map(g => ({
          label: g.name,
          description: `${g.genre} • ${g.players} players`,
          value: g.name,
          emoji: g.emoji,
        }))
      );

    const rows = [new ActionRowBuilder().addComponents(select)];

    // Pagination + action buttons
    const buttons = new ActionRowBuilder();
    if (totalPages > 1) {
      buttons.addComponents(
        new ButtonBuilder()
          .setCustomId(`gn_browse_prev_${page}`)
          .setLabel('◀ Prev')
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(page === 0),
        new ButtonBuilder()
          .setCustomId(`gn_browse_next_${page}`)
          .setLabel('Next ▶')
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(page >= totalPages - 1),
      );
    }
    buttons.addComponents(
      new ButtonBuilder().setCustomId('gn_create_selected').setLabel('Create Game Night').setEmoji('🔥').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId('gn_back_menu').setLabel('Back').setStyle(ButtonStyle.Secondary),
    );
    rows.push(buttons);

    return rows;
  }

  // ── Game Preview (after selecting from dropdown) ──
  gamePreviewEmbed(gameName, gameInfo) {
    const embed = new EmbedBuilder()
      .setColor(0xFF6B35)
      .setTitle(`${gameInfo?.emoji || '🎮'} ${gameName}`)
      .addFields(
        { name: 'Genre', value: gameInfo?.genre || 'Custom', inline: true },
        { name: 'Players', value: gameInfo?.players || 'Any', inline: true },
      )
      .setDescription('Click **Create Game Night** to host, or pick a different game.')
      .setFooter({ text: 'Tip: You\'ll be asked for a date/time after clicking Create' });

    const img = GAME_IMAGES[gameName];
    if (img) embed.setImage(img);

    return embed;
  }

  // ── Time Input Modal ──
  createTimeModal(gameName) {
    return new ModalBuilder()
      .setCustomId('gn_time_modal')
      .setTitle(`Schedule: ${gameName.substring(0, 30)}`)
      .addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('gn_time_input')
            .setLabel('When? (leave blank for no schedule)')
            .setPlaceholder('friday 8pm, tomorrow 9pm, 3/25 7:30pm')
            .setStyle(TextInputStyle.Short)
            .setRequired(false)
        ),
      );
  }

  // ── Event Embed with Interactive Buttons ──
  eventComponents(event) {
    const row = new ActionRowBuilder();

    if (event.options && !event.voteLocked) {
      // Game vote mode — add vote buttons for each option
      event.options.forEach((opt, i) => {
        row.addComponents(
          new ButtonBuilder()
            .setCustomId(`gn_vote_${event.id}_${i + 1}`)
            .setLabel(`${i + 1}. ${opt.name.substring(0, 20)}`)
            .setEmoji(opt.emoji)
            .setStyle(ButtonStyle.Primary)
        );
      });
    } else if (event.schedule && !event.schedule.locked) {
      // Schedule poll — can't do slot buttons (too many), just signup/back
      row.addComponents(
        new ButtonBuilder().setCustomId(`gn_signup_${event.id}`).setLabel('Sign Up').setEmoji('✅').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId(`gn_leave_${event.id}`).setLabel('Leave').setEmoji('👋').setStyle(ButtonStyle.Danger),
      );
    } else {
      // Normal event
      row.addComponents(
        new ButtonBuilder().setCustomId(`gn_signup_${event.id}`).setLabel('Sign Up').setEmoji('✅').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId(`gn_leave_${event.id}`).setLabel('Leave').setEmoji('👋').setStyle(ButtonStyle.Danger),
      );
    }

    return [row];
  }

  // ── Handle all interactions ──
  async handleInteraction(interaction, games) {
    const customId = interaction.customId;
    const userId = interaction.user.id;

    // ── Main Menu Buttons ──
    if (customId === 'gn_browse') {
      await interaction.update({
        embeds: [this.browseEmbed(0)],
        components: this.browseComponents(games, 0),
      });
      return true;
    }

    if (customId === 'gn_back_menu') {
      await interaction.update({
        embeds: [this.mainMenuEmbed()],
        components: this.mainMenuComponents(),
      });
      return true;
    }

    if (customId === 'gn_upcoming') {
      const upcoming = this.gameNight.listUpcoming();
      if (upcoming.length === 0) {
        await interaction.reply({ content: 'No game nights scheduled yet!', ephemeral: true });
        return true;
      }
      const embeds = upcoming.slice(0, 3).map(e => this.gameNight.eventEmbed(e, interaction.guild));
      const components = upcoming.slice(0, 3).flatMap(e => this.eventComponents(e));
      await interaction.reply({ embeds, components, ephemeral: false });
      return true;
    }

    // ── Browse Pagination ──
    if (customId.startsWith('gn_browse_prev_') || customId.startsWith('gn_browse_next_')) {
      const currentPage = parseInt(customId.split('_').pop());
      const newPage = customId.includes('prev') ? currentPage - 1 : currentPage + 1;
      await interaction.update({
        embeds: [this.browseEmbed(newPage)],
        components: this.browseComponents(games, newPage),
      });
      return true;
    }

    // ── Game Select Dropdown ──
    if (customId === 'gn_game_select') {
      const gameName = interaction.values[0];
      const gameInfo = games.find(g => g.name === gameName);
      this.userSelections.set(userId, { game: gameName, info: gameInfo });
      await interaction.update({
        embeds: [this.gamePreviewEmbed(gameName, gameInfo)],
        components: this.browseComponents(games, 0), // Keep the dropdown
      });
      return true;
    }

    // ── Create from selected game ──
    if (customId === 'gn_create_selected') {
      const selection = this.userSelections.get(userId);
      if (!selection) {
        await interaction.reply({ content: 'Pick a game from the dropdown first!', ephemeral: true });
        return true;
      }
      await interaction.showModal(this.createTimeModal(selection.game));
      return true;
    }

    // ── Create custom (no browse) ──
    if (customId === 'gn_create_custom') {
      const modal = new ModalBuilder()
        .setCustomId('gn_custom_modal')
        .setTitle('Create Game Night')
        .addComponents(
          new ActionRowBuilder().addComponents(
            new TextInputBuilder()
              .setCustomId('gn_custom_game')
              .setLabel('Game name')
              .setPlaceholder('Helldivers 2, Rust, CS2...')
              .setStyle(TextInputStyle.Short)
              .setRequired(true)
          ),
          new ActionRowBuilder().addComponents(
            new TextInputBuilder()
              .setCustomId('gn_custom_time')
              .setLabel('When? (leave blank for no schedule)')
              .setPlaceholder('friday 8pm, tomorrow 9pm, 3/25 7:30pm')
              .setStyle(TextInputStyle.Short)
              .setRequired(false)
          ),
        );
      await interaction.showModal(modal);
      return true;
    }

    // ── Create Vote ──
    if (customId === 'gn_vote_create') {
      const modal = new ModalBuilder()
        .setCustomId('gn_vote_modal')
        .setTitle('Create Game Vote')
        .addComponents(
          new ActionRowBuilder().addComponents(
            new TextInputBuilder()
              .setCustomId('gn_vote_games')
              .setLabel('Games (separate with |)')
              .setPlaceholder('Rust | CS2 | Helldivers 2')
              .setStyle(TextInputStyle.Short)
              .setRequired(true)
          ),
          new ActionRowBuilder().addComponents(
            new TextInputBuilder()
              .setCustomId('gn_vote_time')
              .setLabel('When? (optional)')
              .setPlaceholder('friday 8pm')
              .setStyle(TextInputStyle.Short)
              .setRequired(false)
          ),
        );
      await interaction.showModal(modal);
      return true;
    }

    // ── Signup / Leave Buttons ──
    if (customId.startsWith('gn_signup_')) {
      const eventId = customId.replace('gn_signup_', '');
      const result = this.gameNight.signup(eventId, userId);
      if (!result.success) {
        await interaction.reply({ content: result.message, ephemeral: true });
        return true;
      }
      const embed = this.gameNight.eventEmbed(result.event, interaction.guild);
      await interaction.update({ embeds: [embed], components: this.eventComponents(result.event) });
      return true;
    }

    if (customId.startsWith('gn_leave_')) {
      const eventId = customId.replace('gn_leave_', '');
      const result = this.gameNight.leave(eventId, userId);
      if (!result.success) {
        await interaction.reply({ content: result.message, ephemeral: true });
        return true;
      }
      const embed = this.gameNight.eventEmbed(result.event, interaction.guild);
      await interaction.update({ embeds: [embed], components: this.eventComponents(result.event) });
      return true;
    }

    // ── Game Vote Buttons ──
    if (customId.startsWith('gn_vote_')) {
      const parts = customId.split('_');
      const eventId = parts[2];
      const optionIdx = parseInt(parts[3]);
      const result = this.gameNight.vote(eventId, optionIdx, userId);
      if (!result.success) {
        await interaction.reply({ content: result.message, ephemeral: true });
        return true;
      }
      const embed = this.gameNight.eventEmbed(result.event, interaction.guild);
      await interaction.update({ embeds: [embed], components: this.eventComponents(result.event) });
      return true;
    }

    return false;
  }

  // ── Handle Modal Submissions ──
  async handleModalSubmit(interaction) {
    const customId = interaction.customId;
    const userId = interaction.user.id;

    // Time modal (from browse → create selected)
    if (customId === 'gn_time_modal') {
      const selection = this.userSelections.get(userId);
      if (!selection) {
        await interaction.reply({ content: 'Session expired. Try again.', ephemeral: true });
        return true;
      }
      const timeStr = interaction.fields.getTextInputValue('gn_time_input')?.trim() || null;
      const event = this.gameNight.create(selection.game, userId, timeStr);
      if (event.error) {
        await interaction.reply({ content: event.message, ephemeral: true });
        return true;
      }
      this.userSelections.delete(userId);
      const embed = this.gameNight.eventEmbed(event, interaction.guild);
      await interaction.reply({ embeds: [embed], components: this.eventComponents(event) });
      return true;
    }

    // Custom create modal
    if (customId === 'gn_custom_modal') {
      const gameName = interaction.fields.getTextInputValue('gn_custom_game')?.trim();
      const timeStr = interaction.fields.getTextInputValue('gn_custom_time')?.trim() || null;
      if (!gameName) {
        await interaction.reply({ content: 'Game name is required.', ephemeral: true });
        return true;
      }
      const event = this.gameNight.create(gameName, userId, timeStr);
      if (event.error) {
        await interaction.reply({ content: event.message, ephemeral: true });
        return true;
      }
      const embed = this.gameNight.eventEmbed(event, interaction.guild);
      await interaction.reply({ embeds: [embed], components: this.eventComponents(event) });
      return true;
    }

    // Vote create modal
    if (customId === 'gn_vote_modal') {
      const gamesStr = interaction.fields.getTextInputValue('gn_vote_games')?.trim();
      const timeStr = interaction.fields.getTextInputValue('gn_vote_time')?.trim() || null;
      const gameNames = gamesStr.split('|').map(g => g.trim()).filter(g => g);
      if (gameNames.length < 2) {
        await interaction.reply({ content: 'Need at least 2 games separated by |', ephemeral: true });
        return true;
      }
      const event = this.gameNight.createVote(gameNames, userId, timeStr);
      if (event.error) {
        await interaction.reply({ content: event.message, ephemeral: true });
        return true;
      }
      const embed = this.gameNight.eventEmbed(event, interaction.guild);
      await interaction.reply({ embeds: [embed], components: this.eventComponents(event) });
      return true;
    }

    return false;
  }
}

module.exports = { GameNightUI, GAME_IMAGES };
