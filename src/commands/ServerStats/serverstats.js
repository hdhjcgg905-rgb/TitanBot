import { getColor } from '../../config/bot.js';
import { SlashCommandBuilder, PermissionFlagsBits, MessageFlags, ChannelType } from 'discord.js';
import { createEmbed, successEmbed } from '../../utils/embeds.js';
import { logger } from '../../utils/logger.js';

import { handleCreate } from './modules/serverstats_create.js';
import { handleList } from './modules/serverstats_list.js';
import { handleUpdate } from './modules/serverstats_update.js';
import { handleDelete } from './modules/serverstats_delete.js';

import { InteractionHelper } from '../../utils/interactionHelper.js';
import { replyUserError, ErrorTypes } from '../../utils/errorHandler.js';
export default {
    data: new SlashCommandBuilder()
        .setName("serverstats")
        .setDescription("إدارة إحصاءات السيرفر التي تتتبع أعداد الأعضاء وبيانات القنوات")
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
        .addSubcommand(subcommand =>
            subcommand
                .setName("create")
                .setDescription("إنشاء قناة جديدة لتتبع الإحصاءات داخل فئة")
                .addStringOption(option =>
                    option
                        .setName("type")
                        .setDescription("نوع الإحصاءات المطلوب تتبعها")
                        .setRequired(true)
                        .addChoices(
                            { name: "members + bots", value: "members" },
                            { name: "members only", value: "members_only" },
                            { name: "bots only", value: "bots" }
                        )
                )
                .addStringOption(option =>
                    option
                        .setName("channel_type")
                        .setDescription("نوع القناة التي سيتم إنشاؤها لهذا المتتبع")
                        .setRequired(true)
                        .addChoices(
                            { name: "voice channel (recommended)", value: "voice" },
                            { name: "text channel", value: "text" }
                        )
                )
                .addChannelOption(option =>
                    option
                        .setName("category")
                        .setDescription("الفئة التي ستُنشأ فيها قناة متتبع الإحصاءات")
                        .setRequired(true)
                        .addChannelTypes(ChannelType.GuildCategory)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName("list")
                .setDescription("عرض جميع متتبعات الإحصاءات لهذا السيرفر")
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName("update")
                .setDescription("تحديث متتبع إحصاءات موجود")
                .addStringOption(option =>
                    option
                        .setName("counter-id")
                        .setDescription("معرّف المتتبع المطلوب تحديثه")
                        .setRequired(true)
                )
                .addStringOption(option =>
                    option
                        .setName("type")
                        .setDescription("نوع المتتبع الجديد")
                        .setRequired(false)
                        .addChoices(
                            { name: "members + bots", value: "members" },
                            { name: "members only", value: "members_only" },
                            { name: "bots only", value: "bots" }
                        )
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName("delete")
                .setDescription("حذف متتبع إحصاءات موجود")
                .addStringOption(option =>
                    option
                        .setName("counter-id")
                        .setDescription("معرّف المتتبع المطلوب حذفه")
                        .setRequired(true)
                )
        ),

    async execute(interaction, guildConfig, client) {
        const subcommand = interaction.options.getSubcommand();

        switch (subcommand) {
            case "create":
                await handleCreate(interaction, client);
                break;
            case "list":
                await handleList(interaction, client);
                break;
            case "update":
                await handleUpdate(interaction, client);
                break;
            case "delete":
                await handleDelete(interaction, client);
                break;
            default:
                await replyUserError(interaction, { type: ErrorTypes.VALIDATION, message: 'Unknown subcommand.' });
        }
    }
};