import { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, MessageFlags } from 'discord.js';
import { logger } from '../../utils/logger.js';
import { TitanBotError, ErrorTypes } from '../../utils/errorHandler.js';
import { checkUserPermissions } from '../../utils/permissionGuard.js';
import { removeLevels, getUserLevelData, getLevelingConfig } from '../../services/leveling/leveling.js';
import { createEmbed } from '../../utils/embeds.js';

import { InteractionHelper } from '../../utils/interactionHelper.js';
export default {
  data: new SlashCommandBuilder()
    .setName('levelremove')
    .setDescription('إزالة مستويات من مستخدم')
    .addUserOption((option) =>
      option
        .setName('user')
        .setDescription('المستخدم الذي ستُزال منه المستويات')
        .setRequired(true)
    )
    .addIntegerOption((option) =>
      option
        .setName('levels')
        .setDescription('عدد المستويات المراد إزالتها')
        .setRequired(true)
        .setMinValue(1)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .setDMPermission(false),
  category: 'Leveling',

  async execute(interaction, config, client) {
    await InteractionHelper.safeDefer(interaction);

    const hasPermission = await checkUserPermissions(
      interaction,
      PermissionFlagsBits.ManageGuild,
      'You need ManageGuild permission to use this command.'
    );
    if (!hasPermission) return;

    const levelingConfig = await getLevelingConfig(client, interaction.guildId);
    if (!levelingConfig?.enabled) {
      await InteractionHelper.safeEditReply(interaction, {
        embeds: [
          new EmbedBuilder()
            .setColor('#f1c40f')
            .setDescription('نظام المستويات معطّل حاليًا في هذا السيرفر.')
        ],
        flags: MessageFlags.Ephemeral
      });
      return;
    }

    const targetUser = interaction.options.getUser('user');
    const levelsToRemove = interaction.options.getInteger('levels');

    const member = await interaction.guild.members.fetch(targetUser.id).catch(() => null);
    if (!member) {
      throw new TitanBotError(
        `User ${targetUser.id} not found in this guild`,
        ErrorTypes.USER_INPUT,
        'The specified user is not in this server.'
      );
    }

    const userData = await getUserLevelData(client, interaction.guildId, targetUser.id);
    if (userData.level === 0) {
      throw new TitanBotError(
        `User ${targetUser.id} is already at minimum level`,
        ErrorTypes.VALIDATION,
        `${targetUser.tag} is already at level 0 and cannot have levels removed.`
      );
    }

    const updatedData = await removeLevels(client, interaction.guildId, targetUser.id, levelsToRemove);

    await InteractionHelper.safeEditReply(interaction, {
      embeds: [
        createEmbed({
          title: 'تمت إزالة المستويات',
          description: `تمت إزالة ${levelsToRemove} المستويات من ${targetUser.tag}.\n**المستوى الجديد:** ${updatedData.level}`,
          color: 'success'
        })
      ]
    });

    logger.info(
      `[ADMIN] User ${interaction.user.tag} removed ${levelsToRemove} levels from ${targetUser.tag} in guild ${interaction.guildId}`
    );
  }
};