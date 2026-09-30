import { SlashCommandBuilder } from 'discord.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';
import {
    skipTrack,
    stopPlayback,
    pausePlayback,
    resumePlayback,
    shuffleQueue,
    setLoopMode,
    setVolume,
    seekTrack,
    removeFromQueue,
    moveInQueue,
    clearQueue,
    setTwentyFourSeven,
    leaveVoiceChannel,
    replyMusicSuccess,
} from '../../services/music/musicActions.js';
import { deferMusicCommand } from '../../services/music/prefixSupport.js';

export default {
    category: 'Music',
    data: new SlashCommandBuilder()
        .setName('music')
        .setDescription('إدارة التشغيل وقائمة الانتظار وإعدادات الجلسة الصوتية')
        .addSubcommand((sub) =>
            sub.setName('pause').setDescription('إيقاف التشغيل مؤقتًا'),
        )
        .addSubcommand((sub) =>
            sub.setName('resume').setDescription('استئناف التشغيل'),
        )
        .addSubcommand((sub) =>
            sub.setName('skip').setDescription('تخطي المقطع الحالي'),
        )
        .addSubcommand((sub) =>
            sub.setName('stop').setDescription('إيقاف التشغيل ومسح قائمة الانتظار'),
        )
        .addSubcommand((sub) =>
            sub.setName('shuffle').setDescription('خلط قائمة الانتظار'),
        )
        .addSubcommand((sub) =>
            sub
                .setName('loop')
                .setDescription('تحديد وضع التكرار')
                .addStringOption((opt) =>
                    opt
                        .setName('mode')
                        .setDescription('وضع التكرار')
                        .setRequired(true)
                        .addChoices(
                            { name: 'Off', value: 'none' },
                            { name: 'Track', value: 'track' },
                            { name: 'Queue', value: 'queue' },
                        ),
                ),
        )
        .addSubcommand((sub) =>
            sub
                .setName('volume')
                .setDescription('تحديد مستوى صوت التشغيل')
                .addIntegerOption((opt) =>
                    opt.setName('level').setDescription('مستوى الصوت (0-100)').setRequired(true).setMinValue(0).setMaxValue(100),
                ),
        )
        .addSubcommand((sub) =>
            sub
                .setName('seek')
                .setDescription('الانتقال إلى موضع محدد في المقطع الحالي')
                .addIntegerOption((opt) =>
                    opt.setName('seconds').setDescription('الموضع بالثواني').setRequired(true).setMinValue(0),
                ),
        )
        .addSubcommand((sub) =>
            sub
                .setName('remove')
                .setDescription('إزالة مقطع من قائمة الانتظار')
                .addIntegerOption((opt) =>
                    opt.setName('position').setDescription('موضع المقطع في قائمة الانتظار').setRequired(true).setMinValue(1),
                ),
        )
        .addSubcommand((sub) =>
            sub
                .setName('move')
                .setDescription('نقل مقطع داخل قائمة الانتظار')
                .addIntegerOption((opt) =>
                    opt.setName('from').setDescription('الموضع الحالي').setRequired(true).setMinValue(1),
                )
                .addIntegerOption((opt) =>
                    opt.setName('to').setDescription('الموضع الجديد').setRequired(true).setMinValue(1),
                ),
        )
        .addSubcommand((sub) =>
            sub.setName('clear').setDescription('مسح قائمة الانتظار'),
        )
        .addSubcommand((sub) =>
            sub.setName('leave').setDescription('فصل البوت عن القناة الصوتية'),
        )
        .addSubcommand((sub) =>
            sub
                .setName('247')
                .setDescription('تبديل وضع 24/7 (البقاء في القناة الصوتية عند عدم التشغيل)')
                .addBooleanOption((opt) =>
                    opt.setName('enabled').setDescription('تفعيل أو تعطيل وضع 24/7').setRequired(true),
                ),
        ),

    async execute(interaction, config, client) {
        await deferMusicCommand(interaction);
        const subcommand = interaction.options.getSubcommand();

        switch (subcommand) {
            case 'pause': {
                const embed = await pausePlayback(client, interaction);
                await replyMusicSuccess(interaction, embed);
                break;
            }
            case 'resume': {
                const embed = await resumePlayback(client, interaction);
                await replyMusicSuccess(interaction, embed);
                break;
            }
            case 'skip': {
                const embed = await skipTrack(client, interaction);
                await replyMusicSuccess(interaction, embed);
                break;
            }
            case 'stop': {
                const embed = await stopPlayback(client, interaction);
                await replyMusicSuccess(interaction, embed);
                break;
            }
            case 'shuffle': {
                const embed = await shuffleQueue(client, interaction);
                await replyMusicSuccess(interaction, embed);
                break;
            }
            case 'loop': {
                const embed = await setLoopMode(client, interaction, interaction.options.getString('mode'));
                await replyMusicSuccess(interaction, embed);
                break;
            }
            case 'volume': {
                const embed = await setVolume(client, interaction, interaction.options.getInteger('level'));
                await replyMusicSuccess(interaction, embed);
                break;
            }
            case 'seek': {
                const embed = await seekTrack(client, interaction, interaction.options.getInteger('seconds'));
                await replyMusicSuccess(interaction, embed);
                break;
            }
            case 'remove': {
                const embed = await removeFromQueue(client, interaction, interaction.options.getInteger('position'));
                await replyMusicSuccess(interaction, embed);
                break;
            }
            case 'move': {
                const embed = await moveInQueue(
                    client,
                    interaction,
                    interaction.options.getInteger('from'),
                    interaction.options.getInteger('to'),
                );
                await replyMusicSuccess(interaction, embed);
                break;
            }
            case 'clear': {
                const embed = await clearQueue(client, interaction);
                await replyMusicSuccess(interaction, embed);
                break;
            }
            case 'leave': {
                const embed = await leaveVoiceChannel(client, interaction);
                await replyMusicSuccess(interaction, embed);
                break;
            }
            case '247': {
                const embed = await setTwentyFourSeven(client, interaction, interaction.options.getBoolean('enabled'));
                await replyMusicSuccess(interaction, embed);
                break;
            }
            default:
                await InteractionHelper.safeEditReply(interaction, {
                    content: 'أمر موسيقى فرعي غير معروف.',
                });
        }
    },
};
