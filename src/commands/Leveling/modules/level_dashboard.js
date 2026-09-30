import { getColor } from '../../../config/bot.js';
import {
    ActionRowBuilder,
    StringSelectMenuBuilder,
    StringSelectMenuOptionBuilder,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    ChannelSelectMenuBuilder,
    RoleSelectMenuBuilder,
    LabelBuilder,
    ButtonBuilder,
    ButtonStyle,
    ChannelType,
    MessageFlags,
    ComponentType,
    EmbedBuilder,
} from 'discord.js';
import { InteractionHelper } from '../../../utils/interactionHelper.js';
import { successEmbed } from '../../../utils/embeds.js';
import { logger } from '../../../utils/logger.js';
import { TitanBotError, ErrorTypes, replyUserError } from '../../../utils/errorHandler.js';
import { getLevelingConfig, saveLevelingConfig } from '../../../services/leveling/leveling.js';
import { botHasPermission } from '../../../utils/permissionGuard.js';
import { startDashboardSession } from '../../../utils/dashboardSession.js';

function buildDashboardEmbed(cfg, guild) {
    const channel = cfg.levelUpChannel ? `<#${cfg.levelUpChannel}>` : '`غير محدد`';
    const xpMin = cfg.xpRange?.min ?? cfg.xpPerMessage?.min ?? 15;
    const xpMax = cfg.xpRange?.max ?? cfg.xpPerMessage?.max ?? 25;
    const cooldown = cfg.xpCooldown ?? 60;
    const rawMsg = cfg.levelUpMessage || 'مبروك {user}! لقد ارتفعت إلى المستوى {level}! 🎉';
    const msgPreview = `\`${rawMsg.length > 60 ? rawMsg.substring(0, 60) + '…' : rawMsg}\``;

    const rewards = cfg.roleRewards ?? {};
    const rewardEntries = Object.entries(rewards).sort(([a], [b]) => Number(a) - Number(b));
    const rewardsValue = rewardEntries.length > 0
        ? rewardEntries.map(([lvl, roleId]) => `المستوى **${lvl}** ← <@&${roleId}>`).join('\n')
        : '`لا توجد مكافآت معينة`';

    const ignoredChannels = cfg.ignoredChannels ?? [];
    const ignoredRoles = cfg.ignoredRoles ?? [];
    const ignoredChValue = ignoredChannels.length > 0 ? ignoredChannels.map(id => `<#${id}>`).join('، ') : '`لا يوجد`';
    const ignoredRoValue = ignoredRoles.length > 0 ? ignoredRoles.map(id => `<@&${id}>`).join('، ') : '`لا يوجد`';

    return new EmbedBuilder()
        .setTitle('⚡ لوحة تحكم نظام المستويات (Leveling)')
        .setDescription(`إدارة إعدادات نظام المستويات لسيرفر **${guild.name}**.\nاختر خياراً من القائمة أدناه للتعديل.`)
        .setColor(getColor('info'))
        .addFields(
            { name: 'روم الترقية', value: channel, inline: true },
            { name: 'حالة النظام', value: cfg.enabled ? '**مُفعّل**' : '**معطّل**', inline: true },
            { name: 'الإشعارات', value: cfg.announceLevelUp !== false ? '**مُفعّلة**' : '**معطّلة**', inline: true },
            { name: 'النقاط لكل رسالة (XP)', value: `\`${xpMin} – ${xpMax}\``, inline: true },
            { name: 'مهلة الكولداون', value: `\`${cooldown} ثانية\``, inline: true },
            { name: '\u200B', value: '\u200B', inline: true },
            { name: 'رسالة الترقية', value: msgPreview, inline: false },
            { name: 'مكافآت الرتب', value: rewardsValue, inline: false },
            { name: 'الرومات المستثناة', value: ignoredChValue, inline: true },
            { name: 'الرتب المستثناة', value: ignoredRoValue, inline: true },
        )
        .setFooter({ text: 'تغلق لوحة التحكم تلقائياً بعد 10 دقائق من الخمول' })
        .setTimestamp();
}

function buildSelectMenu(guildId) {
    return new StringSelectMenuBuilder()
        .setCustomId(`level_cfg_${guildId}`)
        .setPlaceholder('اختر إعداداً للتعديل عليه...')
        .addOptions(
            new StringSelectMenuOptionBuilder()
                .setLabel('تغيير روم الترقية')
                .setDescription('تحديد الروم التي تُرسل فيها إشعارات زيادة المستوى')
                .setValue('channel')
                .setEmoji('📢'),
            new StringSelectMenuOptionBuilder()
                .setLabel('تعديل رسالة الترقية')
                .setDescription('تخصيص الرسالة التي تظهر عند ارتقاء العضو لمستوى جديد')
                .setValue('message')
                .setEmoji('💬'),
            new StringSelectMenuOptionBuilder()
                .setLabel('تحديد مدى نقاط الـ XP')
                .setDescription('تحديد الحد الأدنى والأقصى لنقاط الـ XP لكل رسالة')
                .setValue('xp_range')
                .setEmoji('🎲'),
            new StringSelectMenuOptionBuilder()
                .setLabel('تحديد مهلة الكولداون')
                .setDescription('عدد الثواني بين كل احتساب نقاط XP لنفس العضو')
                .setValue('xp_cooldown')
                .setEmoji('⏱️'),
            new StringSelectMenuOptionBuilder()
                .setLabel('إضافة مكافأة رتبة')
                .setDescription('منح رتبة معينة عند وصول العضو لمستوى محدد')
                .setValue('role_reward_add')
                .setEmoji('🏆'),
            new StringSelectMenuOptionBuilder()
                .setLabel('إزالة مكافأة رتبة')
                .setDescription('حذف مكافأة رتبة مرتبطة بمستوى معين')
                .setValue('role_reward_remove')
                .setEmoji('🗑️'),
            new StringSelectMenuOptionBuilder()
                .setLabel('الرومات المستثناة')
                .setDescription('تحديد الرومات التي لن يتم احتساب نقاط XP فيها')
                .setValue('ignore_channels')
                .setEmoji('🚫'),
            new StringSelectMenuOptionBuilder()
                .setLabel('الرتب المستثناة')
                .setDescription('تحديد الرتب التي لن يحصل أصحابها على نقاط XP')
                .setValue('ignore_roles')
                .setEmoji('🚫'),
        );
}

function buildButtonRow(cfg, guildId, disabled = false) {
    const announceOn = cfg.announceLevelUp !== false;
    const systemOn = cfg.enabled !== false;
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`level_cfg_toggle_announce_${guildId}`)
            .setLabel('الإشعارات')
            .setStyle(announceOn ? ButtonStyle.Success : ButtonStyle.Danger)
            .setEmoji('📣')
            .setDisabled(disabled),
        new ButtonBuilder()
            .setCustomId(`level_cfg_toggle_system_${guildId}`)
            .setLabel('نظام المستويات')
            .setStyle(systemOn ? ButtonStyle.Success : ButtonStyle.Danger)
            .setEmoji('⚡')
            .setDisabled(disabled),
    );
}

async function refreshDashboard(rootInteraction, cfg, guildId) {
    const selectMenu = buildSelectMenu(guildId);
    await InteractionHelper.safeEditReply(rootInteraction, {
        embeds: [buildDashboardEmbed(cfg, rootInteraction.guild)],
        components: [
            buildButtonRow(cfg, guildId),
            new ActionRowBuilder().addComponents(selectMenu),
        ],
    }).catch(() => {});
}

export default {
    prefixOnly: false,
    async execute(interaction, config, client) {
        try {
            const guildId = interaction.guild.id;
            const cfg = await getLevelingConfig(client, guildId);

            if (!cfg.configured) {
                throw new TitanBotError(
                    'Leveling system not configured',
                    ErrorTypes.CONFIGURATION,
                    'نظام المستويات غير مهيأ بعد. يرجى تشغيل الأمر `/level setup` أولاً لإعداده.',
                );
            }

            await startDashboardSession({
                interaction,
                embeds: [buildDashboardEmbed(cfg, interaction.guild)],
                components: [
                    buildButtonRow(cfg, guildId),
                    new ActionRowBuilder().addComponents(buildSelectMenu(guildId)),
                ],
                selectMenuId: `level_cfg_${guildId}`,
                buttonMatcher: (customId) =>
                    customId === `level_cfg_toggle_announce_${guildId}` ||
                    customId === `level_cfg_toggle_system_${guildId}`,
                onSelect: async (selectInteraction) => {
                    const selectedOption = selectInteraction.values[0];
                    switch (selectedOption) {
                        case 'channel':
                            await handleChannel(selectInteraction, interaction, cfg, guildId, client);
                            break;
                        case 'message':
                            await handleMessage(selectInteraction, interaction, cfg, guildId, client);
                            break;
                        case 'xp_range':
                            await handleXpRange(selectInteraction, interaction, cfg, guildId, client);
                            break;
                        case 'xp_cooldown':
                            await handleXpCooldown(selectInteraction, interaction, cfg, guildId, client);
                            break;
                        case 'role_reward_add':
                            await handleRoleRewardAdd(selectInteraction, interaction, cfg, guildId, client);
                            break;
                        case 'role_reward_remove':
                            await handleRoleRewardRemove(selectInteraction, interaction, cfg, guildId, client);
                            break;
                        case 'ignore_channels':
                            await handleIgnoreChannels(selectInteraction, interaction, cfg, guildId, client);
                            break;
                        case 'ignore_roles':
                            await handleIgnoreRoles(selectInteraction, interaction, cfg, guildId, client);
                            break;
                    }
                },
                onButton: async (btnInteraction) => {
                    await btnInteraction.deferUpdate().catch(() => null);
                    const isAnnounce = btnInteraction.customId === `level_cfg_toggle_announce_${guildId}`;

                    if (isAnnounce) {
                        cfg.announceLevelUp = cfg.announceLevelUp === false;
                        await saveLevelingConfig(client, guildId, cfg);
                        await btnInteraction.followUp({
                            embeds: [
                                successEmbed(
                                    '✅ تم تحديث الإشعارات',
                                    `إشعارات ارتقاء المستوى أصبحت الآن **${cfg.announceLevelUp ? 'مُفعّلة' : 'معطّلة'}**.`,
                                ),
                            ],
                            flags: MessageFlags.Ephemeral,
                        });
                    } else {
                        const wasEnabled = cfg.enabled !== false;
                        cfg.enabled = !wasEnabled;
                        await saveLevelingConfig(client, guildId, cfg);
                        await btnInteraction.followUp({
                            embeds: [
                                successEmbed(
                                    '✅ تم تحديث النظام',
                                    `نظام المستويات أصبح الآن **${cfg.enabled ? 'مُفعّلاً' : 'معطّلاً'}**.${!cfg.enabled ? '\nلن يكسب الأعضاء أي نقاط XP حتى يتم إعادة تفعيل النظام.' : ''}`,
                                ),
                            ],
                            flags: MessageFlags.Ephemeral,
                        });
                    }

                    await refreshDashboard(interaction, cfg, guildId);
                },
            });
        } catch (error) {
            if (error instanceof TitanBotError) throw error;
            logger.error('Unexpected error in level_dashboard:', error);
            throw new TitanBotError(
                `Level dashboard failed: ${error.message}`,
                ErrorTypes.UNKNOWN,
                'فشل في فتح لوحة تحكم المستويات.',
            );
        }
    },
};

async function handleRoleRewardAdd(selectInteraction, rootInteraction, cfg, guildId, client) {
    const modal = new ModalBuilder()
        .setCustomId(`level_cfg_role_reward_add_${guildId}`)
        .setTitle('🏆 إضافة مكافأة رتبة');

    const roleSelect = new RoleSelectMenuBuilder()
        .setCustomId('reward_role')
        .setPlaceholder('اختر الرتبة المراد منحها...')
        .setMinValues(1)
        .setMaxValues(1)
        .setRequired(true);

    const roleLabel = new LabelBuilder()
        .setLabel('الرتبة الممنوحة')
        .setDescription('سيتم منح هذه الرتبة عندما يصل العضو للمستوى المحدد')
        .setRoleSelectMenuComponent(roleSelect);

    const levelInput = new TextInputBuilder()
        .setCustomId('reward_level')
        .setLabel('المستوى المطلوب (1–500)')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('10')
        .setMaxLength(3)
        .setMinLength(1)
        .setRequired(true);

    modal.addLabelComponents(roleLabel);
    modal.addComponents(new ActionRowBuilder().addComponents(levelInput));

    await selectInteraction.showModal(modal);

    const submitted = await selectInteraction
        .awaitModalSubmit({
            filter: i => i.customId === `level_cfg_role_reward_add_${guildId}` && i.user.id === selectInteraction.user.id,
            time: 120_000,
        })
        .catch(() => null);

    if (!submitted) return;

    const rawLevel = submitted.fields.getTextInputValue('reward_level').trim();
    const level = parseInt(rawLevel, 10);

    if (isNaN(level) || level < 1 || level > 500) {
        await replyUserError(submitted, { type: ErrorTypes.VALIDATION, message: 'يجب أن يكون المستوى رقماً صحيحاً بين **1** و **500**.' });
        return;
    }

    const roleId = submitted.fields.getField('reward_role').values[0];

    cfg.roleRewards = cfg.roleRewards ?? {};
    cfg.roleRewards[level] = roleId;
    await saveLevelingConfig(client, guildId, cfg);

    await submitted.reply({
        embeds: [successEmbed('تمت إضافة المكافأة', `سيتم منح <@&${roleId}> عند الوصول للمستوى **${level}**.`)],
        flags: MessageFlags.Ephemeral,
    });

    await refreshDashboard(rootInteraction, cfg, guildId);
}

async function handleRoleRewardRemove(selectInteraction, rootInteraction, cfg, guildId, client) {
    const rewards = cfg.roleRewards ?? {};
    const entries = Object.entries(rewards).sort(([a], [b]) => Number(a) - Number(b));

    if (entries.length === 0) {
        await selectInteraction.deferUpdate();
        await replyUserError(selectInteraction, {
            type: ErrorTypes.USER_INPUT,
            message: 'لا توجد أي مكافآت رتب مضافة حتى يتم حذفها.',
        });
        return;
    }

    const modal = new ModalBuilder()
        .setCustomId(`level_cfg_role_reward_remove_${guildId}`)
        .setTitle('🗑️ إزالة مكافأة رتبة');

    const infoInput = new TextInputBuilder()
        .setCustomId('current_rewards')
        .setLabel('المكافآت الحالية (للقراءة فقط)')
        .setStyle(TextInputStyle.Paragraph)
        .setValue(entries.map(([lvl, roleId]) => `المستوى ${lvl}: <@&${roleId}>`).join('\n'))
        .setRequired(false);

    const levelInput = new TextInputBuilder()
        .setCustomId('remove_level')
        .setLabel('المستوى المراد حذف مكافأته')
        .setStyle(TextInputStyle.Short)
        .setValue(entries[0][0])
        .setMaxLength(3)
        .setMinLength(1)
        .setRequired(true);

    modal.addComponents(
        new ActionRowBuilder().addComponents(infoInput),
        new ActionRowBuilder().addComponents(levelInput),
    );

    await selectInteraction.showModal(modal);

    const submitted = await selectInteraction
        .awaitModalSubmit({
            filter: i => i.customId === `level_cfg_role_reward_remove_${guildId}` && i.user.id === selectInteraction.user.id,
            time: 120_000,
        })
        .catch(() => null);

    if (!submitted) return;

    const rawLevel = submitted.fields.getTextInputValue('remove_level').trim();
    const level = parseInt(rawLevel, 10);

    if (isNaN(level) || !cfg.roleRewards?.[level]) {
        await replyUserError(submitted, { type: ErrorTypes.USER_INPUT, message: `لا توجد مكافأة رتبة مسجلة للمستوى **${rawLevel}**.` });
        return;
    }

    delete cfg.roleRewards[level];
    await saveLevelingConfig(client, guildId, cfg);

    await submitted.reply({
        embeds: [successEmbed('تمت إزالة المكافأة', `تمت إزالة مكافأة الرتبة الخاصة بالمستوى **${level}**.`)],
        flags: MessageFlags.Ephemeral,
    });

    await refreshDashboard(rootInteraction, cfg, guildId);
}

async function handleChannel(selectInteraction, rootInteraction, cfg, guildId, client) {
    const modal = new ModalBuilder()
        .setCustomId(`level_cfg_channel_modal_${guildId}`)
        .setTitle('📢 تغيير روم الترقية');

    const channelSelect = new ChannelSelectMenuBuilder()
        .setCustomId('levelup_channel')
        .setPlaceholder('اختر روم كتابي...')
        .setMinValues(1)
        .setMaxValues(1)
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(true);

    const channelLabel = new LabelBuilder()
        .setLabel('روم الترقية')
        .setDescription('الروم التي ستُرسل فيها إشعارات ارتقاء المستويات')
        .setChannelSelectMenuComponent(channelSelect);

    modal.addLabelComponents(channelLabel);

    await selectInteraction.showModal(modal);

    const submitted = await selectInteraction
        .awaitModalSubmit({
            filter: i => i.customId === `level_cfg_channel_modal_${guildId}` && i.user.id === selectInteraction.user.id,
            time: 120_000,
        })
        .catch(() => null);

    if (!submitted) return;

    const channelId = submitted.fields.getField('levelup_channel').values[0];
    const channel = selectInteraction.guild.channels.cache.get(channelId);

    if (channel && !botHasPermission(channel, ['SendMessages', 'EmbedLinks'])) {
        await replyUserError(submitted, { type: ErrorTypes.PERMISSION, message: `أحتاج إلى صلاحيات **إرسال الرسائل** (Send Messages) و **تضمين الروابط** (Embed Links) في ${channel} لإرسال الإشعارات.` });
        return;
    }

    cfg.levelUpChannel = channelId;
    await saveLevelingConfig(client, guildId, cfg);

    await submitted.reply({
        embeds: [successEmbed('✅ تم تحديث الروم', `ستُرسل إشعارات ارتقاء المستوى الآن في ${channel ?? `<#${channelId}>`}.`)],
        flags: MessageFlags.Ephemeral,
    });

    await refreshDashboard(rootInteraction, cfg, guildId);
}

async function handleIgnoreChannels(selectInteraction, rootInteraction, cfg, guildId, client) {
    const modal = new ModalBuilder()
        .setCustomId(`level_cfg_ignore_channels_${guildId}`)
        .setTitle('🚫 الرومات المستثناة');

    const channelSelect = new ChannelSelectMenuBuilder()
        .setCustomId('ignore_channel')
        .setPlaceholder('اختر الرومات لإضافتها أو إزالتها...')
        .setMinValues(1)
        .setMaxValues(10)
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(true);

    const channelLabel = new LabelBuilder()
        .setLabel('تبديل الرومات المستثناة')
        .setDescription('الرومات المحددة سيتم تبديل حالتها — لن يتم احتساب نقاط XP فيها')
        .setChannelSelectMenuComponent(channelSelect);

    modal.addLabelComponents(channelLabel);

    await selectInteraction.showModal(modal);

    const submitted = await selectInteraction
        .awaitModalSubmit({
            filter: i => i.customId === `level_cfg_ignore_channels_${guildId}` && i.user.id === selectInteraction.user.id,
            time: 120_000,
        })
        .catch(() => null);

    if (!submitted) return;

    const selectedIds = submitted.fields.getField('ignore_channel').values;
    const ignoreSet = new Set(cfg.ignoredChannels ?? []);

    for (const id of selectedIds) {
        if (ignoreSet.has(id)) {
            ignoreSet.delete(id);
        } else {
            ignoreSet.add(id);
        }
    }

    cfg.ignoredChannels = Array.from(ignoreSet);
    await saveLevelingConfig(client, guildId, cfg);

    const list = cfg.ignoredChannels.length > 0
        ? cfg.ignoredChannels.map(id => `<#${id}>`).join('، ')
        : '`لا يوجد`';

    await submitted.reply({
        embeds: [successEmbed('✅ تم تحديث الرومات المستثناة', `لن يتم احتساب نقاط XP في: ${list}`)],
        flags: MessageFlags.Ephemeral,
 