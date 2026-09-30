/**
 * البيانات الوصفية لفئات الأوامر الخاصة بمدير الوصول للأوامر.
 */

export const CATEGORY_ICONS = {
  Birthday: '🎂',        // أعياد الميلاد
  Community: '👥',       // المجتمع
  Core: 'ℹ️',            // الأساسية
  Economy: '💰',         // الاقتصاد
  Fun: '🎮',             // الترفيه
  Giveaway: '🎉',        // المسابقات (القيف اواي)
  JoinToCreate: '🔌',    // انضم لإنشاء قناة
  Leveling: '📊',        // المستويات
  Logging: '📝',         // السجلات (اللوق)
  Moderation: '🛡️',      // الإشراف والحماية
  Music: '🎵',          // الموسيقى
  Reaction_roles: '🎭',  // الرتب بالتفاعل
  Search: '🔍',         // البحث
  ServerStats: '📈',     // إحصائيات السيرفر
  Ticket: '🎫',          // التذاكر (الدعم الفني)
  Tools: '🛠️',           // الأدوات
  Utility: '🔧',         // الخدمات المساعدة
  Verification: '✅',    // التحقق
  Welcome: '👋',         // الترحيب
};

/** الأوامر التي تبقى متاحة دائماً لتمكين المشرفين من استعادة الوصول. */
export const PROTECTED_COMMANDS = new Set(['commands', 'configwizard']);

// تحويل اسم الفئة إلى صيغة قياسية
export function normalizeCategoryKey(category) {
  return String(category || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_');
}

import { spawnSync } from 'node:child_process';
import { readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { logger } from '../src/utils/logger.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env') });

// تحليل المعاملات والوسائط الممررة عبر السطر البرمجي
function parseArgs(argv) {
  const args = {};

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith('--')) {
      continue;
    }

    const [rawKey, inlineValue] = token.slice(2).split('=');
    if (typeof inlineValue !== 'undefined') {
      args[rawKey] = inlineValue;
      continue;
    }

    const nextToken = argv[index + 1];
    if (!nextToken || nextToken.startsWith('--')) {
      args[rawKey] = true;
      continue;
    }

    args[rawKey] = nextToken;
    index += 1;
  }

  return args;
}

// التأكد من توفر الأداة في النظام (PATH)
function ensureCommand(command) {
  const result = spawnSync(command, ['--version'], {
    encoding: 'utf8',
    stdio: 'pipe',
    shell: process.platform === 'win32'
  });

  if (result.status !== 0) {
    throw new Error(`الأمر ${command} مطلوب ولكن لم يتم العثور عليه في مسار النظام PATH.`);
  }
}

// تحديد أحدث ملف نسخ احتياطي (.dump)
async function resolveLatestBackup(backupDir) {
  const entries = await readdir(backupDir, { withFileTypes: true });
  const dumpFiles = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith('.dump'))
    .map((entry) => entry.name)
    .sort((left, right) => right.localeCompare(left));

  if (dumpFiles.length === 0) {
    throw new Error(`لم يتم العثور على أي ملفات نسخ احتياطي بلامتداد .dump في المجلد: ${backupDir}`);
  }

  return path.join(backupDir, dumpFiles[0]);
}

// تنفيذ أوامر النظام (Terminal Commands)
function runCommand(command, args) {
  const result = spawnSync(command, args, {
    encoding: 'utf8',
    stdio: 'pipe',
    shell: process.platform === 'win32'
  });

  if (result.status !== 0) {
    throw new Error(`فشل أمر ${command}: ${result.stderr || result.stdout || 'خطأ غير معروف'}`);
  }
}

// تشغيل عملية استعادة قاعدة البيانات
async function run() {
  const args = parseArgs(process.argv.slice(2));
  const backupDir = path.resolve(args['backup-dir'] || process.env.BACKUP_DIR || path.join(process.cwd(), 'backups'));
  const targetUrl = args['target-url'] || process.env.POSTGRES_RESTORE_URL || process.env.POSTGRES_URL;

  if (!targetUrl) {
    throw new Error('رابط قاعدة البيانات المستهدفة مفقود. يرجى ضبط POSTGRES_RESTORE_URL أو POSTGRES_URL.');
  }

  if (!args.confirm) {
    throw new Error('تتطلب استعادة قاعدة البيانات تأكيداً صريحاً. أعد التشغيل باستخدام الخيار --confirm.');
  }

  ensureCommand('pg_restore');
  ensureCommand('psql');

  const inputPath = args.input ? path.resolve(args.input) : await resolveLatestBackup(backupDir);
  const dropSchema = args['drop-schema'] === true || args['drop-schema'] === 'true';

  logger.warn('بدء استعادة قاعدة البيانات', {
    event: 'restore.start',
    inputPath,
    targetUrl,
    dropSchema
  });

  // مسح الهيكل القديم وإعادة إنشائه إذا تم طلب ذلك
  if (dropSchema) {
    runCommand('psql', [
      '--dbname',
      targetUrl,
      '-v',
      'ON_ERROR_STOP=1',
      '-c',
      'DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;'
    ]);
  }

  // تنفيذ استعادة قاعدة البيانات
  runCommand('pg_restore', [
    '--clean',
    '--if-exists',
    '--no-owner',
    '--no-privileges',
    '--dbname',
    targetUrl,
    inputPath
  ]);

  logger.info('تمت استعادة قاعدة البيانات بنجاح', {
    event: 'restore.completed',
    inputPath,
    targetUrl
  });
}

run().catch((error) => {
  logger.error('فشلت عملية استعادة قاعدة البيانات', {
    event: 'restore.failed',
    error: error.message
  });
  process.exit(1);
});

// الحصول على أيقونة الفئة
export function getCategoryIcon(category) {
  return CATEGORY_ICONS[category] || CATEGORY_ICONS[formatCategoryName(category)] || '📁';
}
