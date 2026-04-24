require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const fs = require('fs');

const token = process.env.BOT_TOKEN;
const bot = new TelegramBot(token, { polling: true });

const DATA_FILE = process.env.DATA_FILE || './participants.json';

function readData() {
  if (!fs.existsSync(DATA_FILE)) return [];
  return JSON.parse(fs.readFileSync(DATA_FILE));
}

function writeData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

const mainMenu = {
  reply_markup: {
    keyboard: [
      ['Зарегистрироваться'],
      ['Список участников'],
      ['Отказаться от участия'],
      ['Правила проведения ивента']
    ],
    resize_keyboard: true
  }
};

bot.onText(/\/start/, (msg) => {
  bot.sendMessage(msg.chat.id,
    "Привет! Это бот Pick me. Открыта регистрация на дегустацию Кисляка 01.05.26. Обязательно ознакомься с правилами мероприятия.",
    mainMenu
  );
});

bot.on('message', (msg) => {
  const text = msg.text;
  const username = msg.from.username;

  if (text === 'Зарегистрироваться') {
    if (!username) {
      return bot.sendMessage(msg.chat.id, 'У тебя нет username в Telegram');
    }

    const data = readData();
    if (data.includes(username)) {
      return bot.sendMessage(msg.chat.id, 'Ты уже зарегистрирован');
    }

    data.push(username);
    writeData(data);

    bot.sendMessage(msg.chat.id, 'Регистрация прошла успешно!', mainMenu);
  }

  if (text === 'Список участников') {
    const data = readData();
    if (data.length === 0) {
      return bot.sendMessage(msg.chat.id, 'Список пуст', mainMenu);
    }

    const list = data.map((u, i) => `${i + 1}. @${u}`).join('\n');
    bot.sendMessage(msg.chat.id, list, mainMenu);
  }

  if (text === 'Отказаться от участия') {
    bot.sendMessage(msg.chat.id, 'Вы точно хотите отказаться?', {
      reply_markup: {
        keyboard: [['Да', 'Нет']],
        resize_keyboard: true
      }
    });
  }

  if (text === 'Да') {
    const data = readData();
    const index = data.indexOf(username);

    if (index === -1) {
      return bot.sendMessage(msg.chat.id, 'Вы не зарегистрированы', mainMenu);
    }

    data.splice(index, 1);
    writeData(data);

    bot.sendMessage(msg.chat.id, 'Ваша заявка на участие отозвана', mainMenu);
  }

  if (text === 'Нет') {
    bot.sendMessage(msg.chat.id, 'Ок', mainMenu);
  }

  if (text === 'Правила проведения ивента') {
    bot.sendMessage(msg.chat.id, `Правила проведения ивента:

1. Порядок участия будет определяться порядковым номером регистрации в боте.
2. В официальной части дегустации будет принимать участие 25 человек.
3. Если по какой-либо причине участник будет отсутствовать, то его заменит следующий по счёту человек.
4. Даже если вы не будете участвовать в официальной части, то не спешите расстраиваться, ведь вы всё равно получите свою сладость.
5. Если у вас не получится принять участие, то не грустите, ведь у нас будет ещё много интересных мероприятий.

‼️ Напоминаем ‼️
Дата проведения: 01.05.26
Место проведения: Каменск-Уральский, Каменская 79`, mainMenu);
  }
});
