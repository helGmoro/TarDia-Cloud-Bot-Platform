// Global state
let currentUser = null
let bots = []

// API Configuration
const API_BASE_URL = "http://localhost:3000/api"

// Initialize app
document.addEventListener("DOMContentLoaded", () => {
  initializeApp()
  setupEventListeners()
})

function initializeApp() {
  // Check if user is logged in
  const savedUser = localStorage.getItem("currentUser")
  if (savedUser) {
    currentUser = JSON.parse(savedUser)
    showDashboard()
    loadBots()
  } else {
    showAuth()
  }
}

function setupEventListeners() {
  // Auth forms
  document.getElementById("loginForm").addEventListener("submit", handleLogin)
  document.getElementById("registerForm").addEventListener("submit", handleRegister)

  // Create bot form
  document.getElementById("createBotForm").addEventListener("submit", handleCreateBot)

  // Modal close on background click
  document.getElementById("createBotModal").addEventListener("click", function (e) {
    if (e.target === this) {
      closeCreateBotModal()
    }
  })
}

// Authentication functions
function switchTab(tab) {
  document.querySelectorAll(".tab-btn").forEach((btn) => btn.classList.remove("active"))
  document.querySelectorAll(".tab-content").forEach((content) => content.classList.remove("active"))

  document.querySelector(`[onclick="switchTab('${tab}')"]`).classList.add("active")
  document.getElementById(tab === "login" ? "loginForm" : "registerForm").classList.add("active")
}

async function handleLogin(e) {
  e.preventDefault()

  const email = document.getElementById("loginEmail").value
  const password = document.getElementById("loginPassword").value

  try {
    const response = await fetch(`${API_BASE_URL}/auth/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email, password }),
    })

    const data = await response.json()

    if (response.ok) {
      currentUser = data.user
      localStorage.setItem("currentUser", JSON.stringify(currentUser))
      localStorage.setItem("authToken", data.token)

      showToast("¡Bienvenido de vuelta!", "success")
      showDashboard()
      loadBots()
    } else {
      showToast(data.message || "Error al iniciar sesión", "error")
    }
  } catch (error) {
    showToast("Error de conexión", "error")
  }
}

async function handleRegister(e) {
  e.preventDefault()

  const email = document.getElementById("registerEmail").value
  const password = document.getElementById("registerPassword").value

  try {
    const response = await fetch(`${API_BASE_URL}/auth/register`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email, password }),
    })

    const data = await response.json()

    if (response.ok) {
      showToast("Cuenta creada exitosamente. Ahora puedes iniciar sesión.", "success")
      switchTab("login")
      document.getElementById("registerForm").reset()
    } else {
      showToast(data.message || "Error al crear la cuenta", "error")
    }
  } catch (error) {
    showToast("Error de conexión", "error")
  }
}

function logout() {
  localStorage.removeItem("currentUser")
  localStorage.removeItem("authToken")
  currentUser = null
  bots = []
  showAuth()
  showToast("Sesión cerrada", "info")
}

// Screen management
function showAuth() {
  document.getElementById("authScreen").classList.add("active")
  document.getElementById("dashboardScreen").classList.remove("active")
}

function showDashboard() {
  document.getElementById("authScreen").classList.remove("active")
  document.getElementById("dashboardScreen").classList.add("active")
  document.getElementById("userEmail").textContent = `Bienvenido, ${currentUser.email}`
}

// Bot management (Ver bots)
async function loadBots() {
  try {
    const response = await fetch(`${API_BASE_URL}/bots`, {
      headers: {
        Authorization: `Bearer ${localStorage.getItem("authToken")}`,
      },
    })

    if (response.ok) {
      bots = await response.json()
      renderBots()
      updateStats()
    }
  } catch (error) {
    console.error("Error loading bots:", error)
  }
}

function renderBots() {
  const container = document.getElementById("botsContainer")
  const emptyState = document.getElementById("emptyState")
  const botsGrid = document.getElementById("botsGrid")

  if (bots.length === 0) {
    emptyState.style.display = "flex"
    botsGrid.style.display = "none"
  } else {
    emptyState.style.display = "none"
    botsGrid.style.display = "grid"

    botsGrid.innerHTML = bots
      .map(
        (bot) => `
            <div class="bot-card">
                <div class="bot-header">
                    <div>
                        <div class="bot-title">${bot.name}</div>
                        <div class="bot-date">Creado el ${new Date(bot.created_at).toLocaleDateString()}</div>
                    </div>
                    <div class="bot-status">
                        <div class="status-dot ${bot.status}"></div>
                        <span class="status-badge ${bot.status}">${getStatusText(bot.status)}</span>
                    </div>
                </div>
                
                <div class="bot-services">
                    <p>Servicios:</p>
                    <div class="services-tags">
                        ${bot.servicios.map((service) => `<span class="service-tag">${getServiceName(service)}</span>`).join("")}
                    </div>
                </div>
                
                <div class="bot-actions">
                    ${
                      bot.status === "active" && bot.url
                        ? `
                        <button class="btn btn-primary btn-sm" onclick="openTelegramBot('${bot.name}')">
                            <i class="fas fa-external-link-alt"></i>
                            Abrir Bot
                        </button>
                    `
                        : ""
                    }
                    ${
                      bot.deploy_url
                        ? `
                        <button class="btn btn-outline btn-sm" onclick="window.open('${bot.deploy_url}', '_blank')">
                            <i class="fas fa-server"></i>
                            Ver Deploy
                        </button>
                    `
                        : ""
                    }
                </div>
            </div>
        `,
      )
      .join("")
  }
}

function updateStats() {
  document.getElementById("totalBots").textContent = bots.length
  document.getElementById("activeBots").textContent = bots.filter((bot) => bot.status === "active").length
  document.getElementById("pendingBots").textContent = bots.filter((bot) => bot.status === "creating").length
}

function getStatusText(status) {
  const statusMap = {
    active: "Activo",
    creating: "Desplegando",
    error: "Error",
  }
  return statusMap[status] || "Desconocido"
}

function getServiceName(service) {
  const serviceMap = {
    clima: "Clima",
    noticias: "Noticias",
    chistes: "Chistes",
    ia: "Chat IA",
  }
  return serviceMap[service] || service
}

// Modal management (Crear bot)
function openCreateBotModal() {
  document.getElementById("createBotModal").classList.add("active")
  document.body.style.overflow = "hidden"
}

function closeCreateBotModal() {
  document.getElementById("createBotModal").classList.remove("active")
  document.body.style.overflow = "auto"
  document.getElementById("createBotForm").reset()
}

async function handleCreateBot(e) {
  e.preventDefault()

  const name = document.getElementById("botName").value
  const token = document.getElementById("botToken").value
  const servicios = Array.from(document.querySelectorAll('input[name="servicios"]:checked')).map((cb) => cb.value)

  if (servicios.length === 0) {
    showToast("Selecciona al menos un servicio", "error")
    return
  }

  // Show loading
  showLoading("Creando tu bot...")
  closeCreateBotModal()

  try {
    const response = await fetch(`${API_BASE_URL}/crear-bot`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${localStorage.getItem("authToken")}`,
      },
      body: JSON.stringify({
        name,
        token,
        servicios,
      }),
    })

    const data = await response.json()

    if (response.ok) {
      hideLoading()
      showToast(`¡Tu bot ${name} está funcionando! 🎉`, "success")

      // Add bot to list
      bots.unshift(data)
      renderBots()
      updateStats()

      // Show success message with link
      setTimeout(() => {
        showToast(`Bot desplegado en: ${data.deploy_url}`, "info")
      }, 2000)
    } else {
      hideLoading()
      showToast(data.message || "Error al crear el bot", "error")
    }
  } catch (error) {
    hideLoading()
    showToast("Error de conexión", "error")
  }
}

// Loading management
function showLoading(message) {
  document.getElementById("loadingText").textContent = message
  document.getElementById("loadingOverlay").classList.add("active")
}

function hideLoading() {
  document.getElementById("loadingOverlay").classList.remove("active")
}

// Utility functions
function openTelegramBot(botName) {
  window.open(`https://t.me/${botName}`, "_blank")
}

function showToast(message, type = "info") {
  const toast = document.createElement("div")
  toast.className = `toast ${type}`

  const icon = type === "success" ? "check-circle" : type === "error" ? "exclamation-circle" : "info-circle"

  toast.innerHTML = `
        <i class="fas fa-${icon}"></i>
        <span>${message}</span>
    `

  document.getElementById("toastContainer").appendChild(toast)

  setTimeout(() => {
    toast.remove()
  }, 5000)
}
