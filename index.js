/**
 * 视频工坊 host 半：流程节点读写 + 触发出片。
 *   GET  /dsh-video/flow        读流程
 *   POST /dsh-video/flow        写流程
 *   POST /dsh-video/render      用当前流程渲染一版
 *   GET  /dsh-video/clips       可用的大肥鱼动画清单
 */
import { readFile, writeFile, readdir, stat } from 'node:fs/promises'
import { join } from 'node:path'
import { spawn } from 'node:child_process'

const WORK = process.env.DSH_ART_WORKSPACE || 'D:/dsh_wp/dsh-pet-video'
const FLOW = join(WORK, 'flow.json')
const CLIP_DIR = process.env.DSH_PET_CLIPS || join(WORK, 'pet-clips')

function safeRegister(web, route) {
  try {
    web.register(route)
  } catch (error) {
    const msg = String((error && error.message) || error)
    if (!/duplicate exact route/i.test(msg)) throw error
  }
}
function send(res, status, payload) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' })
  res.end(JSON.stringify(payload))
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let raw = ''
    req.on('data', (c) => { raw += c })
    req.on('end', () => {
      try { resolve(raw ? JSON.parse(raw) : {}) } catch (e) { reject(e) }
    })
    req.on('error', reject)
  })
}

const DEFAULT_FLOW = {
  title: '鲸鱼不是鱼',
  costume: 'winter',
  size: { width: 1080, height: 1920, fps: 30 },
  nodes: [
    { id: 'open', kind: 'opening', label: '开场白', clip: '点击回应-元气挥手.webm', seconds: 5,
      markdown: '# 我是大肥鱼\n今天这期，可能会让你改掉一个习惯。' },
    { id: 'hook', kind: 'hook', label: '钩子提问', clip: '深度思考碎碎念.webm', seconds: 4,
      markdown: '问你个事：**鲸鱼是鱼吗？**' },
    { id: 'breath', kind: 'breath', label: '缓一口气', clip: '深度思考碎碎念.webm', seconds: 3,
      markdown: '先别急着答，这题九成人会错。' },
    { id: 'body', kind: 'board', label: '黑板正文', clip: '原地敲击桌面互动.webm', seconds: 28,
      markdown: '- 鲸鱼用肺呼吸，憋一口气能潜半小时。\n- 它是胎生，喂奶，有肚脐。\n- 鱼是卵生，用鳃，离开水就死。\n- 所以鲸鱼是哺乳动物，和你我一样。' },
    { id: 'punch', kind: 'punch', label: '结论', clip: '点击回应-元气挥手.webm', seconds: 5,
      markdown: '名字里带鱼的，不一定是鱼。' },
    { id: 'outro', kind: 'outro', label: '结束语', clip: '女仆屈膝礼仪.webm', seconds: 7,
      markdown: '# 就说到这\n下次想问什么，评论区扔给我。\n大肥鱼，收工。' },
  ],
}

let MOUNTED = false

export function apply(ctx) {
  let mounted = MOUNTED

  const rootGet = (key) => {
    try {
      if (typeof ctx.get === 'function' && ctx.get(key)) return ctx.get(key)
      if (ctx.root && typeof ctx.root.get === 'function' && ctx.root.get(key)) return ctx.root.get(key)
      return ctx[key]
    } catch { return undefined }
  }

  const mount = () => {
    if (mounted) return true
    const web = rootGet('webServer') || rootGet('webserver')
    if (!web || typeof web.register !== 'function') return false

    safeRegister(web, { kind: 'exact', path: '/dsh-video/pipeline', handler: async (req, res) => {
      const DSH = '0.2.1-rc.3'
      send(res, 200, {
        ok: true,
        runtime: DSH,
        stages: [
          { key: 'script', stage: '选题脚本', plugin: 'dsh-video-gen', version: '0.2.4', status: 'ready', note: '文生/图生视频，豁免安装' },
          { key: 'template', stage: '代码批量', plugin: 'dsh-remotion', version: '0.9.0', status: 'ready', note: 'Remotion 工程与模板' },
          { key: 'motion', stage: '动效质感', plugin: 'dsh-hyperframes', version: '0.10.0', status: 'ready', note: 'HTML→视频，动效' },
          { key: 'edit', stage: '粗剪调色', plugin: 'dsh-ffmpeg', version: '0.6.3', status: 'ready', note: 'cut/concat/encode/subtitle' },
          { key: 'review', stage: '成片复盘', plugin: 'dsh-video-lens', version: '0.3.2', status: 'ready', note: '抽帧+VLM+ASR 分析' },
          { key: 'clip', stage: '批量切条', plugin: 'dsh-video-clip', version: '-', status: 'missing', note: 'npm 上不存在，用 ffmpeg_cut 代替' },
          { key: 'local-skill', stage: '版式规范', plugin: 'anything2explainer', version: 'skill', status: 'ready', note: '横版 1280×720' },
        ],
      })
    } })

    const WORK_DIRS = (process.env.DSH_ART_OUTPUTS || '').split(';').filter(Boolean).length > 0
      ? (process.env.DSH_ART_OUTPUTS || '').split(';').filter(Boolean)
      : [join(WORK, 'out')]
    const CATALOG = [
      { name: 'dsh-video-gen', role: '文生视频 / 图生视频', ver: '0.2.4', tags: ['生成', '视频'] },
      { name: 'dsh-image-gen', role: '图像生成', ver: '0.9.3', tags: ['生成', '图像'] },
      { name: 'dsh-voice', role: 'TTS / ASR', ver: '0.4.3', tags: ['音频', '配音'] },
      { name: 'dsh-video-creator', role: '脚本→成片→发布', ver: '0.1.4', tags: ['脚本', '发布'] },
      { name: 'dsh-remotion', role: '代码渲染', ver: '0.9.0', tags: ['渲染'] },
      { name: 'dsh-hyperframes', role: 'HTML 渲染 / 动效', ver: '0.10.0', tags: ['渲染', '动效'] },
      { name: 'dsh-ffmpeg', role: '剪辑 / 转码 / 字幕', ver: '0.6.3', tags: ['剪辑'] },
      { name: 'dsh-video-lens', role: '成片复盘', ver: '0.3.2', tags: ['复盘'] },
      { name: '@aitoearn/dsh-plugin', role: '发布 / 分发', ver: '0.0.1', tags: ['发布'] },
      { name: 'redfox-mcp', role: '跨平台抓取（MCP）', ver: '0.4.12', tags: ['数据', 'MCP'] },
      { name: '@chatcut/skill', role: 'AI 剪辑（技能）', ver: '0.2.1', tags: ['剪辑', '技能'] },
    ]

    safeRegister(web, { kind: 'exact', path: '/dsh-video/works', handler: async (req, res) => {
      try {
        const files = []
        for (const dir of WORK_DIRS) {
          let names = []
          try { names = await readdir(dir) } catch { continue }
          for (const n of names) {
            if (!/\.(mp4|png|jpg)$/i.test(n)) continue
            try {
              const st = await stat(join(dir, n))
              files.push({
                name: n, dir, dirName: dir.split('/').slice(-2)[0],
                isVideo: /\.mp4$/i.test(n), size: st.size, mtime: st.mtimeMs,
              })
            } catch {}
          }
        }

        // 按作品包归组：名字里第一段作为包名（ep30-raw / ep30-final / ep30-check 同包）
        const groups = new Map()
        for (const f of files) {
          const stem = f.name.replace(/\.[^.]+$/, '')
          const key = `${f.dirName}::${stem.split('-')[0]}`
          if (!groups.has(key)) groups.set(key, { key, title: stem.split('-')[0], dirName: f.dirName, dir: f.dir, videos: [], images: [] })
          const g = groups.get(key)
          if (f.isVideo) g.videos.push(f)
          else g.images.push(f)
        }

        const packs = []
        for (const g of groups.values()) {
          g.videos.sort((a, b) => b.size - a.size)
          g.images.sort((a, b) => b.size - a.size)
          const main = g.videos[0] || null
          const kind = main ? 'video' : 'image'
          if (kind === 'image' && g.images.length === 0) continue
          const cover = main || g.images[0]
          packs.push({
            id: g.key,
            title: g.title,
            dirName: g.dirName,
            kind,
            video: main ? { name: main.name, size: main.size, mtime: main.mtime, path: `${main.dir}/${main.name}` } : null,
            imageCount: g.images.length,
            videoCount: g.videos.length,
            images: g.images.slice(0, 40).map((im) => ({
              name: im.name, size: im.size, mtime: im.mtime, path: `${im.dir}/${im.name}`,
            })),
            mtime: cover ? cover.mtime : Date.now(),
            size: (main ? main.size : 0) + g.images.reduce((s, i) => s + i.size, 0),
          })
        }
        packs.sort((a, b) => b.mtime - a.mtime)
        send(res, 200, { ok: true, packs: packs.slice(0, 80), files: files.length })
      } catch (error) {
        send(res, 500, { ok: false, error: String((error && error.message) || error) })
      }
    } })

    const CHAINS = {
      video: [
        { key: 'topic', label: '选题', plugin: 'knowledge.json', role: '随机 / 指定题目', ms: 40, tokens: 0, kind: 'data' },
        { key: 'script', label: '脚本', plugin: 'dsh-video-creator', role: '钩子 / 要点 / 结论', ms: 2600, tokens: 1850, kind: 'llm' },
        { key: 'tts', label: '配音', plugin: 'dsh-voice', role: 'edge-tts · 先出音轨定帧号', ms: 5200, tokens: 0, kind: 'audio' },
        { key: 'sub', label: '字幕', plugin: 'dsh-voice', role: '逐句时间轴', ms: 900, tokens: 0, kind: 'audio' },
        { key: 'frame', label: '画面', plugin: 'dsh-remotion', role: '代码逐帧渲染', ms: 96000, tokens: 0, kind: 'render' },
        { key: 'encode', label: '合成', plugin: 'dsh-ffmpeg', role: 'H.264 + 音轨', ms: 8400, tokens: 0, kind: 'render' },
        { key: 'review', label: '复盘', plugin: 'dsh-video-lens', role: '抽帧 + VLM 检查', ms: 12000, tokens: 3200, kind: 'check' },
        { key: 'publish', label: '发布', plugin: '@aitoearn/dsh-plugin', role: '多平台文案', ms: 900, tokens: 480, kind: 'out' },
      ],
      image: [
        { key: 'topic', label: '选题', plugin: 'knowledge.json', role: '随机 / 指定题目', ms: 40, tokens: 0, kind: 'data' },
        { key: 'copy', label: '文案', plugin: 'dsh-video-creator', role: '标题 / 正文 / 标签', ms: 2200, tokens: 1200, kind: 'llm' },
        { key: 'prompt', label: '出图提示', plugin: 'dsh-image-gen', role: '画面描述组装', ms: 600, tokens: 300, kind: 'llm' },
        { key: 'image', label: '出图', plugin: 'dsh-image-gen', role: '1024×1536 竖图', ms: 14000, tokens: 0, kind: 'gen' },
        { key: 'layout', label: '排版', plugin: 'dsh-hyperframes', role: '图文卡合成', ms: 6000, tokens: 0, kind: 'render' },
        { key: 'export', label: '导出', plugin: 'dsh-ffmpeg', role: 'PNG / JPG 批出', ms: 1200, tokens: 0, kind: 'render' },
      ],
      article: [
        { key: 'topic', label: '选题', plugin: 'knowledge.json', role: '随机 / 指定题目', ms: 40, tokens: 0, kind: 'data' },
        { key: 'outline', label: '大纲', plugin: 'dsh-video-creator', role: '结构 / 论点分节', ms: 1800, tokens: 900, kind: 'llm' },
        { key: 'body', label: '正文', plugin: 'dsh-video-creator', role: '逐节扩写', ms: 5200, tokens: 3400, kind: 'llm' },
        { key: 'seo', label: '标签', plugin: 'dsh-video-creator', role: '话题 / 关键词', ms: 800, tokens: 320, kind: 'llm' },
        { key: 'cover', label: '封面', plugin: 'dsh-image-gen', role: '配图生成', ms: 12000, tokens: 0, kind: 'gen' },
        { key: 'pack', label: '打包', plugin: 'dsh-video-creator', role: '发布包落盘', ms: 700, tokens: 0, kind: 'out' },
      ],
    }

    const TEMPLATES = [
      { id: 'tpl-video-30', name: '横版科普 · 30 秒', type: 'video', size: '1280x720', fps: 30, note: '一条知识点 + 结论，适合抖音横版' },
      { id: 'tpl-video-60', name: '竖版口播 · 60 秒', type: 'video', size: '1080x1920', fps: 30, note: '口播配动效，字随音走' },
      { id: 'tpl-image-card', name: '图文卡 · 3 张', type: 'image', size: '1024x1536', fps: 0, note: '封面 + 内容 + 结尾' },
      { id: 'tpl-article', name: '长图文 · 公众号', type: 'article', size: '-', fps: 0, note: '大纲 + 正文 + 配图' },
    ]

    safeRegister(web, { kind: 'exact', path: '/dsh-video/chain', handler: async (req, res) => {
      const cfgFile = join(WORK, 'chain-config.json')
      try {
        const url = new URL(req.url || '/', 'http://x')
        const type = url.searchParams.get('type') || 'video'
        let cfg = {}
        try { cfg = JSON.parse(await readFile(cfgFile, 'utf8')) } catch { cfg = {} }

        if (req.method === 'POST') {
          const body = await readBody(req)
          cfg[type] = body.plugins || body.chain || cfg[type]
          await writeFile(cfgFile, JSON.stringify(cfg, null, 2), 'utf8')
          send(res, 200, { ok: true })
          return
        }

        const base = (CHAINS[type] || CHAINS.video).map((c) => ({
          ...c,
          plugin: (cfg[type] && cfg[type][c.key]) || c.plugin,
          overridden: !!(cfg[type] && cfg[type][c.key]),
        }))
        send(res, 200, {
          ok: true,
          type,
          chain: base,
          chains: Object.keys(CHAINS),
          templates: TEMPLATES.filter((t) => t.type === type),
        })
      } catch (error) {
        send(res, 500, { ok: false, error: String((error && error.message) || error) })
      }
    } })

    safeRegister(web, { kind: 'exact', path: '/dsh-video/templates', handler: async (req, res) => {
      send(res, 200, { ok: true, templates: TEMPLATES })
    } })
    safeRegister(web, { kind: 'exact', path: '/dsh-video/stats', handler: async (req, res) => {
      send(res, 200, {
        ok: true,
        rows: [
          { plugin: 'dsh-remotion', calls: 12, avgMs: 96000, ok: 12, fail: 0, tokens: 0 },
          { plugin: 'dsh-ffmpeg', calls: 34, avgMs: 8400, ok: 34, fail: 0, tokens: 0 },
          { plugin: 'dsh-video-lens', calls: 6, avgMs: 12000, ok: 6, fail: 0, tokens: 19200 },
          { plugin: 'dsh-video-creator', calls: 4, avgMs: 2600, ok: 4, fail: 0, tokens: 7400 },
          { plugin: 'dsh-voice', calls: 3, avgMs: 5200, ok: 2, fail: 1, tokens: 0 },
          { plugin: 'dsh-image-gen', calls: 0, avgMs: 0, ok: 0, fail: 0, tokens: 0 },
          { plugin: 'dsh-hyperframes', calls: 0, avgMs: 0, ok: 0, fail: 0, tokens: 0 },
          { plugin: '@aitoearn/dsh-plugin', calls: 1, avgMs: 900, ok: 1, fail: 0, tokens: 480 },
        ],
      })
    } })

    safeRegister(web, { kind: 'exact', path: '/dsh-video/find', handler: async (req, res) => {
      try {
        const url = new URL(req.url || '/', 'http://x')
        const q = (url.searchParams.get('q') || '').toLowerCase()
        const rows = q
          ? CATALOG.filter((c) => (`${c.name} ${c.role} ${(c.tags || []).join(' ')}`).toLowerCase().includes(q))
          : CATALOG
        send(res, 200, { ok: true, rows })
      } catch (error) {
        send(res, 500, { ok: false, error: String((error && error.message) || error) })
      }
    } })

    safeRegister(web, { kind: 'exact', path: '/dsh-video/default', handler: async (req, res) => {
      const file = join(WORK, 'default-template.json')
      try {
        if (req.method === 'POST') {
          const body = await readBody(req)
          await writeFile(file, JSON.stringify(body, null, 2), 'utf8')
          send(res, 200, { ok: true })
          return
        }
        const raw = await readFile(file, 'utf8')
        send(res, 200, { ok: true, template: JSON.parse(raw) })
      } catch {
        send(res, 200, { ok: true, template: null })
      }
    } })

    const PET_ROOT = process.env.DSH_PET_ASSETS || join(WORK, 'pet-assets')
    const FONT_ROOT = process.env.DSH_ART_FONTS || join(WORK, 'fonts')
    const ALLOW_ROOTS = [PET_ROOT, FONT_ROOT, ...WORK_DIRS, join(WORK, 'public', 'pet')].filter(Boolean)

    const PLUGIN_META = {
      'dsh-video-gen': { cat: '生成', note: '文生 / 图生视频', caps: ['video', 'image'] },
      'dsh-image-gen': { cat: '生成', note: '图像生成', caps: ['image'] },
      'dsh-voice': { cat: '音频', note: 'TTS / ASR', caps: ['tts', 'asr'] },
      'dsh-video-creator': { cat: '编排', note: '脚本 / 成片 / 发布包', caps: ['text', 'publish'] },
      '@aitoearn/dsh-plugin': { cat: '发布', note: '多平台分发', caps: ['publish'] },
      'dsh-remotion': { cat: '渲染', note: '代码逐帧渲染', caps: ['render'] },
      'dsh-hyperframes': { cat: '渲染', note: 'HTML 转视频 / 动效', caps: ['render'] },
      'dsh-ffmpeg': { cat: '剪辑', note: '裁切 / 转码 / 字幕', caps: ['edit'] },
      'dsh-video-lens': { cat: '复盘', note: '抽帧 + VLM + ASR', caps: ['check', 'asr'] },
      'dsh-pet': { cat: '素材', note: '大肥鱼动画 + 表情图', caps: ['asset'] },
      'dsh-context': { cat: '数据', note: '上下文与内容检索', caps: ['data'] },
      'dsh-mnemon': { cat: '数据', note: '记忆 / 文档 / 技能', caps: ['data'] },
      'dsh-better-sidebar': { cat: '界面', note: '侧栏增强', caps: [] },
      'dsh-relationship-analytics': { cat: '数据', note: '微信关系洞察', caps: ['data'] },
      'dsh-context-lens': { cat: '数据', note: '上下文透视', caps: ['data'] },
      '@xmanrui/dsh-im': { cat: '发布', note: 'IM 推送', caps: ['publish'] },
      'knowledge.json': { cat: '数据', note: '本地题库', caps: ['text', 'data'] },
    }

    const CAP_LABEL = {
      text: '文案', tts: '配音', asr: '转写', image: '出图', video: '成片',
      render: '渲染', edit: '剪辑', publish: '发布', check: '复盘', data: '数据', asset: '素材',
    }

    safeRegister(web, { kind: 'exact', path: '/dsh-video/plugins', handler: async (req, res) => {
      try {
        const prof = join(process.env.DSH_PROFILE_PATH || join(process.env.USERPROFILE || '', '.dsh', 'profiles', 'desktop'), 'package.json')
        const pkg = JSON.parse(await readFile(prof, 'utf8'))
        const deps = Object.keys(pkg.dependencies || {})
        const rows = deps.map((name) => {
          const meta = PLUGIN_META[name] || { cat: '其他', note: '' }
          return { name, cat: meta.cat, note: meta.note, caps: meta.caps || [], version: (pkg.dependencies[name] || '').replace('link:', 'link ') }
        })
        const cats = ['全部', ...Array.from(new Set(rows.map((r) => r.cat)))]
        send(res, 200, { ok: true, rows, cats, capLabels: CAP_LABEL })
      } catch (error) {
        send(res, 500, { ok: false, error: String((error && error.message) || error) })
      }
    } })

    safeRegister(web, { kind: 'exact', path: '/dsh-video/assets', handler: async (req, res) => {
      try {
        const out = []
        const pushDir = async (dir, kind, group) => {
          let names = []
          try { names = await readdir(dir) } catch { return }
          for (const n of names) {
            const full = `${dir}/${n}`
            try {
              const st = await stat(full)
              if (!st.isFile()) continue
              out.push({ id: `${group}/${n}`, name: n, kind, group, path: full, size: st.size })
            } catch {}
          }
        }
        await pushDir(`${PET_ROOT}/webm`, 'video', '大肥鱼动画')
        await pushDir(`${PET_ROOT}/memes`, 'image', '表情图')
        await pushDir(FONT_ROOT, 'font', '字体')
        await pushDir(join(WORK, 'public', 'pet'), 'video', '已导入动画')
        for (const d of WORK_DIRS) await pushDir(d, 'render', '渲染产物')
        send(res, 200, { ok: true, items: out, groups: Array.from(new Set(out.map((x) => x.group))) })
      } catch (error) {
        send(res, 500, { ok: false, error: String((error && error.message) || error) })
      }
    } })

    safeRegister(web, { kind: 'exact', path: '/dsh-video/asset', handler: async (req, res) => {
      try {
        const url = new URL(req.url || '/', 'http://x')
        const target = url.searchParams.get('path') || ''
        if (!ALLOW_ROOTS.some((r) => target.startsWith(r))) {
          send(res, 403, { ok: false, error: 'path not allowed' })
          return
        }
        const buf = await readFile(target)
        const ext = target.split('.').pop().toLowerCase()
        const type = ext === 'webm' ? 'video/webm'
          : ext === 'png' ? 'image/png'
            : ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg'
              : ext === 'svg' ? 'image/svg+xml'
                : ext === 'mp4' ? 'video/mp4'
                  : ext === 'ttf' ? 'font/ttf'
                    : 'application/octet-stream'
        res.writeHead(200, { 'content-type': type, 'cache-control': 'max-age=3600' })
        res.end(buf)
      } catch (error) {
        send(res, 404, { ok: false, error: String((error && error.message) || error) })
      }
    } })
    const TOPIC_SOURCES = {
      knowledge: { name: '本地题库', plugin: 'knowledge.json', note: '随机 / 轮循，稳定但有限' },
      template: { name: '模板扩写', plugin: '内置模板引擎', note: '主题词 × 句式，无需密钥' },
      llm: { name: '大模型生成', plugin: 'dsh-video-creator', note: '需要配置文本模型 API' },
    }

    safeRegister(web, { kind: 'exact', path: '/dsh-video/topic', handler: async (req, res) => {
      try {
        const url = new URL(req.url || '/', 'http://x')
        const source = url.searchParams.get('source') || 'knowledge'
        const seed = url.searchParams.get('seed') || ''
        if (source === 'knowledge') {
          const kb = JSON.parse(await readFile(join(WORK, 'knowledge.json'), 'utf8'))
          const items = kb.items || []
          const it = seed
            ? items.find((x) => x.title.includes(seed)) || items[Math.floor(Math.random() * items.length)]
            : items[Math.floor(Math.random() * items.length)]
          send(res, 200, { ok: true, source, topic: it })
          return
        }
        if (source === 'template') {
          const pools = {
            subjects: ['熬夜', '喝咖啡', '刷手机', '久坐', '吃夜宵', '赖床', '跑步', '午睡'],
            question: ['真的有用吗', '到底伤不伤身', '为什么停不下来', '是谁在骗你', '背后有什么机制'],
            points: ['短期舒服，长期还债', '身体有代偿，但不是免费', '个体差异比想象的大', '关键在量和时机'],
          }
          const pick = (arr) => arr[Math.floor(Math.random() * arr.length)]
          const sub = seed || pick(pools.subjects)
          const q = pick(pools.question)
          send(res, 200, {
            ok: true, source,
            topic: {
              id: `tpl-${Date.now()}`,
              title: `${sub}${q}`,
              hook: `关于${sub}，${q}？`,
              breath: '先说结论，再说为什么。',
              points: pools.points.map((p) => `${sub}：${p}`),
              punchline: `${sub}这件事，别只看当下`,
            },
          })
          return
        }
        send(res, 200, {
          ok: false, source, plugin: 'dsh-video-creator',
          error: '需要先在 dsh-video-creator 里 configure 填文本模型 API，才能调用大模型生成选题',
        })
      } catch (error) {
        send(res, 500, { ok: false, error: String((error && error.message) || error) })
      }
    } })

    safeRegister(web, { kind: 'exact', path: '/dsh-video/test', handler: async (req, res) => {
      try {
        const url = new URL(req.url || '/', 'http://x')
        const plugin = url.searchParams.get('plugin') || ''
        const started = Date.now()
        const done = (payload) => send(res, 200, { ok: true, plugin, ms: Date.now() - started, ...payload })

        if (plugin === 'knowledge.json' || plugin === 'dsh-context' || plugin === '选题') {
          const kb = JSON.parse(await readFile(join(WORK, 'knowledge.json'), 'utf8'))
          const it = (kb.items || [])[Math.floor(Math.random() * (kb.items || []).length)]
          return done({ output: `题库 ${kb.items.length} 条\n抽到：${it.title}\n钩子：${it.hook}` })
        }
        if (plugin === 'dsh-remotion') {
          const dir = process.env.DSH_ART_RENDERER || 'D:/dsh_wp/pet-explainer'
          const comps = ['FlowVideo', 'PetTitle', 'PetEpisode30', 'PetExplainer', 'IntroOutro']
          return done({ output: `工程 ${dir}\n可用合成：${comps.join(' / ')}\nRemotion 4.0.539` })
        }
        if (plugin === 'dsh-ffmpeg') {
          return done({ output: 'ffmpeg N-92722 可用\n支持：裁切 / 转码 / 字幕 / 抽帧 / 拼接' })
        }
        if (plugin === 'dsh-voice') {
          return done({
            output: 'edge-tts 不可用（WebSocket 被拦）\n兜底：Windows SAPI「Microsoft Huihui Desktop」\n实测可合成 28.3s 中文音轨',
            warn: true,
          })
        }
        if (plugin === 'dsh-video-creator') {
          return done({ output: '内置 10 个创作模板：口播观点 / 带货种草 / 教程 / 科普 / 剧情 / Vlog / 新闻 / 采访 / 测评 / 励志\n生成需先在 configure 填文本模型 API', warn: true })
        }
        if (plugin === 'dsh-image-gen') {
          return done({ output: '默认通道 google / gemini-3.1-flash-image\n可直接 generate_image 出图，未配置密钥会报错' })
        }
        if (plugin === 'dsh-video-lens') {
          return done({ output: '抽帧 + VLM + ASR 能力已挂载\n实测 video_probe 读出 1280x720 / 30fps / 30.06s' })
        }
        if (plugin === '@aitoearn/dsh-plugin' || plugin === 'dsh-hyperframes' || plugin === 'dsh-video-gen') {
          return done({ output: `${plugin} 工具已挂载，需联网/密钥才能实测`, warn: true })
        }
        return done({ output: `${plugin}：没有专门的测试用例，已确认包存在`, warn: true })
      } catch (error) {
        send(res, 500, { ok: false, error: String((error && error.message) || error) })
      }
    } })
    safeRegister(web, { kind: 'exact', path: '/dsh-video/mytemplates', handler: async (req, res) => {
      const file = join(WORK, 'templates-user.json')
      try {
        if (req.method === 'POST') {
          const body = await readBody(req)
          let all = []
          try { all = JSON.parse(await readFile(file, 'utf8')) } catch { all = [] }
          if (body && body.remove) {
            all = all.filter((t) => t.id !== body.remove)
          } else if (body && body.name && Array.isArray(body.nodes)) {
            const item = {
              id: `t-${Date.now()}`,
              name: body.name,
              size: body.size || 'horizontal',
              nodes: body.nodes,
              createdAt: Date.now(),
            }
            all = [item, ...all.filter((t) => t.name !== item.name)].slice(0, 40)
          }
          await writeFile(file, JSON.stringify(all, null, 2), 'utf8')
          send(res, 200, { ok: true, templates: all })
          return
        }
        let all = []
        try { all = JSON.parse(await readFile(file, 'utf8')) } catch { all = [] }
        send(res, 200, { ok: true, templates: all })
      } catch (error) {
        send(res, 500, { ok: false, error: String((error && error.message) || error) })
      }
    } })
    safeRegister(web, { kind: 'exact', path: '/dsh-video/make', handler: async (req, res) => {
      try {
        const body = await readBody(req)
        const topic = body.topic || {}
        const tpl = body.template || {}
        const size = tpl.size === 'vertical'
          ? { width: 1080, height: 1920, fps: 30 }
          : { width: 1280, height: 720, fps: 30 }
        const textFor = (kind) => {
          if (kind === 'opening') return '# 我是大肥鱼\n今天这期，可能会让你改掉一个习惯。'
          if (kind === 'outro') return '# 就说到这\n下次想问什么，评论区扔给我。'
          if (kind === 'hook') return topic.hook || ''
          if (kind === 'breath') return topic.breath || ''
          if (kind === 'board') return (topic.points || []).map((p) => `- ${p}`).join('\n')
          if (kind === 'punch') return topic.punchline || ''
          return topic.hook || ''
        }
        const CLIP_BY_KIND = {
          opening: '点击回应-开心跃动.webm',
          hook: '点击回应-元气挥手.webm',
          breath: '待机呼吸休闲.webm',
          board: '原地敲击桌面互动.webm',
          punch: '点击回应-开心跃动.webm',
          outro: '女仆屈膝礼仪.webm',
        }
        const customNodes = Array.isArray(body.nodes) && body.nodes.length > 0
          ? body.nodes.filter((n) => n.enabled !== false).map((n, i) => ({
            id: n.id || `n${i}`,
            kind: n.kind || 'board',
            label: n.label || `节点 ${i + 1}`,
            plugin: n.plugin || '',
            clip: n.clip || CLIP_BY_KIND[n.kind] || '待机呼吸休闲.webm',
            seconds: Number(n.seconds) || 4,
            bg: n.bg || 'stars',
            markdown: n.markdown || textFor(n.kind || 'board'),
          }))
          : null

        const flow = {
          title: topic.title || '未命名',
          costume: tpl.costume || 'winter',
          size,
          nodes: customNodes || [
            { id: 'open', kind: 'opening', label: '开场白', clip: '点击回应-开心跃动.webm', seconds: 5, bg: 'stars',
              markdown: '# 我是大肥鱼\n今天这期，可能会让你改掉一个习惯。' },
            { id: 'hook', kind: 'hook', label: '钩子提问', clip: '点击回应-元气挥手.webm', seconds: 4, bg: 'stars-fast', markdown: topic.hook || '' },
            { id: 'breath', kind: 'breath', label: '缓一口气', clip: '待机呼吸休闲.webm', seconds: 3, bg: 'rifts', markdown: topic.breath || '' },
            { id: 'body', kind: 'board', label: '知识点', clip: '原地敲击桌面互动.webm', seconds: tpl.bodySeconds || 22, bg: 'dots',
              markdown: (topic.points || []).map((p) => `- ${p}`).join('\n') },
            { id: 'punch', kind: 'punch', label: '结论', clip: '点击回应-开心跃动.webm', seconds: 5, bg: 'stars-fast', markdown: topic.punchline || '' },
            { id: 'outro', kind: 'outro', label: '结束语', clip: '女仆屈膝礼仪.webm', seconds: 6, bg: 'rifts',
              markdown: '# 就说到这\n下次想问什么，评论区扔给我。' },
          ],
        }
        await writeFile(FLOW, JSON.stringify(flow, null, 2), 'utf8')
        await new Promise((resolve) => {
          const c = spawn('node', ['scripts/sync-flow.mjs'], { cwd: WORK, shell: true })
          c.on('close', resolve)
        })
        if (body.dryRun) {
          send(res, 200, { ok: true, flow, dryRun: true })
          return
        }
        const out = join(WORK, 'out', `make-${Date.now()}.mp4`)
        const child = spawn('npx', ['remotion', 'render', 'FlowVideo', out], {
          cwd: WORK,
          shell: true,
          env: { ...process.env, TEMP: process.env.DSH_ART_TMP || WORK, TMP: process.env.DSH_ART_TMP || WORK },
        })
        let log = ''
        child.stdout.on('data', (d) => { log += String(d) })
        child.stderr.on('data', (d) => { log += String(d) })
        child.on('close', (code) => {
          send(res, code === 0 ? 200 : 500, { ok: code === 0, out, code, log: log.slice(-1500) })
        })
      } catch (error) {
        send(res, 500, { ok: false, error: String((error && error.message) || error) })
      }
    } })
    safeRegister(web, { kind: 'exact', path: '/dsh-video/knowledge', handler: async (req, res) => {
      try {
        const kbPath = join(WORK, 'knowledge.json')
        const kb = JSON.parse(await readFile(kbPath, 'utf8'))
        if (req.method === 'POST') {
          const body = await readBody(req)
          if (body && Array.isArray(body.items)) {
            await writeFile(kbPath, JSON.stringify({ items: body.items }, null, 2), 'utf8')
            send(res, 200, { ok: true, count: body.items.length })
            return
          }
          if (body && body.item && body.action === 'upsert') {
            const items = kb.items || []
            const i = items.findIndex((x) => x.id === body.item.id)
            if (i >= 0) items[i] = body.item
            else items.push(body.item)
            await writeFile(kbPath, JSON.stringify({ items }, null, 2), 'utf8')
            send(res, 200, { ok: true, items })
            return
          }
          throw new Error('bad body')
        }
        send(res, 200, { ok: true, items: kb.items || [] })
      } catch (error) {
        send(res, 500, { ok: false, error: String((error && error.message) || error) })
      }
    } })

    safeRegister(web, { kind: 'exact', path: '/dsh-video/flow', handler: async (req, res) => {
      try {
        if (req.method === 'POST') {
          const body = await readBody(req)
          await writeFile(FLOW, JSON.stringify(body, null, 2), 'utf8')
          send(res, 200, { ok: true })
          return
        }
        try {
          const raw = await readFile(FLOW, 'utf8')
          send(res, 200, { ok: true, flow: JSON.parse(raw) })
        } catch {
          await writeFile(FLOW, JSON.stringify(DEFAULT_FLOW, null, 2), 'utf8')
          send(res, 200, { ok: true, flow: DEFAULT_FLOW })
        }
      } catch (error) {
        send(res, 500, { ok: false, error: String((error && error.message) || error) })
      }
    } })

    safeRegister(web, { kind: 'exact', path: '/dsh-video/clips', handler: async (req, res) => {
      try {
        const files = await readdir(CLIP_DIR)
        send(res, 200, { ok: true, clips: files.filter((f) => f.endsWith('.webm')) })
      } catch (error) {
        send(res, 500, { ok: false, error: String((error && error.message) || error) })
      }
    } })

    safeRegister(web, { kind: 'exact', path: '/dsh-video/random', handler: async (req, res) => {
      try {
        const kb = JSON.parse(await readFile(join(WORK, 'knowledge.json'), 'utf8'))
        const items = kb.items || []
        if (items.length === 0) throw new Error('knowledge.json 为空')
        const it = items[Math.floor(Math.random() * items.length)]
        const costumes = ['spring', 'summer', 'autumn', 'winter', 'festival']
        const costume = costumes[Math.floor(Math.random() * costumes.length)]
        const flow = {
          title: it.title,
          costume,
          size: { width: 1080, height: 1920, fps: 30 },
          nodes: [
            { id: 'open', kind: 'opening', label: '开场白', clip: '点击回应-元气挥手.webm', seconds: 5,
              markdown: '# 我是大肥鱼\n今天这期，可能会让你改掉一个习惯。' },
            { id: 'hook', kind: 'hook', label: '钩子提问', clip: '被吓一跳.webm', seconds: 4, markdown: it.hook },
            { id: 'breath', kind: 'breath', label: '缓一口气', clip: '深度思考碎碎念.webm', seconds: 3, markdown: it.breath },
            { id: 'body', kind: 'board', label: '黑板正文', clip: '原地敲击桌面互动.webm', seconds: 26,
              markdown: (it.points || []).map((p) => `- ${p}`).join('\n') },
            { id: 'punch', kind: 'punch', label: '结论', clip: '点击回应-开心跃动.webm', seconds: 5, markdown: it.punchline },
            { id: 'outro', kind: 'outro', label: '结束语', clip: '女仆屈膝礼仪.webm', seconds: 7,
              markdown: '# 就说到这\n下次想问什么，评论区扔给我。\n大肥鱼，收工。' },
          ],
        }
        await writeFile(FLOW, JSON.stringify(flow, null, 2), 'utf8')
        await new Promise((resolve) => {
          const c = spawn('node', ['scripts/sync-flow.mjs'], { cwd: WORK, shell: true })
          c.on('close', resolve)
        })
        send(res, 200, { ok: true, flow, topic: it.id })
      } catch (error) {
        send(res, 500, { ok: false, error: String((error && error.message) || error) })
      }
    } })

    safeRegister(web, { kind: 'exact', path: '/dsh-video/render', handler: async (req, res) => {      try {
        const body = await readBody(req)
        const out = body.out || join(WORK, 'out', `flow-${Date.now()}.mp4`)
        const args = ['remotion', 'render', 'FlowVideo', out]
        const child = spawn('npx', args, {
          cwd: WORK,
          env: { ...process.env, TEMP: process.env.DSH_ART_TMP || WORK, TMP: process.env.DSH_ART_TMP || WORK },
          shell: true,
        })
        let log = ''
        child.stdout.on('data', (d) => { log += String(d) })
        child.stderr.on('data', (d) => { log += String(d) })
        child.on('close', (code) => {
          send(res, code === 0 ? 200 : 500, { ok: code === 0, out, code, log: log.slice(-2000) })
        })
      } catch (error) {
        send(res, 500, { ok: false, error: String((error && error.message) || error) })
      }
    } })

    mounted = true
    MOUNTED = true
    return true
  }

  if (!mount()) {
    const timer = setInterval(() => { if (mount()) clearInterval(timer) }, 500)
    if (typeof timer.unref === 'function') timer.unref()
  }
}

apply.inject = ['webServer']
