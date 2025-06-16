const fs = require("fs").promises
const path = require("path")
const { exec } = require("child_process")
const { promisify } = require("util")

const execAsync = promisify(exec)

async function createBot(botConfig) {
  const { id, name, token, servicios } = botConfig

  try {
    console.log(`📋 Step 1: Preparing template for ${name}`)

    // Create bot directory in generated/
    const botDir = path.join(__dirname, "../generated", `bot-${id}`)
    await fs.mkdir(botDir, { recursive: true })

    console.log(`⚙️ Step 2: Configuring services: ${servicios.join(", ")}`)

    // Copy and customize template
    await copyAndCustomizeTemplate(botDir, { name, token, servicios })

    console.log(`📦 Step 3: Creating repository`)

    // Initialize git repository
    await initGitRepo(botDir, name)

    console.log(`🚀 Step 4: Deploying bot`)

    // Deploy to hosting service
    const deployResult = await deployBot(botDir, name)

    return {
      success: true,
      deploy_url: deployResult.url,
      repo_url: deployResult.repo_url,
    }
  } catch (error) {
    console.error(`❌ Bot creation failed for ${name}:`, error)
    throw error
  }
}

async function copyAndCustomizeTemplate(botDir, config) {
  const { name, token, servicios } = config

  // Copy template files from templates/bot-template/
  const templateDir = path.join(__dirname, "../templates/bot-template")

  try {
    // Copy package.json
    const packageTemplate = await fs.readFile(path.join(templateDir, "package.json"), "utf8")
    const packageJson = packageTemplate.replace("{{BOT_NAME}}", name.toLowerCase().replace(/[^a-z0-9]/g, "-"))
    await fs.writeFile(path.join(botDir, "package.json"), packageJson)

    // Copy and customize index.js
    await generateBotIndex(botDir, config)

    // Copy Dockerfile
    const dockerfile = await fs.readFile(path.join(templateDir, "Dockerfile"), "utf8")
    await fs.writeFile(path.join(botDir, "Dockerfile"), dockerfile)

    // Generate .env file
    await generateEnvFile(botDir, { name, token })

    console.log(`✅ Template customized with services: ${servicios.join(", ")}`)
  } catch (error) {
    console.error("Error copying template:", error)
    throw error
  }
}

async function generateBotIndex(botDir, config) {
  const { name, token, servicios } = config

  const imports = `const TelegramBot = require('node-telegram-bot-api');
const dotenv = require('dotenv');`

  let serviceImports = ""
  let serviceHandlers = ""
  const commands = []

  // Add service-specific code
  if (servicios.includes("clima")) {
    serviceImports += `const axios = require('axios');\n`
    commands.push("/clima [ciudad] - Consultar el clima")
    serviceHandlers += `
// Servicio de Clima
bot.onText(/\\/clima (.+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const ciudad = match[1];

  try {
    const response = await axios.get(\`https://api.openweathermap.org/data/2.5/weather?q=\${ciudad}&appid=\${process.env.WEATHER_API_KEY}&units=metric&lang=es\`);
    const weather = response.data;
    
    const mensaje = \`🌤️ Clima en \${weather.name}:
🌡️ Temperatura: \${weather.main.temp}°C
🌡️ Sensación térmica: \${weather.main.feels_like}°C
💧 Humedad: \${weather.main.humidity}%
📝 \${weather.weather[0].description}\`;
    
    bot.sendMessage(chatId, mensaje);
  } catch (error) {
    bot.sendMessage(chatId, '❌ No pude obtener el clima para esa ciudad.');
  }
});`
  }

  if (servicios.includes("noticias")) {
    commands.push("/noticias - Últimas noticias")
    serviceHandlers += `
// Servicio de Noticias
bot.onText(/\\/noticias/, async (msg) => {
  const chatId = msg.chat.id;

  try {
    const response = await axios.get(\`https://gnews.io/api/v4/top-headlines?lang=es&max=5&token=\${process.env.NEWS_API_KEY}\`);
    const articles = response.data.articles;
    
    let mensaje = '📰 Últimas noticias:\\n\\n';
    articles.forEach((article, index) => {
      mensaje += \`\${index + 1}. \${article.title}\\n\${article.url}\\n\\n\`;
    });
    
    bot.sendMessage(chatId, mensaje);
  } catch (error) {
    bot.sendMessage(chatId, '❌ No pude obtener las noticias.');
  }
});`
  }

  if (servicios.includes("chistes")) {
    commands.push("/chiste - Chiste aleatorio")
    serviceHandlers += `
// Servicio de Chistes
const chistes = [
  "¿Por qué los pájaros vuelan hacia el sur en invierno? Porque es demasiado lejos para caminar.",
  "¿Qué le dice un taco a otro taco? ¿Quieres que vayamos por unas quesadillas?",
  "¿Por qué no se puede confiar en las escaleras? Porque siempre están tramando algo.",
  "¿Cómo se llama el campeón de buceo japonés? Tokofondo.",
  "¿Qué hace una abeja en el gimnasio? ¡Zum-ba!"
];

bot.onText(/\\/chiste/, (msg) => {
  const chatId = msg.chat.id;
  const randomChiste = chistes[Math.floor(Math.random() * chistes.length)];
  bot.sendMessage(chatId, \`😄 \${randomChiste}\`);
});`
  }

  if (servicios.includes("ia")) {
    commands.push("Escríbeme cualquier cosa - Chat con IA")
    serviceHandlers += `
// Servicio de IA
bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const texto = msg.text;

  // Ignorar comandos
  if (texto.startsWith('/')) return;

  try {
    const response = await axios.post(\`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=\${process.env.GEMINI_API_KEY}\`, {
      contents: [{
        role: "user",
        parts: [{ text: \`Eres \${process.env.BOT_NAME}, un asistente amigable. Responde: \${texto}\` }]
      }]
    }, {
      headers: { 'Content-Type': 'application/json' }
    });

    const respuesta = response.data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (respuesta) {
      bot.sendMessage(chatId, respuesta);
    } else {
      bot.sendMessage(chatId, "🤔 No pude generar una respuesta.");
    }
  } catch (error) {
    bot.sendMessage(chatId, "❌ Error al procesar tu mensaje.");
  }
});`
  }

  const botCode = `${imports}
${serviceImports}

dotenv.config();

const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });

// Comando start
bot.onText(/\\/start/, (msg) => {
  const chatId = msg.chat.id;
  const userName = msg.from.first_name;

  const welcomeMessage = \`¡Hola \${userName}! 👋 

Soy \${process.env.BOT_NAME} 🤖

📋 Comandos disponibles:
${commands.map((cmd) => `• ${cmd}`).join("\\n")}

¡Empecemos! 🚀\`;

  bot.sendMessage(chatId, welcomeMessage);
});

// Comando help
bot.onText(/\\/help/, (msg) => {
  const chatId = msg.chat.id;

  const helpMessage = \`🆘 Ayuda - \${process.env.BOT_NAME}

📋 Comandos disponibles:
${commands.map((cmd) => `• ${cmd}`).join("\\n")}

💡 ¿Necesitas ayuda? ¡Solo pregunta!\`;

  bot.sendMessage(chatId, helpMessage);
});

${serviceHandlers}

// Error handling
bot.on('polling_error', (error) => {
  console.error('Polling error:', error);
});

console.log(\`🤖 Bot \${process.env.BOT_NAME} is running...\`);
console.log(\`📊 Services: \${JSON.stringify(${JSON.stringify(servicios)})}\`);

// Graceful shutdown
process.once('SIGINT', () => {
  console.log('🛑 Stopping bot...');
  bot.stopPolling();
  process.exit(0);
});`

  await fs.writeFile(path.join(botDir, "index.js"), botCode)
}

async function generateEnvFile(botDir, config) {
  const envContent = `BOT_TOKEN=${config.token}
BOT_NAME=${config.name}
WEATHER_API_KEY=your_weather_api_key
NEWS_API_KEY=your_news_api_key
GEMINI_API_KEY=your_gemini_api_key
PORT=3000
NODE_ENV=production
`

  await fs.writeFile(path.join(botDir, ".env"), envContent)
}

async function initGitRepo(botDir, botName) {
  try {
    await execAsync("git init", { cwd: botDir })
    await execAsync("git add .", { cwd: botDir })
    await execAsync(`git commit -m "Initial commit for ${botName}"`, { cwd: botDir })

    // Create .gitignore
    const gitignore = `node_modules/
.env
*.log
.DS_Store
`
    await fs.writeFile(path.join(botDir, ".gitignore"), gitignore)

    console.log(`✅ Git repository initialized for ${botName}`)
  } catch (error) {
    console.error("Git initialization failed:", error)
  }
}

async function deployBot(botDir, botName) {
  // Simulate deployment process
  console.log(`🚀 Deploying ${botName} to hosting service...`)

  // In a real implementation, you would:
  // 1. Push to GitHub using GitHub API
  // 2. Call Render/Railway API to create new service
  // 3. Return actual deployment URL

  // Simulate deployment delay
  await new Promise((resolve) => setTimeout(resolve, 3000))

  const deployUrl = `https://${botName.toLowerCase().replace(/[^a-z0-9]/g, "-")}.onrender.com`
  const repoUrl = `https://github.com/your-username/${botName.toLowerCase().replace(/[^a-z0-9]/g, "-")}`

  console.log(`✅ Bot deployed successfully at: ${deployUrl}`)

  return {
    url: deployUrl,
    repo_url: repoUrl,
  }
}

module.exports = { createBot }
