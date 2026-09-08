// ========================================
// TOGOTASK V2
// Connecté au serveur Node.js + PostgreSQL
// ========================================

async function api(url, options = {}) {
  const response = await fetch(url, {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {})
    },
    ...options
  });

  let data;

  try {
    data = await response.json();
  } catch {
    data = {
      success: false,
      message: "Réponse invalide du serveur."
    };
  }

  if (!response.ok) {
    throw new Error(data.message || "Une erreur est survenue.");
  }

  return data;
}


// ========================================
// DÉCONNEXION
// ========================================

async function logout() {

  try {
    await api("/api/logout", {
      method: "POST"
    });
  } catch (error) {
    console.error(error);
  }

  window.location.href = "index.html";
}


// ========================================
// INSCRIPTION
// ========================================

const registerForm =
  document.getElementById("registerForm");

if (registerForm) {

  registerForm.addEventListener("submit", async function(event) {

    event.preventDefault();

    const name =
      document.getElementById("registerName").value.trim();

    const phone =
      document.getElementById("registerPhone").value.trim();

    const password =
      document.getElementById("registerPassword").value;

    const message =
      document.getElementById("registerMessage");

    message.textContent = "Création du compte...";

    try {

      const data = await api("/api/register", {
        method: "POST",
        body: JSON.stringify({
          name,
          phone,
          password
        })
      });

      message.textContent =
        "✅ " + data.message;

      setTimeout(() => {
        window.location.href = "dashboard.html";
      }, 700);

    } catch (error) {

      message.textContent =
        "❌ " + error.message;

    }

  });

}


// ========================================
// CONNEXION
// ========================================

const loginForm =
  document.getElementById("loginForm");

if (loginForm) {

  loginForm.addEventListener("submit", async function(event) {

    event.preventDefault();

    const phone =
      document.getElementById("loginPhone").value.trim();

    const password =
      document.getElementById("loginPassword").value;

    const message =
      document.getElementById("loginMessage");

    message.textContent = "Connexion...";

    try {

      const data = await api("/api/login", {
        method: "POST",
        body: JSON.stringify({
          phone,
          password
        })
      });

      message.textContent =
        "✅ " + data.message;

      setTimeout(() => {
        window.location.href = "dashboard.html";
      }, 500);

    } catch (error) {

      message.textContent =
        "❌ " + error.message;

    }

  });

}


// ========================================
// UTILISATEUR CONNECTÉ
// ========================================

async function getCurrentUser() {

  try {

    const data = await api("/api/me");

    return data.user;

  } catch (error) {

    return null;

  }

}


// ========================================
// PROTECTION DES PAGES
// ========================================

async function protectPage() {

  const protectedPages = [
    "dashboard.html",
    "tasks.html",
    "withdrawals.html",
    "admin.html"
  ];

  const currentPage =
    window.location.pathname.split("/").pop();

  if (!protectedPages.includes(currentPage)) {
    return;
  }

  const user = await getCurrentUser();

  if (!user) {
    window.location.href = "index.html";
    return;
  }

  // Protection supplémentaire de la page admin
  if (
    currentPage === "admin.html" &&
    user.role !== "admin"
  ) {

    alert("Accès administrateur refusé.");

    window.location.href = "dashboard.html";

    return;
  }

  return user;
}


// ========================================
// DASHBOARD
// ========================================

async function loadDashboard() {

  const welcomeUser =
    document.getElementById("welcomeUser");

  const balance =
    document.getElementById("balance");

  const completedTasks =
    document.getElementById("completedTasks");

  const withdrawals =
    document.getElementById("withdrawals");

  if (
    !welcomeUser &&
    !balance &&
    !completedTasks &&
    !withdrawals
  ) {
    return;
  }

  const user = await getCurrentUser();

  if (!user) return;

  if (welcomeUser) {
    welcomeUser.textContent =
      "Bonjour " + user.name + " 👋";
  }

  if (balance) {
    balance.textContent =
      Number(user.balance).toLocaleString("fr-FR") +
      " FCFA";
  }

  // Récupération des tâches pour connaître
  // le nombre réellement terminé
  try {

    const data = await api("/api/tasks");

    const completed =
      data.tasks.filter(task => task.completed).length;

    if (completedTasks) {
      completedTasks.textContent = completed;
    }

  } catch (error) {

    console.error(error);

  }

  // Nombre de retraits
  try {

    const data = await api("/api/withdrawals");

    if (withdrawals) {
      withdrawals.textContent =
        data.withdrawals.length;
    }

  } catch (error) {

    if (withdrawals) {
      withdrawals.textContent = "0";
    }

  }

}


// ========================================
// TÂCHES
// ========================================

async function loadTasks() {

  const taskList =
    document.getElementById("taskList");

  if (!taskList) return;

  taskList.innerHTML =
    "<p>Chargement des tâches...</p>";

  try {

    const data =
      await api("/api/tasks");

    taskList.innerHTML = "";

    if (!data.tasks.length) {

      taskList.innerHTML =
        "<p>Aucune tâche disponible pour le moment.</p>";

      return;
    }

    data.tasks.forEach(task => {

      const card =
        document.createElement("div");

      card.className =
        "task-card";

      const icon =
        getTaskIcon(task.type);

      const type =
        getTaskType(task.type);

      card.innerHTML = `

        <div class="task-top">

          <span class="task-category">
            ${icon} ${type}
          </span>

          <strong>
            +${Number(task.reward).toLocaleString("fr-FR")} FCFA
          </strong>

        </div>

        <h3>
          ${escapeHTML(task.title)}
        </h3>

        <p>
          Réalise cette tâche pour obtenir
          la récompense indiquée.
        </p>

        <div class="task-footer">

          <span>
            ⏱️ ${escapeHTML(task.duration || "—")}
          </span>

          ${
            task.completed
            ?
            `<button class="btn-small" disabled>
              Terminée ✓
            </button>`
            :
            `<button
              class="btn-small"
              onclick="completeTask(${task.id})"
            >
              Commencer
            </button>`
          }

        </div>

      `;

      taskList.appendChild(card);

    });

  } catch (error) {

    taskList.innerHTML =
      `<p>❌ ${escapeHTML(error.message)}</p>`;

  }

}


// ========================================
// TERMINER UNE TÂCHE
// ========================================

async function completeTask(taskId) {

  const confirmation =
    confirm(
      "Confirmer que tu veux terminer cette tâche ?"
    );

  if (!confirmation) return;

  try {

    const data =
      await api(
        `/api/tasks/${taskId}/complete`,
        {
          method: "POST"
        }
      );

    alert(
      "✅ Tâche terminée ! +" +
      data.reward +
      " FCFA"
    );

    window.location.reload();

  } catch (error) {

    alert(
      "❌ " + error.message
    );

  }

}


// ========================================
// RETRAIT
// ========================================

async function loadWithdrawPage() {

  const form =
    document.getElementById("withdrawForm");

  if (!form) return;

  const user =
    await getCurrentUser();

  if (!user) return;

  const balance =
    document.getElementById("withdrawBalance");

  if (balance) {

    balance.textContent =
      Number(user.balance).toLocaleString("fr-FR") +
      " FCFA";

  }

  form.addEventListener("submit", async function(event) {

    event.preventDefault();

    const amount =
      Number(
        document.getElementById("withdrawAmount").value
      );

    const method =
      document.getElementById("paymentMethod").value;

    const paymentNumber =
      document.getElementById("paymentNumber")
        .value
        .trim();

    const message =
      document.getElementById("withdrawMessage");

    message.textContent =
      "Enregistrement de la demande...";

    try {

      const data =
        await api("/api/withdrawals", {

          method: "POST",

          body: JSON.stringify({
            amount,
            method,
            paymentNumber
          })

        });

      message.textContent =
        "✅ " + data.message;

      form.reset();

      const updatedUser =
        await getCurrentUser();

      if (updatedUser && balance) {

        balance.textContent =
          Number(updatedUser.balance)
            .toLocaleString("fr-FR") +
          " FCFA";

      }

    } catch (error) {

      message.textContent =
        "❌ " + error.message;

    }

  });

}


// ========================================
// ADMIN
// ========================================

async function loadAdmin() {

  const taskForm =
    document.getElementById("taskForm");

  if (!taskForm) return;

  const user =
    await getCurrentUser();

  if (!user || user.role !== "admin") return;

  try {

    const data =
      await api("/api/admin/stats");

    const adminUsers =
      document.getElementById("adminUsers");

    const adminRewards =
      document.getElementById("adminRewards");

    if (adminUsers) {
      adminUsers.textContent =
        data.users;
    }

    if (adminRewards) {
      adminRewards.textContent =
        Number(data.rewards)
          .toLocaleString("fr-FR") +
        " FCFA";
    }

  } catch (error) {

    console.error(error);

  }


  taskForm.addEventListener("submit", async function(event) {

    event.preventDefault();

    const title =
      document.getElementById("taskTitle")
        .value
        .trim();

    const reward =
      Number(
        document.getElementById("taskReward").value
      );

    const type =
      document.getElementById("taskType").value;

    const message =
      document.getElementById("adminMessage");

    try {

      const data =
        await api("/api/admin/tasks", {

          method: "POST",

          body: JSON.stringify({
            title,
            reward,
            type,
            duration: "1 minute"
          })

        });

      message.textContent =
        "✅ " + data.message;

      taskForm.reset();

    } catch (error) {

      message.textContent =
        "❌ " + error.message;

    }

  });

}


// ========================================
// OUTILS
// ========================================

function getTaskIcon(type) {

  if (type === "video") return "🎬";

  if (type === "survey") return "📝";

  if (type === "website") return "🌐";

  return "📋";
}


function getTaskType(type) {

  if (type === "video") return "Vidéo";

  if (type === "survey") return "Enquête";

  if (type === "website") return "Site web";

  return "Tâche";
}


function escapeHTML(value) {

  const div =
    document.createElement("div");

  div.textContent =
    value ?? "";

  return div.innerHTML;
}


// ========================================
// DÉMARRAGE
// ========================================

(async function() {

  const user =
    await protectPage();

  if (
    window.location.pathname.includes("dashboard.html")
  ) {

    await loadDashboard();

  }

  if (
    window.location.pathname.includes("tasks.html")
  ) {

    await loadTasks();

  }

  if (
    window.location.pathname.includes("withdrawals.html")
  ) {

    await loadWithdrawPage();

  }

  if (
    window.location.pathname.includes("admin.html")
  ) {

    await loadAdmin();

  }

})();