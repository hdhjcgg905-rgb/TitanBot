import { getColor } from '../../config/bot.js';
import { SlashCommandBuilder, PermissionFlagsBits, ChannelType, MessageFlags } from 'discord.js';
import { createEmbed } from '../../utils/embeds.js';
import { getLevelingConfig, saveLevelingConfig } from '../../services/leveling/leveling.js';
import { botHasPermission } from '../../utils/permissionGuard.js';
import { TitanBotError, ErrorTypes, replyUserError } from '../../utils/errorHandler.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';
import { logger } from '../../utils/logger.js';
import levelDashboard from './modules/level_dashboard.js';

export default {
    data: new SlashCommandBuilder()
        .setName('level')
        .setDescription('إدارة نظام المستويات واللفلات')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
        .setDMPermission(false)
        .addSubcommand((subcommand) =>
            subcommand
                .setName('setup')
                .setDescription('إعداد نظام المستويات وتفعيله')
                .addChannelOption((option) =>
                    option
                        .setName('channel')
                        .setDescription('القناة المخصصة لإرسال إشعارات الترقية')
                        .addChannelTypes(ChannelType.GuildText)
                        .setRequired(true),
                )
                .addIntegerOption((option) =>
                    option
                        .setName('xp_min')
                        .setDescription('أدنى حد للخبرة لكل رسالة (الافتراضي: 15)')
                        .setMinValue(1)
                        .setMaxValue(500)
                        .setRequired(false),
                )
                .addIntegerOption((option) =>
                    option
                        .setName('xp_max')
                        .setDescription('أقصى حد للخبرة لكل رسالة (الافتراضي: 25)')
                        .setMinValue(1)
                        .setMaxValue(500)
                        .setRequired(false),
                )
                .addStringOption((option) =>
                    option
                        .setName('message')
                        .setDescription(
                            'رسالة الترقية. استخدم {user} و {level}',
                        )
                        .setMaxLength(500)
                        .setRequired(false),
                )
                .addIntegerOption((option) =>
                    option
                        .setName('xp_cooldown')
                        .setDescription('الثواني بين كل كسب للخبرة لكل شخص (الافتراضي: 60)')
                        .setMinValue(0)
                        .setMaxValue(3600)
                        .setRequired(false),
                ),
        )
        .addSubcommand((subcommand) =>
            subcommand
                .setName('dashboard')
                .setDescription('فتح لوحة تحكم إعدادات المستويات التفاعلية'),
        ),
    category: 'Leveling',

    async execute(interaction, config, client) {
        const deferred = await InteractionHelper.safeDefer(interaction, {
            flags: MessageFlags.Ephemeral,
        });
        if (!deferred) return;

        if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
            return await replyUserError(interaction, { type: ErrorTypes.PERMISSION, message: 'تنعى الخدمة: تحتاج إلى صلاحية **إدارة السيرفر** (Manage Server) لاستخدام هذا الأمر.' });
        }

        const subcommand = interaction.options.getSubcommand();

        if (subcommand === 'dashboard') {
            return levelDashboard.execute(interaction, config, client);
        }

        if (subcommand === 'setup') {
            const channel = interaction.options.getChannel('channel');
            const xpMin = interaction.options.getInteger('xp_min') ?? 15;
            const xpMax = interaction.options.getInteger('xp_max') ?? 25;
            const message =
                interaction.options.getString('message') ??
                'مبروك {user}! لقد ارتفعت إلى المستوى {level}! 🎉';
            const xpCooldown = interaction.options.getInteger('xp_cooldown') ?? 60;

            if (xpMin > xpMax) {
                return await replyUserError(interaction, { type: ErrorTypes.VALIDATION, message: `الحد الأدنى للـ XP (**${xpMin}**) لا يمكن أن يكون أكبر من الحد الأقصى (**${xpMax}**).` });
            }

            if (!botHasPermission(channel, ['SendMessages', 'EmbedLinks'])) {
                throw new TitanBotError(
                    'Bot missing permissions in the specified channel',
                    ErrorTypes.PERMISSION,
                    `أحتاج إلى صلاحيات **إرسال الرسائل** و **تضمين الروابط** في القناة ${channel} لإرسال إشعارات الترقية.`,
                );
            }

            const existingConfig = await getLevelingConfig(client, interaction.guildId);

            if (existingConfig.configured) {
                return await replyUserError(interaction, { type: ErrorTypes.UNKNOWN, message: `نظام المستويات مُعد مسبقاً في هذا السيرفر (تُرسل إشعارات الترقية إلى <#${existingConfig.levelUpChannel}>).\n\nاستخدم الأمر \`/level dashboard\` للتعديل على الإعدادات.` });
            }

            const newConfig = {
                ...existingConfig,
                configured: true,
                enabled: true,
                levelUpChannel: channel.id,
                xpRange: { min: xpMin, max: xpMax },
                xpCooldown: xpCooldown,
                levelUpMessage: message,
                announceLevelUp: true,
            };

            await saveLevelingConfig(client, interaction.guildId, newConfig);

            logger.info(`Leveling system set up in guild ${interaction.guildId}`, {
                channelId: channel.id,
                xpMin,
                xpMax,
                xpCooldown,
                userId: interaction.user.id,
            });

            return await InteractionHelper.safeEditReply(interaction, {
                embeds: [
                    createEmbed({
                        title: '✅ تم إعداد نظام المستويات',
                        description:
                            `نظام المستويات **مُفعّل** الآن وجاهز للاستخدام.\n\n` +
                            `**قناة الترقية:** ${channel}\n` +
                            `**الـ XP لكل رسالة:** ${xpMin} – ${xpMax}\n` +
                            `**مهلة الكولداون:** ${xpCooldown} ثانية\n` +
                            `**رسالة الترقية:** \`${message}\`\n\n` +
                            `يمكنك استخدام \`/level dashboard\` لتعديل أي من هذه الإعدادات في أي وقت.`,
                        color: 'success',
                    }),
                ],
            });
        }
    },
};