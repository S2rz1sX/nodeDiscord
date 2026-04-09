const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static("public"));

// ---------------- STATE ----------------
let botSettings = {
    TOXIC: true,
    REPLY: true
};

let logSettings = {
    ERROR: true,
    SYSTEM: true
};

let bots = new Set();
let webs = new Set();
let botStatus = new Map();

// ---------------- SOCKET ----------------
io.on("connection", (socket) => {
    console.log("🌐 Client connected");

    // ---------------- REGISTER ----------------
    socket.on("register", (role) => {
        if (role === "bot") {
            bots.add(socket);
            botStatus.set(socket.id, Date.now());
            console.log("🤖 Bot registered");
        }

        if (role === "web") {
            webs.add(socket);
            console.log("🖥️ Web registered");

            // ส่งค่าให้เฉพาะ web
            socket.emit("settings", botSettings);
            socket.emit("log_settings", logSettings);
        }
    });

    // ---------------- HEARTBEAT ----------------
    socket.on("heartbeat", () => {
        botStatus.set(socket.id, Date.now());
    });

    // ---------------- SETTINGS ----------------
    socket.on("toggle", ({ key, value }) => {
        if (!(key in botSettings)) return;
        if (typeof value !== "boolean") return;

        botSettings[key] = value;

        console.log(`⚙️ ${key} = ${value}`);

        // ยิงไป bot เท่านั้น
        bots.forEach(s => s.emit("toggle", { key, value }));

        // sync เฉพาะ web
        webs.forEach(s => s.emit("settings", botSettings));
    });

    // ---------------- LOG TOGGLE ----------------
    socket.on("toggle_log", ({ key, value }) => {
        if (!(key in logSettings)) return;
        if (typeof value !== "boolean") return;

        logSettings[key] = value;

        console.log(`📜 log ${key} = ${value}`);

        bots.forEach(s => s.emit("toggle_log", { key, value }));
        webs.forEach(s => s.emit("log_settings", logSettings));
    });

    // ---------------- RESET ----------------
    socket.on("reset_settings", () => {
        botSettings = {
            TOXIC: true,
            REPLY: true
        };

        logSettings = {
            ERROR: true,
            SYSTEM: true
        };

        console.log("🔄 reset settings");

        bots.forEach(s => s.emit("reset_settings"));
        webs.forEach(s => {
            s.emit("settings", botSettings);
            s.emit("log_settings", logSettings);
        });
    });

    // ---------------- REQUEST ----------------
    socket.on("request_settings", () => {
        socket.emit("settings", botSettings);
        socket.emit("log_settings", logSettings);
    });

    // ---------------- LOG ----------------
    socket.on("log_line", (data) => {
        if (!data?.type || !data?.msg) return;

        // ส่งเฉพาะ web
        webs.forEach(s => s.emit("log_line", data));
    });

    // ---------------- CLEAR ----------------
    socket.on("clear", () => {
        webs.forEach(s => s.emit("clear"));
    });

    // ---------------- DISCONNECT ----------------
    socket.on("disconnect", () => {
        bots.delete(socket);
        webs.delete(socket);
        botStatus.delete(socket.id);

        console.log("❌ Client disconnected",socket.id);
    });
});

// ---------------- HEARTBEAT CHECK ----------------
setInterval(() => {
    const now = Date.now();

    for (const [id, time] of botStatus.entries()) {
        if (now - time > 10000) {
            console.log(`⚠️ bot ${id} timeout`);
            botStatus.delete(id);
        }
    }
}, 5000);

// ---------------- START ----------------
server.listen(3000, () => {
    console.log("🚀 Server running on http://localhost:3000");
});