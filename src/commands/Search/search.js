import { SlashCommandBuilder } from 'discord.js';
import { replyUserError, ErrorTypes } from '../../utils/errorHandler.js';

import searchDefine from './modules/search_define.js';
import searchGoogle from './modules/search_google.js';
import searchUrban from './modules/search_urban.js';

export default {
    data: new SlashCommandBuilder()
        .setName('search')
        .setDescription('البحث في الويب والقواميس')
        .addSubcommand(subcommand =>
            subcommand
                .setName('define')
                .setDescription('البحث عن تعريف كلمة')
                .addStringOption(option =>
                    option.setName('word')
                        .setDescription('الكلمة المطلوب البحث عن تعريفها')
                        .setRequired(true))
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('google')
                .setDescription('البحث في Google')
                .addStringOption(option =>
                    option.setName('query')
                        .setDescription('ما الذي تريد البحث عنه؟')
                        .setRequired(true))
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('urban')
                .setDescription('البحث عن التعريفات في Urban القاموس')
                .addStringOption(option =>
                    option.setName('term')
                        .setDescription('المصطلح المطلوب البحث عنه في Urban القاموس')
                        .setRequired(true))
        ),

    async execute(interaction, config, client) {
        const subcommand = interaction.options.getSubcommand();

        switch (subcommand) {
            case 'define':
                return await searchDefine.execute(interaction, config, client);
            case 'google':
                return await searchGoogle.execute(interaction, config, client);
            case 'urban':
                return await searchUrban.execute(interaction, config, client);
            default:
                return await replyUserError(interaction, { type: ErrorTypes.UNKNOWN, message: 'Unknown subcommand' });
        }
    }
};
