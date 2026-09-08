require("dotenv").config();

const express = require("express");
const path = require("path");
const cookieParser = require("cookie-parser");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const { query, pool } = require("./db");

const app = express();

const PORT = process.env.PORT || 10000;
const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
    console.error("JWT_SECRET est manquant.");
    process.exit(1);
}

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

app.use(express.static(path.join(__dirname, "public")));


/*
========================================
AUTHENTIFICATION
========================================
*/

function createToken(user) {
    return jwt.sign(
        {
            id: user.id,
            role: user.role
        },
        JWT_SECRET,
        {
            expiresIn: "7d"
        }
    );
}

function auth(req, res, next) {
    try {
        const token = req.cookies.togotask_token;

        if (!token) {
            return res.status(401).json({
                success: false,
                message: "Vous devez être connecté."
            });
        }

        const decoded = jwt.verify(token, JWT_SECRET);

        req.user = decoded;

        next();

    } catch (error) {
        return res.status(401).json({
            success: false,
            message: "Session invalide ou expirée."
        });
    }
}

function adminOnly(req, res, next) {
    if (req.user.role !== "admin") {
        return res.status(403).json({
            success: false,
            message: "Accès administrateur refusé."
        });
    }

    next();
}


/*
========================================
TEST SERVEUR
========================================
*/

app.get("/api/health", (req, res) => {
    res.json({
        success: true,
        message: "TogoTask V2 fonctionne 🚀"
    });
});


/*
========================================
INSCRIPTION
========================================
*/

app.post("/api/register", async (req, res) => {
    try {
        const { name, phone, password } = req.body;

        if (!name || !phone || !password) {
            return res.status(400).json({
                success: false,
                message: "Tous les champs sont obligatoires."
            });
        }

        if (password.length < 6) {
            return res.status(400).json({
                success: false,
                message: "Le mot de passe doit contenir au moins 6 caractères."
            });
        }

        const existingUser = await query(
            "SELECT id FROM users WHERE phone = $1",
            [phone.trim()]
        );

        if (existingUser.rows.length > 0) {
            return res.status(409).json({
                success: false,
                message: "Ce numéro est déjà utilisé."
            });
        }

        const passwordHash = await bcrypt.hash(password, 12);

        const result = await query(
            `
            INSERT INTO users
            (name, phone, password_hash)
            VALUES ($1, $2, $3)
            RETURNING id, name, phone, balance, role
            `,
            [
                name.trim(),
                phone.trim(),
                passwordHash
            ]
        );

        const user = result.rows[0];

        const token = createToken(user);

        res.cookie("togotask_token", token, {
            httpOnly: true,
            sameSite: "lax",
            secure: process.env.NODE_ENV === "production",
            maxAge: 7 * 24 * 60 * 60 * 1000
        });

        res.json({
            success: true,
            message: "Compte créé avec succès.",
            user
        });

    } catch (error) {
        console.error("Erreur inscription :", error);

        res.status(500).json({
            success: false,
            message: "Erreur serveur."
        });
    }
});


/*
========================================
CONNEXION
========================================
*/

app.post("/api/login", async (req, res) => {
    try {
        const { phone, password } = req.body;

        if (!phone || !password) {
            return res.status(400).json({
                success: false,
                message: "Numéro et mot de passe obligatoires."
            });
        }

        const result = await query(
            `
            SELECT *
            FROM users
            WHERE phone = $1
            `,
            [phone.trim()]
        );

        if (result.rows.length === 0) {
            return res.status(401).json({
                success: false,
                message: "Identifiants incorrects."
            });
        }

        const user = result.rows[0];

        const passwordCorrect = await bcrypt.compare(
            password,
            user.password_hash
        );

        if (!passwordCorrect) {
            return res.status(401).json({
                success: false,
                message: "Identifiants incorrects."
            });
        }

        const token = createToken(user);

        res.cookie("togotask_token", token, {
            httpOnly: true,
            sameSite: "lax",
            secure: process.env.NODE_ENV === "production",
            maxAge: 7 * 24 * 60 * 60 * 1000
        });

        res.json({
            success: true,
            message: "Connexion réussie.",
            user: {
                id: user.id,
                name: user.name,
                phone: user.phone,
                balance: user.balance,
                role: user.role
            }
        });

    } catch (error) {
        console.error("Erreur connexion :", error);

        res.status(500).json({
            success: false,
            message: "Erreur serveur."
        });
    }
});


/*
========================================
UTILISATEUR CONNECTÉ
========================================
*/

app.get("/api/me", auth, async (req, res) => {
    try {
        const result = await query(
            `
            SELECT id, name, phone, balance, role, created_at
            FROM users
            WHERE id = $1
            `,
            [req.user.id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Utilisateur introuvable."
            });
        }

        res.json({
            success: true,
            user: result.rows[0]
        });

    } catch (error) {
        console.error("Erreur /api/me :", error);

        res.status(500).json({
            success: false,
            message: "Erreur serveur."
        });
    }
});


/*
========================================
DÉCONNEXION
========================================
*/

app.post("/api/logout", (req, res) => {
    res.clearCookie("togotask_token");

    res.json({
        success: true,
        message: "Déconnexion réussie."
    });
});


/*
========================================
TÂCHES
========================================
*/

app.get("/api/tasks", auth, async (req, res) => {
    try {
        const result = await query(
            `
            SELECT
                t.id,
                t.title,
                t.type,
                t.reward,
                t.duration,
                t.video_url,
                t.active,
                CASE
                    WHEN tc.id IS NULL THEN false
                    ELSE true
                END AS completed
            FROM tasks t
            LEFT JOIN task_completions tc
                ON tc.task_id = t.id
                AND tc.user_id = $1
            WHERE t.active = true
            ORDER BY t.id DESC
            `,
            [req.user.id]
        );

        res.json({
            success: true,
            tasks: result.rows
        });

    } catch (error) {
        console.error("Erreur récupération tâches :", error);

        res.status(500).json({
            success: false,
            message: "Impossible de récupérer les tâches."
        });
    }
});


/*
========================================
TERMINER UNE TÂCHE
========================================

IMPORTANT :
Pour le moment, cette route représente une
validation DEMO côté serveur.

Elle ne vérifie pas encore qu'une vidéo,
enquête ou visite a réellement été effectuée.
========================================
*/

app.post("/api/tasks/:id/complete", auth, async (req, res) => {
    const client = await pool.connect();

    try {
        const taskId = Number(req.params.id);

        if (!Number.isInteger(taskId) || taskId <= 0) {
            return res.status(400).json({
                success: false,
                message: "Identifiant de tâche invalide."
            });
        }

        await client.query("BEGIN");

        const taskResult = await client.query(
            `
            SELECT id, title, reward
            FROM tasks
            WHERE id = $1
            AND active = true
            FOR UPDATE
            `,
            [taskId]
        );

        if (taskResult.rows.length === 0) {
            await client.query("ROLLBACK");

            return res.status(404).json({
                success: false,
                message: "Tâche introuvable."
            });
        }

        const task = taskResult.rows[0];

        const alreadyCompleted = await client.query(
            `
            SELECT id
            FROM task_completions
            WHERE user_id = $1
            AND task_id = $2
            `,
            [req.user.id, taskId]
        );

        if (alreadyCompleted.rows.length > 0) {
            await client.query("ROLLBACK");

            return res.status(409).json({
                success: false,
                message: "Tu as déjà terminé cette tâche."
            });
        }

        await client.query(
            `
            INSERT INTO task_completions
            (user_id, task_id, reward)
            VALUES ($1, $2, $3)
            `,
            [
                req.user.id,
                task.id,
                task.reward
            ]
        );

        await client.query(
            `
            UPDATE users
            SET balance = balance + $1
            WHERE id = $2
            `,
            [
                task.reward,
                req.user.id
            ]
        );

        await client.query(
            `
            INSERT INTO transactions
            (user_id, type, amount, description)
            VALUES ($1, $2, $3, $4)
            `,
            [
                req.user.id,
                "task_reward",
                task.reward,
                `Récompense : ${task.title}`
            ]
        );

        await client.query("COMMIT");

        res.json({
            success: true,
            message: "Tâche terminée.",
            reward: task.reward
        });

    } catch (error) {
        await client.query("ROLLBACK");

        console.error("Erreur terminaison tâche :", error);

        res.status(500).json({
            success: false,
            message: "Impossible de terminer la tâche."
        });

    } finally {
        client.release();
    }
});


/*
========================================
RETRAITS — HISTORIQUE
========================================
*/

app.get("/api/withdrawals", auth, async (req, res) => {
    try {
        const result = await query(
            `
            SELECT
                id,
                amount,
                method,
                payment_number,
                status,
                created_at
            FROM withdrawals
            WHERE user_id = $1
            ORDER BY id DESC
            `,
            [req.user.id]
        );

        res.json({
            success: true,
            withdrawals: result.rows
        });

    } catch (error) {
        console.error("Erreur retraits :", error);

        res.status(500).json({
            success: false,
            message: "Impossible de récupérer les retraits."
        });
    }
});


/*
========================================
CRÉER UNE DEMANDE DE RETRAIT
========================================

Pour la V2 :
- la demande est enregistrée ;
- le solde est réservé/déduit ;
- le statut reste "pending".

Aucun paiement réel T-Money/Flooz n'est
effectué par cette route pour le moment.
========================================
*/

app.post("/api/withdrawals", auth, async (req, res) => {
    const client = await pool.connect();

    try {
        const amount = Number(req.body.amount);
        const method = String(req.body.method || "").trim().toLowerCase();
        const paymentNumber = String(
            req.body.paymentNumber || ""
        ).trim();

        if (!Number.isInteger(amount) || amount < 1000) {
            return res.status(400).json({
                success: false,
                message: "Le montant minimum de retrait est de 1 000 FCFA."
            });
        }

        if (!["tmoney", "flooz"].includes(method)) {
            return res.status(400).json({
                success: false,
                message: "Méthode de paiement invalide."
            });
        }

        if (!paymentNumber || paymentNumber.length < 8) {
            return res.status(400).json({
                success: false,
                message: "Numéro de paiement invalide."
            });
        }

        await client.query("BEGIN");

        const userResult = await client.query(
            `
            SELECT id, balance
            FROM users
            WHERE id = $1
            FOR UPDATE
            `,
            [req.user.id]
        );

        if (userResult.rows.length === 0) {
            await client.query("ROLLBACK");

            return res.status(404).json({
                success: false,
                message: "Utilisateur introuvable."
            });
        }

        const user = userResult.rows[0];

        if (Number(user.balance) < amount) {
            await client.query("ROLLBACK");

            return res.status(400).json({
                success: false,
                message: "Solde insuffisant."
            });
        }

        await client.query(
            `
            INSERT INTO withdrawals
            (user_id, amount, method, payment_number, status)
            VALUES ($1, $2, $3, $4, 'pending')
            `,
            [
                req.user.id,
                amount,
                method,
                paymentNumber
            ]
        );

        await client.query(
            `
            UPDATE users
            SET balance = balance - $1
            WHERE id = $2
            `,
            [
                amount,
                req.user.id
            ]
        );

        await client.query(
            `
            INSERT INTO transactions
            (user_id, type, amount, description)
            VALUES ($1, $2, $3, $4)
            `,
            [
                req.user.id,
                "withdrawal",
                -amount,
                `Demande de retrait ${method.toUpperCase()}`
            ]
        );

        await client.query("COMMIT");

        res.json({
            success: true,
            message: "Demande de retrait enregistrée.",
            status: "pending"
        });

    } catch (error) {
        await client.query("ROLLBACK");

        console.error("Erreur retrait :", error);

        res.status(500).json({
            success: false,
            message: "Impossible d'enregistrer le retrait."
        });

    } finally {
        client.release();
    }
});


/*
========================================
STATISTIQUES ADMIN
========================================
*/

app.get(
    "/api/admin/stats",
    auth,
    adminOnly,
    async (req, res) => {

        try {
            const usersResult = await query(
                `
                SELECT COUNT(*) AS total
                FROM users
                `
            );

            const rewardsResult = await query(
                `
                SELECT COALESCE(SUM(amount), 0) AS total
                FROM transactions
                WHERE type = 'task_reward'
                `
            );

            const tasksResult = await query(
                `
                SELECT COUNT(*) AS total
                FROM tasks
                WHERE active = true
                `
            );

            res.json({
                success: true,
                users: Number(usersResult.rows[0].total),
                rewards: Number(rewardsResult.rows[0].total),
                tasks: Number(tasksResult.rows[0].total)
            });

        } catch (error) {
            console.error("Erreur statistiques admin :", error);

            res.status(500).json({
                success: false,
                message: "Impossible de récupérer les statistiques."
            });
        }
    }
);


/*
========================================
CRÉER UNE TÂCHE — ADMIN
========================================
*/

app.post(
    "/api/admin/tasks",
    auth,
    adminOnly,
    async (req, res) => {

        try {
            const title = String(req.body.title || "").trim();
            const type = String(req.body.type || "").trim();
            const reward = Number(req.body.reward);
            const duration = String(
                req.body.duration || "1 minute"
            ).trim();

            const allowedTypes = [
                "video",
                "survey",
                "website"
            ];

            if (!title) {
                return res.status(400).json({
                    success: false,
                    message: "Le titre est obligatoire."
                });
            }

            if (!allowedTypes.includes(type)) {
                return res.status(400).json({
                    success: false,
                    message: "Type de tâche invalide."
                });
            }

            if (!Number.isInteger(reward) || reward < 0) {
                return res.status(400).json({
                    success: false,
                    message: "Récompense invalide."
                });
            }

            const result = await query(
                `
                INSERT INTO tasks
                (title, type, reward, duration, active)
                VALUES ($1, $2, $3, $4, true)
                RETURNING *
                `,
                [
                    title,
                    type,
                    reward,
                    duration
                ]
            );

            res.json({
                success: true,
                message: "Tâche créée avec succès.",
                task: result.rows[0]
            });

        } catch (error) {
            console.error("Erreur création tâche :", error);

            res.status(500).json({
                success: false,
                message: "Impossible de créer la tâche."
            });
        }
    }
);


/*
========================================
TÂCHES PAR DÉFAUT
========================================
*/

async function seedTasks() {

    try {

        const result = await query(
            "SELECT COUNT(*) AS total FROM tasks"
        );

        const total = Number(result.rows[0].total);

        if (total > 0) {
            return;
        }

        await query(
            `
            INSERT INTO tasks
            (title, type, reward, duration, active)
            VALUES
            ($1, $2, $3, $4, true),
            ($5, $6, $7, $8, true),
            ($9, $10, $11, $12, true)
            `,
            [
                "Regarder une vidéo",
                "video",
                50,
                "30 secondes",

                "Répondre à une enquête",
                "survey",
                100,
                "2 minutes",

                "Tester une page web",
                "website",
                75,
                "1 minute"
            ]
        );

        console.log("✅ Tâches par défaut créées.");

    } catch (error) {
        console.error(
            "Erreur création tâches par défaut :",
            error
        );
    }
}


/*
========================================
DÉMARRAGE SERVEUR
========================================
*/

async function startServer() {

    try {

        await query("SELECT NOW()");

        console.log("✅ PostgreSQL connecté.");

        await seedTasks();

        app.listen(
            PORT,
            "0.0.0.0",
            () => {
                console.log(
                    `🚀 TogoTask V2 fonctionne sur le port ${PORT}`
                );
            }
        );

    } catch (error) {

        console.error(
            "❌ Impossible de démarrer TogoTask :",
            error
        );

        process.exit(1);
    }
}

startServer();