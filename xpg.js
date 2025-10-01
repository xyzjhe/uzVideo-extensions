//@name:[直] 小苹果
//@version:2
//@webSite:http://c.xpgtv.net
//@remark: 修正分类/详情/播放ID判定；兼容多形态播放参数；动态时间戳；避免“播放链接为空”与“not a function”
//@order: B

/***********************
 * 运行期依赖说明:
 * - req: 环境应提供 (支持 req(url,{headers}) 及 req.head(url,{headers,timeout}))
 * - UZUtils: 需要 removeTrailingSlash；若缺失，内置兜底
 * - 各种响应模型类：RepVideoClassList / RepVideoList / RepVideoDetail / RepVideoPlayUrl / RepVideoSubclassList / VideoDetail
 *   若运行环境未注入，则本文件会自动定义最小兼容版本，防止报错。
 ************************/

// -------- 兜底工具/类定义（若运行环境已有则不会覆盖） --------
if (typeof UZUtils === 'undefined') {
  globalThis.UZUtils = {
    removeTrailingSlash(str = '') {
      return str.replace(/\/+$/, '');
    }
  };
}

function ensureClass(name, factory) {
  if (typeof globalThis[name] === 'undefined') {
    globalThis[name] = factory();
  }
}

ensureClass('RepVideoClassList', () => class RepVideoClassList {
  constructor() {
    this.code = 200;
    this.msg = 'success';
    this.data = [];
    this.error = null;
  }
});

ensureClass('RepVideoList', () => class RepVideoList {
  constructor() {
    this.code = 200;
    this.msg = 'success';
    this.data = [];
    this.page = 1;
    this.total = 0;
    this.error = null;
  }
});

ensureClass('RepVideoDetail', () => class RepVideoDetail {
  constructor() {
    this.code = 200;
    this.msg = 'success';
    this.data = null; // VideoDetail
    this.error = null;
  }
});

ensureClass('RepVideoPlayUrl', () => class RepVideoPlayUrl {
  constructor() {
    this.code = 200;
    this.msg = 'success';
    this.data = null; // 播放直链
    this.parse = 0;
    this.headers = {};
    this.error = null;
  }
});

ensureClass('RepVideoSubclassList', () => class RepVideoSubclassList {
  constructor() {
    this.code = 200;
    this.msg = 'success';
    this.data = [];
    this.error = null;
  }
});

ensureClass('VideoDetail', () => class VideoDetail {
  constructor() {
    this.vod_id = '';
    this.vod_name = '';
    this.vod_pic = '';
    this.vod_remarks = '';
    this.vod_year = '';
    this.vod_area = '';
    this.vod_lang = '';
    this.type_name = '';
    this.vod_actor = '';
    this.vod_director = '';
    this.vod_content = '';
    this.vod_play_from = '';
    this.vod_play_url = '';
  }
});

// -------- 配置 --------
const appConfig = {
  _webSite: 'http://c.xpgtv.net',
  get webSite() { return this._webSite; },
  set webSite(v) { this._webSite = v; },
  UA: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/117.0.0.0 Safari/537.36',
  cookie: '',
  headers: {
    'user_id': 'XPGBOX',
    'token2': 'SnAXiSW8vScXE0Z9aDOnK5xffbO75w1+uPom3WjnYfVEA1oWtUdi2Ihy1N8=',
    'version': 'XPGBOX com.phoenix.tv1.5.7',
    'hash': 'd78a',
    'screenx': '2345',
    'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/117.0.0.0 Safari/537.36',
    // 你需要替换为真实 token 或改成动态算法
    'token': 'ElEDlwCVgXcFHFhddiq2JKteHofExRBUrfNlmHrWetU3VVkxnzJAodl52N9EUFS+Dig2A/fBa/V9RuoOZRBjYvI+GW8kx3+xMlRecaZuECdb/3AdGkYpkjW3wCnpMQxf8vVeCz5zQLDr8l8bUChJiLLJLGsI+yiNskiJTZz9HiGBZhZuWh1mV1QgYah5CLTbSz8=',
        'timestamp': '1743060300',
    'screeny': '1065'
  },
  videoHost: 'http://c.xpgtv.net/m3u8',
  maxRetries: 2,
  timeout: 5000
};

// -------- 工具函数 --------
function refreshDynamicHeaders() {
  appConfig.headers.timestamp = Math.floor(Date.now() / 1000).toString();
  // 如果 token 需要随时间戳刷新，这里加入你的生成算法
}

function safeJson(obj) {
  return JSON.stringify(obj);
}

function isSiteUrl(str) {
  if (!str) return false;
  const base = UZUtils.removeTrailingSlash(appConfig.webSite);
  return UZUtils.removeTrailingSlash(str).toLowerCase() === base.toLowerCase();
}

function normalizeArray(arr) {
  return Array.isArray(arr) ? arr : [];
}

function firstNotEmpty(...vals) {
  for (const v of vals) {
    if (v !== undefined && v !== null && v !== '') return v;
  }
  return '';
}

// 从 args 中分离站点与 ID
function extractSiteAndId(args = {}) {
  const site = args.url && args.url.startsWith('http') ? args.url : appConfig.webSite;
  let idCandidate = firstNotEmpty(
    args.id,
    args.vod_id,
    args.playUrl,
    args.link,
    args.rawUrl
  );

  // 如果提供了 url 但不是站点根且不只是 http(s)://host，且包含 /m3u8/ 或 .m3u8，可能就是播放直链
  if (!idCandidate && args.url && args.url.startsWith('http')) {
    if (!isSiteUrl(args.url)) {
      idCandidate = args.url;
    }
  }

  return { site: UZUtils.removeTrailingSlash(site), idCandidate };
}

// 解析播放字段（支持 "清晰度$URL#清晰度2$URL2"）
function parsePlayString(str) {
  if (!str) return '';
  // 取第一段
  const firstSeg = str.split('#')[0];
  if (firstSeg.includes('$')) {
    return firstSeg.split('$').pop();
  }
  return firstSeg;
}

async function httpGetJson(url) {
  refreshDynamicHeaders();
  const pro = await req(url, { headers: appConfig.headers });
  return pro;
}

// -------- 分类列表 --------
async function getClassList(args = {}) {
  const backData = new RepVideoClassList();
  try {
    const webUrl = args.url || appConfig.webSite;
    appConfig.webSite = UZUtils.removeTrailingSlash(webUrl);

    const api = appConfig.webSite + '/api.php/v2.vod/androidtypes';
    const pro = await httpGetJson(api);
    backData.error = pro.error || null;

    const arr = (pro.data && pro.data.data) ? pro.data.data : [];
    backData.data = normalizeArray(arr).map(item => ({
      type_id: item.type_id !== undefined ? String(item.type_id) : '',
      type_name: item.type_name || ''
    }));
  } catch (e) {
    backData.code = 500;
    backData.msg = 'failure';
    backData.error = e.message;
  }
  return safeJson(backData);
}

// -------- 视频列表 --------
async function getVideoList(args = {}) {
  const backData = new RepVideoList();
  try {
    const site = args.url || appConfig.webSite;
    appConfig.webSite = UZUtils.removeTrailingSlash(site);

    const tid = firstNotEmpty(args.mainClassId, args.type_id, args.tid, args.classId);
    if (!tid) {
      backData.code = 400;
      backData.msg = 'missing type id';
      backData.error = '缺少分类ID';
      return safeJson(backData);
    }
    const page = Number(args.page || 1);
    const filter = args.filter || {};

    const params = [];
    params.push(`page=${page}`);
    params.push(`type=${encodeURIComponent(tid)}`);
    if (filter.area) params.push(`area=${encodeURIComponent(filter.area)}`);
    if (filter.year) params.push(`year=${encodeURIComponent(filter.year)}`);

    const url = `${appConfig.webSite}/api.php/v2.vod/androidfilter10086?${params.join('&')}`;
    const pro = await httpGetJson(url);

    const response = pro.data || {};
    const dataArr = (response.data && Array.isArray(response.data)) ? response.data : [];
    backData.data = dataArr.map(item => {
      const v = new VideoDetail();
      v.vod_id = item.id !== undefined ? String(item.id) : '';
      v.vod_name = item.name || '';
      v.vod_pic = item.pic || '';
      v.vod_remarks = item.score || '暂无评分';
      return v;
    });
    backData.page = page;
    backData.total = response.total || 0;
  } catch (e) {
    backData.code = 500;
    backData.msg = 'failure';
    backData.error = '获取列表失败: ' + e.message;
  }
  return safeJson(backData);
}

// -------- 视频详情 --------
async function getVideoDetail(args = {}) {
  const backData = new RepVideoDetail();
  try {
    const site = args.url || appConfig.webSite;
    appConfig.webSite = UZUtils.removeTrailingSlash(site);

    const vid = firstNotEmpty(args.vod_id, args.id);
    if (!vid) {
      backData.code = 400;
      backData.msg = 'missing id';
      backData.error = '缺少视频ID';
      return safeJson(backData);
    }

    const api = `${appConfig.webSite}/api.php/v3.vod/androiddetail2?vod_id=${encodeURIComponent(vid)}`;
    const pro = await httpGetJson(api);
    const data = (pro.data && pro.data.data) ? pro.data.data : {};

    const det = new VideoDetail();
    det.vod_id = String(vid);
    det.vod_name = data.name || '';
    det.vod_pic = data.pic || '';
    det.vod_year = data.year || '';
    det.vod_area = data.area || '';
    det.vod_lang = data.lang || '';
    det.type_name = data.className || '';
    det.vod_actor = data.actor || '';
    det.vod_director = data.director || '';
    det.vod_content = data.content || '';
    det.vod_play_from = '小苹果';
    const urlsArr = (data.urls && Array.isArray(data.urls)) ? data.urls : [];
    det.vod_play_url = urlsArr.map(u => `${u.key}$${u.url}`).join('#');
    backData.data = det;
  } catch (e) {
    backData.code = 500;
    backData.msg = 'failure';
    backData.error = '获取视频详情失败: ' + e.message;
  }
  return safeJson(backData);
}

// -------- 播放地址 --------
async function getVideoPlayUrl(args = {}) {
  const backData = new RepVideoPlayUrl();
  try {
    // 分离站点与候选 ID
    const { site, idCandidate } = extractSiteAndId(args);
    appConfig.webSite = site;

    if (!idCandidate) {
      backData.code = 400;
      backData.msg = 'missing play id';
      backData.error = '播放链接(或ID)为空';
      return safeJson(backData);
    }

    // 解析形如 "清晰度$xxx#清晰度2$yyy"
    let finalMedia = parsePlayString(idCandidate);

    // 如果是 "http...$http..." 这种错误截取，继续 parse
    if (!finalMedia && idCandidate.startsWith('http')) {
      finalMedia = idCandidate;
    }

    // 组装最终 URL
    let finalUrl = finalMedia;
    if (!/^https?:\/\//i.test(finalMedia)) {
      // 认为是纯 ID
      finalUrl = `${appConfig.videoHost.replace(/\/+$/,'')}/${finalMedia}.m3u8`;
    }

    refreshDynamicHeaders();
    const headers = { ...appConfig.headers };

    // 预检（失败不终止，只记录）
    let verified = false;
    try {
      await req.head(finalUrl, { headers, timeout: appConfig.timeout });
      verified = true;
    } catch (e) {
      // 尝试 GET 范围请求（可选，如果环境支持）
      try {
        await req(finalUrl, {
          method: 'GET',
            headers: {
              ...headers,
              Range: 'bytes=0-1023'
            },
            timeout: 4000
        });
        verified = true;
      } catch (e2) {
        // 忽略，仍返回直链
      }
    }

    if (!verified) {
      backData.msg = 'warn: link not verified by HEAD';
    }

    backData.data = finalUrl;
    backData.parse = 0;
    backData.headers = headers;
  } catch (e) {
    backData.code = 500;
    backData.msg = 'failure';
    backData.error = '播放解析失败: ' + e.message;
  }
  return safeJson(backData);
}

// -------- 搜索 --------
async function searchVideo(args = {}) {
  const backData = new RepVideoList();
  try {
    const site = args.url || appConfig.webSite;
    appConfig.webSite = UZUtils.removeTrailingSlash(site);

    const key = args.searchWord || args.keyword || '';
    if (!key) {
      backData.code = 400;
      backData.msg = 'missing keyword';
      backData.error = '缺少搜索关键词';
      return safeJson(backData);
    }
    const page = Number(args.page || 1);
    const api = `${appConfig.webSite}/api.php/v2.vod/androidsearch10086?page=${page}&wd=${encodeURIComponent(key)}`;
    const pro = await httpGetJson(api);
    const response = pro.data || {};
    const dataArr = (response.data && Array.isArray(response.data)) ? response.data : [];
    backData.data = dataArr.map(item => {
      const v = new VideoDetail();
      v.vod_id = item.id !== undefined ? String(item.id) : '';
      v.vod_name = item.name || '';
      v.vod_pic = item.pic || '';
      v.vod_remarks = item.score || '暂无评分';
      return v;
    });
    backData.page = page;
  } catch (e) {
    backData.code = 500;
    backData.msg = 'failure';
    backData.error = '获取搜索结果失败: ' + e.message;
  }
  return safeJson(backData);
}

// -------- 占位子类（无数据） --------
async function getSubclassList() {
  const backData = new RepVideoSubclassList();
  return safeJson(backData);
}

async function getSubclassVideoList() {
  const backData = new RepVideoList();
  return safeJson(backData);
}

// -------- 导出（供 extApp 调用） --------
/*
  约定：
    extApp.getClassList       -> getClassList
    extApp.getVideoList       -> getVideoList
    extApp.getVideoDetail     -> getVideoDetail
    extApp.getVideoPlayUrl    -> getVideoPlayUrl
    extApp.searchVideo        -> searchVideo
    （如果 extApp 还会寻找 getSubclassList 等，也已经保留）
*/
module.exports = {
  getClassList,
  getVideoList,
  getVideoDetail,
  getVideoPlayUrl,
  searchVideo,
  getSubclassList,
  getSubclassVideoList
};
