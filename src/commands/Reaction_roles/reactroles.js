import { getColor } from '../../config/bot.js';
import { SlashCommandBuilder, PermissionFlagsBits, ChannelType, ActionRowBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, RoleSelectMenuBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ButtonBuilder, ButtonStyle, MessageFlags, ComponentType, EmbedBuilder, LabelBuilder, CheckboxBuilder, TextDisplayBuilder } from 'discord.js';
import { createEmbed, successEmbed, infoEmbed, warningEmbed } from '../../utils/embeds.js';
import { logger } from '../../utils/logger.js';
import { createError, TitanBotError, ErrorTypes, replyUserError } from '../../utils/errorHandler.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';
import { createReactionRoleMessage, hasDangerousPermissions, getAllReactionRoleMessages, deleteReactionRoleMessage } from '../../services/reactionRoleService.js';
import { logEvent, EVENT_TYPES } from '../../services/loggingService.js';
import {
    getReactionRolePanelStatus,
    formatPanelStatusField,
} from '../../utils/panelStatus.js';
import { startDashboardSession } from '../../utils/dashboardSession.js';
import { getReactionRoleKey } from '../../utils/database/keys.js';

const DASHBOARD_EPHEMERAL = MessageFlags.Ephemeral;
const SELECT_OPTION_LABEL_LIMIT = 100;
const SELECT_OPTION_DESCRIPTION_LIMIT = 100;

function truncateText(value, maxLength) {
    const text = String(value ?? '');
    return text.length > maxLength ? text.substring(0, maxLength) : text;
}

export default {
    data: new SlashCommandBuilder()
        .setName('reactroles')
        .setDescription('إدارة تعيين الرتب بالتفاعلات')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addSubcommand(subcommand =>
            subcommand
                .setName('setup')
                .setDescription('إعداد لوحة جديدة لرتب التفاعلات')
                .addChannelOption(option => 
                    option.setName('channel')
                        .setDescription('القناة التي ستُرسل إليها رسالة رتب التفاعلات')
                        .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
                        .setRequired(true)
                )
                .addStringOption(option =>
                    option.setName('title')
                        .setDescription('عنوان لوحة رتب التفاعلات')
                        .setRequired(true)
                )
                .addStringOption(option =>
                    option.setName('description')
                        .setDescription('وصف لوحة رتب التفاعلات')
                        .setRequired(true)
                )
                .addRoleOption(option =>
                    option.setName('role1')
                        .setDescription('الرتبة الأولى المراد إضافتها')
                        .setRequired(true)
                )
                .addRoleOption(option =>
                    option.setName('role2')
                        .setDescription('الرتبة الثانية المراد إضافتها')
                        .setRequired(false)
                )
                .addRoleOption(option =>
                    option.setName('role3')
                        .setDescription('الرتبة الثالثة المراد إضافتها')
                        .setRequired(false)
                )
                .addRoleOption(option =>
                    option.setName('role4')
                        .setDescription('الرتبة الرابعة المراد إضافتها')
                        .setRequired(false)
                )
                .addRoleOption(option =>
                    option.setName('role5')
                        .setDescription('الرتبة الخامسة المراد إضافتها')
                        .setRequired(false)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('dashboard')
                .setDescription('إدارة وإعداد لوحات رتب التفاعلات')
                .addStringOption(option =>
                    option
                        .setName('panel')
                        .setDescription('اختر لوحة رتب تفاعلات لإدارتها')
                        .setRequired(false)
                        .setAutocomplete(true)
                )
        ),

    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();

        if (subcommand === 'setup') {
            await handleSetup(interaction);
        } else if (subcommand === 'dashboard') {
            const selectedPanelId = interaction.options.getString('panel');
            await handleDashboard(interaction, selectedPanelId);
        }
    },

    async autocomplete(interaction) {
        if (interaction.commandName !== 'reactroles') return;
        if (interaction.options.getSubcommand() !== 'dashboard') return;

        // Autocomplete must respond within 3s. Build choices from stored panel data and
        // cached channels/messages only — no network fetches — to avoid DiscordAPIError 10062.
        try {
            const guildId = interaction.guild.id;
            const client = interaction.client;
            const guild = interaction.guild;

            let panels;
            try {
                panels = await getAllReactionRoleMessages(client, guildId);
            } catch {
                await interaction.respond([]).catch(() => {});
                return;
            }

            if (!panels?.length) {
                await interaction.respond([]).catch(() => {});
                return;
            }

            const choices = [];
            for (const panel of panels) {
                if (!panel.messageId || !panel.channelId) continue;

                const channel = guild.channels.cache.get(panel.channelId);
                if (!channel) continue;

                const cachedTitle = channel.messages?.cache?.get(panel.messageId)?.embeds?.[0]?.title;
                const roleCount = Array.isArray(panel.roles) ? panel.roles.length : 0;
                const label = cachedTitle
                    ? `${cachedTitle} (#${channel.name})`
                    : `#${channel.name} · ${roleCount} role${roleCount === 1 ? '' : 's'}`;

                choices.push({ name: label.substring(0, 100), value: panel.messageId });
                if (choices.length >= 25) break;
            }

            await interaction.respond(choices).catch(() => {});
        } catch {
            await interaction.respond([]).catch(() => {});
        }
    }
};

async function handleSetup(interaction) {
    const deferSuccess = await InteractionHelper.safeDefer(interaction);
    if (!deferSuccess) return;
    
    logger.info(`Reaction role setup initiated by ${interaction.user.tag} in guild ${interaction.guild.name}`);
    
    const channel = interaction.options.getChannel('channel');
    const title = interaction.options.getString('title');
    const description = interaction.options.getString('description');

    if (channel.type !== ChannelType.GuildText && channel.type !== ChannelType.GuildAnnouncement) {
        throw createError(
            `Invalid channel type: ${channel.type}`,
            ErrorTypes.VALIDATION,
            'Please select a text or announcement channel.',
            { channelType: channel.type }
        );
    }

    if (!interaction.guild.members.me.permissions.has(PermissionFlagsBits.ManageRoles)) {
        throw createError(
            'Bot missing ManageRoles permission',
            ErrorTypes.PERMISSION,
            'I need the "Manage Roles" permission to set up reaction roles.',
            { permission: 'ManageRoles' }
        );
    }
    
    if (!channel.permissionsFor(interaction.guild.members.me).has(PermissionFlagsBits.SendMessages)) {
        throw createError(
            `Bot cannot send messages in ${channel.name}`,
            ErrorTypes.PERMISSION,
            `I don't have permission to send messages in ${channel}.`,
            { channelId: channel.id }
        );
    }

    const existingPanels = await getAllReactionRoleMessages(interaction.client, interaction.guildId);
    if (existingPanels && existingPanels.length >= 5) {
        throw createError(
            'Panel limit reached',
            ErrorTypes.VALIDATION,
            'Your guild has reached the maximum of 5 reaction role panels. Delete an existing panel to create a new one.',
            { maxPanels: 5, currentPanels: existingPanels.length }
        );
    }

    const roles = [];
    const roleValidationErrors = [];
    const seenRoleIds = new Set();
    
    for (let i = 1; i <= 5; i++) {
        const role = interaction.options.getRole(`role${i}`);
        if (role) {
            if (seenRoleIds.has(role.id)) {
                roleValidationErrors.push(`**${role.name}** - This role was selected more than once`);
                continue;
            }

            if (role.position >= interaction.guild.members.me.roles.highest.position) {
                roleValidationErrors.push(`**${role.name}** - My bot's role is positioned lower than this role in your server's role hierarchy and cannot assign it`);
                continue;
            }
            
            if (hasDangerousPermissions(role)) {
                roleValidationErrors.push(`**${role.name}** - This role has dangerous permissions (Administrator, Manage Server, etc.)`);
                continue;
            }
            
            if (role.managed) {
                roleValidationErrors.push(`**${role.name}** - This is a managed role (integration/bot role)`);
                continue;
            }
            
            if (role.id === interaction.guild.id) {
                roleValidationErrors.push(`**${role.name}** - Cannot use the @everyone role`);
                continue;
            }
            
            seenRoleIds.add(role.id);
            roles.push(role);
        }
    }
    
    if (roleValidationErrors.length > 0) {
        const errorMsg = `The following roles cannot be added:\n${roleValidationErrors.join('\n')}`;
        
        if (roles.length === 0) {
            throw createError(
                'No valid roles provided',
                ErrorTypes.VALIDATION,
                errorMsg,
                { errors: roleValidationErrors }
            );
        }
        
        await interaction.followUp({
            embeds: [warningEmbed('Role Validation Warning', errorMsg)],
            flags: MessageFlags.Ephemeral
        });
    }

    if (roles.length < 1) {
        throw createError(
            'No roles provided',
            ErrorTypes.VALIDATION,
            'You must provide at least one valid role.',
            {}
        );
    }

    const row = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
            .setCustomId('reaction_roles')
            .setPlaceholder('اختر الخاص بك الرتب')
            .setMinValues(0)
            .setMaxValues(roles.length)
            .addOptions(
                roles.map(role => ({
                    label: truncateText(role.name, SELECT_OPTION_LABEL_LIMIT),
                    description: truncateText(`Add/remove the ${role.name} role`, SELECT_OPTION_DESCRIPTION_LIMIT),
                    value: role.id,
                    emoji: '🎭'
                }))
            )
    );

    const panelEmbed = new EmbedBuilder()
        .setTitle(title)
        .setDescription(description)
        .setColor(getColor('info'))
        .addFields({
            name: 'Available Roles',
            value: roles.map(role => `• ${role}`).join('\n')
        })
        .setFooter({ text: 'Select roles from the dropdown menu below' });

    const message = await channel.send({
        embeds: [panelEmbed],
        components: [row]
    });

    const roleIds = roles.map(role => role.id);
    try {
        await createReactionRoleMessage(
            interaction.client,
            interaction.guildId,
            channel.id,
            message.id,
            roleIds
        );
    } catch (saveError) {
        // The panel is already posted but its data failed to persist, so the dropdown
        // would not work. Remove the orphaned message before surfacing the error.
        await message.delete().catch(() => {});
        throw saveError;
    }

    logger.info(`Reaction role message created: ${message.id} with ${roles.length} roles by ${interaction.user.tag}`);

    try {
        await logEvent({
            client: interaction.client,
            guildId: interaction.guildId,
            eventType: EVENT_TYPES.REACTION_ROLE_CREATE,
            data: {
                description: `التفاعل الرتبة اللوحة تم الإنشاء بواسطة ${interaction.user.tag}`,
                userId: interaction.user.id,
                channelId: channel.id,
                fields: [
                    {
                        name: 'Title',
                        value: title,
                        inline: false
                    },
                    {
                        name: 'Channel',
                        value: channel.toString(),
                        inline: true
                    },
                    {
                        name: 'Roles',
                        value: `${roles.length} roles`,
                        inline: true
                    },
                    {
                        name: 'Role List',
                        value: roles.map(r => r.toString()).join(','),
                        inline: false
                    },
                    {
                        name: 'Message Link',
                        value: message.url,
                        inline: false
                    }
                ]
            }
        });
    } catch (logError) {
        logger.warn('Failed to log reaction role creation:', logError);
    }

    await InteractionHelper.safeEditReply(interaction, {
        embeds: [successEmbed('Success', `✅ Reaction role panel created in ${channel}!\n\n${message.url}`)]
    });
}

async function fetchPanelDiscordMessage(guild, panelData) {
    try {
        const channel = guild.channels.cache.get(panelData.channelId);
        if (!channel) return null;
        return await channel.messages.fetch(panelData.messageId).catch(() => null);
    } catch {
        return null;
    }
}

async function rebuildLivePanelMessage(guild, panelData) {
    try {
        const channel = guild.channels.cache.get(panelData.channelId);
        if (!channel) return;
        const msg = await channel.messages.fetch(panelData.messageId).catch(() => null);
        if (!msg || !msg.embeds[0]) return;

        const roleObjects = panelData.roles
            .map(id => guild.roles.cache.get(id))
            .filter(Boolean);

        if (roleObjects.length === 0) return;

        const currentEmbed = msg.embeds[0];
        const updatedEmbed = EmbedBuilder.from(currentEmbed);
        const fields = currentEmbed.fields.map(f => ({ name: f.name, value: f.value, inline: f.inline }));
        const roleFieldIdx = fields.findIndex(f => f.name === 'Available Roles');
        const newRoleValue = roleObjects.map(r => `• ${r}`).join('\n');
        if (roleFieldIdx !== -1) {
            fields[roleFieldIdx] = { name: 'Available Roles', value: newRoleValue, inline: false };
        } else {
            fields.push({ name: 'Available Roles', value: newRoleValue, inline: false });
        }
        updatedEmbed.setFields(fields);

        const selectRow = new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder()
                .setCustomId('reaction_roles')
                .setPlaceholder('اختر الخاص بك الرتب')
                .setMinValues(0)
                .setMaxValues(roleObjects.length)
                .addOptions(
                    roleObjects.map(r => ({
                        label: r.name.substring(0, 100),
                        description: `إضافة/إزالة الـ ${r.name} الرتبة`.substring(0, 100),
                        value: r.id,
                        emoji: '🎭',
                    })),
                ),
        );

        await msg.edit({ embeds: [updatedEmbed], components: [selectRow] });
    } catch (error) {
        logger.warn('Could not rebuild live reaction role panel:', error.message);
    }
}

async function showPanelDashboard(interaction, panelData, discordMsg, guildId, guild, client, panelStatus = null) {
    if (!panelStatus && client) {
        panelStatus = await getReactionRolePanelStatus(client, guild, panelData);
        if (panelStatus.recoveredId) {
            await migrateReactionRoleMessageId(client, guildId, panelData, panelStatus.recoveredId);
            discordMsg = panelStatus.message || discordMsg;
        }
    }

    const payload = buildReactionRoleDashboardPayload(panelData, discordMsg, guildId, guild, panelStatus);
    await InteractionHelper.safeEditReply(interaction, { ...payload, flags: DASHBOARD_EPHEMERAL });
}

function buildReactionRoleDashboardPayload(panelData, discordMsg, guildId, guild, panelStatus = null) {
    const channel = guild.channels.cache.get(panelData.channelId);
    const title = discordMsg?.embeds?.[0]?.title ?? 'Untitled Panel';
    const roleList =
        panelData.roles.length > 0
            ? panelData.roles.map(id => `<@&${id}>`).join(',')
            : '`None`';

    const showRepost = panelStatus?.exists === false && panelStatus?.reason === 'panel_deleted';

    const embed = new EmbedBuilder()
        .setTitle('التفاعل الرتب لوحة التحكم')
        .setDescription(
            `**العنوان:** ${title}\n\nاختر خيارًا أدناه لتعديل إعداد.${discordMsg ? `\n[Click Here to View Panel](${discordMsg.url})` : ''}`,
        )
        .setColor(getColor('info'))
        .addFields(
            { name: 'Panel Status', value: formatPanelStatusField(panelStatus), inline: false },
            { name: 'Channel', value: channel ? `<#${channel.id}>` : '`Not found`', inline: true },
            { name: 'Roles', value: `\`${panelData.roles.length} / 25\``, inline: true },
            { name: '\u200B', value: '\u200B', inline: true },
            { name: 'Role List', value: roleList, inline: false },
        )
        .setFooter({ text: 'Dashboard closes after 10 minutes of inactivity' })
        .setTimestamp();

    const buttons = [];

    if (showRepost) {
        buttons.push(
            new ButtonBuilder()
                .setCustomId(`rr_repost_${guildId}`)
                .setLabel('إعادة نشر اللوحة')
                .setStyle(ButtonStyle.Primary)
                .setEmoji('📌'),
        );
    }

    buttons.push(
        new ButtonBuilder()
            .setCustomId(`rr_edit_text_${guildId}`)
            .setLabel('تعديل اللوحة نص')
            .setStyle(ButtonStyle.Primary)
            .setEmoji('✏️'),
        new ButtonBuilder()
            .setCustomId(`rr_delete_${guildId}`)
            .setLabel('حذف اللوحة')
            .setStyle(ButtonStyle.Danger)
            .setEmoji('🗑️'),
    );

    const optionsSelect = new StringSelectMenuBuilder()
        .setCustomId(`rr_opts_${guildId}`)
        .setPlaceholder('اختر  الإجراء...')
        .addOptions(
            new StringSelectMenuOptionBuilder()
                .setLabel('إضافة الرتبة')
                .setDescription('إضافة رتبة إلى هذه اللوحة (حتى 25 رتبة)')
                .setValue('add_role')
                .setEmoji('➕'),
            ...(panelData.roles.length > 0
                ? [
                      new StringSelectMenuOptionBuilder()
                          .setLabel('إزالة الرتبة')
                          .setDescription('إزالة رتبة من هذه اللوحة')
                          .setValue('remove_role')
                          .setEmoji('➖'),
                  ]
                : []),
        );

    return {
        embeds: [embed],
        components: [
            new ActionRowBuilder().addComponents(buttons),
            new ActionRowBuilder().addComponents(optionsSelect),
        ],
    };
}

async function migrateReactionRoleMessageId(client, guildId, panelData, newMessageId)