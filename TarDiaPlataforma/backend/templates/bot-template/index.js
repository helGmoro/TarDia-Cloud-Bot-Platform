const TelegramBot = require("node-telegram-bot-api")
const dotenv = require("dotenv")

dotenv.config()

const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true })

// Comando start
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id
  const userName = msg.from.first_name

  const welcomeMessage = `¡Hola ${userName}! 👋 

Soy ${process.env.BOT_NAME} 🤖

📋 Comandos disponibles:
• /help - Mostrar ayuda

¡Empecemos! 🚀`

  bot.sendMessage(chatId, welcomeMessage)
})

// Comando help
bot.onText(/\/help/, (msg) => {
  const chatId = msg.chat.id

  const helpMessage = `🆘 Ayuda - ${process.env.BOT_NAME}

📋 Comandos disponibles:
• /start - Mensaje de bienvenida
• /help - Mostrar esta ayuda

💡 ¿Necesitas ayuda? ¡Solo pregunta!`

  bot.sendMessage(chatId, helpMessage)
})

// Error handling
bot.on("polling_error", (error) => {
  console.error("Polling error:", error)
})

console.log(`🤖 Bot ${process.env.BOT_NAME} is running...`)

// Graceful shutdown
process.once("SIGINT", () => {
  console.log("🛑 Stopping bot...")
  bot.stopPolling()
  process.exit(0)
})
