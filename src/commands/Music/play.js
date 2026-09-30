import { SlashCommandBuilder, MessageFlags } from 'discord.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';
import { playQuery, replyMusicSuccess } from '../../services/music/musicActions.js';

export default {
    slashOnly: true,
    category: 'Music',
    data: new SlashCommandBuilder()
        .setName('play')
        .setDescription('تشغيل أغنية أو إضافتها إلى قائمة الانتظار')
        .addStringOption(opt =>
            opt.setName('query')
                .setDescription('اسم الأغنية أو الرابط')
                .setRequired(true)
        )
        .addStringOption(opt =>
            opt.setName('source')
                .setDescription('اختر منصة البحث')
                .setRequired(false)
                .addChoices(
                    { name: '🎵 YouTube Music (موصى به)', value: 'ytmsearch:' },
                    { name: '🟢 Spotify', value: 'spsearch:' },
                    { name: '🔴 YouTube Normal', value: 'ytsearch:' }
                )
        ),

    async execute(interaction, config, client) {
        const deferred = await InteractionHelper.safeDefer(interaction, { flags: MessageFlags.Ephemeral });

        if (!deferred) {
            return;
        }

        const rawQuery = interaction.options.getString('query');
        const sourcePrefix = interaction.options.getString('source') || 'ytmsearch:';

        // إذا كان الإدخال رابطاً (URL)، نستخدمه مباشرة، وإلا نضيف البادئة المحددة
        const isUrl = /^https?:\/\//i.test(rawQuery);
        const finalQuery = isUrl ? rawQuery : `${sourcePrefix}${rawQuery}`;

        const result = await playQuery(client, interaction, finalQuery);
        await replyMusicSuccess(interaction, result.embed);
    },
};
