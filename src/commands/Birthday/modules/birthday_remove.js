import { EmbedBuilder } from 'discord.js';
import { deleteBirthday } from '../../../services/birthdayService.js';

import { InteractionHelper } from '../../../utils/interactionHelper.js';
export default {
    async execute(interaction, config, client) {
        await InteractionHelper.safeDefer(interaction);

        const userId = interaction.user.id;
        const guildId = interaction.guildId;

        const result = await deleteBirthday(client, guildId, userId);

        if (result.status === 'not_found') {
            const embed = new EmbedBuilder()
                .setColor(0xFF0000)
                .setTitle('لا أعياد الميلاد تم العثور')
                .setDescription('أنت don\'t have a birthday set to remove.');
            await InteractionHelper.safeEditReply(interaction, {
                embeds: [embed]
            });
            return;
        }

        const embed = new EmbedBuilder()
            .setColor(0x00FF00)
            .setTitle('أعياد الميلاد تمت الإزالة')
            .setDescription('الخاص بك عيد الميلاد لديه تم بنجاح تمت الإزالة من الـ السيرفر.');
        await InteractionHelper.safeEditReply(interaction, {
            embeds: [embed]
        });
    }
};