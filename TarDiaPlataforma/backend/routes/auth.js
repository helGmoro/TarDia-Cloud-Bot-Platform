const express = require("express")
const bcrypt = require("bcryptjs")
const jwt = require("jsonwebtoken")
const fs = require("fs").promises
const path = require("path")
const { v4: uuidv4 } = require("uuid")

const router = express.Router()
const JWT_SECRET = process.env.JWT_SECRET || "cloud-bot-secret"

// In-memory storage (replace with database in production)
let users = []

// Load users data
async function loadUsers() {
  try {
    const usersData = await fs.readFile(path.join(__dirname, "../data", "users.json"), "utf8")
    users = JSON.parse(usersData)
  } catch (error) {
    users = []
  }
}

// Save users data
async function saveUsers() {
  try {
    await fs.mkdir(path.join(__dirname, "../data"), { recursive: true })
    await fs.writeFile(path.join(__dirname, "../data", "users.json"), JSON.stringify(users, null, 2))
  } catch (error) {
    console.error("Error saving users:", error)
  }
}

// Initialize
loadUsers()

// Register route
router.post("/register", async (req, res) => {
  try {
    const { email, password } = req.body

    const existingUser = users.find((user) => user.email === email)
    if (existingUser) {
      return res.status(400).json({ message: "El usuario ya existe" })
    }

    const hashedPassword = await bcrypt.hash(password, 10)

    const user = {
      id: uuidv4(),
      email,
      password: hashedPassword,
      created_at: new Date().toISOString(),
    }

    users.push(user)
    await saveUsers()

    res.status(201).json({ message: "Usuario creado exitosamente" })
  } catch (error) {
    console.error("Registration error:", error)
    res.status(500).json({ message: "Error interno del servidor" })
  }
})

// Login route
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body

    const user = users.find((user) => user.email === email)
    if (!user) {
      return res.status(400).json({ message: "Credenciales inválidas" })
    }

    const validPassword = await bcrypt.compare(password, user.password)
    if (!validPassword) {
      return res.status(400).json({ message: "Credenciales inválidas" })
    }

    const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET)

    res.json({
      token,
      user: { id: user.id, email: user.email },
    })
  } catch (error) {
    console.error("Login error:", error)
    res.status(500).json({ message: "Error interno del servidor" })
  }
})

module.exports = router
