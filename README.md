# hack-chat.simple-bot
本机器人是基于WebSocket协议开发的Hack.Chat聊天辅助工具，提供消息管理、用户统计、命令系统等功能。

# 版本介绍:
1.bot.js - 这是机器人的框架

2.sunldigv3_bot - 这是机器人的主体，在浏览器环境上运行

3.sunldigv3_bot_nodejs - 这是在node.js上运行的版本

# 功能介绍

所有用户均可使用的基础指令。

| 指令 | 参数 | 功能说明 |
| :--- | :--- | :--- |
| `!help` | 无 | 显示此帮助信息列表 |
| `!online` | 无 | 实时获取当前频道在线用户清单 |
| `!stats` | 无 | 查看频道活跃度 TOP3 及当前在线统计 |
| `!userinfo` | `[用户名]` | 查询指定用户的发言数、AFK及禁言状态 |
| `!yiyan` | 无 | 获取一句来自 Hitokoto 的随机文学感悟 |
| `!emoji` | 无 | 发送一个随机选取的表情符号 |
| `!weather` | `[城市]` | 查询指定城市的实时简易天气 |

仅管理员可以使用的指令。

| 指令 | 参数 | 功能说明 |
| :--- | :--- | :--- |
| `!helpadmin` | 无 | 获取管理员专属指令详情 |
| `!mute` | `[名] [分]` | 临时禁言指定用户（分钟制） |
| `!silence` | `[用户名]` | 永久禁言指定用户 |
| `!unsilence` | `[用户名]` | 解除用户的禁言限制 |
| `!announce` | `[内容]` | 发送带有显著标识的频道官方公告 |
| `!pann` | `[子命令]` | **定时公告管理**：支持 `add/list/remove/clear` |
| `!con` | `[文本]` | 强制机器人输出原始文本（绕过逻辑处理） |
| `!stop` | 无 | 优雅停止机器人运行并切断连接 |

# 使用方法
<li>打开浏览器控制台</li>
<li>将 sunldigv3_bot.js 里的代码直接粘贴进去</li>
<li>找到这里： channel: "lounge",  其中 lounge 为房间名，可自定义（不要带"?"）</li>
<li>找到这里： botName: "sunldigv3_bot",  其中 sunldigv3_bot 为bot名，可自定义</li>
<li>找到这里： hex: "#5ee6ed",其中 #5ee6ed 为bot的颜色，可自定义</li>
<li>按回车即可运行</li>

# 对于移动设备，如手机
<li>可以下载 via 浏览器</li>
<li>下载项目代码，在文件查看器里复制代码</li>
<li>回到 via 浏览器，在菜单中点击 添加书签 </li>
<li>名称自定义，如：bot</li>
<li>在网页 URL 中输入 javascript: [项目代码]</li>
<li>保存，在任意页面打开书签界面，点击保存的书签即可运行</li>

# node.js版本
执行以下代码：
``` javascript
# 初始化 package.json（项目配置文件，必须先执行）
npm init -y

# 安装所需依赖（ws、node-fetch@2、fs-extra）
npm install ws node-fetch@2 fs-extra --save

#启动机器人
node sunldigv3_bot_nodejs.js
```


*注：此项目不会长期维护，仅提供框架。*
