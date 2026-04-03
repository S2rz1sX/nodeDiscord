const config = require("./settings.json");
const { Client } = require("discord.js-selfbot-v13");
const process = require("process");
const fs = require("fs");
const ioClient = require("socket.io-client");

const socket = ioClient("http://localhost:3000");

const client = new Client({
    intents: 131071
});

let runtimeSettings = {
    TOXIC: true,
    REPLY: true
};

socket.on("update_settings", (data) => {
    runtimeSettings = data;
    log("SYSTEM", `อัปเดต setting: ${JSON.stringify(data)}`);
});

// ---------------- LOGGER ----------------
const ENABLE_LOG = {
    ERROR: true,
    STATUS: false,
    NICKNAME: true,
    REPLY: true,
    TOXIC: true,
    DELETED: true,
    RANDOM: false,
    LOGIN: true,
    SYSTEM: true,
    SKIP: false,
    MESSAGE: false
};

function log(type, msg) {
    if (!ENABLE_LOG[type]) return;

    const time = new Date().toLocaleTimeString();
    const full = `[${time}] [${type}] ${msg}`;

    console.log(full);
    fs.appendFileSync("logs.txt", full + "\n");

    socket.emit("log", { time, type, msg });
}

// ---------------- READY ----------------
client.on("ready", () => {
    log("SYSTEM", `login as ${client.user.tag}`);

    updatePresenceByStatus(); // ครั้งแรก

    socket.emit("bot_info", {
        username: client.user.username,
        tag: client.user.tag,
        avatar: client.user.displayAvatarURL({ dynamic: true }),
        id: client.user.id
    });
});

// ---------------- PRESENCE ----------------
client.on("presenceUpdate", () => {
    const status = client.user.presence?.status;

    socket.emit("bot_status", status);

    updatePresenceByStatus();
    updateNicknameByStatus(status);
});

// fallback กัน event ไม่ยิง
setInterval(() => {
    updatePresenceByStatus();
}, 15000);

function updatePresenceByStatus() {
    const status = client.user.presence?.status || "online";

    const statusMessages = {
        online: ["พร้อมตอบ 💬", "ทักได้เลย 🔥"],
        idle: ["เหงาๆ 💤", "รอคนคุย 😴"],
        dnd: ["ห้ามรบกวน ❌"],
        invisible: ["ซ่อนตัว 👀"],
        offline: ["ไม่อยู่ ❌"]
    };

    const name = random(statusMessages[status] || ["NF ON TOP"]);

    let type = "PLAYING";
    if (status === "idle") type = "LISTENING";
    if (status === "dnd") type = "WATCHING";

    client.user.setPresence({
        status: status,
        activities: [{ name, type }]
    });

    log("STATUS", `อัปเดต → ${status} | ${type} ${name}`);
}

function updateNicknameByStatus(status) {
    let name = null;

    switch (status) {
        case "dnd":
            name = "ห้ามรบกวนไม่ว่าง";
            break;
        case "idle":
            name = "เหงาๆหาคนโทร";
            break;
        case "invisible":
            name = "ซ่อนตัวอยู่ 👀";
            break;
        case "offline":
            name = "ไม่อยู่ ไปพักแปป";
            break;
    }

    if (!name) return;

    const guild = client.guilds.cache.get(config.guildId);
    if (!guild) return log("ERROR", "หา guild ไม่เจอ");

    const me = guild.members.me;
    if (!me?.permissions.has("CHANGE_NICKNAME"))
        return log("ERROR", "ไม่มี permission เปลี่ยนชื่อ");

    me.setNickname(name)
        .then(() => log("NICKNAME", `เปลี่ยนชื่อเป็น → ${name}`))
        .catch(err => log("ERROR", `เปลี่ยนชื่อพลาด: ${err}`));
}

// ---------------- GLOBAL ----------------
const cooldown = new Map();

const emojis = ['😄', '😂', '😍', '🔥', '💖', '✨', '😎', '🥺', '👍'];

const wordReply = [".", "สวัสดีครับ", "สวัสดี", "ดีครับ"];
const wordReplyToxic = ["ควย", "พ่อ", "แม่", "จน", "ขยะ", "ดิสขยะ"];

const replyWord = [
    "˚୨୧⋆｡˚ ⋆ 𝙃𝙚𝙡𝙡𝙤, 𝙬𝙚𝙡𝙘𝙤𝙢𝙚 𝙩𝙤 𝑵𝑭 Nakubbb. ⋆ ˚｡⋆୨୧˚",
    "˚୨୧⋆｡˚ ⋆ 𝙃𝙚𝙡𝙡𝙤, 𝙬𝙚𝙡𝙘𝙤𝙢𝙚 𝙩𝙤 𝑵𝑭. ⋆ ˚｡⋆୨୧˚",
];

const replyToxic = ["ใจเย็นครับ อย่าด่ากัน"];
const replyDeleted = ["กำลังตอบเลยลบทำไม", "เอาอีก ลบข้อความอีก"];

const random = (arr) => arr[Math.floor(Math.random() * arr.length)];
const randomTime = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

// ---------------- MESSAGE ----------------
client.on("messageCreate", async (msg) => {

    if (!msg.guild) return log("SKIP", "ไม่ใช่ใน guild");
    if (msg.guild.id !== config.guildId) return;
    if (msg.channel.id !== config.channelId) return;
    if (msg.author.id === client.user.id) return;

    if (config.excludedUserIds.includes(msg.author.id)) return;
    if (msg.member?.roles.cache.some(role => config.excludedRoleIds.includes(role.id))) return;
    if (cooldown.has(msg.author.id)) return;

    cooldown.set(msg.author.id, true);
    setTimeout(() => cooldown.delete(msg.author.id), 10000);

    const delay = randomTime(3, 7) * 1000;
    msg.channel.sendTyping();

    // deleted message
    if (msg.reference?.messageId) {
        try {
            const ref = await msg.channel.messages.fetch(msg.reference.messageId);
            if (!ref) {
                log("DELETED", `reply deleted by ${msg.author.tag}`);
                return setTimeout(() => msg.channel.send(random(replyDeleted)), delay);
            }
        } catch {
            log("DELETED", `fetch error deleted ${msg.author.tag}`);
            return setTimeout(() => msg.channel.send(random(replyDeleted)), delay);
        }
    }

    // normal reply
    if (runtimeSettings.REPLY && wordReply.includes(msg.content.trim())) {
        log("REPLY", `ตอบ → ${msg.author.tag}`);
        return setTimeout(() => {
            msg.reply(`${random(replyWord)} ${random(emojis)}`);
        }, delay);
    }

    // toxic
    if (runtimeSettings.TOXIC && wordReplyToxic.some(word => msg.content.includes(word))) {
        log("TOXIC", `toxic → ${msg.author.tag}`);
        return setTimeout(() => {
            msg.reply(random(replyToxic));
        }, delay);
    }

    // random
    if (Math.random() < 0.1) {
        return setTimeout(() => {
            msg.reply(`ผมเห็นนะ 👀 ${random(emojis)}`);
        }, delay);
    }
});

// ---------------- ERROR ----------------
process.on("uncaughtException", (err) => log("ERROR", err));
process.on("unhandledRejection", (err) => log("ERROR", err));

// ---------------- LOGIN ----------------
log("SYSTEM", "กำลังพยายาม login...");
client.login(config.token)
    .then(() => log("LOGIN", "login สำเร็จ"))
    .catch(err => log("ERROR", `login ล้มเหลว: ${err}`));