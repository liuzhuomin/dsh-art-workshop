[![ci](https://github.com/liuzhuomin/dsh-art-workshop/actions/workflows/ci.yml/badge.svg)](https://github.com/liuzhuomin/dsh-art-workshop/actions/workflows/ci.yml)

# dsh-art-workshop · 艺术工坊

> DeepSeek Harness 里的内容生产流水线：从选题到成片，一条链走完。


> 姊妹项目：[dsh-wechat-relations](https://github.com/liuzhuomin/dsh-wechat-relations) —— 微信关系分析插件，把上千联系人压缩成一张可判断的关系网。

不是又一个「点一下生成」的按钮。它把**选题 → 脚本 → 配音 → 画面 → 合成 → 复盘 → 发布**拆成可替换的环节，每个环节插哪个插件由你定，每一步的耗时和 token 花销都摆在明面上。

---

## 五个视图

```
┌─ 艺术工坊 ──────────────────────────────── [作品][链路][插件][素材][知识库] ─┐
│                                                                            │
│  作品           链路            插件           素材          知识库          │
│  作品包卡片      时间线编排       调用统计        动画/表情/字体   抽题与云词库  │
│  视频+图片       插件可换         可设默认         可复制文件名     点开即生成    │
└────────────────────────────────────────────────────────────────────────────┘
```

### 作品

按「作品包」归组：一个视频 + 它用到的所有图片（折叠收起）。视频直接内嵌播放，图片懒加载。

- 筛选：全部 / 视频包 / 图文包
- 每个包带：复制参数、模仿生成、详情（右侧显示完整生成链路）

### 链路

时间线视图，按耗时等比画条，重的段落自动标红：

```
总耗时 2.3min                       总 token 5,650

选题   knowledge.json    ▏40ms          0tk  [knowledge.json ▾]
脚本   dsh-video-creator ███ 2.6s    1850tk  [dsh-video-creator ▾]
配音   dsh-voice         █████ 5.2s     0tk  [dsh-voice ▾]
画面   dsh-remotion      ████████████ 96s 0tk  [dsh-remotion ▾]   ← 橙红，瓶颈
合成   dsh-ffmpeg        ███ 8.4s       0tk  [dsh-ffmpeg ▾]
复盘   dsh-video-lens    ████ 12.0s  3200tk  [dsh-video-lens ▾]
发布   @aitoearn         ▏900ms      480tk  [@aitoearn ▾]
```

**每行右侧是插件下拉，全部开放**——想用哪个就用哪个，选完写 `chain-config.json`，重启不丢。视频 / 图文 / 长图文三套链分开存。

### 插件

读 DSH profile 实际装的包，按分类筛选（生成 / 音频 / 渲染 / 剪辑 / 复盘 / 数据 / 发布 / 素材 / 界面）。

每行两个动作：

- **测试** —— 跑真实调用，右侧出结果和耗时（能跑的跑，不能跑的明确说「需要密钥」）
- **设为默认** —— 写进默认模板，右侧立刻显示这套模板由哪些插件编排而成

### 素材

扫本地素材库：动画（webm 首帧直出预览）、表情图、字体、渲染产物。点一下复制文件名，直接填进流程节点。

### 知识库

两种形态：**卡片**（编号 + 要点数 + 钩子）和**云词库**（随机大小、五种颜色）。

点开一条 → 右侧显示全文 → 「用这条生成」→ 选择：

1. **使用默认模板**：走插件页设好的编排；
2. **自定义流程节点**：逐节点勾选启用、改名、改时长、调顺序、换插件（下拉**按节点功能过滤**，只列同类插件）。

调好的组合可以「存为模板」，下次一键载入。

---

## 安装

```bash
git clone https://github.com/liuzhuomin/dsh-art-workshop.git
cd dsh-art-workshop
dsh plugin add .
```

重启 DSH，侧栏出现「艺术工坊」。

### 环境变量（可选）

插件默认按目录约定找文件，路径不同就设这些：

| 变量 | 默认 | 作用 |
| --- | --- | --- |
| `DSH_ART_WORKSPACE` | `D:/dsh_wp/dsh-pet-video` | Remotion 工程目录（要能跑 `npx remotion render`） |
| `DSH_ART_OUTPUTS` | `<workspace>/out` | 作品输出目录，多个用 `;` 分隔 |
| `DSH_ART_RENDERER` | `D:/dsh_wp/pet-explainer` | 版式工程（`anything2explainer` 那套） |
| `DSH_PET_ASSETS` | `<workspace>/pet-assets` | 角色素材根目录（`webm/`、`memes/`） |
| `DSH_ART_FONTS` | `<workspace>/fonts` | 字体目录 |
| `DSH_ART_TMP` | `<workspace>` | ffmpeg / 渲染的临时目录 |
| `DSH_PROFILE_PATH` | `~/.dsh/profiles/desktop` | DSH profile 路径（插件清单从这里读） |

Windows 上 `%TEMP%` 偶尔不可写，`DSH_ART_TMP` 就是干这个用的。

---

## 接口

| 方法 | 路径 | 作用 |
| --- | --- | --- |
| GET | `/dsh-video/works` | 作品包列表（视频 + 关联图片） |
| GET | `/dsh-video/chain?type=video\|image\|article` | 链路定义 |
| POST | `/dsh-video/chain?type=…` | 保存链路插件配置 |
| GET/POST | `/dsh-video/plugins` | 已装插件清单（含能力标签） |
| GET | `/dsh-video/assets` | 素材库 |
| GET | `/dsh-video/asset?path=` | 素材文件（白名单目录） |
| GET | `/dsh-video/knowledge` / POST | 知识库读写 |
| GET | `/dsh-video/topic?source=knowledge\|template\|llm` | 抽题 |
| POST | `/dsh-video/make` | 出片（可传自定义 nodes） |
| GET | `/dsh-video/test?plugin=` | 插件自测 |
| GET/POST | `/dsh-video/mytemplates` | 我的模板 |
| GET/POST | `/dsh-video/default` | 默认模板 |

---

## 知识库格式

`knowledge.json` 就一个数组，加题目直接往里写：

```json
{
  "items": [
    {
      "id": "yawning",
      "title": "打哈欠会传染吗",
      "hook": "看见别人打哈欠，你是不是也想打？",
      "breath": "这不是心理作用。",
      "points": ["传染性哈欠和共情能力相关", "镜像神经元在模仿对方动作"],
      "punchline": "你打的不是哈欠，是共情"
    }
  ]
}
```

仓库自带 6 条示例，都是公开的科普常识。

---

## 关于失败

这个插件的设计前提是：**插件会挂**。

- 插件自测会明说「需要密钥」「edge-tts 被拦」这类情况，不假装成功；
- 渲染失败把日志尾部直接贴到界面；
- 路由重复注册不会让整个插件崩掉（`safeRegister`）。

---

## License

MIT
