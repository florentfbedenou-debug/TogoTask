// ========================================
// TOGOTASK V1
// Prototype local
// ========================================

const defaultTasks = [
  {
    id: 1,
    title: "Regarder une vidéo",
    type: "video",
    reward: 50,
    duration: "30 secondes"
  },
  {
    id: 2,
    title: "Répondre à une enquête",
    type: "survey",
    reward: 100,
    duration: "2 minutes"
  },
  {
    id: 3,
    title: "Tester une page web",
    type: "website",
    reward: 75,
    duration: "1 minute"
  }
];


// ========================================
// INITIALISATION
// ========================================

function initData() {

  if (!localStorage.getItem("togotask_users")) {
    localStorage.setItem(
      "togotask_users",
      JSON.stringify([])
    );
  }

  if (!localStorage.getItem("togotask_tasks")) {
    localStorage.setItem(
      "togotask_tasks",
      JSON.stringify(defaultTasks)
    );
  }

}

initData();


// ========================================
// OUTILS
// ========================================

function getUsers() {

  return JSON.parse(
    localStorage.getItem("togotask_users")
  ) || [];

}


function saveUsers(users) {

  localStorage.setItem(
    "togotask_users",
    JSON.stringify(users)
  );

}


function getTasks() {

  return JSON.parse(
    localStorage.getItem("togotask_tasks")
  ) || [];

}


function saveTasks(tasks) {

  localStorage.setItem(
    "togotask_tasks",
    JSON.stringify(tasks)
  );

}


function getCurrentUser() {

  return JSON.parse(
    localStorage.getItem("togotask_current_user")
  );

}


function saveCurrentUser(user) {

  localStorage.setItem(
    "togotask_current_user",
    JSON.stringify(user)
  );

}


function logout() {

  localStorage.removeItem(
    "togotask_current_user"
  );

  window.location.href = "index.html";

}


// ========================================
// INSCRIPTION
// ========================================

const registerForm =
  document.getElementById("registerForm");

if (registerForm) {

  registerForm.addEventListener(
    "submit",
    function(event) {

      event.preventDefault();

      const name =
        document.getElementById("registerName").value.trim();

      const phone =
        document.getElementById("registerPhone").value.trim();

      const password =
        document.getElementById("registerPassword").value;

      const message =
        document.getElementById("registerMessage");

      let users = getUsers();

      const exists =
        users.some(
          user => user.phone === phone
        );

      if (exists) {

        message.textContent =
          "❌ Ce numéro possède déjà un compte.";

        return;

      }

      const newUser = {

        id: Date.now(),

        name: name,

        phone: phone,

        password: password,

        balance: 0,

        completedTasks: [],

        withdrawals: []

      };

      users.push(newUser);

      saveUsers(users);

      saveCurrentUser(newUser);

      message.textContent =
        "✅ Compte créé avec succès !";

      setTimeout(() => {

        window.location.href =
          "dashboard.html";

      }, 700);

    }
  );

}


// ========================================
// CONNEXION
// ========================================

const loginForm =
  document.getElementById("loginForm");

if (loginForm) {

  loginForm.addEventListener(
    "submit",
    function(event) {

      event.preventDefault();

      const phone =
        document.getElementById("loginPhone").value.trim();

      const password =
        document.getElementById("loginPassword").value;

      const message =
        document.getElementById("loginMessage");

      const users = getUsers();

      const user =
        users.find(
          user =>
            user.phone === phone &&
            user.password === password
        );

      if (!user) {

        message.textContent =
          "❌ Numéro ou mot de passe incorrect.";

        return;

      }

      saveCurrentUser(user);

      message.textContent =
        "✅ Connexion réussie !";

      setTimeout(() => {

        window.location.href =
          "dashboard.html";

      }, 500);

    }
  );

}


// ========================================
// PROTECTION DU DASHBOARD
// ========================================

if (
  window.location.pathname.includes("dashboard.html") ||
  window.location.pathname.includes("tasks.html") ||
  window.location.pathname.includes("withdrawals.html")
) {

  const user = getCurrentUser();

  if (!user) {

    window.location.href =
      "index.html";

  }

}


// ========================================
// DASHBOARD
// ========================================

const currentUser =
  getCurrentUser();

if (currentUser) {

  const welcomeUser =
    document.getElementById("welcomeUser");

  if (welcomeUser) {

    welcomeUser.textContent =
      "Bonjour " + currentUser.name + " 👋";

  }

  const balance =
    document.getElementById("balance");

  if (balance) {

    balance.textContent =
      currentUser.balance + " FCFA";

  }

  const completedTasks =
    document.getElementById("completedTasks");

  if (completedTasks) {

    completedTasks.textContent =
      currentUser.completedTasks.length;

  }

  const withdrawals =
    document.getElementById("withdrawals");

  if (withdrawals) {

    withdrawals.textContent =
      currentUser.withdrawals.length;

  }

}


// ========================================
// AFFICHAGE DES TÂCHES
// ========================================

const taskList =
  document.getElementById("taskList");

if (taskList) {

  const tasks = getTasks();

  const user = getCurrentUser();

  taskList.innerHTML = "";

  tasks.forEach(task => {

    const alreadyDone =
      user.completedTasks.includes(task.id);

    const card =
      document.createElement("div");

    card.className =
      "task-card";

    card.innerHTML = `

      <div class="task-top">

        <span class="task-category">
          ${getTaskIcon(task.type)}
          ${getTaskType(task.type)}
        </span>

        <strong>
          +${task.reward} FCFA
        </strong>

      </div>

      <h3>
        ${task.title}
      </h3>

      <p>
        Réalise cette tâche pour recevoir
        une récompense de démonstration.
      </p>

      <div class="task-footer">

        <span>
          ⏱️ ${task.duration}
        </span>

        <button
          class="btn-small"
          onclick="completeTask(${task.id})"
          ${alreadyDone ? "disabled" : ""}
        >
          ${alreadyDone ? "Terminée ✓" : "Commencer"}
        </button>

      </div>

    `;

    taskList.appendChild(card);

  });

}


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


// ========================================
// TERMINER UNE TÂCHE
// ========================================

function completeTask(taskId) {

  const user =
    getCurrentUser();

  const tasks =
    getTasks();

  const task =
    tasks.find(
      task => task.id === taskId
    );

  if (!task) return;

  if (
    user.completedTasks.includes(taskId)
  ) {

    alert(
      "Cette tâche est déjà terminée."
    );

    return;

  }

  const confirmation =
    confirm(
      "Terminer cette tâche de démonstration ?"
    );

  if (!confirmation) return;

  user.balance += task.reward;

  user.completedTasks.push(taskId);

  updateUser(user);

  alert(
    `Tâche terminée ! +${task.reward} FCFA`
  );

  window.location.reload();

}


// ========================================
// MISE À JOUR UTILISATEUR
// ========================================

function updateUser(user) {

  const users =
    getUsers();

  const index =
    users.findIndex(
      item => item.id === user.id
    );

  if (index !== -1) {

    users[index] = user;

    saveUsers(users);

  }

  saveCurrentUser(user);

}


// ========================================
// RETRAIT
// ========================================

const withdrawForm =
  document.getElementById("withdrawForm");

if (withdrawForm) {

  const user =
    getCurrentUser();

  const withdrawBalance =
    document.getElementById(
      "withdrawBalance"
    );

  withdrawBalance.textContent =
    user.balance + " FCFA";


  withdrawForm.addEventListener(
    "submit",
    function(event) {

      event.preventDefault();

      const amount =
        Number(
          document.getElementById(
            "withdrawAmount"
          ).value
        );

      const method =
        document.getElementById(
          "paymentMethod"
        ).value;

      const number =
        document.getElementById(
          "paymentNumber"
        ).value.trim();

      const message =
        document.getElementById(
          "withdrawMessage"
        );


      if (amount < 1000) {

        message.textContent =
          "❌ Le minimum de démonstration est 1 000 FCFA.";

        return;

      }


      if (amount > user.balance) {

        message.textContent =
          "❌ Solde insuffisant.";

        return;

      }


      user.withdrawals.push({

        id: Date.now(),

        amount: amount,

        method: method,

        number: number,

        status: "Démonstration"

      });


      user.balance -= amount;

      updateUser(user);


      message.textContent =
        "✅ Demande enregistrée en mode démonstration.";

      withdrawForm.reset();

      withdrawBalance.textContent =
        user.balance + " FCFA";

    }
  );

}


// ========================================
// ADMIN
// ========================================

const taskForm =
  document.getElementById("taskForm");

if (taskForm) {

  const users =
    getUsers();

  document.getElementById(
    "adminUsers"
  ).textContent =
    users.length;


  let totalRewards = 0;

  users.forEach(user => {

    user.completedTasks.forEach(taskId => {

      const task =
        getTasks().find(
          task => task.id === taskId
        );

      if (task) {

        totalRewards += task.reward;

      }

    });

  });


  document.getElementById(
    "adminRewards"
  ).textContent =
    totalRewards + " FCFA";


  taskForm.addEventListener(
    "submit",
    function(event) {

      event.preventDefault();

      const title =
        document.getElementById(
          "taskTitle"
        ).value.trim();

      const reward =
        Number(
          document.getElementById(
            "taskReward"
          ).value
        );

      const type =
        document.getElementById(
          "taskType"
        ).value;

      const tasks =
        getTasks();

      tasks.push({

        id: Date.now(),

        title: title,

        reward: reward,

        type: type,

        duration: "1 minute"

      });

      saveTasks(tasks);

      document.getElementById(
        "adminMessage"
      ).textContent =
        "✅ Tâche ajoutée.";

      taskForm.reset();

    }
  );

}