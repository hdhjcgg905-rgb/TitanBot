import { SlashCommandBuilder, ChannelType } from 'discord.js';
import { replyUserError, ErrorTypes } from '../../utils/errorHandler.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';

import report from './modules/report.js';
import reportSetchannel from './modules/report_setchannel.js';

export default {
    data: new SlashCommandBuilder()
        .setName('report')
        .setDescription('الإبلاغ عن مستخدم لإدارة السيرفر أو إعداد قناة استقبال البلاغات.')
        .setDMPermission(false)
        .addSubcommand(subcommand =>
            subcommand
                .setName('file')
                .setDescription('الإبلاغ عن مستخدم إلى فريق إشراف السيرفر.')
                .addUserOption(option =>
                    option
                        .setName('user')
                        .setDescription('المستخدم الذي تريد الإبلاغ عنه.')
                        .setRequired(true),
                )
                .addStringOption(option =>
                    option
                        .setName('reason')
                        .setDescription('سبب البلاغ (يرجى ذكر التفاصيل).')
                        .setRequired(true)
                        .setMaxLength(500),
                ),
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('setchannel')
                .setDescription('تحديد القناة التي تُرسل إليها بلاغات المستخدمين. (يتطلب صلاحية إدارة السيرفر)')
                .addChannelOption(option =>
                    option
                        .setName('channel')
                        .setDescription('القناة النصية التي ستستقبل البلاغات.')
                        .addChannelTypes(ChannelType.GuildText)
                        .setRequired(true),
                ),
        ),
    category: 'Utility',

    async execute(interaction, config, client) {
        const subcommand = interaction.options.getSubcommand();

        if (subcommand === 'file') {
            return await report.execute(interaction, config, client);
        }

        if (subcommand === 'setchannel') {
            return await reportSetchannel.execute(interaction, config, client);
        }

        return await replyUserError(interaction, { type: ErrorTypes.UNKNOWN, message: 'Unknown subcommand.' });
    },
};