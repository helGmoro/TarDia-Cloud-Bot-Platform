const express = require("express")
const cors = require("cors")
const bcrypt = require("bcryptjs")
const jwt = require("jsonwebtoken")
const fs = require("fs").promises
const path = require("path")
const { v4: uuidv4 } = require("uuid")
const { createBot } = require("./utils/createBot")

const app = express()
const PORT = process.env.PORT || 3000
const JWT_SECRET = process.env.JWT_SECRET || "bot-factory-secret"

// Middleware
app.use(cors())
app.use(express.json())
app.use(express.static("frontend"))

// In-memory storage (replace with database in production)
let users = []
let bots = []

// Load data
async function loadData() {
  try {
    const usersData = await fs.readFile(path.join(__dirname, "data", "users.json"), "utf8")
    users = JSON.parse(usersData)
  } catch (error) {
    users = []
  }

  try {
    const botsData = await fs.readFile(path.join(__dirname, "data", "bots.json"), "utf8")
    bots = JSON.parse(botsData)
  } catch (error) {
    bots = []
  }
}

// Save data
async function saveData() {
  try {
    await fs.mkdir(path.join(__dirname, "data"), { recursive: true })
    await fs.writeFile(path.join(__dirname, "data", "users.json"), JSON.stringify(users, null, 2))
    await fs.writeFile(path.join(__dirname, "data", "bots.json"), JSON.stringify(bots, null, 2))
  } catch (error) {
    console.error("Error saving data:", error)
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

// Import routes
const authRoutes = require("./routes/auth")
const botRoutes = require("./routes/bots")

// Use routes
app.use("/api/auth", authRoutes)
app.use("/api", botRoutes)

// Serve frontend
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "../frontend/index.html"))
})

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Cloud Bot Platform running on http://localhost:${PORT}`)
  console.log(`📱 Frontend available at http://localhost:${PORT}`)
})
