// ==================================================
// 🔧 IMPORT / SETUP
// ==================================================
const config = require("./settings.json");
const { Client } = require("discord.js-selfbot-v13");
const process = require("process");
const fs = require("fs");
const ioClient = require("socket.io-client");

const client = new Client({ intents: 131071 });
const socket = ioClient("http://localhost:3000");


// ==================================================
// ⚙️ STATE (ค่าที่เปลี่ยน runtime)
// ==================================================
let runtimeSettings = {
    TOXIC: true,
    REPLY: true
};

const DEFAULT_LOG = {
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

let ENABLE_LOG = { ...DEFAULT_LOG };

let heartbeatInterval = null;


// ==================================================
// 📡 SOCKET / DASHBOARD CONTROL
// ==================================================
socket.on("connect", () => {
    socket.emit("register", "bot");
    log("SYSTEM", "dashboard connected");
    syncDashboard();

    // 🔥 heartbeat (start only once)
    if (!heartbeatInterval) {
        heartbeatInterval = setInterval(() => {
            if (socket.connected) {
                socket.emit("heartbeat");
            }
        }, 5000);
    }
});

socket.on("disconnect", () => {
    if (heartbeatInterval) {
        clearInterval(heartbeatInterval);
        heartbeatInterval = null;
    }
});

// 🎛️ toggle feature
socket.on("toggle", ({ key, value }) => {
    runtimeSettings[key] = value;
    log("SYSTEM", `เปลี่ยน ${key} → ${value}`);
    syncDashboard();
});

// 📜 toggle log
socket.on("toggle_log", ({ key, value }) => {
    ENABLE_LOG[key] = value;
    log("SYSTEM", `log ${key} → ${value}`);
    syncDashboard();
});

// 🔄 reset
socket.on("reset_settings", () => {
    runtimeSettings = { TOXIC: true, REPLY: true };
    ENABLE_LOG = { ...DEFAULT_LOG };

    log("SYSTEM", "รีเซ็ตค่าทั้งหมดแล้ว");
    syncDashboard();
});

// 📥 request current
socket.on("request_settings", syncDashboard);


// ==================================================
// 📊 LOG SYSTEM
// ==================================================
function log(type, msg) {
    if (!ENABLE_LOG[type]) return;

    const time = new Date().toLocaleTimeString();

    if (typeof msg === "object") {
        msg = JSON.stringify(msg, null, 2);
    }

    const full = `[${time}] [${type}] ${msg}`;

    console.log(full);

    fs.appendFile("logs.txt", full + "\n", (err) => {
        if (err) console.error("log file error:", err);
    });

    if (socket.connected) {
        socket.emit("log_line", { time, type, msg });
    }
}


// ==================================================
// 🔄 DASHBOARD SYNC
// ==================================================
let syncTimeout;

function syncDashboard() {
    clearTimeout(syncTimeout);
    syncTimeout = setTimeout(() => {
        socket.emit("settings", runtimeSettings);
        socket.emit("log_settings", ENABLE_LOG);
    }, 300);
}


// ==================================================
// 🤖 DISCORD READY / BOT INFO
// ==================================================
client.on("ready", () => {
    log("SYSTEM", `login as ${client.user.tag}`);

    updatePresenceByStatus();

    socket.emit("bot_info", {
        username: client.user.username,
        tag: client.user.tag,
        avatar: client.user.displayAvatarURL({ dynamic: true }),
        id: client.user.id
    });

    syncDashboard();
});


// ==================================================
// 🟢 PRESENCE / STATUS SYSTEM
// ==================================================
let lastStatus = null;

client.on("presenceUpdate", () => {
    const status = client.user.presence?.status;

    if (status === lastStatus) return;
    lastStatus = status;

    socket.emit("bot_status", status);

    updatePresenceByStatus();
    updateNicknameByStatus(status);
});

setInterval(updatePresenceByStatus, 15000);


// ==================================================
// 🎭 PRESENCE LOGIC
// ==================================================
function updatePresenceByStatus() {
    const status = client.user.presence?.status || "online";

    const statusMessages = {
        online: ["พร้อมตอบ 💬", "ทักได้เลย 🔥"],
        idle: ["เหงาๆ 💤"],
        dnd: ["ห้ามรบกวน ❌"],
        invisible: ["ซ่อนตัว 👀"],
        offline: ["ไม่อยู่ ❌"]
    };

    const name = random(statusMessages[status] || ["NF ON TOP"]);

    let type = "PLAYING";
    if (status === "idle") type = "LISTENING";
    if (status === "dnd") type = "WATCHING";

    client.user.setPresence({
        status,
        activities: [{ name, type }]
    });

    log("STATUS", `${status} | ${type} ${name}`);
}


// ==================================================
// 🧾 NICKNAME SYSTEM
// ==================================================
function updateNicknameByStatus(status) {
    const map = {
        dnd: "ตี๋น้อย168",
        idle: "塔蒂",
        invisible: "塔蒂",
        offline: "塔蒂"
    };

    const name = map[status];
    if (!name) return;

    const guild = client.guilds.cache.get(config.guildId);
    if (!guild) return log("ERROR", "หา guild ไม่เจอ");

    const me = guild.members.me;
    if (!me?.permissions.has("CHANGE_NICKNAME")) {
        return log("ERROR", "ไม่มี permission เปลี่ยนชื่อ");
    }

    me.setNickname(name)
        .then(() => log("NICKNAME", `→ ${name}`))
        .catch(err => log("ERROR", err.message));
}


// ==================================================
// 🧠 UTIL / HELPER
// ==================================================
const cooldown = new Map();
const gameCooldown = new Map();

const emojis = ['😄', '😂', '😍', '🔥', '💖', '✨', '😎', '🥺', '👍'];

const wordReply = [".", "สวัสดีครับ", "สวัสดี", "ดีครับ", "สวัสดีค่ะ"];
const wordReplyToxic = ["ควย", "จน", "ขยะ", "ดิสขยะ"];

const replyWord = [
    "˚୨୧⋆｡˚ ⋆ 𝙃𝙚𝙡𝙡𝙤, 𝙬𝙚𝙡𝙘𝙤𝙢𝙚 𝙩𝙤 𝑵𝑭 Nakubbb. ⋆ ˚｡⋆୨୧˚",
    "˚୨୧⋆｡˚ ⋆ 𝙃𝙚𝙡𝙡𝙤, 𝙬𝙚𝙡𝙘𝙤𝙢𝙚 𝙩𝙤 𝑵𝑭. ⋆ ˚｡⋆୨୧˚",
    "ꜱᴀᴡᴀᴅᴇᴇᴋᴜʙ ᴜꜱᴇʀ",
    "สวัสดีจ้าา",
    "สวัสดีฮะ :p"
];

const replyToxic = ["ใจเย็นครับ อย่าด่ากัน"];
const replyDeleted = ["กำลังตอบเลยลบทำไม", "เอาอีก ลบข้อความอีก"];

const random = (arr) => arr[Math.floor(Math.random() * arr.length)];
const randomTime = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

// ==================================================
// 💬 MESSAGE HANDLER (MAIN LOGIC)
// ==================================================
client.on("messageCreate", async (msg) => {

    // ---------------- FILTER ----------------
    if (!msg.guild) return log("SKIP", "ไม่ใช่ใน guild");
    if (msg.guild.id !== config.guildId) return;
    if (msg.channel.id !== config.channelId) return;
    if (msg.author.bot && msg.author.id !== client.user.id) return; // ไม่ตอบ bot อื่น แต่ตอบตัวเองได้
    if (msg.reference) return log("SKIP", `เป็น reply ไม่ตอบ → ${msg.author.tag}`);
    if (config.excludedUserIds.includes(msg.author.id)) return;
    if (msg.member?.roles.cache.some(role => config.excludedRoleIds.includes(role.id))) return;

    // ---------------- COOLDOWN ----------------
    if (cooldown.has(msg.author.id)) return;
    cooldown.set(msg.author.id, true);
    setTimeout(() => cooldown.delete(msg.author.id), 10000);

    const typingInterval = setInterval(() => msg.channel.sendTyping(), 3000);
    const stopTyping = () => clearInterval(typingInterval);

    const delay = randomTime(3, 7) * 1000;

    try {
        const trimmedContent = msg.content?.trim();
        if (!trimmedContent) return stopTyping();

        // ---------------- DELETED MESSAGE ----------------
        if (msg.reference?.messageId) {
            try {
                const ref = await msg.channel.messages.fetch(msg.reference.messageId);
                if (!ref) {
                    log("DELETED", `reply deleted by ${msg.author.tag}`);
                    return setTimeout(() => {
                        stopTyping();
                        msg.channel.send(random(replyDeleted));
                    }, delay);
                }
            } catch {
                log("DELETED", `fetch error deleted ${msg.author.tag}`);
                return setTimeout(() => {
                    stopTyping();
                    msg.channel.send(random(replyDeleted));
                }, delay);
            }
        }

        // ---------------- NORMAL REPLY ----------------
        if (runtimeSettings.REPLY && wordReply.includes(trimmedContent)) {
            log("REPLY", `ตอบ → ${msg.author.tag}`);
            return setTimeout(() => {
                stopTyping();
                msg.reply(`${random(replyWord)} ${random(emojis)}`);
            }, delay);
        }

        // ---------------- TOXIC ----------------
        if (runtimeSettings.TOXIC && wordReplyToxic.some(word => trimmedContent.includes(word))) {
            log("TOXIC", `toxic → ${msg.author.tag}`);
            return setTimeout(() => {
                stopTyping();
                msg.reply(random(replyToxic));
            }, delay);
        }

    } catch (err) {
        console.log("❌ ERROR:", err);
        stopTyping();
    }

    // ---------------- GAME DETECT ----------------
    const gameKeywords = {
        ROV: ["rov", "อาโอวี", "อาวี"],
        Roblox: ["roblox", "โรบอก"],
        FreeFire: ["freefire", "ff", "ฟีฟาย", "ไฮ"],
        Valorant: ["valorant", "valo", "วาโล"],
        MLBB: ["mlbb", "mobile legends", "โมบาย"],
        PUBG: ["pubg", "พับจี"]
    };

    const inviteWords = ["เล่น","มา","กัน","ไหม","มั้ย","ปะ","จัด","หาคน","ลง","แรงค์","rank","team","ทีม","ด่วน","ว่าง","หา"];

    const clean = trimmedContent.toLowerCase().replace(/[^\u0E00-\u0E7Fa-zA-Z0-9 ]/g, "");
    log("MESSAGE", `ข้อความ: ${clean}`);

    for (const game in gameKeywords) {
        const hasGame = gameKeywords[game].some(k => clean.includes(k));
        const hasInvite = inviteWords.some(w => clean.includes(w));

        if (!(hasGame && hasInvite)) continue; // log เฉพาะเกม detect เจอ

        if (ENABLE_LOG.SYSTEM) log("SYSTEM", `[CHECK] ${game} | game:${hasGame} invite:${hasInvite}`);

        if (gameCooldown.has(game)) {
            log("SKIP", `${game} cooldown`);
            continue;
        }

        gameCooldown.set(game, true);
        setTimeout(() => gameCooldown.delete(game), 30000);

        const channelId = config.gameChannels?.[game];
        if (!channelId) {
            log("ERROR", `ไม่มี channel ของ ${game}`);
            continue;
        }

        const channel = client.channels.cache.get(channelId);
        if (!channel) {
            log("ERROR", `หา channel ไม่เจอ ${game}`);
            continue;
        }

        log("SYSTEM", `🎮 เจอ ${game} จาก ${msg.author.tag}`);

        setTimeout(() => {
            const embed = {
                title: "🔥 มีคนชวนเล่นเกม!",
                description: `**${msg.author.username}** กำลังหาเพื่อนเล่น **${game}**`,
                color: 0x00ff99,
                thumbnail: { url: msg.author.displayAvatarURL({ dynamic: true }) },
                footer: { text: "NF Matchmaking System" },
                timestamp: new Date()
            };

            // ส่ง embed ปลอดภัย
            if (embed.title && embed.description) {
                channel.send({ embeds: [embed] }).catch(err => log("ERROR", `ส่ง embed ไม่ได้: ${err.message}`));
            }

            // reply fallback
            const replyContent = `🎮 ไปเล่นกันได้ที่ <#${channelId}>`;
            if (replyContent) msg.reply({ content: replyContent }).catch(err => log("ERROR", `reply ไม่ได้: ${err.message}`));

            stopTyping(); // หยุด typing หลังส่ง
        }, delay);

        break; // เจอเกมแรกแล้วหยุด
    }
});


// ---------------- ERROR ----------------
process.on("uncaughtException", (err) => {
    log("ERROR", `uncaught: ${err.message}`);
    log("ERROR", err.stack);
});

process.on("unhandledRejection", (err) => {
    log("ERROR", `promise: ${err?.message || err}`);
    if (err?.stack) log("ERROR", err.stack);
});

// ---------------- LOGIN ----------------
log("SYSTEM", "กำลังพยายาม login...");

client.login(config.token)
    .then(() => log("LOGIN", "login สำเร็จ"))
    .catch(err => {
        log("ERROR", `login ล้มเหลว: ${err.message}`);
        if (err.stack) log("ERROR", err.stack);
        console.error(err);
    });