/**
 * 艺术工坊 · 浏览器半
 * 四个视图：作品 / 链路 / 插件 / 知识库
 * 右侧常驻详情面板：作品的生成链路、插件的默认模板编排。
 */
window.__ModuleLoader__.load({
  id: 'dsh-video-workshop',
  factory: (require) => {
    const React = require('react')
    const h = React.createElement

    const api = async (path, body) => {
      const res = await fetch(path, body
        ? { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }
        : undefined)
      return res.json()
    }

    const fmtSize = (n) => n > 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.round(n / 1024)} KB`
    const fmtMs = (ms) => ms >= 1000 ? `${(ms / 1000).toFixed(1)}s` : `${ms}ms`
    const fmtTime = (t) => {
      const d = new Date(t)
      return `${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
    }

    const TABS = [
      { id: 'works', label: '作品' },
      { id: 'chain', label: '链路' },
      { id: 'plugins', label: '插件' },
      { id: 'assets', label: '素材' },
      { id: 'kb', label: '知识库' },
    ]

    function App() {
      const [tab, setTab] = React.useState('works')
      const [works, setWorks] = React.useState([])
      const [workFilter, setWorkFilter] = React.useState('全部')
      const [openImages, setOpenImages] = React.useState({})
      const [chain, setChain] = React.useState([])
      const [chainType, setChainType] = React.useState('video')
      const [tpls, setTpls] = React.useState([])
      const [assets, setAssets] = React.useState([])
      const [assetGroup, setAssetGroup] = React.useState('全部')
      const [plugRows, setPlugRows] = React.useState([])
      const [plugCat, setPlugCat] = React.useState('全部')
      const [topicSource, setTopicSource] = React.useState('knowledge')
      const [topic, setTopic] = React.useState(null)
      const [testResult, setTestResult] = React.useState(null)
      const [stageSel, setStageSel] = React.useState(null)
      const [genFor, setGenFor] = React.useState(null)
      const [genTpl, setGenTpl] = React.useState({ mode: 'default', size: 'horizontal' })
      const [genNodes, setGenNodes] = React.useState([])
      const [myTemplates, setMyTemplates] = React.useState([])
      const [capLabels, setCapLabels] = React.useState({})
      const [capFilter, setCapFilter] = React.useState('auto')
      const [newTplName, setNewTplName] = React.useState('')
      const [genStatus, setGenStatus] = React.useState('')
      const [stats, setStats] = React.useState([])
      const [kb, setKb] = React.useState([])
      const [tpl, setTpl] = React.useState(null)
      const [selWork, setSelWork] = React.useState(null)
      const [selPlugin, setSelPlugin] = React.useState(null)
      const [kbSel, setKbSel] = React.useState(0)
      const [kbMode, setKbMode] = React.useState('card')
      const [q, setQ] = React.useState('')
      const [findFor, setFindFor] = React.useState(null)
      const [findRows, setFindRows] = React.useState([])
      const [msg, setMsg] = React.useState('')

      React.useEffect(() => {
        api('/dsh-video/works').then((j) => { if (j && j.ok) setWorks(j.packs || []) })
        api('/dsh-video/chain?type=video').then((j) => { if (j && j.ok) { setChain(j.chain || []); setTpls(j.templates || []) } })
        api('/dsh-video/stats').then((j) => { if (j && j.ok) setStats(j.rows || []) })
        api('/dsh-video/knowledge').then((j) => { if (j && j.ok) setKb(j.items || []) })
        api('/dsh-video/default').then((j) => { if (j && j.ok) setTpl(j.template) })
        api('/dsh-video/plugins').then((j) => { if (j && j.ok) { setPlugRows(j.rows || []); setCapLabels(j.capLabels || {}) } })
        api('/dsh-video/assets').then((j) => { if (j && j.ok) setAssets(j.items || []) })
        api('/dsh-video/mytemplates').then((j) => { if (j && j.ok) setMyTemplates(j.templates || []) })
      }, [])

      const switchChain = async (type) => {
        setChainType(type)
        const j = await api('/dsh-video/chain?type=' + encodeURIComponent(type))
        if (j && j.ok) { setChain(j.chain || []); setTpls(j.templates || []) }
      }

      const pullTopic = async (source) => {
        setTopicSource(source)
        const j = await api('/dsh-video/topic?source=' + encodeURIComponent(source))
        if (j && j.ok) setTopic(j.topic)
        else setTopic({ title: '不可用', hook: (j && j.error) || '', points: [], punchline: '' })
      }

      const runTest = async (plugin) => {
        setTestResult({ plugin, loading: true })
        const j = await api('/dsh-video/test?plugin=' + encodeURIComponent(plugin))
        setTestResult(j || { plugin, output: '请求失败' })
      }

      const doFind = async (key) => {
        setFindFor(key)
        const j = await api(`/dsh-video/find?q=${encodeURIComponent(key)}`)
        setFindRows(j && j.ok ? j.rows : [])
      }

      const setDefault = async (row) => {
        const template = {
          name: `${row.plugin} 模板`,
          updatedAt: Date.now(),
          stages: chain.map((c) => ({ label: c.label, plugin: c.plugin === row.plugin ? row.plugin : c.plugin })),
        }
        await api('/dsh-video/default', template)
        setTpl(template)
        setMsg(`已设为默认模板：${row.plugin}`)
      }

      const copyParams = async (w) => {
        const text = JSON.stringify({ work: w.name, dir: w.dirName, kind: w.kind, chain: chain.map((c) => c.plugin) }, null, 2)
        try {
          await navigator.clipboard.writeText(text)
          setMsg(`参数已复制：${w.name}`)
        } catch {
          setMsg('复制失败，浏览器拒绝剪贴板')
        }
      }

      /* ── 顶栏 ── */
      const header = h('header', { className: 'aw-head' },
        h('div', { className: 'aw-brand' },
          h('div', { className: 'aw-logo' }, '艺'),
          h('div', null,
            h('div', { className: 'aw-title' }, '艺术工坊'),
            h('div', { className: 'aw-sub' }, `作品 ${works.length} · 链路 ${chain.length} 节点 · 插件 ${stats.length}`))),
        h('nav', { className: 'aw-seg' },
          TABS.map((t) => h('button', {
            key: t.id, type: 'button', className: 'aw-seg-btn',
            'data-active': tab === t.id ? 'true' : 'false',
            onClick: () => { setTab(t.id); setFindFor(null) },
          }, t.label))),
        h('div', { className: 'aw-actions' },
          h('input', {
            className: 'aw-search',
            placeholder: '搜索插件或作品…',
            value: q,
            onChange: (e) => setQ(e.currentTarget.value),
          })))

      /* ── 作品包 ── */
      const packs = works.filter((w) => workFilter === '全部' || (workFilter === '视频包' ? w.kind === 'video' : w.kind === 'image'))
      const toggleImages = (id) => setOpenImages((m) => ({ ...m, [id]: !m[id] }))

      const workCard = (w) => {
        const imgs = w.images || []
        const opened = !!openImages[w.id]
        const media = w.video
          ? h('video', {
            className: 'aw-media', src: `/dsh-video/asset?path=${encodeURIComponent(w.video.path)}`,
            preload: 'metadata', muted: true, playsInline: true, controls: true,
            onClick: (e) => e.stopPropagation(),
          })
          : imgs[0]
            ? h('img', { className: 'aw-media', src: `/dsh-video/asset?path=${encodeURIComponent(imgs[0].path)}`, alt: w.title })
            : null
        return h('article', {
          key: w.id, className: 'aw-pack',
          'data-active': selWork && selWork.id === w.id ? 'true' : 'false',
        },
        h('div', { className: 'aw-pack-head', onClick: () => setSelWork(w) },
          h('span', { className: 'aw-pack-kind', 'data-kind': w.kind }, w.kind === 'video' ? '视频包' : '图文包'),
          h('b', { className: 'aw-pack-title' }, w.title),
          h('span', { className: 'aw-muted aw-small' }, `${w.dirName} · ${fmtSize(w.size)}`),
          h('span', { className: 'aw-muted aw-small' }, fmtTime(w.mtime))),
        h('div', { className: 'aw-pack-media' }, media),
        imgs.length > 0
          ? h('div', { className: 'aw-pack-fold' },
            h('button', {
              type: 'button', className: 'aw-fold-btn',
              onClick: () => toggleImages(w.id),
            }, opened ? `收起图片 (${imgs.length})` : `展开图片 (${imgs.length})`),
            opened
              ? h('div', { className: 'aw-strip' },
                imgs.map((im) => h('img', {
                  key: im.name, className: 'aw-strip-img',
                  src: `/dsh-video/asset?path=${encodeURIComponent(im.path)}`,
                  alt: im.name, title: im.name,
                })))
              : null)
          : null,
        h('div', { className: 'aw-pack-actions' },
          h('button', { type: 'button', className: 'aw-mini', onClick: () => setSelWork(w) }, '详情'),
          h('button', { type: 'button', className: 'aw-mini', onClick: () => copyParams(w) }, '复制参数'),
          h('button', { type: 'button', className: 'aw-mini aw-mini-primary', onClick: () => setMsg(`已按 ${w.title} 排队模仿生成`) }, '模仿生成')))
      }

      const worksView = h('div', { className: 'aw-works' },
        h('div', { className: 'aw-chips' },
          ['全部', '视频包', '图文包'].map((f) => h('button', {
            key: f, type: 'button', className: 'aw-chip',
            'data-active': workFilter === f ? 'true' : 'false',
            onClick: () => setWorkFilter(f),
          }, f)),
          h('span', { className: 'aw-muted aw-small' }, `共 ${packs.length} 个作品包`)),
        h('div', { className: 'aw-packs' },
          packs.length === 0
            ? h('p', { className: 'aw-empty' }, '还没有作品，先渲染一条。')
            : packs.map(workCard)))


      /* ── 链路时间线 ── */
      const totalMs = chain.reduce((s, c) => s + c.ms, 0) || 1
      const chainView = h('div', { className: 'aw-timeline' },
        h('div', { className: 'aw-chaintabs' },
          [['video', '视频'], ['image', '图文'], ['article', '长图文']].map(([id, label]) => h('button', {
            key: id, type: 'button', className: 'aw-chain-tab',
            'data-active': chainType === id ? 'true' : 'false',
            onClick: () => switchChain(id),
          }, label)),
          h('span', { className: 'aw-muted aw-small' }, (tpls[0] && tpls[0].note) || '')),
        h('div', { className: 'aw-tl-head' },
          h('span', null, `总耗时 ${fmtMs(totalMs)}`),
          h('span', { className: 'aw-muted' }, `总 token ${chain.reduce((s, c) => s + c.tokens, 0).toLocaleString()}`)),
        h('div', { className: 'aw-topicbar' },
          h('span', { className: 'aw-topicbar-label' }, '选题来源'),
          [['knowledge', '本地题库'], ['template', '模板扩写'], ['llm', '大模型']].map(([id, label]) => h('button', {
            key: id, type: 'button', className: 'aw-chip',
            'data-active': topicSource === id ? 'true' : 'false',
            onClick: () => pullTopic(id),
          }, label)),
          topic ? h('span', { className: 'aw-topicbar-result' }, '→ ' + topic.title) : null),
        chain.map((c) => {
          const pct = Math.max(2, (c.ms / totalMs) * 100)
          const heavy = c.ms > totalMs * 0.3
          return h('div', { key: c.key, className: 'aw-tl-row', onClick: () => setStageSel(c), style: { cursor: 'pointer' } },
            h('div', { className: 'aw-tl-label' },
              h('b', null, c.label),
              h('span', null, c.plugin)),
            h('div', { className: 'aw-tl-track' },
              h('div', {
                className: 'aw-tl-bar', 'data-heavy': heavy ? 'true' : 'false',
                style: { width: `${pct}%` },
              }, h('span', null, fmtMs(c.ms)))),
            h('div', { className: 'aw-tl-meta' },
              h('span', null, c.tokens ? `${c.tokens} tk` : '0 tk'),
              h('button', { type: 'button', className: 'aw-find', onClick: () => doFind(c.plugin) }, 'find')),
            h('div', { className: 'aw-tl-role' }, c.role))
        }))

      /* ── 插件统计 ── */
      const plugCats = ['全部', ...Array.from(new Set(plugRows.map((r) => r.cat)))]
      const plugList = (plugCat === '全部' ? plugRows : plugRows.filter((r) => r.cat === plugCat)).filter((r) => !q || r.name.toLowerCase().includes(q.toLowerCase()))
      const rows = stats.filter((r) => plugList.some((p) => p.name === r.plugin) && (!q || r.plugin.toLowerCase().includes(q.toLowerCase())))
      const maxCalls = Math.max(1, ...rows.map((r) => r.calls))
      const pluginsView = h('div', { className: 'aw-plugwrap' },
        h('div', { className: 'aw-chips' }, plugCats.map((c) => h('button', {
          key: c, type: 'button', className: 'aw-chip',
          'data-active': plugCat === c ? 'true' : 'false',
          onClick: () => setPlugCat(c),
        }, c))),
        h('div', { className: 'aw-table' },
        h('div', { className: 'aw-tr aw-th' },
          h('span', null, '插件'), h('span', null, '调用'), h('span', null, '平均耗时'),
          h('span', null, '成功率'), h('span', null, 'Token'), h('span', null, '')),
        rows.map((r) => {
          const rate = r.calls ? Math.round((r.ok / r.calls) * 100) : 0
          return h('div', {
            key: r.plugin,
            className: 'aw-tr', 'data-active': selPlugin && selPlugin.plugin === r.plugin ? 'true' : 'false',
            onClick: () => setSelPlugin(r),
          },
          h('span', { className: 'aw-plugin' },
            h('b', null, r.plugin),
            h('i', { className: 'aw-bar', style: { width: `${(r.calls / maxCalls) * 60}px` } })),
          h('span', null, r.calls),
          h('span', null, fmtMs(r.avgMs)),
          h('span', { 'data-bad': rate < 100 ? 'true' : 'false' }, `${rate}%`),
          h('span', null, r.tokens.toLocaleString()),
          h('span', { className: 'aw-row-actions' },
            h('button', { type: 'button', className: 'aw-mini', onClick: (e) => { e.stopPropagation(); doFind(r.plugin) } }, 'find'),
            h('button', { type: 'button', className: 'aw-mini aw-mini-primary', onClick: (e) => { e.stopPropagation(); setDefault(r) } }, '设为默认')))
        })))

      /* ── 素材库 ── */
      const assetGroups = ['全部', ...Array.from(new Set(assets.map((a) => a.group)))]
      const assetList = assetGroup === '全部' ? assets : assets.filter((a) => a.group === assetGroup)
      const assetCard = (a, i) => {
        const src = `/dsh-video/asset?path=${encodeURIComponent(a.path)}`
        const isImg = a.kind === 'image' || a.kind === 'render' && /\.(png|jpg)$/i.test(a.name)
        return h('article', { key: a.id, className: 'aw-acard' },
          h('div', { className: 'aw-acard-thumb' },
            isImg
              ? h('img', { src, loading: 'lazy', alt: a.name })
              : a.kind === 'font'
                ? h('span', { className: 'aw-afont' }, 'Aa')
                : h('video', { src, muted: true, preload: 'metadata', playsInline: true })),
          h('div', { className: 'aw-acard-body' },
            h('div', { className: 'aw-acard-name' }, a.name.replace(/\.(webm|png|jpg|ttf|mp4)$/i, '')),
            h('div', { className: 'aw-acard-meta' }, `${a.group} · ${fmtSize(a.size)}`)),
          h('div', { className: 'aw-acard-actions' },
            h('button', { type: 'button', className: 'aw-mini', onClick: async () => {
              try { await navigator.clipboard.writeText(a.name); setMsg(`已复制文件名：${a.name}`) } catch { setMsg('复制失败') }
            } }, '复制文件名')))
      }
      const assetsView = h('div', { className: 'aw-assets' },
        h('div', { className: 'aw-chips' },
          assetGroups.map((g) => h('button', {
            key: g, type: 'button', className: 'aw-chip',
            'data-active': assetGroup === g ? 'true' : 'false',
            onClick: () => setAssetGroup(g),
          }, g))),
        h('div', { className: 'aw-agrid' }, assetList.map(assetCard)))
      /* ── 知识库 ── */
      const kbCards = h('div', { className: 'aw-kbgrid' },
        kb.map((it, i) => h('button', {
          key: it.id, type: 'button', className: 'aw-kbcard',
          'data-active': i === kbSel ? 'true' : 'false',
          onClick: () => setKbSel(i),
        },
        h('div', { className: 'aw-kbcard-top' },
          h('span', { className: 'aw-kbno' }, String(i + 1).padStart(2, '0')),
          h('span', { className: 'aw-muted aw-small' }, `${(it.points || []).length} 要点`)),
        h('div', { className: 'aw-kbcard-title' }, it.title),
        h('div', { className: 'aw-kbcard-hook' }, it.hook || ''))))

      const cloudWords = kb.map((it) => ({ id: it.id, text: it.title }))
      const kbCloud = h('div', { className: 'aw-cloud' },
        cloudWords.map((w, i) => {
          const size = 15 + ((i * 7) % 22)
          const colors = ['#8b5cf6', '#22d3ee', '#f59e0b', '#34d399', '#f472b6']
          return h('button', {
            key: w.id, type: 'button', className: 'aw-cloud-word',
            style: { fontSize: `${size}px`, color: colors[i % colors.length], opacity: 0.75 + ((i % 3) * 0.08) },
            onClick: () => { const idx = kb.findIndex((k) => k.id === w.id); setKbSel(idx) },
          }, w.text)
        }))

      const kbDetail = kb[kbSel]
      const kbView = h('div', { className: 'aw-kbwrap' },
        h('div', { className: 'aw-kbtoolbar' },
          h('div', { className: 'aw-toggle' },
            h('button', { type: 'button', 'data-active': kbMode === 'card' ? 'true' : 'false', onClick: () => setKbMode('card') }, '卡片'),
            h('button', { type: 'button', 'data-active': kbMode === 'cloud' ? 'true' : 'false', onClick: () => setKbMode('cloud') }, '云词库'))),
        kbMode === 'card' ? kbCards : kbCloud)

      const defaultNodes = (t) => ([
        { id: 'open', kind: 'opening', label: '开场白', plugin: 'knowledge.json', seconds: 5, enabled: true },
        { id: 'hook', kind: 'hook', label: '钩子提问', plugin: 'knowledge.json', seconds: 4, enabled: true },
        { id: 'breath', kind: 'breath', label: '缓一口气', plugin: 'knowledge.json', seconds: 3, enabled: true },
        { id: 'body', kind: 'board', label: '知识点', plugin: 'dsh-remotion', seconds: 22, enabled: true },
        { id: 'punch', kind: 'punch', label: '结论', plugin: 'knowledge.json', seconds: 5, enabled: true },
        { id: 'outro', kind: 'outro', label: '结束语', plugin: 'dsh-voice', seconds: 6, enabled: true },
      ])

      // 节点类型 → 需要的插件能力
      const KIND_CAP = {
        opening: 'text', hook: 'text', breath: 'text', board: 'text', punch: 'text', outro: 'text',
        tts: 'tts', image: 'image', render: 'render', edit: 'edit', publish: 'publish',
      }
      const KIND_LABEL = {
        opening: '开场文案', hook: '钩子文案', breath: '缓冲文案', board: '知识点文案',
        punch: '结论文案', outro: '收尾文案', tts: '配音', image: '出图',
        render: '画面渲染', edit: '剪辑', publish: '发布',
      }
      const pluginsForKind = (kind) => {
        const cap = capFilter === 'auto' ? (KIND_CAP[kind] || 'text') : capFilter
        const hit = plugRows.filter((p) => (p.caps || []).includes(cap))
        return hit.length > 0 ? hit : plugRows
      }

      const updateGenNode = (i, patch) => {
        const nodes = genNodes.slice()
        nodes[i] = { ...nodes[i], ...patch }
        setGenNodes(nodes)
      }
      const moveGenNode = (i, dir) => {
        const j = i + dir
        if (j < 0 || j >= genNodes.length) return
        const nodes = genNodes.slice()
        const tmp = nodes[i]
        nodes[i] = nodes[j]
        nodes[j] = tmp
        setGenNodes(nodes)
      }

      const saveMyTemplate = async () => {
        const name = newTplName.trim() || (genFor && genFor.title) || '未命名模板'
        const j = await api('/dsh-video/mytemplates', { name, size: genTpl.size, nodes: genNodes })
        if (j && j.ok) {
          setMyTemplates(j.templates || [])
          setNewTplName('')
          setMsg('已存为模板：' + name)
        }
      }
      const loadMyTemplate = (t) => {
        setGenTpl({ ...genTpl, mode: 'custom', size: t.size || 'horizontal' })
        setGenNodes(t.nodes || [])
        setMsg('已载入模板：' + t.name)
      }
      const removeMyTemplate = async (t) => {
        const j = await api('/dsh-video/mytemplates', { remove: t.id })
        if (j && j.ok) setMyTemplates(j.templates || [])
      }

      const startGen = async () => {
        if (!genFor) return
        const useDefault = genTpl.mode === 'default'
        const template = { size: genTpl.size, chain: 'video', name: useDefault ? ((tpl && tpl.name) || '默认模板') : '自定义流程' }
        const body = { topic: genFor, template }
        if (!useDefault) body.nodes = genNodes
        setGenStatus('正在生成，可能需要几分钟…')
        const j = await api('/dsh-video/make', body)
        setGenStatus(j && j.ok ? `生成完成：${j.out}` : `失败：${(j && (j.error || j.log)) || '未知错误'}`.slice(0, 240))
      }
      /* ── 右侧详情 ── */
      let detail = null
      if (stageSel) {
        const cands = plugRows.filter((p) => p.name !== stageSel.plugin)
        detail = h('div', { className: 'aw-detail' },
          h('div', { className: 'aw-detail-head' },
            h('div', { className: 'aw-detail-id' }, '环节 · ' + stageSel.label),
            h('h3', null, stageSel.plugin),
            h('div', { className: 'aw-muted aw-small' },
              stageSel.role + ' · ' + fmtMs(stageSel.ms) + ' · ' + stageSel.tokens + ' tk')),
          h('div', { className: 'aw-detail-label' }, '替换为'),
          cands.map((c) => h('div', { key: c.name, className: 'aw-cand' },
            h('div', { className: 'aw-cand-name' }, c.name),
            h('div', { className: 'aw-cand-role' }, c.cat + ' · ' + (c.note || '')),
            h('div', { className: 'aw-detail-actions' },
              h('button', {
                type: 'button', className: 'aw-btn aw-btn-primary',
                onClick: async () => {
                  const template = {
                    name: stageSel.label + ' → ' + c.name,
                    updatedAt: Date.now(),
                    stages: chain.map((x) => ({ label: x.label, plugin: x.key === stageSel.key ? c.name : x.plugin })),
                  }
                  await api('/dsh-video/default', template)
                  setTpl(template)
                  setStageSel(null)
                  setMsg('已替换：' + stageSel.label + ' → ' + c.name)
                },
              }, '用它')))),
          h('div', { className: 'aw-detail-actions' },
            h('button', { type: 'button', className: 'aw-btn', onClick: () => setStageSel(null) }, '关闭')))
      } else if (findFor) {
        detail = h('div', { className: 'aw-detail' },
          h('div', { className: 'aw-detail-head' },
            h('div', { className: 'aw-detail-id' }, 'FIND'),
            h('h3', null, `替换 ${findFor}`)),
          findRows.length === 0
            ? h('p', { className: 'aw-empty' }, '没找到候选，换个关键词。')
            : findRows.map((c) => h('div', { key: c.name, className: 'aw-cand' },
              h('div', { className: 'aw-cand-name' }, c.name),
              h('div', { className: 'aw-cand-role' }, c.role),
              h('div', { className: 'aw-cand-tags' }, (c.tags || []).map((t) => h('span', { key: t }, t)))),
            ))
      } else if (tab === 'works' && selWork) {
        detail = h('div', { className: 'aw-detail' },
          h('div', { className: 'aw-detail-head' },
            h('div', { className: 'aw-detail-id' }, selWork.kind === 'video' ? 'VIDEO' : 'IMAGE'),
            h('h3', null, selWork.name),
            h('div', { className: 'aw-muted aw-small' }, `${selWork.dirName} · ${fmtSize(selWork.size)}`)),
          h('div', { className: 'aw-detail-label' }, '生成链路'),
          chain.map((c) => h('div', { key: c.key, className: 'aw-chain-row' },
            h('span', { className: 'aw-chain-dot' }),
            h('span', { className: 'aw-chain-label' }, c.label),
            h('span', { className: 'aw-chain-plugin' }, c.plugin),
            h('span', { className: 'aw-muted aw-small' }, `${fmtMs(c.ms)} / ${c.tokens}tk`),
            h('button', { type: 'button', className: 'aw-find', onClick: () => doFind(c.plugin) }, 'find'))),
          h('div', { className: 'aw-detail-actions' },
            h('button', { type: 'button', className: 'aw-btn', onClick: () => copyParams(selWork) }, '复制参数'),
            h('button', { type: 'button', className: 'aw-btn aw-btn-primary', onClick: () => setMsg('已排队模仿生成') }, '模仿生成')))
      } else if (testResult) {
        detail = h('div', { className: 'aw-detail' },
          h('div', { className: 'aw-detail-head' },
            h('div', { className: 'aw-detail-id' }, 'TEST'),
            h('h3', null, testResult.plugin),
            h('div', { className: 'aw-muted aw-small' }, testResult.loading ? '运行中…' : 耗时 )),
          testResult.loading
            ? h('p', { className: 'aw-empty' }, '测试中…')
            : [h('pre', { key: 'o', className: 'aw-pre', 'data-warn': testResult.warn ? 'true' : 'false' }, testResult.output || testResult.error || '无输出'),
                h('div', { key: 'a', className: 'aw-detail-actions' },
                  h('button', { type: 'button', className: 'aw-btn', onClick: () => setTestResult(null) }, '关闭'))])
      } else if (tab === 'plugins') {
        detail = h('div', { className: 'aw-detail' },
          h('div', { className: 'aw-detail-head' },
            h('div', { className: 'aw-detail-id' }, '默认模板'),
            h('h3', null, tpl ? tpl.name : '尚未设置'),
            h('div', { className: 'aw-muted aw-small' }, tpl ? `更新于 ${fmtTime(tpl.updatedAt)}` : '在左侧插件行点「设为默认」')),
          h('div', { className: 'aw-detail-label' }, '编排'),
          (tpl ? tpl.stages : chain).map((s, i) => h('div', { key: `${s.label}-${i}`, className: 'aw-chain-row' },
            h('span', { className: 'aw-chain-dot' }),
            h('span', { className: 'aw-chain-label' }, s.label),
            h('span', { className: 'aw-chain-plugin' }, s.plugin || '—'))))
      } else if (genFor) {
        detail = h('div', { className: 'aw-detail' },
          h('div', { className: 'aw-detail-head' },
            h('div', { className: 'aw-detail-id' }, '生成'),
            h('h3', null, genFor.title),
            h('div', { className: 'aw-muted aw-small' }, '选择用默认模板，还是自己配一套')),
          h('div', { className: 'aw-genopt', 'data-active': genTpl.mode === 'default' ? 'true' : 'false' },
            h('label', null,
              h('input', { type: 'radio', checked: genTpl.mode === 'default', onChange: () => setGenTpl({ ...genTpl, mode: 'default' }) }),
              h('b', null, '使用默认模板'),
              h('span', null, (tpl && tpl.name) || '横版 1280×720 · 冬装 · 22s 正文'))),
          h('div', { className: 'aw-genopt', 'data-active': genTpl.mode === 'custom' ? 'true' : 'false' },
            h('label', null,
              h('input', { type: 'radio', checked: genTpl.mode === 'custom', onChange: () => setGenTpl({ ...genTpl, mode: 'custom' }) }),
              h('b', null, '自定义流程节点')),
            genTpl.mode === 'custom'
              ? h('div', { className: 'aw-genfields' },
                h('div', { className: 'aw-detail-label' }, '画幅'),
                h('div', { className: 'aw-chips' },
                  [['horizontal', '横版'], ['vertical', '竖版']].map(([id, label]) => h('button', {
                    key: id, type: 'button', className: 'aw-chip',
                    'data-active': genTpl.size === id ? 'true' : 'false',
                    onClick: () => setGenTpl({ ...genTpl, size: id }),
                  }, label))),
                h('div', { className: 'aw-detail-label' }, `节点 ${genNodes.filter((n) => n.enabled !== false).length} 个`),
                h('div', { className: 'aw-capbar' },
                  h('span', { className: 'aw-capbar-label' }, '插件筛选'),
                  [['auto', '自动'], ['text', '文案'], ['tts', '配音'], ['image', '出图'], ['render', '渲染'], ['edit', '剪辑'], ['publish', '发布'], ['data', '数据']].map(([id, label]) => h('button', {
                    key: id, type: 'button', className: 'aw-capchip',
                    'data-active': capFilter === id ? 'true' : 'false',
                    onClick: () => setCapFilter(id),
                  }, label))),
                myTemplates.length > 0
                  ? h('div', { className: 'aw-detail-label' }, '我的模板')
                  : null,
                myTemplates.length > 0
                  ? h('div', { className: 'aw-tpllist' },
                    myTemplates.map((t) => h('div', { key: t.id, className: 'aw-tplitem' },
                      h('span', { className: 'aw-tplname', title: t.name }, t.name),
                      h('span', { className: 'aw-muted aw-small' }, `${(t.nodes || []).length} 节点`),
                      h('button', { type: 'button', className: 'aw-mini', onClick: () => loadMyTemplate(t) }, '载入'),
                      h('button', { type: 'button', className: 'aw-mini', onClick: () => removeMyTemplate(t) }, '删'))))
                  : null,
                genNodes.map((n, i) => h('div', { key: n.id, className: 'aw-gcard', 'data-off': n.enabled === false ? 'true' : 'false' },
                  h('div', { className: 'aw-gcard-head' },
                    h('input', {
                      type: 'checkbox', checked: n.enabled !== false,
                      onChange: (e) => updateGenNode(i, { enabled: e.currentTarget.checked }),
                    }),
                    h('span', { className: 'aw-gcard-idx' }, String(i + 1).padStart(2, '0')),
                    h('span', { className: 'aw-gcard-kind' }, KIND_LABEL[n.kind] || n.kind || '文案'),
                    h('span', { className: 'aw-gcard-sec' }, n.seconds + 's'),
                    h('button', { type: 'button', className: 'aw-gnode-btn', onClick: () => moveGenNode(i, -1), title: '上移' }, '↑'),
                    h('button', { type: 'button', className: 'aw-gnode-btn', onClick: () => moveGenNode(i, 1), title: '下移' }, '↓')),
                  h('div', { className: 'aw-gcard-body' },
                    h('label', { className: 'aw-gfield' },
                      h('span', null, '名称'),
                      h('input', {
                        className: 'aw-ginput', value: n.label,
                        onChange: (e) => updateGenNode(i, { label: e.currentTarget.value }),
                      })),
                    h('label', { className: 'aw-gfield' },
                      h('span', null, '时长'),
                      h('input', {
                        className: 'aw-ginput', type: 'number', value: n.seconds,
                        onChange: (e) => updateGenNode(i, { seconds: Number(e.currentTarget.value) }),
                      })),
                    h('label', { className: 'aw-gfield aw-gfield-wide' },
                      h('span', null, '插件'),
                      h('select', {
                        className: 'aw-gselect', value: n.plugin || '',
                        onChange: (e) => updateGenNode(i, { plugin: e.currentTarget.value }),
                      }, pluginsForKind(n.kind).map((p) => h('option', { key: p.name, value: p.name },
                        p.name + '（' + (p.cat || '') + (p.caps && p.caps.length ? ' · ' + p.caps.map((c) => capLabels[c] || c).join('/') : '') + '）'))))))),
                h('div', { className: 'aw-saverow' },
                  h('input', {
                    className: 'aw-tplinput', placeholder: '模板名，留空用选题名',
                    value: newTplName, onChange: (e) => setNewTplName(e.currentTarget.value),
                  }),
                  h('button', { type: 'button', className: 'aw-mini', onClick: saveMyTemplate }, '存为模板')))
              : null),
          genStatus ? h('pre', { className: 'aw-pre' }, genStatus) : null,
          h('div', { className: 'aw-detail-actions' },
            h('button', { type: 'button', className: 'aw-btn aw-btn-primary', onClick: startGen }, '开始生成'),
            h('button', { type: 'button', className: 'aw-btn', onClick: () => { setGenFor(null); setGenStatus('') } }, '取消')))
      } else if (tab === 'kb' && kbDetail) {
        detail = h('div', { className: 'aw-detail' },
          h('div', { className: 'aw-detail-head' },
            h('div', { className: 'aw-detail-id' }, `#${kbDetail.id}`),
            h('h3', null, kbDetail.title),
            h('div', { className: 'aw-muted aw-small' }, kbDetail.hook || '')),
          h('div', { className: 'aw-detail-label' }, '缓冲'),
          h('p', { className: 'aw-text' }, kbDetail.breath || '—'),
          h('div', { className: 'aw-detail-label' }, '要点'),
          h('ol', { className: 'aw-list' }, (kbDetail.points || []).map((p, i) => h('li', { key: i }, p))),
          h('div', { className: 'aw-detail-label' }, '结论'),
          h('p', { className: 'aw-text aw-accent' }, kbDetail.punchline || '—'),
          h('div', { className: 'aw-detail-actions' },
            h('button', { type: 'button', className: 'aw-btn aw-btn-primary', onClick: () => { setGenFor(kbDetail); setGenStatus(''); setGenNodes(defaultNodes(kbDetail)) } }, '用这条生成')))
      } else {
        detail = h('div', { className: 'aw-detail' },
          h('div', { className: 'aw-detail-head' }, h('h3', null, '详情')),
          h('p', { className: 'aw-empty' }, '点一张卡片看详情。'))
      }

      const main = tab === 'works' ? worksView
        : tab === 'chain' ? chainView
          : tab === 'plugins' ? pluginsView
            : tab === 'assets' ? assetsView
              : kbView

      return h('div', { className: 'aw' },
        header,
        msg ? h('div', { className: 'aw-msg' }, msg) : null,
        h('div', { className: 'aw-body' },
          h('main', { className: 'aw-main' }, main),
          detail))
    }

    const CSS = `
.aw{display:flex;flex-direction:column;height:100%;min-height:0;font-size:12px;color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-layer-1)}
.aw-head{display:flex;align-items:center;gap:16px;padding:12px 18px;border-bottom:1px solid var(--dsw-alias-border-l1)}
.aw-brand{display:flex;align-items:center;gap:10px}
.aw-logo{width:30px;height:30px;border-radius:9px;display:grid;place-items:center;font-size:14px;font-weight:700;color:#fff;background:linear-gradient(135deg,#8b5cf6,#22d3ee)}
.aw-title{font-size:13.5px;font-weight:600}
.aw-sub{font-size:10.5px;color:var(--dsw-alias-label-tertiary);margin-top:2px}
.aw-seg{display:flex;gap:2px;padding:2px;border-radius:8px;background:var(--dsw-alias-bg-layer-2);margin-left:auto}
.aw-seg-btn{height:26px;padding:0 14px;border:0;border-radius:6px;background:0 0;color:var(--dsw-alias-label-tertiary);font:inherit;font-size:11.5px;cursor:pointer}
.aw-seg-btn[data-active=true]{background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);font-weight:600;box-shadow:0 1px 3px rgba(0,0,0,.12)}
.aw-actions{display:flex;gap:6px}
.aw-search{height:28px;width:180px;padding:0 10px;border:1px solid var(--dsw-alias-border-l2);border-radius:999px;background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary);font:inherit;font-size:11.5px}
.aw-msg{padding:6px 18px;font-size:11px;color:var(--dsw-alias-label-tertiary);border-bottom:1px solid var(--dsw-alias-border-l1)}
.aw-body{flex:1;min-height:0;display:flex}
.aw-main{flex:1;min-width:0;overflow:auto;padding:16px 18px}
.aw-detail{width:392px;flex:none;border-left:1px solid var(--dsw-alias-border-l1);overflow:auto;padding:16px;display:flex;flex-direction:column;gap:10px;background:var(--dsw-alias-bg-layer-2)}
.aw-detail-head{display:flex;flex-direction:column;gap:4px;padding-bottom:12px;border-bottom:1px solid var(--dsw-alias-border-l1)}
.aw-detail-id{font-size:10px;letter-spacing:1.5px;color:#8b5cf6}
.aw-detail-head h3{margin:0;font-size:14px;font-weight:600;word-break:break-all}
.aw-detail-label{font-size:10.5px;letter-spacing:1px;color:var(--dsw-alias-label-tertiary);margin-top:4px}
.aw-detail-actions{display:flex;gap:6px;margin-top:auto;padding-top:12px}
.aw-btn{height:28px;padding:0 12px;border:1px solid var(--dsw-alias-border-l2);border-radius:7px;background:0 0;color:var(--dsw-alias-label-secondary);font:inherit;font-size:11px;cursor:pointer}
.aw-btn-primary{border-color:#8b5cf6;color:#8b5cf6;font-weight:600}
.aw-works{display:flex;flex-direction:column}
.aw-packs{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:14px}
.aw-pack{display:flex;flex-direction:column;border:1px solid var(--dsw-alias-border-l1);border-radius:12px;background:var(--dsw-alias-bg-layer-2);overflow:hidden}
.aw-pack[data-active=true]{border-color:#8b5cf6;box-shadow:0 0 0 1px #8b5cf6 inset}
.aw-pack-head{display:flex;align-items:center;gap:8px;padding:10px 12px;border-bottom:1px solid var(--dsw-alias-border-l1);cursor:pointer;flex-wrap:wrap}
.aw-pack-kind{font-size:9.5px;padding:1px 7px;border-radius:999px;background:rgba(139,92,246,.16);color:#a78bfa}
.aw-pack-kind[data-kind=image]{background:rgba(245,158,11,.16);color:#f59e0b}
.aw-pack-title{font-size:12.5px;font-weight:600}
.aw-pack-media{background:#000;display:grid;place-items:center;min-height:150px}
.aw-media{width:100%;max-height:230px;object-fit:contain;display:block}
.aw-pack-fold{padding:8px 12px;border-top:1px solid var(--dsw-alias-border-l1)}
.aw-fold-btn{border:0;background:0 0;color:var(--dsw-alias-label-tertiary);font:inherit;font-size:10.5px;cursor:pointer;padding:0}
.aw-fold-btn:hover{color:#8b5cf6}
.aw-strip{display:flex;gap:6px;overflow-x:auto;padding-top:8px}
.aw-strip-img{height:64px;border-radius:6px;border:1px solid var(--dsw-alias-border-l1);object-fit:cover;flex:none}
.aw-pack-actions{display:flex;gap:6px;padding:10px 12px;border-top:1px solid var(--dsw-alias-border-l1)}
.aw-pack-actions .aw-mini{flex:1}.aw-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:14px}
.aw-card{position:relative;display:flex;flex-direction:column;border:1px solid var(--dsw-alias-border-l1);border-radius:12px;background:var(--dsw-alias-bg-layer-2);overflow:hidden;cursor:pointer;transition:transform .16s,border-color .16s}
.aw-card:hover{transform:translateY(-2px);border-color:#8b5cf6}
.aw-card[data-active=true]{border-color:#8b5cf6;box-shadow:0 0 0 1px #8b5cf6 inset}
.aw-thumb{height:104px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;background:linear-gradient(135deg,rgba(139,92,246,.22),rgba(34,211,238,.14))}
.aw-thumb[data-kind=image]{background:linear-gradient(135deg,rgba(245,158,11,.2),rgba(52,211,153,.14))}
.aw-thumb-icon{font-size:24px;color:#fff;opacity:.9}
.aw-thumb-name{font-size:10.5px;color:rgba(255,255,255,.72);max-width:88%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.aw-card-body{padding:10px 12px;display:flex;flex-direction:column;gap:5px}
.aw-card-row{display:flex;justify-content:space-between;align-items:center}
.aw-tag{font-size:10px;padding:1px 7px;border-radius:999px;background:rgba(139,92,246,.16);color:#a78bfa}
.aw-muted{color:var(--dsw-alias-label-tertiary)}
.aw-small{font-size:10.5px}
.aw-card-actions{display:flex;gap:6px;padding:0 12px 12px;opacity:0;transition:opacity .16s}
.aw-card:hover .aw-card-actions,.aw-card[data-active=true] .aw-card-actions{opacity:1}
.aw-mini{flex:1;height:26px;border:1px solid var(--dsw-alias-border-l2);border-radius:7px;background:0 0;color:var(--dsw-alias-label-secondary);font:inherit;font-size:10.5px;cursor:pointer}
.aw-mini-primary{border-color:#8b5cf6;color:#8b5cf6;font-weight:600}
.aw-timeline{display:flex;flex-direction:column;gap:10px}
.aw-chaintabs{display:flex;gap:6px;align-items:center;margin-bottom:4px}.aw-chain-tab{height:24px;padding:0 12px;border:1px solid var(--dsw-alias-border-l1);border-radius:999px;background:0 0;color:var(--dsw-alias-label-tertiary);font:inherit;font-size:11px;cursor:pointer}.aw-chain-tab[data-active=true]{border-color:#8b5cf6;color:#8b5cf6;background:rgba(139,92,246,.12)}.aw-tl-head{display:flex;justify-content:space-between;font-size:11.5px;color:var(--dsw-alias-label-secondary);padding-bottom:6px;border-bottom:1px solid var(--dsw-alias-border-l1)}
.aw-tl-row{display:grid;grid-template-columns:130px 1fr 90px;gap:10px;align-items:center}
.aw-tl-label{display:flex;flex-direction:column;gap:2px}
.aw-tl-label b{font-size:12px;font-weight:600}
.aw-tl-label span{font-size:10px;color:var(--dsw-alias-label-tertiary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.aw-tl-track{height:26px;border-radius:6px;background:var(--dsw-alias-bg-layer-2);overflow:hidden}
.aw-tl-bar{height:100%;border-radius:6px;background:linear-gradient(90deg,#8b5cf6,#22d3ee);display:flex;align-items:center;justify-content:flex-end;padding-right:8px;font-size:10px;color:#fff;min-width:44px}
.aw-tl-bar[data-heavy=true]{background:linear-gradient(90deg,#f59e0b,#ef4444)}
.aw-tl-select{height:22px;max-width:150px;border:1px solid var(--dsw-alias-border-l2);border-radius:5px;background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);font:inherit;font-size:10px;padding:0 4px;cursor:pointer;text-overflow:ellipsis}.aw-tl-meta{display:flex;align-items:center;gap:8px;justify-content:flex-end;font-size:10.5px;color:var(--dsw-alias-label-tertiary)}
.aw-tl-role{grid-column:2 / 4;font-size:10px;color:var(--dsw-alias-label-tertiary);margin-top:-6px}
.aw-find{height:20px;padding:0 8px;border:1px solid var(--dsw-alias-border-l2);border-radius:999px;background:0 0;color:var(--dsw-alias-label-tertiary);font:inherit;font-size:10px;cursor:pointer}
.aw-find:hover{border-color:#8b5cf6;color:#8b5cf6}
.aw-table{display:flex;flex-direction:column;border:1px solid var(--dsw-alias-border-l1);border-radius:10px;overflow:hidden}
.aw-tr{display:grid;grid-template-columns:1fr 60px 80px 60px 70px 150px;gap:8px;align-items:center;padding:9px 14px;font-size:11.5px;border-top:1px solid var(--dsw-alias-border-l1);cursor:pointer}
.aw-tr:first-child{border-top:0}
.aw-tr.aw-th{background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-tertiary);font-size:10.5px;cursor:default}
.aw-tr[data-active=true]{background:rgba(139,92,246,.08)}
.aw-plugin{display:flex;align-items:center;gap:8px;min-width:0}
.aw-plugin b{font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.aw-bar{display:block;height:4px;border-radius:2px;background:#8b5cf6;opacity:.55}
.aw-row-actions{display:flex;gap:6px}
.aw-row-actions .aw-mini{flex:1}
.aw-tr span[data-bad=true]{color:#f59e0b}
.aw-kbwrap{display:flex;flex-direction:column;gap:12px}
.aw-kbtoolbar{display:flex;justify-content:flex-end}
.aw-toggle{display:flex;gap:2px;padding:2px;border-radius:8px;background:var(--dsw-alias-bg-layer-2)}
.aw-toggle button{height:24px;padding:0 12px;border:0;border-radius:6px;background:0 0;color:var(--dsw-alias-label-tertiary);font:inherit;font-size:11px;cursor:pointer}
.aw-toggle button[data-active=true]{background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);font-weight:600}
.aw-kbgrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:12px}
.aw-kbcard{display:flex;flex-direction:column;gap:7px;padding:14px;border:1px solid var(--dsw-alias-border-l1);border-radius:12px;background:var(--dsw-alias-bg-layer-2);color:inherit;font:inherit;text-align:left;cursor:pointer}
.aw-kbcard:hover{border-color:#8b5cf6}
.aw-kbcard[data-active=true]{border-color:#8b5cf6;background:var(--dsw-alias-bg-layer-1)}
.aw-kbcard-top{display:flex;justify-content:space-between}
.aw-kbno{font-size:10px;letter-spacing:2px;color:#8b5cf6;font-weight:700}
.aw-kbcard-title{font-size:13px;font-weight:600;line-height:1.4}
.aw-kbcard-hook{font-size:11px;color:var(--dsw-alias-label-tertiary);line-height:1.5;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.aw-cloud{display:flex;flex-wrap:wrap;gap:12px 18px;align-items:center;justify-content:center;padding:26px 10px;border:1px solid var(--dsw-alias-border-l1);border-radius:14px;background:radial-gradient(circle at 50% 45%,rgba(139,92,246,.10),transparent 70%)}
.aw-cloud-word{border:0;background:0 0;font-family:inherit;font-weight:700;cursor:pointer;line-height:1.1;transition:transform .15s,opacity .15s}
.aw-cloud-word:hover{transform:scale(1.08);opacity:1!important}
.aw-plugwrap{display:flex;flex-direction:column;gap:10px}
.aw-chips{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px}
.aw-chip{height:24px;padding:0 12px;border:1px solid var(--dsw-alias-border-l1);border-radius:999px;background:0 0;color:var(--dsw-alias-label-tertiary);font:inherit;font-size:11px;cursor:pointer}
.aw-chip[data-active=true]{border-color:#8b5cf6;color:#8b5cf6;background:rgba(139,92,246,.12)}
.aw-assets{display:flex;flex-direction:column}
.aw-agrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:12px}
.aw-acard{display:flex;flex-direction:column;border:1px solid var(--dsw-alias-border-l1);border-radius:10px;overflow:hidden;background:var(--dsw-alias-bg-layer-2)}
.aw-acard-thumb{height:100px;display:grid;place-items:center;background:linear-gradient(135deg,rgba(139,92,246,.14),rgba(34,211,238,.10));overflow:hidden}
.aw-acard-thumb img,.aw-acard-thumb video{max-width:100%;max-height:100%;object-fit:contain;display:block}
.aw-afont{font-size:30px;font-weight:700;color:#a78bfa}
.aw-acard-body{padding:8px 10px;display:flex;flex-direction:column;gap:3px}
.aw-acard-name{font-size:11.5px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.aw-acard-meta{font-size:10px;color:var(--dsw-alias-label-tertiary)}
.aw-acard-actions{padding:0 10px 10px;display:flex;gap:6px}
.aw-acard-actions .aw-mini{flex:1}.aw-genopt{display:flex;flex-direction:column;gap:6px;padding:10px;border:1px solid var(--dsw-alias-border-l1);border-radius:9px;background:var(--dsw-alias-bg-layer-1)}.aw-genopt[data-active=true]{border-color:#8b5cf6}.aw-genopt label{display:flex;align-items:center;gap:8px;cursor:pointer}.aw-genopt label b{font-size:12px}.aw-genopt label span{font-size:10.5px;color:var(--dsw-alias-label-tertiary)}.aw-genfields{display:flex;flex-direction:column;gap:4px;margin-top:6px}.aw-gnode{display:grid;grid-template-columns:14px 1fr 52px 120px 40px 20px 20px;gap:4px;align-items:center;padding:4px 0}.aw-gnode[data-off=true]{opacity:.45}.aw-gnode-label{height:24px;padding:0 6px;border:1px solid var(--dsw-alias-border-l2);border-radius:5px;background:var(--dsw-alias-bg-layer-2);color:inherit;font:inherit;font-size:11px;min-width:0}.aw-gnode-cap{font-size:9.5px;color:#8b5cf6;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.aw-gnode-plugin{height:24px;border:1px solid var(--dsw-alias-border-l2);border-radius:5px;background:var(--dsw-alias-bg-layer-2);color:inherit;font-size:9.5px;min-width:0;width:120px}.aw-gnode-sec{height:24px;width:44px;border:1px solid var(--dsw-alias-border-l2);border-radius:5px;background:var(--dsw-alias-bg-layer-2);color:inherit;font-size:10.5px;text-align:center}.aw-gnode-btn{height:22px;border:1px solid var(--dsw-alias-border-l2);border-radius:4px;background:0 0;color:var(--dsw-alias-label-tertiary);cursor:pointer;font-size:10px;padding:0}.aw-capbar{display:flex;gap:4px;flex-wrap:wrap;margin:2px 0 6px}
.aw-capbar-label{font-size:10px;color:var(--dsw-alias-label-tertiary);margin-right:2px}
.aw-capchip{height:20px;padding:0 8px;border:1px solid var(--dsw-alias-border-l1);border-radius:999px;background:0 0;color:var(--dsw-alias-label-tertiary);font:inherit;font-size:10px;cursor:pointer}
.aw-capchip[data-active=true]{border-color:#8b5cf6;color:#8b5cf6;background:rgba(139,92,246,.12)}
.aw-gcard{display:flex;flex-direction:column;gap:6px;padding:8px 10px;margin-bottom:6px;border:1px solid var(--dsw-alias-border-l1);border-radius:8px;background:var(--dsw-alias-bg-layer-2)}
.aw-gcard[data-off=true]{opacity:.45}
.aw-gcard-head{display:flex;align-items:center;gap:8px}
.aw-gcard-idx{font-size:10px;color:#8b5cf6;letter-spacing:1px}
.aw-gcard-kind{font-size:11px;font-weight:600;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.aw-gcard-sec{font-size:10.5px;color:var(--dsw-alias-label-tertiary)}
.aw-gcard-body{display:grid;grid-template-columns:1fr 68px;gap:6px}
.aw-gfield{display:flex;flex-direction:column;gap:3px;min-width:0}
.aw-gfield>span{font-size:9.5px;color:var(--dsw-alias-label-tertiary)}
.aw-gfield-wide{grid-column:1 / -1}
.aw-ginput,.aw-gselect{height:26px;padding:0 7px;border:1px solid var(--dsw-alias-border-l2);border-radius:6px;background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);font:inherit;font-size:11px;width:100%;min-width:0;box-sizing:border-box;text-overflow:ellipsis}
.aw-gselect{cursor:pointer}.aw-tpllist{display:flex;flex-direction:column;gap:4px;margin:2px 0 6px}.aw-tplitem{display:grid;grid-template-columns:1fr 60px 44px 34px;gap:6px;align-items:center;padding:5px 8px;border:1px solid var(--dsw-alias-border-l1);border-radius:6px;background:var(--dsw-alias-bg-layer-2)}.aw-tplname{font-size:11px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.aw-tplitem .aw-mini{height:22px;font-size:10px;padding:0}.aw-saverow{display:flex;gap:6px;margin-top:8px}.aw-tplinput{flex:1;height:26px;padding:0 8px;border:1px solid var(--dsw-alias-border-l2);border-radius:6px;background:var(--dsw-alias-bg-layer-2);color:inherit;font:inherit;font-size:11px}.aw-saverow .aw-mini{flex:0 0 82px;height:26px}.aw-pre{margin:0;padding:12px;border:1px solid var(--dsw-alias-border-l1);border-radius:8px;background:var(--dsw-alias-bg-layer-1);font-family:Consolas,monospace;font-size:11px;line-height:1.7;white-space:pre-wrap;color:var(--dsw-alias-label-secondary)}.aw-pre[data-warn=true]{border-color:rgba(245,158,11,.5);color:#f59e0b}.aw-topicbar{display:flex;align-items:center;gap:6px;flex-wrap:wrap;padding:8px 0}.aw-topicbar-label{font-size:10.5px;color:var(--dsw-alias-label-tertiary);margin-right:2px}.aw-topicbar-result{font-size:11px;color:#8b5cf6;font-weight:600}.aw-empty{padding:18px 0;color:var(--dsw-alias-label-tertiary)}
.aw-text{margin:0;font-size:12px;line-height:1.7;color:var(--dsw-alias-label-secondary)}
.aw-accent{color:#8b5cf6;font-weight:600}
.aw-list{margin:0;padding-left:18px;font-size:12px;line-height:1.75;color:var(--dsw-alias-label-secondary)}
.aw-chain-row{display:grid;grid-template-columns:10px 52px 1fr auto auto;gap:7px;align-items:center;font-size:11px}
.aw-chain-dot{width:7px;height:7px;border-radius:50%;background:#8b5cf6}
.aw-chain-label{color:var(--dsw-alias-label-secondary);font-weight:600}
.aw-chain-plugin{color:var(--dsw-alias-label-tertiary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.aw-cand{display:flex;flex-direction:column;gap:3px;padding:10px;border:1px solid var(--dsw-alias-border-l1);border-radius:9px;background:var(--dsw-alias-bg-layer-1)}
.aw-cand-name{font-size:12px;font-weight:600}
.aw-cand-role{font-size:10.5px;color:var(--dsw-alias-label-tertiary)}
.aw-cand-tags{display:flex;gap:5px;flex-wrap:wrap;margin-top:2px}
.aw-cand-tags span{font-size:9.5px;padding:1px 7px;border-radius:999px;background:rgba(139,92,246,.14);color:#a78bfa}
`

    function Icon(props) {
      const s = props.size || 18
      return h('svg', { width: s, height: s, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.5 },
        h('circle', { cx: 12, cy: 12, r: 8.5 }),
        h('path', { d: 'M12 3.5a8.5 8.5 0 0 1 0 17' }),
        h('path', { d: 'M8.5 8.5h4a2 2 0 0 1 0 4h-4v3' }))
    }

    function apply(ctx) {
      ctx.effect(() => {
        const style = document.createElement('style')
        style.setAttribute('data-plugin', 'dsh-video-workshop')
        style.textContent = CSS
        document.head.appendChild(style)
        return () => style.remove()
      }, 'art-workshop: styles')

      ctx.inject(['slots'], (slotsCtx) => {
        const slots = slotsCtx.slots
        const a = slots.inject('sidebar.panellist', () => slots.register({
          name: 'sidebar.panellist', id: 'video-workshop', order: 35, label: () => '艺术工坊',
        }, Icon))
        const b = slots.inject('main', () => slots.register({ name: 'main', key: 'video-workshop' }, App))
        return () => { a(); b() }
      })
    }

    return { name: 'dsh-video-workshop', inject: [], apply }
  },
})
