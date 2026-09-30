import { SlashCommandBuilder, MessageFlags, ChannelType } from 'discord.js';
import { createEmbed, successEmbed } from '../../utils/embeds.js';
import { replyUserError, ErrorTypes } from '../../utils/errorHandler.js';

import birthdaySet from './modules/birthday_set.js';
import birthdayInfo from './modules/birthday_info.js';
import birthdayList from './modules/birthday_list.js';
import birthdayRemove from './modules/birthday_remove.js';
import nextBirthdays from './modules/next_birthdays.js';
import birthdaySetchannel from './modules/birthday_setchannel.js';

import { InteractionHelper } from '../../utils/interactionHelper.js';
export default {
    data: new SlashCommandBuilder()
        .setName('birthday')
        .setDescription('أعياد الميلاد النظام الأوامر')
        .addSubcommand(subcommand =>
            subcommand
                .setName('set')
                .setDescription('تعيين الخاص بك عيد الميلاد')
                .addIntegerOption(option =>
                    option
                        .setName('month')
                        .setDescription('ميلاد الشهر (1-12)')
                        .setRequired(true)
                        .setMinValue(1)
                        .setMaxValue(12)
                )
                .addIntegerOption(option =>
                    option
                        .setName('day')
                        .setDescription('ميلاد اليوم (1-31)')
                        .setRequired(true)
                        .setMinValue(1)
                        .setMaxValue(31)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('info')
                .setDescription('عرض عيد الميلاد المعلومات')
                .addUserOption(option =>
                    option
                        .setName('user')
                        .setDescription('المستخدم إلى تحقق عيد الميلاد لـ')
                        .setRequired(false)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('list')
                .setDescription('عرض الكل أعياد الميلاد في الـ السيرفر')
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('remove')
                .setDescription('إزالة الخاص بك عيد الميلاد')
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('next')
                .setDescription('عرض القادمة أعياد الميلاد')
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('setchannel')
                .setDescription('تعيين أو تعطيل الـ القناة لـ عيد الميلاد الإعلانات. (إدارة السيرفر مطلوب)')
                .addChannelOption(option =>
                    option
                        .setName('channel')
                        .setDescription('الـ نص القناة لـ الإعلانات. Leave فارغة إلى تعطيل.')
                        .addChannelTypes(ChannelType.GuildText)
                        .setRequired(false)
                )
        ),

    async execute(interaction, config, client) {
        const subcommand = interaction.options.getSubcommand();

        switch (subcommand) {
            case 'set':
                return await birthdaySet.execute(interaction, config, client);
            case 'info':
                return await birthdayInfo.execute(interaction, config, client);
            case 'list':
                return await birthdayList.execute(interaction, config, client);
            case 'remove':
                return await birthdayRemove.execute(interaction, config, client);
            case 'next':
                return await nextBirthdays.execute(interaction, config, client);
            case 'setchannel':
                return await birthdaySetchannel.execute(interaction, config, client);
            default:
                return await replyUserError(interaction, { type: ErrorTypes.UNKNOWN, message: 'Unknown subcommand' });
        }
    }
};