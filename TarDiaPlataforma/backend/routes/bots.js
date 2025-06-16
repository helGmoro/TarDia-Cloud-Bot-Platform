const express = require("express")
const jwt = require("jsonwebtoken")
const fs = require("fs").promises
const path = require("path")
const { v4: uuidv4 } = require("uuid")
const { createBot } = require("../utils/createBot")

const router = express.Router()
const JWT_SECRET = process.env.JWT_SECRET || "cloud-bot-secret"

// In-memory storage (replace with database in production)
let bots = []

// Load bots data
async function loadBots() {
  try {
    const botsData = await fs.readFile(path.join(__dirname, "../data", "bots.json"), "utf8")
    bots = JSON.parse(botsData)
  } catch (error) {
    bots = []
  }
}

// Save bots data
async function saveBots() {
  try {
    await fs.mkdir(path.join(__dirname, "../data"), { recursive: true })
    await fs.writeFile(path.join(__dirname, "../data", "bots.json"), JSON.stringify(bots, null, 2))
  } catch (error) {
    console.error("Error saving bots:", error)
  }
}

// Authentication middleware
function authenticateToken(req, res, next) {
  const authHeader = req.headers["authorization"]
  const token = authHeader && authHeader.split(" ")[1]

  if (!token) {
    return res.status(401).json({ message: "Token de acceso requerido" })
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ message: "Token inválido" })
    }
    req.user = user
    next()
  })
}

// Initialize
loadBots()

// Get user bots (listar)
router.get("/bots", authenticateToken, (req, res) => {
  const userBots = bots.filter((bot) => bot.user_id === req.user.id)
  res.json(userBots)
})

// Create bot (crear bot)
router.post("/crear-bot", authenticateToken, async (req, res) => {
  try {
    const { name, token, servicios } = req.body

    console.log(`🤖 Creating bot: ${name} with services: ${servicios.join(", ")}`)

    // Validate input
    if (!name || !token || !servicios || servicios.length === 0) {
      return res.status(400).json({ message: "Todos los campos son requeridos" })
    }

    // Create bot record
    const bot = {
      id: uuidv4(),
      user_id: req.user.id,
      name,
      token,
      servicios,
      status: "creating",
      created_at: new Date().toISOString(),
    }

    bots.push(bot)
    await saveBots()

    // Create bot asynchronously
    createBotAsync(bot)

    res.status(201).json(bot)
  } catch (error) {
    console.error("Bot creation error:", error)
    res.status(500).json({ message: "Error interno del servidor" })
  }
})

// Bot creation logic
async function createBotAsync(bot) {
  try {
    console.log(`📋 Starting bot creation process for: ${bot.name}`)

    // Create the bot
    const result = await createBot(bot)

    // Update bot status
    const botIndex = bots.findIndex((b) => b.id === bot.id)
    if (botIndex !== -1) {
      bots[botIndex].status = "active"
      bots[botIndex].url = `https://t.me/${bot.name}`
      bots[botIndex].deploy_url = result.deploy_url
      bots[botIndex].repo_url = result.repo_url
      await saveBots()
      console.log(`✅ Bot ${bot.name} created successfully`)
    }
  } catch (error) {
    console.error(`❌ Bot creation failed for ${bot.name}:`, error)

    const botIndex = bots.findIndex((b) => b.id === bot.id)
    if (botIndex !== -1) {
      bots[botIndex].status = "error"
      await saveBots()
    }
  }
}

module.exports = router
