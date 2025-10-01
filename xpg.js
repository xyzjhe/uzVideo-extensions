//@name:[直] 小苹果
//@version:1
//@webSite:http://c.xpgtv.net
//@remark: 由 xpgpy.js 按 uzVideo(Zhi_biliys.js) 模板重写，保留全部算法逻辑
//@order: B

/**
 * 依赖:
 *  - req(url, {headers, method, params, data, timeout})
 *  - req.head(url, {headers, timeout})
 *  - UZUtils.removeTrailingSlash
 *  - 模型类: RepVideoClassList / RepVideoList / RepVideoDetail / RepVideoPlayUrl / RepVideoSubclassList / VideoDetail
 *
 * 说明:
 *  - 按 Zhi_biliys.js 规范暴露函数:
 *      getClassList
 *      getVideoList
 *      getVideoDetail
 *      getVideoPlayUrl
 *      searchVideo
 *      getSubclassList (占位)
 *      getSubclassVideoList (占位)
 *  - 不新增额外字段，算法/请求路径/拼接逻辑与原 xpgpy.js 相同。
 */

const appConfig = {
    _webSite: 'http://c.xpgtv.net',
    get webSite() { return this._webSite },
    set webSite(v) { this._webSite = v },

    UA: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/117.0.0.0 Safari/537.36',
    cookie: '',
    headers: {
        'user_id': 'XPGBOX',
        'token2': 'SnAXiSW8vScXE0Z9aDOnK5xffbO75w1+uPom3WjnYfVEA1oWtUdi2Ihy1N8=',
        'version': 'XPGBOX com.phoenix.tv1.5.7',
        'hash': 'd78a',
        'screenx': '2345',
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/117.0.0.0 Safari/537.36',
        // 原文件 token 被截断，这里请自行补全真实 token
        'token': 'ElEDlwCVgXcFHFhddiq2JKteHofExRBUrfNlmHrWetU3VVkxnzJAodl52N9EUFS+Dig2A/fBa/V9RuoOZRBjYvI+GW8kx3+xMlRecaZuECdb/3AdGkYpkjW3wCnpMQxf8vVeCz5zQLDr8l8bUChJiLLJLGsI+yiNskiJTZz9HiGBZhZuWh1mV1QgYah5CLTbSz8=',
        'timestamp': '1743060300', // 保留原静态值（若需动态可手动改）
        'screeny': '1065'
    },
    videoHost: 'http://c.xpgtv.net/m3u8',
    maxRetries: 3,
    timeout: 5000
};

/* 工具: 安全取数组 */
function arr(val) {
    return Array.isArray(val) ? val : [];
}

/* ========== 分类列表 (原 home) ========== */
async function getClassList(args = {}) {
    const webUrl = args.url || appConfig.webSite;
    appConfig.webSite = UZUtils.removeTrailingSlash(webUrl);

    const backData = new RepVideoClassList();
    try {
        const url = appConfig.webSite + '/api.php/v2.vod/androidtypes';
        const pro = await req(url, { headers: appConfig.headers });
        backData.error = pro.error || null;

        const raw = pro.data && pro.data.data ? pro.data.data : [];
        backData.data = arr(raw).map(item => ({
            type_id: (item.type_id !== undefined ? item.type_id.toString() : ''),
            type_name: item.type_name || ''
        }));
        // 原 home 里还有 filters，这里模板不要求返回；若需可加扩展字段
    } catch (e) {
        backData.error = e.message;
    }
    return JSON.stringify(backData);
}

/* ========== 视频列表 (原 category) ========== */
async function getVideoList(args = {}) {
    const backData = new RepVideoList();
    try {
        const webUrl = args.url || appConfig.webSite;
        appConfig.webSite = UZUtils.removeTrailingSlash(webUrl);

        // 原 category 使用 id 作为分类 ID
        const tid = args.mainClassId || args.type_id || args.id;
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

        const url = appConfig.webSite + `/api.php/v2.vod/androidfilter10086?` + params.join('&');
        const pro = await req(url, { headers: appConfig.headers });
        const response = pro.data || {};
        const dataArr = response.data && Array.isArray(response.data) ? response.data : [];

        backData.data = dataArr.map(item => {
            const videoDet = new VideoDetail();
            videoDet.vod_id = (item.id !== undefined ? item.id.toString() : '');
            videoDet.vod_name = item.name || '';
            videoDet.vod_pic = item.pic || '';
            videoDet.vod_remarks = item.score || '暂无评分';
            return videoDet;
        });
        backData.page = page;
        backData.total = response.total || 0;
    } catch (e) {
        backData.error = '获取列表失败～' + e.message;
    }
    return JSON.stringify(backData);
}

/* ========== 视频详情 (原 detail) ========== */
async function getVideoDetail(args = {}) {
    const backData = new RepVideoDetail();
    try {
        const webUrl = args.url || appConfig.webSite;
        appConfig.webSite = UZUtils.removeTrailingSlash(webUrl);

        // 原 detail 使用 id
        const id = args.vod_id || args.id;
        if (!id) {
            backData.error = '缺少视频ID';
            return JSON.stringify(backData);
        }

        const url = appConfig.webSite + `/api.php/v3.vod/androiddetail2?vod_id=${id}`;
        const pro = await req(url, { headers: appConfig.headers });
        const data = pro.data && pro.data.data ? pro.data.data : {};

        const detModel = new VideoDetail();
        detModel.vod_year = data.year || '';
        detModel.vod_area = data.area || '';
        detModel.vod_lang = data.lang || '';
        detModel.type_name = data.className || '';
        detModel.vod_actor = data.actor || '';
        detModel.vod_director = data.director || '';
        detModel.vod_content = data.content || '';
        detModel.vod_play_from = '小苹果';

        const urlsArr = data.urls && Array.isArray(data.urls) ? data.urls : [];
        detModel.vod_play_url = urlsArr.map(u => `${u.key}$${u.url}`).join('#');

        // 额外补上名称/封面（原 detail 返回 list[0] 里有 _parseVodDetail，仅带播放信息；列表中有 name/pic，可在此补）
        detModel.vod_name = data.name || '';
        detModel.vod_pic = data.pic || '';

        backData.data = detModel;
    } catch (e) {
        backData.error = '获取视频详情失败' + e.message;
    }
    return JSON.stringify(backData);
}

/* ========== 播放直链 (原 play) ========== */
async function getVideoPlayUrl(args = {}) {
    const backData = new RepVideoPlayUrl();
    try {
        const webUrl = args.url || appConfig.webSite;
        appConfig.webSite = UZUtils.removeTrailingSlash(webUrl);

        // 原逻辑仅使用 id (inReq.body.id)
        const id = args.id || args.vod_id || args.mediaId;
        if (!id) {
            backData.error = '缺少视频 ID 参数';
            return JSON.stringify(backData);
        }

        let vodUrl = id;
        if (!vodUrl.startsWith('http')) {
            vodUrl = appConfig.videoHost.replace(/\/+$/,'') + `/${id}.m3u8`;
        }

        const headers = appConfig.headers;
        let success = false;
        for (let i = 0; i < appConfig.maxRetries; i++) {
            try {
                await req.head(vodUrl, {
                    headers,
                    timeout: appConfig.timeout
                });
                success = true;
                break;
            } catch (err) {
                await new Promise(r => setTimeout(r, 1000 * (i + 1)));
                if (i === appConfig.maxRetries - 1) {
                    backData.error = '播放链接验证失败';
                }
            }
        }

        if (success) {
            backData.data = vodUrl;
            backData.parse = 0;
            backData.headers = headers;
        }
    } catch (e) {
        backData.error = '播放解析异常: ' + e.message;
    }
    return JSON.stringify(backData);
}

/* ========== 搜索 (原 search) ========== */
async function searchVideo(args = {}) {
    const backData = new RepVideoList();
    try {
        const webUrl = args.url || appConfig.webSite;
        appConfig.webSite = UZUtils.removeTrailingSlash(webUrl);

        const key = args.searchWord || args.wd;
        if (!key) {
            backData.error = '缺少搜索关键词';
            return JSON.stringify(backData);
        }

        const page = args.page || 1;
        const url = appConfig.webSite + `/api.php/v2.vod/androidsearch10086?page=${page}&wd=${encodeURIComponent(key)}`;
        const pro = await req(url, { headers: appConfig.headers });
        const response = pro.data || {};
        const dataArr = response.data && Array.isArray(response.data) ? response.data : [];

        backData.data = dataArr.map(item => {
            const videoDet = new VideoDetail();
            videoDet.vod_id = (item.id !== undefined ? item.id.toString() : '');
            videoDet.vod_name = item.name || '';
            videoDet.vod_pic = item.pic || '';
            videoDet.vod_remarks = item.score || '暂无评分';
            return videoDet;
        });
        backData.page = page;
    } catch (e) {
        backData.error = '获取列表失败～' + e.message;
    }
    return JSON.stringify(backData);
}

/* ========== 子类相关（原爬虫无此逻辑，占位保持接口一致） ========== */
async function getSubclassList(_args = {}) {
    const backData = new RepVideoSubclassList();
    backData.data = []; // 无子分类
    return JSON.stringify(backData);
}

async function getSubclassVideoList(_args = {}) {
    const backData = new RepVideoList();
    backData.data = [];
    return JSON.stringify(backData);
}

/* 导出（uz 框架通过函数名反射调用） */
module.exports = {
    getClassList,
    getVideoList,
    getVideoDetail,
    getVideoPlayUrl,
    searchVideo,
    getSubclassList,
    getSubclassVideoList
};
