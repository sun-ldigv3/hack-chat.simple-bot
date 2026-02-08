(function () {
    const CONFIG = {
        server: "wss://hack.chat/chat-ws", // 官方WS地址，禁止修改
        channel: "lounge", // 机器人频道（和你访问的hack.chat/xxx频道一致）
        botName: "sunldigv3_bot",
        debug: false, // 调试模式，日常关闭
        // 通用常量（按需微调，无需大幅修改）
        CONST: {
            adminPrefix: 'sun', // 管理员前缀（仅该前缀用户可执行管理员命令）
            cmdPrefix: '!', // 命令前缀
            sendRateLimit: 200, // 防限流发送间隔（ms）
            muteCheckInterval: 10000, // 禁言检查间隔10秒
            maxMsgHistory: 1000, // 本地消息最大存储量
            latestMsgCount: 5, // 最新消息展示数
            welcomeMsg: "欢迎 %s 加入！发`!help`看命令", // 移除mk前缀，纯文本
            emojiList: ['😀', '😂', '🤣', '😊', '👍', '🎉', '🎁', '🌟', '🚀', '💡', '📚', '🎲', '☁️', '⚡', '❤️'],
            // 模仿风格模板（参考 awa_ya 风格：俏皮/幽默）
            styleTemplates: {
                questionReplies: [
                    '我也很不解',
                    '这问题把我问懵了',
                    '同感，谁能解释一下',
                    '我就是一个小机器人，也很困惑',
                    '这……我需要查阅我的小百科'
                ],
                exclaimReplies: [
                    '嘿嘿，这也太精彩了吧',
                    '哎呦，不错哦',
                    '哈哈，这波我给满分'
                ],
                greetingReplies: [
                    '嗨，大家好呀～',
                    '在的，有事喊我',
                    '你好呀，今天也要加油哦'
                ],
                smallTalkReplies: [
                    '嗯哼~', '哦哦', '了解啦'
                ]
            },
            // 周期发布池设置（权重由代码内概率控制）
            periodic: {
                includeYiyan: true, // 是否把一言纳入周期池
                includeStyle: true, // 是否包含风格自动语句
                includeTriviaAuto: false // trivia 已移除
            }
        }
    };

    // 命令配置：新增/修改命令仅改此处，无需动业务代码
    const CMD_CONFIG = {
        help: { trigger: ['help', 'h'], desc: '查看所有可用命令', auth: false, public: true, params: '' },
        roll: { trigger: ['roll'], desc: '掷骰子，支持!roll 1-100自定义范围', auth: false, public: true, params: '[范围(可选)]' },
        afk: { trigger: ['afk'], desc: '设置/取消离开状态(AFK)', auth: false, public: true, params: '' },
        online: { trigger: ['online'], desc: '查看当前频道所有在线用户', auth: false, public: true, params: '' },
        msglist: { trigger: ['msglist'], desc: '查看最新5条消息ID（用于!reply）', auth: false, public: true, params: '' },
        reply: { trigger: ['reply'], desc: '引用历史消息回复', auth: false, public: true, params: '[消息ID] [回复内容]' },
        userinfo: { trigger: ['userinfo'], desc: '查询用户信息', auth: false, public: true, params: '[用户名(可选)]' },
        stats: { trigger: ['stats'], desc: '查看频道活跃度TOP3+在线人数', auth: false, public: true, params: '' },
        save: { trigger: ['save'], desc: '导出本地聊天记录为JSON文件', auth: false, public: true, params: '' },
        clear: { trigger: ['clear'], desc: '清空机器人本地消息历史', auth: false, public: true, params: '' },
        calc: { trigger: ['calc', '计算'], desc: '简易计算器，支持+/*/-/()', auth: false, public: true, params: '[计算式]' },
        weather: { trigger: ['weather', '天气'], desc: '查询城市简易天气', auth: false, public: true, params: '[城市名]' },
        emoji: { trigger: ['emoji', '表情'], desc: '发送随机表情包', auth: false, public: true, params: '' },
        specialHelp: { trigger: ['helpadmin'], desc: '查看管理员专属命令', auth: false, public: false, params: '' },
        mute: { trigger: ['mute'], desc: '临时禁言用户', auth: true, public: false, params: '[用户名] [分钟数]' },
        silence: { trigger: ['silence'], desc: '永久禁言用户', auth: true, public: false, params: '[用户名]' },
        unsilence: { trigger: ['unsilence'], desc: '解除用户禁言', auth: true, public: false, params: '[用户名]' },
        con: { trigger: ['con'], desc: '机器人直接输出纯文本内容', auth: true, public: false, params: '[任意文本]' },
        announce: { trigger: ['announce'], desc: '发送频道醒目公告', auth: true, public: false, params: '[公告内容]' },
        pann: { trigger: ['pann'], desc: '管理定时公告：pann add|remove|list|clear', auth: true, public: false, params: '[子命令]' },
        yiyan: { trigger: ['yiyan', '一言'], desc: '随机获取一言（来自 hitokoto）', auth: false, public: true, params: '' },
        stop: { trigger: ['stop'], desc: '停止机器人并退出', auth: true, public: false, params: '' }
    }; 

    const bot = {
        // 运行时数据（无持久化，重启重置）
        ws: null,
        clientId: Math.random().toString(36).slice(2, 10),
        lastSendTime: 0,
        afkUsers: new Map(),
        silencedUsers: new Map(),
        messageHistory: [],
        userActivity: new Map(),
        messageIdMap: new Map(),
        nextMessageId: 1,
        scheduledIntervals: [],
        cmdMap: new Map(),
        onlineUsers: new Set(),
        // 额外状态：问号回复冷却 / 逗号定时器句柄 / 最近整点已发送小时
        lastQuestionReplyTime: 0,
        commaTimeoutId: null,
        lastHourlyAnnouncement: null,
        // 最近消息时间戳（用于自适应行为判断）
        recentMsgTimestamps: [],
        // 周期性发布：timeout id & 定时公告列表 & 上次发布 id（避免重复）
        periodicTimeoutId: null,
        scheduledAnnouncements: [],
        lastPeriodicSentId: null,

        // 停止标识（用于阻止自动重连）
        stopped: false,

        // 初始化入口
        init() {
            this.initCmdMap();
            this.connectWS();
            this.startTimers();
            console.log(`[✅ ${CONFIG.botName}] 机器人启动`);
            window.hackChatBot = this;
        },

        // 初始化命令映射
        initCmdMap() {
            const { cmdPrefix } = CONFIG.CONST;
            Object.entries(CMD_CONFIG).forEach(([cmdKey, config]) => {
                config.trigger.forEach(trigger => {
                    const fullTrigger = `${cmdPrefix}${trigger}`;
                    this.cmdMap.set(fullTrigger, {
                        key: cmdKey,
                        ...config,
                        handler: this[`handle${cmdKey.charAt(0).toUpperCase() + cmdKey.slice(1)}`]
                    });
                });
            });
        },

        // 连接WS服务器
        connectWS() {
            if (this.ws) this.ws.close(1000, 'reconnect');
            this.ws = new WebSocket(CONFIG.server);
            this.ws.binaryType = 'utf8';

            this.ws.onopen = () => {
                console.log(`[连接成功] 频道：${CONFIG.channel}`);
                this.joinChannel();
            };

            this.ws.onmessage = (e) => {
                try {
                    const msg = JSON.parse(e.data);
                    CONFIG.debug && console.log(`[接收]`, msg);
                    this.handleOfficialCommands(msg);
                } catch (err) {
                    console.error(`[解析失败]`, err);
                }
            };

            this.ws.onclose = () => {
                console.log(`[连接关闭]`);
                this.onlineUsers.clear();
                if (!this.stopped) {
                    console.log(`5秒后重连`);
                    setTimeout(() => this.connectWS(), 5000);
                } else {
                    console.log(`[${CONFIG.botName}] 停止状态，不再重连`);
                }
            }; 

            this.ws.onerror = (err) => {
                console.error(`[WS错误]`, err);
            };
        },

        // 加入频道（官方标准格式）
        joinChannel() {
            if (this.ws.readyState !== WebSocket.OPEN) return;
            this.sendWSMessage({
                cmd: 'join',
                channel: CONFIG.channel,
                nick: CONFIG.botName,
                clientId: this.clientId
            });
        },

        // 处理所有官方指令（已完全移除私信相关逻辑）
        handleOfficialCommands(msg) {
            switch (msg.cmd) {
                case 'chat':
                    this.recordMessage(msg);
                    // 禁言校验：优先判断是否被禁言，无私信分支
                    if (!this.isSilenced(msg.nick)) {
                        this.handleChatMessage(msg);
                    } else {
                        const remain = Math.ceil((this.silencedUsers.get(msg.nick) - Date.now()) / 60000);
                        this.sendChat(`${msg.nick} 禁言中，剩余${Math.max(remain, 0)}分钟`);
                    }
                    break;
                case 'error':
                    this.handleServerError(msg);
                    break;
                case 'onlineSet':
                    this.updateOnlineUsers(msg.nicks);
                    break;
                case 'onlineAdd':
                    this.onlineUsers.add(msg.nick);
                    this.sendWelcomeMessage(msg.nick); // 直接使用msg.nick，修复新用户昵称识别bug
                    CONFIG.debug && console.log(`[新用户] ${msg.nick} 加入`);
                    break;
                case 'onlineRemove':
                    this.onlineUsers.delete(msg.nick);
                    this.afkUsers.delete(msg.nick);
                    break;
                default:
                    CONFIG.debug && console.log(`[未处理指令]`, msg.cmd);
            }
        },

        // 新用户欢迎（核心修复：直接使用msg.nick，无mk前缀）
        sendWelcomeMessage(nick) {
            if (nick === CONFIG.botName) return; // 排除机器人自身
            const welcomeText = CONFIG.CONST.welcomeMsg.replace('%s', nick);
            this.sendChat(welcomeText);
        },

        // 处理群聊消息（无私信相关逻辑）
        handleChatMessage(msg) {
            // 避免处理机器人自身消息
            if (msg.nick === CONFIG.botName) return;
            const text = msg.text.trim();
            if (!text) return;
            this.handleCommands(msg, text);
            this.handleAFKMention(msg);
            this.updateUserActivity(msg.nick);

            // 如果消息包含问号：若消息仅为问号（例如 "?" 或 "？？"），立即回复并绕过冷却；否则仍遵循冷却。
            try {
                if (!text.startsWith(CONFIG.CONST.cmdPrefix) && /[？?]/.test(text)) {
                    const now = Date.now();
                    const isJustQuestion = /^[？?]+$/.test(text);
                    if (isJustQuestion || !this.lastQuestionReplyTime || now - this.lastQuestionReplyTime > 5000) {
                        const reply = this.pickStyleReply('questionReplies');
                        this.sendChat(reply);
                        this.lastQuestionReplyTime = now;
                    }
                }
            } catch (e) { console.error('[问号处理错误]', e); }
        },

        // 记录消息
        recordMessage(msg) {
            if (msg.cmd !== 'chat' || msg.nick === CONFIG.botName) return;
            const msgObj = {
                id: this.nextMessageId++,
                nick: msg.nick,
                text: msg.text,
                time: new Date().toISOString()
            };
            this.messageHistory.push(msgObj);
            this.messageIdMap.set(msgObj.id, msgObj);

            // 记录最近消息时间戳（用于判断频道是否安静），并作简单截断以控制长度
            this.recentMsgTimestamps = this.recentMsgTimestamps || [];
            this.recentMsgTimestamps.push(Date.now());
            const MAX_TS = 500;
            if (this.recentMsgTimestamps.length > MAX_TS) {
                this.recentMsgTimestamps.splice(0, this.recentMsgTimestamps.length - MAX_TS);
            }

            if (this.messageHistory.length > CONFIG.CONST.maxMsgHistory) {
                const delMsg = this.messageHistory.shift();
                this.messageIdMap.delete(delMsg.id);
            }
        },

        // 命令处理（移除所有私信相关参数和逻辑，无mk前缀）
        handleCommands(msg, text) {
            const [cmdTrigger, ...params] = text.split(/\s+/);
            const cmdItem = this.cmdMap.get(cmdTrigger);
            if (!cmdItem) return;

            try {
                // 管理员权限统一校验，修复禁言命令权限漏洞
                if (cmdItem.auth && !this.hasAdminAuth(msg.nick)) {
                    this.sendChat(`无权限，仅管理员可执行`);
                    return;
                }
                // 参数校验
                if (cmdItem.params && params.length === 0 && cmdTrigger !== '!help s') {
                    this.sendChat(`格式错误，正确：${cmdTrigger} ${cmdItem.params}`);
                    return;
                }
                // 执行命令
                cmdItem.handler.call(this, msg, params);
            } catch (err) {
                console.error(`[命令失败] ${cmdTrigger}`, err);
                this.sendChat(`执行出错：${err.message.slice(0, 20)}`);
            }
        },

        // 发送WS消息（防限流）
        sendWSMessage(data, ignoreLimit = false) {
            if (this.ws.readyState !== WebSocket.OPEN) {
                console.error(`[发送失败] 连接未建立`);
                return;
            }
            const now = Date.now();
            if (!ignoreLimit && now - this.lastSendTime < CONFIG.CONST.sendRateLimit) {
                console.warn(`[限流] 频率过高`);
                return;
            }
            this.ws.send(JSON.stringify(data));
            this.lastSendTime = now;
        },

        // 发送消息（移除私信参数，纯文本输出，无任何前缀）
        sendChat(text) {
            this.sendWSMessage({
                cmd: 'chat',
                text: text,
                clientId: this.clientId
            });
            CONFIG.debug && console.log(`[发送]`, text);
        },

        // 简化调试日志，便于统一控制输出（使用：this.debugLog(...))
        debugLog(...args) {
            if (CONFIG.debug) console.log(...args);
        },

        // 管理员权限校验
        hasAdminAuth(nick) {
            return nick.startsWith(CONFIG.CONST.adminPrefix);
        },

        // 禁言判断（完善校验逻辑，修复禁言不生效bug）
        isSilenced(nick) {
            if (!this.silencedUsers.has(nick)) return false;
            const expire = this.silencedUsers.get(nick);
            if (expire === Infinity) return true; // 永久禁言
            if (expire > Date.now()) return true; // 临时禁言未到期
            // 自动清理过期禁言，避免无效数据
            this.silencedUsers.delete(nick);
            return false;
        },

        // 更新活跃度
        updateUserActivity(nick) {
            this.userActivity.set(nick, (this.userActivity.get(nick) || 0) + 1);
        },

        // AFK@提醒（纯文本，无mk前缀，精简表述）
        handleAFKMention(msg) {
            const mentionReg = /@(\w+)/g;
            let match;
            while ((match = mentionReg.exec(msg.text)) !== null) {
                const user = match[1];
                if (this.afkUsers.has(user)) {
                    const afkMs = Date.now() - this.afkUsers.get(user);
                    const afkStr = afkMs > 3600000 ? `${(afkMs / 3600000).toFixed(1)}h` : `${Math.floor(afkMs / 60000)}m`;
                    this.sendChat(`@${msg.nick}：${user} AFK(${afkStr})`);
                }
            }
        },

        // 服务端错误处理（纯文本，无mk前缀）
        handleServerError(msg) {
            const errorMap = {
                'nicknameTaken': '昵称被占，修改botName',
                'channelInvalid': '频道无效',
                'banned': '被官方封禁',
                'rateLimited': '发送频率过高'
            };
            const text = errorMap[msg.error] || `服务端错误：${msg.error}`;
            console.error(`[服务端错误]`, text);
            this.sendChat(text);
        },

        // 更新在线用户
        updateOnlineUsers(nicks) {
            this.onlineUsers = new Set(nicks);
            CONFIG.debug && console.log(`[在线用户] 共${this.onlineUsers.size}人`, [...this.onlineUsers]);
        },

        // 启动定时器
        startTimers() {
            // 禁言检查
            const muteId = setInterval(() => this.checkMuteExpire(), CONFIG.CONST.muteCheckInterval);
            this.scheduledIntervals.push(muteId);
            this.debugLog(`[定时器启动] 禁言检查`);

            // 每小时整点提醒（检查间隔30s，保证不漏发）
            this.lastHourlyAnnouncement = null;
            const hourlyId = setInterval(() => {
                try {
                    const now = new Date();
                    if (now.getMinutes() === 0 && now.getSeconds() < 5) {
                        const hour = now.getHours();
                        if (this.lastHourlyAnnouncement !== hour) {
                            this.sendChat(`${hour}点了，喝口水吧`);
                            this.lastHourlyAnnouncement = hour;
                        }
                    } else if (now.getMinutes() > 0 || now.getSeconds() > 5) {
                        // 重置，准备下一次整点发送
                        this.lastHourlyAnnouncement = null;
                    }
                } catch (e) { console.error('[小时提醒错误]', e); }
            }, 30000);
            this.scheduledIntervals.push(hourlyId);
            this.debugLog(`[定时器启动] 整点提醒`);

            // ====================== 定时器相关 ======================
            // 随机间隔 10-15 分钟发送逗号（递归 setTimeout）
            this.scheduleComma();

            // 加载并启动周期性公告/历史回放发布
            this.loadScheduledAnnouncements && this.loadScheduledAnnouncements();
            this.schedulePeriodicPost && this.schedulePeriodicPost();
        },

        // 安排下一次逗号发送
        scheduleComma() {
            const min = 10 * 60 * 1000;
            const delay = min + Math.floor(Math.random() * (5 * 60 * 1000)); // 10~15 分钟
            if (this.commaTimeoutId) clearTimeout(this.commaTimeoutId);
            this.commaTimeoutId = setTimeout(() => {
                try {
                    // 仅在频道安静时发送逗号（默认：5 分钟内 <= 2 条消息）
                    if (this.isChannelQuiet()) {
                        this.sendChat(',');
                    } else {
                        CONFIG.debug && console.log('[逗号] 频道繁忙，跳过本次发送');
                    }
                } catch (e) { console.error('[逗号发送失败]', e); }
                this.commaTimeoutId = null;
                this.scheduleComma();
            }, delay);
            // 不再将 timeout id 推入 scheduledIntervals（避免数组无限增长），cleanup 会单独清理 commaTimeoutId
            this.debugLog(`[定时器启动] 逗号定时器，下一次 ${Math.round(delay/60000)} 分钟后`);
        },

        // 判断频道是否安静（默认 5 分钟窗口内消息不超过 2 条）
        isChannelQuiet(windowMinutes = 5, maxMsgs = 2) {
            try {
                const cutoff = Date.now() - windowMinutes * 60 * 1000;
                const recent = (this.recentMsgTimestamps || []).filter(t => t >= cutoff).length;
                return recent <= maxMsgs;
            } catch (e) { return true; }
        },

        // 加载定时公告（从 localStorage 恢复）
        loadScheduledAnnouncements() {
            try {
                const key = `bot_${CONFIG.botName}_scheduledAnnouncements`;
                const raw = localStorage.getItem(key);
                this.scheduledAnnouncements = raw ? JSON.parse(raw) : [];
            } catch (e) {
                this.scheduledAnnouncements = [];
            }
        },

        // 保存定时公告
        saveScheduledAnnouncements() {
            try {
                const key = `bot_${CONFIG.botName}_scheduledAnnouncements`;
                localStorage.setItem(key, JSON.stringify(this.scheduledAnnouncements || []));
            } catch (e) {}
        },

        // 安排周期性发布（15~30 分钟间隔，随机）
        schedulePeriodicPost() {
            const min = 15 * 60 * 1000;
            const delay = min + Math.floor(Math.random() * (15 * 60 * 1000)); // 15~30 分钟
            if (this.periodicTimeoutId) clearTimeout(this.periodicTimeoutId);
            this.periodicTimeoutId = setTimeout(() => {
                try {
                    // 池：定时公告 / 一言 / 历史回放 / 风格短语
                    const r = Math.random();
                    const hasAnn = this.scheduledAnnouncements && this.scheduledAnnouncements.length > 0;
                    if (hasAnn && r < 0.5) {
                        const ann = this.scheduledAnnouncements[Math.floor(Math.random() * this.scheduledAnnouncements.length)];
                        this.sendChat(ann);
                    } else if (CONFIG.CONST.periodic.includeYiyan && r < 0.65) {
                        // 一言（异步）
                        this.handleYiyan && this.handleYiyan();
                    } else if (CONFIG.CONST.periodic.includeStyle && r < 0.95) {
                        const s = this.pickStyleReply('smallTalkReplies');
                        if (s) this.sendChat(s);
                    } else {
                        const text = this.pickRandomPastMessage();
                        if (text) this.sendChat(text);
                    }
                } catch (e) { console.error('[周期发布失败]', e); }
                this.periodicTimeoutId = null;
                this.schedulePeriodicPost();
            }, delay);
            this.debugLog(`[定时器启动] 周期性发布，下一次 ${Math.round(delay/60000)} 分钟后`);
        },

        // 从历史中挑选一条用户消息（排除欢迎、指令、太短、逗号、公告）
        pickRandomPastMessage(maxScan = 500) {
            try {
                const arr = this.messageHistory.slice(-maxScan).filter(m => {
                    if (!m || !m.text) return false;
                    const t = m.text.trim();
                    if (t.length < 3) return false; // 太短忽略
                    if (t === ',') return false;
                    if (t.startsWith(CONFIG.CONST.cmdPrefix)) return false; // 忽略命令
                    if (/^欢迎\s+/.test(t)) return false; // 忽略欢迎
                    if (t.includes('频道公告')) return false; // 忽略公告
                    return true;
                });
                if (!arr.length) return null;
                let candidate = arr[Math.floor(Math.random() * arr.length)];
                // 避免连续重复同一条
                if (this.lastPeriodicSentId && arr.length > 1 && candidate.id === this.lastPeriodicSentId) {
                    candidate = arr.find(m => m.id !== this.lastPeriodicSentId) || candidate;
                }
                this.lastPeriodicSentId = candidate.id;
                let text = candidate.text.trim();
                if (text.length > 200) text = text.slice(0,200) + '...';
                return text;
            } catch (e) { return null; }
        }, 

        // 检查禁言过期（纯文本，无mk前缀）
        checkMuteExpire() {
            const now = Date.now();
            for (const [user, expire] of this.silencedUsers.entries()) {
                if (expire !== Infinity && expire < now) {
                    this.silencedUsers.delete(user);
                    this.sendChat(`${user} 禁言已到期`);
                }
            }
        },

        // 清理资源
        cleanup() {
            // 清理所有定时器（支持 timeout & interval）
            this.scheduledIntervals.forEach(t => {
                try { clearInterval(t); } catch (e) {}
                try { clearTimeout(t); } catch (e) {}
            });
            if (this.commaTimeoutId) {
                clearTimeout(this.commaTimeoutId);
                this.commaTimeoutId = null;
            }
            if (this.periodicTimeoutId) {
                clearTimeout(this.periodicTimeoutId);
                this.periodicTimeoutId = null;
            }

            // 保存定时公告以便下次恢复
            try { this.saveScheduledAnnouncements && this.saveScheduledAnnouncements(); } catch (e) {}
            this.ws && this.ws.close(1000, 'cleanup');
            console.log(`[${CONFIG.botName}] 已停止`);
        },

        // ====================== 所有命令处理方法（无mk前缀，纯文本输出） ======================
        // 帮助
        handleHelp(msg, _) {
            const { cmdPrefix } = CONFIG.CONST;
            const list = Object.entries(CMD_CONFIG)
                .filter(([_, c]) => c.public)
                .map(([_, c]) => `${cmdPrefix}${c.trigger[0]} ${c.params} - ${c.desc}`)
                .join('\n');
            this.sendChat(`**命令列表**\n${list}`);
        },

        // 掷骰子
        handleRoll(msg, params) {
            let min = 1, max = 6;
            if (params.length > 0) {
                const range = params[0].split('-');
                if (range.length === 2 && !isNaN(range[0]) && !isNaN(range[1])) {
                    min = Number(range[0]);
                    max = Number(range[1]);
                    if (min >= max) {
                        this.sendChat(`范围错误，最小值须小于最大值`);
                        return;
                    }
                } else {
                    this.sendChat(`格式：!roll 1-100`);
                    return;
                }
            }
            const res = Math.floor(Math.random() * (max - min + 1)) + min;
            this.sendChat(`🎲 [${min}-${max}]：${res}`);
        },

        // AFK
        handleAfk(msg, _) {
            const nick = msg.nick;
            if (this.afkUsers.has(nick)) {
                const afkMs = Date.now() - this.afkUsers.get(nick);
                const afkStr = afkMs > 3600000 ? `${(afkMs / 3600000).toFixed(1)}h` : `${Math.floor(afkMs / 60000)}m`;
                this.afkUsers.delete(nick);
                this.sendChat(`${nick} 已返回 | 离开：${afkStr}`);
            } else {
                this.afkUsers.set(nick, Date.now());
                this.sendChat(`${nick} AFK`);
            }
        },

        // 在线用户
        handleOnline(msg, _) {
            if (this.onlineUsers.size === 0) {
                this.sendChat(`无在线用户`);
                return;
            }
            const list = [...this.onlineUsers].sort().join('、');
            this.sendChat(`在线（${this.onlineUsers.size}人）：${list}`);
        },

        // 最新消息ID
        handleMsglist(msg, _) {
            const latest = this.messageHistory.slice(-CONFIG.CONST.latestMsgCount).reverse();
            if (latest.length === 0) {
                this.sendChat(`无消息记录`);
                return;
            }
            const list = latest.map(m => `#${m.id} @${m.nick}：${m.text.slice(0, 20)}`).join('\n');
            this.sendChat(`最近消息：\n${list}`);
        },

        // 引用回复
        handleReply(msg, params) {
            const [idStr, ...content] = params;
            const msgId = Number(idStr);
            const replyText = content.join(' ');
            if (isNaN(msgId) || !replyText) {
                this.sendChat(`格式：!reply 消息ID 内容`);
                return;
            }
            const target = this.messageIdMap.get(msgId);
            if (!target) {
                this.sendChat(`未找到ID ${msgId}`);
                return;
            }
            const text = `> #${target.id} @${target.nick}：${target.text.slice(0,50)}\n@${msg.nick}：${replyText}`;
            this.sendChat(text);
        },

        // 用户信息
        handleUserinfo(msg, params) {
            const target = params[0] || msg.nick;
            const hasAct = this.userActivity.has(target);
            const isAfk = this.afkUsers.has(target);
            const isSil = this.isSilenced(target);
            const isPermSil = isSil && this.silencedUsers.get(target) === Infinity;
            const count = this.userActivity.get(target) || 0;
            const isAdmin = this.hasAdminAuth(target);
            const isOnline = this.onlineUsers.has(target);

            if (!hasAct && !isAfk && !isSil) {
                this.sendChat(`无${target}的记录`);
                return;
            }

            const afkTime = isAfk ? Math.floor((Date.now() - this.afkUsers.get(target))/3600000) : 0;
            const silRemain = isSil && !isPermSil ? Math.ceil((this.silencedUsers.get(target)-Date.now())/60000) : 0;
            const text = `**${target}**\n发言：${count}条\nAFK：${isAfk ? `是（${afkTime}h）` : '否'}\n禁言：${isSil ? (isPermSil ? '永久' : `临时${silRemain}m`) : '否'}\n管理员：${isAdmin ? '是' : '否'}\n在线：${isOnline ? '是' : '否'}`;
            this.sendChat(text);
        },

        // 活跃度统计
        handleStats(msg, _) {
            const top3 = [...this.userActivity.entries()]
                .sort((a,b) => b[1]-a[1])
                .slice(0,3)
                .map(([n,c]) => `${n}：${c}条`)
                .join('、');
            const text = `**统计**\n在线：${this.onlineUsers.size}人\n活跃TOP3：${top3 || '无'}`;
            this.sendChat(text);
        },

        // 导出记录
        handleSave(msg, _) {
            const blob = new Blob([JSON.stringify(this.messageHistory, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `hackchat_${CONFIG.channel}_${new Date().toISOString().slice(0,10)}.json`;
            a.click();
            URL.revokeObjectURL(url);
            this.sendChat(`聊天记录已导出`);
        },

        // 清空记录
        handleClear(msg, _) {
            this.messageHistory = [];
            this.messageIdMap.clear();
            this.nextMessageId = 1;
            this.sendChat(`本地消息历史已清空`);
        },

        // 计算器
        handleCalc(msg, params) {
            const calcStr = params.join(' ');
            if (!calcStr) {
                this.sendChat(`格式：!calc 1+2*3`);
                return;
            }
            try {
                const validReg = /^[0-9\+\-\*\/\(\)\.\s]+$/;
                if (!validReg.test(calcStr)) {
                    this.sendChat(`仅支持数字+/*/-/()`);
                    return;
                }
                const res = eval(calcStr);
                this.sendChat(`==${calcStr}== = ${isNaN(res) ? '无效' : res}`);
            } catch (err) {
                this.sendChat(`计算失败`);
            }
        },

        // 天气查询
        handleWeather(msg, params) {
            const city = params.join(' ');
            if (!city) {
                this.sendChat(`格式：!weather 北京`);
                return;
            }
            fetch(`https://wttr.in/${encodeURIComponent(city)}?format=3`)
                .then(res => res.text())
                .then(data => {
                    this.sendChat(`${data}`);
                })
                .catch(() => {
                    this.sendChat(`天气查询失败`);
                });
        },

        // 随机表情
        handleEmoji(msg, _) {
            const emoji = CONFIG.CONST.emojiList[Math.floor(Math.random() * CONFIG.CONST.emojiList.length)];
            this.sendChat(`${emoji}`);
        },

        // 管理员帮助
        handleSpecialHelp(msg, _) {
            const { cmdPrefix } = CONFIG.CONST;
            const list = Object.entries(CMD_CONFIG)
                .filter(([_, c]) => c.auth)
                .map(([_, c]) => `${cmdPrefix}${c.trigger[0]} ${c.params} - ${c.desc}`)
                .join('\n');
            this.sendChat(`**管理员命令**\n${list}`);
        },

        // 临时禁言（修复权限校验，纯文本）
        handleMute(msg, params) {
            const [target, minStr] = params;
            const minutes = Number(minStr);
            if (isNaN(minutes) || minutes <= 0) {
                this.sendChat(`分钟数须大于0`);
                return;
            }
            if (target === CONFIG.botName) {
                this.sendChat(`不能禁言机器人自身`);
                return;
            }
            this.silencedUsers.set(target, Date.now() + minutes * 60000);
            this.sendChat(`${target} 禁言${minutes}分钟`);
        },

        // 永久禁言（修复权限校验，纯文本）
        handleSilence(msg, params) {
            const target = params[0];
            if (target === CONFIG.botName) {
                this.sendChat(`不能禁言机器人自身`);
                return;
            }
            this.silencedUsers.set(target, Infinity);
            this.sendChat(`${target} 永久禁言`);
        },

        // 解除禁言（修复权限校验，纯文本）
        handleUnsilence(msg, params) {
            const target = params[0];
            if (this.silencedUsers.delete(target)) {
                this.sendChat(`${target} 禁言已解除`);
            } else {
                this.sendChat(`${target} 未被禁言`);
            }
        },

        // !con命令（核心修复：纯文本输出，无任何格式/前缀）
        handleCon(msg, params) {
            const content = params.join(' ');
            if (!content) {
                this.sendChat(`格式：!con 任意纯文本`);
                return;
            }
            // 直接发送原始内容，不添加任何格式/前缀，纯文本输出
            this.sendWSMessage({
                cmd: 'chat',
                text: content,
                clientId: this.clientId
            }, true); // 忽略限流，确保即时输出
        },

        // 频道公告（纯文本，保留醒目格式）
        handleAnnounce(msg, params) {
            const text = params.join(' ');
            if (!text) {
                this.sendChat(`格式：!announce 公告内容`);
                return;
            }
            const announce = `**【频道公告】**\n${text}`;
            this.sendChat(announce);
        },

        // 管理定时公告（管理员命令）：!pann add|remove|list|clear
        handlePann(msg, params) {
            const sub = params[0];
            if (!sub) {
                this.sendChat(`格式：!pann add|remove|list|clear`);
                return;
            }
            const rest = params.slice(1).join(' ');
            switch (sub) {
                case 'add':
                    if (!rest) { this.sendChat(`格式：!pann add 公告内容`); return; }
                    this.scheduledAnnouncements = this.scheduledAnnouncements || [];
                    this.scheduledAnnouncements.push(rest);
                    this.saveScheduledAnnouncements();
                    this.sendChat(`已添加定时公告：${rest}`);
                    break;
                case 'remove':
                    if (!rest) { this.sendChat(`格式：!pann remove 索引/部分内容`); return; }
                    this.scheduledAnnouncements = this.scheduledAnnouncements || [];
                    const idx = Number(rest);
                    if (!isNaN(idx) && idx >= 1 && idx <= this.scheduledAnnouncements.length) {
                        const removed = this.scheduledAnnouncements.splice(idx-1,1)[0];
                        this.saveScheduledAnnouncements();
                        this.sendChat(`已移除公告 #${idx}：${removed}`);
                    } else {
                        const needle = rest.trim();
                        // 先尝试精确匹配（忽略两端空格）
                        let i = this.scheduledAnnouncements.findIndex(a => a.trim() === needle);
                        // 再尝试包含匹配（不区分大小写）
                        if (i === -1) {
                            const low = needle.toLowerCase();
                            i = this.scheduledAnnouncements.findIndex(a => a.toLowerCase().includes(low));
                        }
                        if (i >= 0) {
                            const removed = this.scheduledAnnouncements.splice(i,1)[0];
                            this.saveScheduledAnnouncements();
                            this.sendChat(`已移除公告 #${i+1}：${removed}`);
                        } else {
                            this.sendChat(`未找到指定公告，使用 !pann list 查看索引或确保内容完整`);
                        }
                    }
                    break; 
                case 'list':
                    if (!this.scheduledAnnouncements || this.scheduledAnnouncements.length === 0) {
                        this.sendChat(`无定时公告`);
                        return;
                    }
                    const list = this.scheduledAnnouncements.map((a,i)=>`${i+1}. ${a}`).join('\n');
                    this.sendChat(`**定时公告**\n${list}`);
                    break;
                case 'clear':
                    this.scheduledAnnouncements = [];
                    this.saveScheduledAnnouncements();
                    this.sendChat(`已清空所有定时公告`);
                    break;
                default:
                    this.sendChat(`未知子命令，使用 add|remove|list|clear`);
            }
        },

        // 管理员命令：停止并退出机器人
        handleStop(msg, _) {
            if (!this.hasAdminAuth(msg.nick)) {
                this.sendChat(`无权限，仅管理员可执行`);
                return;
            }
            try {
                this.sendChat('毁灭吧，消失吧。');
            } catch (e) {}
            // 标记为停止，防止自动重连
            this.stopped = true;
            // 等待短暂时间以确保消息发送，再清理资源并移除引用
            setTimeout(() => {
                try { this.cleanup(); } catch (e) {}
                try { window.hackChatBot = null; } catch (e) {}
            }, 500);
        },

        // 风格回复选择器
        pickStyleReply(type) {
            try {
                const pool = (CONFIG.CONST.styleTemplates && CONFIG.CONST.styleTemplates[type]) || [];
                if (!pool.length) return null;
                return pool[Math.floor(Math.random() * pool.length)];
            } catch (e) { return null; }
        },

        // 随机工具
        randomPick(arr) { return arr && arr.length ? arr[Math.floor(Math.random()*arr.length)] : null; },



        // 一言（从 hitokoto API 获取随机短句）
        async handleYiyan(msg, _) {
            try {
                const res = await fetch('https://v1.hitokoto.cn/?encode=json');
                if (!res.ok) throw new Error('fetch failed');
                const data = await res.json();
                const text = (data.hitokoto || data.text || '').trim();
                const from = (data.from || data.from_who || '').trim();
                if (!text) {
                    this.sendChat('一言获取失败');
                    return;
                }
                const out = from ? `${text} —— ${from}` : `${text}`;
                this.sendChat(out);
            } catch (e) {
                console.error('[一言错误]', e);
                this.sendChat('获取一言失败，请稍后重试');
            }
        }
    };

    // 页面关闭清理资源
    window.addEventListener('beforeunload', () => bot.cleanup());
    // 启动机器人
    bot.init();
})();
