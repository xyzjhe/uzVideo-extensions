




// ---------- 兜底类（若运行环境提供这些类则不会覆盖） ----------
(function ensureModels() {
  function define(name, ctor) {
    if (typeof globalThis[name] === 'undefined') {
      globalThis[name] = ctor;
    }
  }
  define('RepVideoClassList', function() {
    return function RepVideoClassList() {
      this.data = [];
      this.error = null;
    };
  });
  define('RepVideoList', function() {
    return function RepVideoList() {
      this.data = [];
      this.page = 1;
      this.total = 0;
      this.error = null;
    };
  });
  define('RepVideoDetail', function() {
    return function RepVideoDetail() {
      this.data = null;
      this.error = null;
    };
  });
  define('RepVideoPlayUrl', function() {
    return function RepVideoPlayUrl() {
      this.data = null;
      this.parse = 0;
      this.headers = {};
      this.error = null;
    };
  });
  define('RepVideoSubclassList', function() {
    return function RepVideoSubclassList() {
      this.data = [];
      this.error = null;
    };
  });
  define('VideoDetail', function() {
    return function VideoDetail() {
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
    };
  });
  if (typeof UZUtils === 'undefined') {
    globalThis.UZUtils = {
      removeTrailingSlash(str = '') {
        return str.replace(/\/+$/, '');
      }
    };
  }
})();

// ---------- 配置 ----------
const appConfig = {
  _webSite: 'http://c.xpgtv.net',
  get webSite() { return this._webSite; },
  set webSite(v) { this._webSite = v; },
  headers: {
    'user_id': 'XPGBOX',
    'token2': 'SnAXiSW8vScXE0Z9aDOnK5xffbO75w1+uPom3WjnYfVEA1oWtUdi2Ihy1N8=',
    'version': 'XPGBOX com.phoenix.tv1.5.7',
    'hash': 'd78a',
    'screenx': '2345',
    'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/117.0.0.0 Safari/537.36',
    // 请替换为完整 token
    'token': 'ElEDlwCVgXcFHFhddiq2JKteHofExRBUrfNlmHrWetU3VVkxnzJAodl52N9EUFS+Dig2A/fBa/V9RuoOZRBjYvI+GW8kx3+xMlRecaZuECdb/3AdGkYpkjW3wCnpMQxf8vVeCz5zQLDr8l8bUChJiLLJLGsI+yiNskiJTZz9HiGBZhZuWh1mV1QgYah5CLTbSz8=',
    'timestamp': '1743060300',
    'screeny': '1065'
  },
  videoHost: 'http://c.xpgtv.net/m3u8',
  maxRetries: 3,
  timeout: 5000
};

function refreshTimestamp() {
  // 如果想保持原逻辑静态，可注释此行
  appConfig.headers.timestamp = Math.floor(Date.now() / 1000).toString();
}

function safeArr(a) { return Array.isArray(a) ? a : []; }

function firstNonEmpty(...vals) {
  for (const v of vals) {
    if (v !== undefined && v !== null && v !== '') return v;
  }
  return '';
}

function parseFirstPlaySeg(str) {
  if (!str) return '';
  // 取第一段
  let first = str.split('#')[0];
  if (first.includes('$')) {
    first = first.split('$').pop();
  }
  return first;
}

function isFullUrl(s) {
  return typeof s === 'string' && /^https?:\/\//i.test(s);
}

// ---------- 分类 (原 home) ----------
async function getClassList(args = {}) {
  const backData = new RepVideoClassList();
  try {
    const site = args.url || appConfig.webSite;
    appConfig.webSite = UZUtils.removeTrailingSlash(site);
    refreshTimestamp();

    const url = appConfig.webSite + '/api.php/v2.vod/androidtypes';
    const pro = await req(url, { headers: appConfig.headers });
    backData.error = pro.error || null;

    const raw = pro.data && pro.data.data ? pro.data.data : [];
    backData.data = safeArr(raw).map(it => ({
      type_id: it.type_id !== undefined ? String(it.type_id) : '',
      type_name: it.type_name || ''
    }));
  } catch (e) {
    backData.error = e.message;
  }
  return JSON.stringify(backData);
}

// ---------- 视频列表 (原 category) ----------
async function getVideoList(args = {}) {
  const backData = new RepVideoList();
  try {
    const site = args.url || appConfig.webSite;
    appConfig.webSite = UZUtils.removeTrailingSlash(site);
    refreshTimestamp();

    const tid = firstNonEmpty(args.mainClassId, args.type_id, args.id);
    if (!tid) {
      backData.error = '缺少分类ID';
      return JSON.stringify(backData);
    }

    const page = args.page || 1;
    const filter = args.filter || {};
    const params = [];
    params.push(`page=${page}`);
    params.push(`type=${encodeURIComponent(tid)}`);
    if (filter.area) params.push(`area=${encodeURIComponent(filter.area)}`);
    if (filter.year) params.push(`year=${encodeURIComponent(filter.year)}`);

    const listUrl = appConfig.webSite + '/api.php/v2.vod/androidfilter10086?' + params.join('&');
    const pro = await req(listUrl, { headers: appConfig.headers });
    const resp = pro.data || {};
    const rows = resp.data && Array.isArray(resp.data) ? resp.data : [];

    backData.data = rows.map(item => {
      const v = new VideoDetail();
      v.vod_id = item.id !== undefined ? String(item.id) : '';
      v.vod_name = item.name || '';
      v.vod_pic = item.pic || '';
      v.vod_remarks = item.score || '暂无评分';
      return v;
    });
    backData.page = page;
    backData.total = resp.total || 0;
  } catch (e) {
    backData.error = '获取列表失败～' + e.message;
  }
  return JSON.stringify(backData);
}

// ---------- 视频详情 (原 detail) ----------
async function getVideoDetail(args = {}) {
  const backData = new RepVideoDetail();
  try {
    const site = args.url || appConfig.webSite;
    appConfig.webSite = UZUtils.removeTrailingSlash(site);
    refreshTimestamp();

    const id = firstNonEmpty(args.vod_id, args.id);
    if (!id) {
      backData.error = '缺少视频ID';
      return JSON.stringify(backData);
    }

    const detUrl = appConfig.webSite + `/api.php/v3.vod/androiddetail2?vod_id=${encodeURIComponent(id)}`;
    const pro = await req(detUrl, { headers: appConfig.headers });
    const data = pro.data && pro.data.data ? pro.data.data : {};

    const det = new VideoDetail();
    det.vod_id = String(id);
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
    const urlsArr = data.urls && Array.isArray(data.urls) ? data.urls : [];
    det.vod_play_url = urlsArr.map(u => `${u.key}$${u.url}`).join('#');

    backData.data = det;
  } catch (e) {
    backData.error = '获取视频详情失败' + e.message;
  }
  return JSON.stringify(backData);
}

// ---------- 播放直链 (原 play) ----------
async function getVideoPlayUrl(args = {}) {
  const backData = new RepVideoPlayUrl();
  try {
    const site = args.site || args.base || args.url || appConfig.webSite;
    // 仅当是完整站点 URL 才更新全局
    if (isFullUrl(site)) {
      appConfig.webSite = UZUtils.removeTrailingSlash(site);
    }
    refreshTimestamp();

    // 多字段尝试
    let rawCandidate = firstNonEmpty(
      args.id,
      args.vod_id,
      args.playUrl,
      args.link,
      args.rawUrl
    );

    // 如果没取到并且 args.url 不是纯站点且包含 .m3u8，尝试用它
    if (!rawCandidate && args.url && !args.url.endsWith('//') && args.url.includes('.m3u8')) {
      rawCandidate = args.url;
    }

    // 支持 "清晰度$URL#清晰度2$URL2"
    rawCandidate = parseFirstPlaySeg(rawCandidate);

    if (!rawCandidate) {
      backData.error = '播放链接(或ID)为空';
      return JSON.stringify(backData);
    }

    let finalUrl = rawCandidate;
    if (!isFullUrl(finalUrl)) {
      finalUrl = appConfig.videoHost.replace(/\/+$/,'') + `/${finalUrl}.m3u8`;
    }

    const headers = appConfig.headers;
    // 原逻辑: HEAD 验证，失败重试
    let ok = false;
    for (let i = 0; i < appConfig.maxRetries; i++) {
      try {
        await req.head(finalUrl, { headers, timeout: appConfig.timeout });
        ok = true;
        break;
      } catch (err) {
        await new Promise(r => setTimeout(r, 1000 * (i + 1)));
        if (i === appConfig.maxRetries - 1) {
          // 最后一次失败，仍然返回直链但记录错误
          backData.error = '播放链接验证失败(继续返回直链)';
        }
      }
    }

    backData.data = finalUrl;
    backData.parse = 0;
    backData.headers = headers;
  } catch (e) {
    backData.error = '播放解析异常: ' + e.message;
  }
  return JSON.stringify(backData);
}

// ---------- 搜索 (原 search) ----------
async function searchVideo(args = {}) {
  const backData = new RepVideoList();
  try {
    const site = args.url || appConfig.webSite;
    appConfig.webSite = UZUtils.removeTrailingSlash(site);
    refreshTimestamp();

    const wd = firstNonEmpty(args.searchWord, args.wd);
    if (!wd) {
      backData.error = '缺少搜索关键词';
      return JSON.stringify(backData);
    }
    const page = args.page || 1;
    const url = appConfig.webSite + `/api.php/v2.vod/androidsearch10086?page=${page}&wd=${encodeURIComponent(wd)}`;

    const pro = await req(url, { headers: appConfig.headers });
    const resp = pro.data || {};
    const arr = resp.data && Array.isArray(resp.data) ? resp.data : [];
    backData.data = arr.map(item => {
      const v = new VideoDetail();
      v.vod_id = item.id !== undefined ? String(item.id) : '';
      v.vod_name = item.name || '';
      v.vod_pic = item.pic || '';
      v.vod_remarks = item.score || '暂无评分';
      return v;
    });
    backData.page = page;
  } catch (e) {
    backData.error = '获取列表失败～' + e.message;
  }
  return JSON.stringify(backData);
}

// ---------- 子分类（原爬虫无逻辑，按模板占位） ----------
async function getSubclassList() {
  const backData = new RepVideoSubclassList();
  backData.data = [];
  return JSON.stringify(backData);
}
async function getSubclassVideoList() {
  const backData = new RepVideoList();
  backData.data = [];
  return JSON.stringify(backData);
}

// (不使用 module.exports，环境会扫描全局函数)
