const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static("public"));

let botSettings = {
    TOXIC: true,
    REPLY: true
};

io.on("connection", (socket) => {
    console.log("🌐 Web connected");

    // ส่งค่า setting ปัจจุบัน
    socket.emit("settings", botSettings);

    // รับคำสั่งจากเว็บ
    socket.on("toggle", ({ key, value }) => {
        botSettings[key] = value;

        console.log(`⚙️ ${key} = ${value}`);

        // ส่งไปให้ bot
        io.emit("update_settings", botSettings);
    });

    socket.on("log", (data) => {
        io.emit("log_line", `[${data.time}] [${data.type}] ${data.msg}`);
    });

    socket.on("clear", () => {
        io.emit("clear");
    });
});

server.listen(3000, () => {
    console.log("🚀 Server running on http://localhost:3000");
});