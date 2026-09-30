import { SlashCommandBuilder } from 'discord.js';
import shopConfigSetrole from './modules/shop_config_setrole.js';

export default {
    slashOnly: true,
    data: new SlashCommandBuilder()
        .setName('shop-config')
        .setDescription('إعداد المتجر الإعدادات. (إدارة السيرفر مطلوب)')
        .addSubcommand(subcommand =>
            subcommand
                .setName('setrole')
                .setDescription('تعيين الـ Discord الرتبة ممنوحة عندما الـ مميز الرتبة المتجر العنصر هو تم شراؤه.')
                .addRoleOption(option =>
                    option
                        .setName('role')
                        .setDescription('الـ الرتبة إلى منح لـ مميز الرتبة المشتريات.')
                        .setRequired(true),
                ),
        ),

    async execute(interaction, config, client) {
        const subcommand = interaction.options.getSubcommand();

        if (subcommand === 'setrole') {
            return shopConfigSetrole.execute(interaction, config, client);
        }
    },
};
