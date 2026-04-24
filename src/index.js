import 'dotenv/config';
import { Telegraf, Markup } from 'telegraf';
import fs from 'node:fs/promises';
import path from 'node:path';

const BOT_TOKEN = process.env.BOT_TOKEN;
const DATA_FILE = process.env.DATA_FILE || './data/participants.json';

if (!BOT_TOKEN) {
  console.error('Ошибка: не задан BOT_TOKEN. Добавьте его в .env или Railway Variables.');
  process.exit(1);
}

const bot = new Telegraf(BOT_TOKEN);
const userState = new Map();

const TEXT = {
  welcome:
    'Привет! Это бот Pick me. Открыта регистрация на дегустацию Кисляка 01.05.26. Обязательно ознакомься с правилами мероприятия.',
  registered: 'Регистрация прошла успешно!',
  alreadyRegistered: 'Вы уже зарегистрированы.',
  rules: 'Правила ивента будут чуть позже',
  cancelConfirm: 'Вы точно хотите отказаться от участия?',
  notRegistered: 'Вы не зарегистрированы',
  removed: 'Ваша заявка на участие отозвана',
  shareContact: 'Нажмите кнопку ниже, чтобы отправить контакт. В список будет записан ваш Telegram username.',
  wrongContact: 'Пожалуйста, отправьте свой контакт через кнопку ниже.',
  noUsername: 'У вас не задан Telegram username. Добавьте username в настройках Telegram и попробуйте снова.',
  emptyList: 'Пока нет зарегистрированных участников.',
};

function mainMenu() {
  return Markup.keyboard([
    ['Зарегистрироваться'],
    ['Список участников'],
    ['Отказаться от участия'],
    ['Правила проведения ивента'],
  ]).resize();
}

function contactMenu() {
  return Markup.keyboard([
    [Markup.button.contactRequest('Отправить контакт')],
    ['Главное меню'],
  ]).resize();
}

function yesNoMenu() {
  return Markup.keyboard([['Да', 'Нет'], ['Главное меню']]).resize();
}

async function ensureDataFile() {
  await fs.mkdir(path.dirname(DATA_FILE), { recursive: true });
  try {
    await fs.access(DATA_FILE);
  } catch {
    await fs.writeFile(DATA_FILE, JSON.stringify([], null, 2), 'utf8');
  }
}

async function readParticipants() {
  await ensureDataFile();
  const raw = await fs.readFile(DATA_FILE, 'utf8');
  try {
    const data = JSON.parse(raw);
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

async function writeParticipants(participants) {
  await ensureDataFile();
  await fs.writeFile(DATA_FILE, JSON.stringify(participants, null, 2), 'utf8');
}

function getUsername(ctx) {
  const username = ctx.from?.username;
  return username ? username.toLowerCase() : null;
}

function formatUsername(username) {
  return username ? `@${username}` : 'без username';
}

async function showMainMenu(ctx, text = TEXT.welcome) {
  userState.delete(ctx.from.id);
  await ctx.reply(text, mainMenu());
}

bot.start(async (ctx) => {
  await showMainMenu(ctx);
});

bot.hears('Главное меню', async (ctx) => {
  await showMainMenu(ctx);
});

bot.hears('Зарегистрироваться', async (ctx) => {
  userState.set(ctx.from.id, 'register_wait_contact');
  await ctx.reply(TEXT.shareContact, contactMenu());
});

bot.hears('Список участников', async (ctx) => {
  const participants = await readParticipants();

  if (participants.length === 0) {
    await ctx.reply(TEXT.emptyList, mainMenu());
    return;
  }

  const list = participants
    .map((participant, index) => `${index + 1}. ${formatUsername(participant.username)}`)
    .join('\n');

  await ctx.reply(`Список участников:\n\n${list}`, mainMenu());
});

bot.hears('Отказаться от участия', async (ctx) => {
  userState.set(ctx.from.id, 'cancel_confirm');
  await ctx.reply(TEXT.cancelConfirm, yesNoMenu());
});

bot.hears('Правила проведения ивента', async (ctx) => {
  await ctx.reply(TEXT.rules, mainMenu());
});

bot.hears('Нет', async (ctx) => {
  const state = userState.get(ctx.from.id);
  if (state === 'cancel_confirm') {
    await showMainMenu(ctx, 'Отмена отказа от участия.');
  }
});

bot.hears('Да', async (ctx) => {
  const state = userState.get(ctx.from.id);
  if (state !== 'cancel_confirm') return;

  userState.set(ctx.from.id, 'cancel_wait_contact');
  await ctx.reply(TEXT.shareContact, contactMenu());
});

bot.on('contact', async (ctx) => {
  const state = userState.get(ctx.from.id);
  if (!state) {
    await ctx.reply(TEXT.wrongContact, contactMenu());
    return;
  }

  const username = getUsername(ctx);
  if (!username) {
    await showMainMenu(ctx, TEXT.noUsername);
    return;
  }

  const participants = await readParticipants();

  if (state === 'register_wait_contact') {
    const exists = participants.some((participant) => participant.username === username);

    if (!exists) {
      participants.push({
        username,
        firstName: ctx.from.first_name || null,
        registeredAt: new Date().toISOString(),
      });
      await writeParticipants(participants);
    }

    await showMainMenu(ctx, exists ? TEXT.alreadyRegistered : TEXT.registered);
    return;
  }

  if (state === 'cancel_wait_contact') {
    const index = participants.findIndex((participant) => participant.username === username);

    if (index === -1) {
      await showMainMenu(ctx, TEXT.notRegistered);
      return;
    }

    participants.splice(index, 1);
    await writeParticipants(participants);
    await showMainMenu(ctx, TEXT.removed);
  }
});

bot.on('text', async (ctx) => {
  const state = userState.get(ctx.from.id);

  if (state === 'register_wait_contact' || state === 'cancel_wait_contact') {
    await ctx.reply(TEXT.wrongContact, contactMenu());
    return;
  }

  await showMainMenu(ctx, 'Выберите действие в главном меню.');
});

bot.catch((error, ctx) => {
  console.error(`Ошибка при обработке update ${ctx.update.update_id}:`, error);
});

bot.launch();
console.log('Pick me bot запущен');

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
