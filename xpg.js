//@name:[直] 小苹果
//@version:1
//@webSite:http://c.xpgtv.net
//@remark: 完全自封装 uzVideo API，严格模仿 Zhi_biliys.js 格式，算法逻辑保留自 xpgpy.js
//@order: B

const appConfig = {
    _webSite: 'http://c.xpgtv.net',
    get webSite() { return this._webSite },
    set webSite(value) { this._webSite = value },
    UA: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/117.0.0.0 Safari/537.36',
    cookie: '',
    headers: {
        'user_id': 'XPGBOX',
        'token2': 'SnAXiSW8vScXE0Z9aDOnK5xffbO75w1+uPom3WjnYfVEA1oWtUdi2Ihy1N8=',
        'version': 'XPGBOX com.phoenix.tv1.5.7',
        'hash': 'd78a',
        'screenx': '2345',
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/117.0.0.0 Safari/537.36',
        'token': 'ElEDlwCVgXcFHFhddiq2JKteHofExRBUrfNlmHrWetU3VVkxnzJAodl52N9EUFS+Dig2A/fBa/V9RuoOZRBjYvI+GW8kx3+xMlRecaZuECdb/3AdGkYpkjW3wCnpMQxf8vVeCz5zQLDr8l8bUChJiLLJLGsI+yiNskiJTZz9HiGBZhZuWh1mV1QgYah5CLTbSz8=',
        'timestamp': '1743060300',
        'screeny': '1065'
    },
    videoHost: 'http://c.xpgtv.net/m3u8',
    maxRetries: 3,
    timeout: 5000,
}

async function getClassList(args) {
    const webUrl = args.url || appConfig.webSite
    appConfig.webSite = UZUtils.removeTrailingSlash(webUrl)
    let backData = new RepVideoClassList()
    try {
        let url = UZUtils.removeTrailingSlash(appConfig.webSite) + '/api.php/v2.vod/androidtypes'
        const pro = await req(url, { headers: appConfig.headers })
        backData.error = pro.error
        const data = (pro.data && pro.data.data) ? pro.data.data : []
        let classes = []
        (Array.isArray(data) ? data : []).forEach(item => {
            classes.push({
                type_id: (item.type_id !== undefined ? item.type_id.toString() : ''),
                type_name: item.type_name || ''
            })
        })
        backData.data = classes
    } catch (e) {
        backData.error = e.message
    }
    return JSON.stringify(backData)
}

async function getVideoList(args) {
    let backData = new RepVideoList()
    let webUrl = args.url || appConfig.webSite
    appConfig.webSite = UZUtils.removeTrailingSlash(webUrl)
    let tid = args.mainClassId || args.url
    let page = args.page || 1
    let filter = args.filter || {}
    let params = []
    params.push(`page=${page}`)
    params.push(`type=${tid}`)
    if (filter.area) params.push(`area=${filter.area}`)
    if (filter.year) params.push(`year=${filter.year}`)
    let paramStr = params.join('&')
    let url = UZUtils.removeTrailingSlash(appConfig.webSite) + `/api.php/v2.vod/androidfilter10086?${paramStr}`
    try {
        let pro = await req(url, { headers: appConfig.headers })
        let response = pro.data || {}
        let data = (response.data && Array.isArray(response.data)) ? response.data : []
        let videos = []
        data.forEach(item => {
            let videoDet = new VideoDetail()
            videoDet.vod_id = (item.id !== undefined ? item.id.toString() : '')
            videoDet.vod_name = item.name || ''
            videoDet.vod_pic = item.pic || ''
            videoDet.vod_remarks = item.score || '暂无评分'
            videos.push(videoDet)
        })
        backData.data = videos
        backData.page = page
        backData.total = response.total || 0
    } catch (error) {
        backData.error = '获取列表失败～' + error.message
    }
    return JSON.stringify(backData)
}

async function getVideoDetail(args) {
    let backData = new RepVideoDetail()
    let webUrl = args.url || appConfig.webSite
    appConfig.webSite = UZUtils.removeTrailingSlash(webUrl)
    let id = args.url || args.vod_id
    let url = UZUtils.removeTrailingSlash(appConfig.webSite) + `/api.php/v3.vod/androiddetail2?vod_id=${id}`
    try {
        let pro = await req(url, { headers: appConfig.headers })
        let data = (pro.data && pro.data.data) ? pro.data.data : {}
        let detModel = new VideoDetail()
        detModel.vod_year = data.year || ''
        detModel.vod_area = data.area || ''
        detModel.vod_lang = data.lang || ''
        detModel.type_name = data.className || ''
        detModel.vod_actor = data.actor || ''
        detModel.vod_director = data.director || ''
        detModel.vod_content = data.content || ''
        detModel.vod_play_from = '小苹果'
        let urlsArr = (data.urls && Array.isArray(data.urls)) ? data.urls : []
        detModel.vod_play_url = urlsArr.map(url => `${url.key}$${url.url}`).join('#')
        backData.data = detModel
    } catch (error) {
        backData.error = '获取视频详情失败' + error.message
    }
    return JSON.stringify(backData)
}

async function getVideoPlayUrl(args) {
    let backData = new RepVideoPlayUrl()
    let webUrl = args.url || appConfig.webSite
    appConfig.webSite = UZUtils.removeTrailingSlash(webUrl)
    let id = args.url
    let vodUrl = id
    if (!vodUrl || !vodUrl.startsWith('http')) {
        vodUrl = UZUtils.removeTrailingSlash(appConfig.webSite) + `/m3u8/${id}.m3u8`
    }
    let headers = appConfig.headers
    for (let i = 0; i < appConfig.maxRetries; i++) {
        try {
            await req.head(vodUrl, {
                headers,
                timeout: appConfig.timeout
            })
            backData.data = vodUrl
            backData.parse = 0
            backData.headers = headers
            return JSON.stringify(backData)
        } catch (error) {
            await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)))
            if (i === appConfig.maxRetries - 1) {
                backData.error = '播放链接验证失败'
                return JSON.stringify(backData)
            }
        }
    }
}

async function searchVideo(args) {
    let backData = new RepVideoList()
    let webUrl = args.url || appConfig.webSite
    appConfig.webSite = UZUtils.removeTrailingSlash(webUrl)
    let key = args.searchWord
    let page = args.page || 1
    let url = UZUtils.removeTrailingSlash(appConfig.webSite) + `/api.php/v2.vod/androidsearch10086?page=${page}&wd=${key}`
    try {
        let pro = await req(url, { headers: appConfig.headers })
        let response = pro.data || {}
        let data = (response.data && Array.isArray(response.data)) ? response.data : []
        let videos = []
        data.forEach(item => {
            let videoDet = new VideoDetail()
            videoDet.vod_id = (item.id !== undefined ? item.id.toString() : '')
            videoDet.vod_name = item.name || ''
            videoDet.vod_pic = item.pic || ''
            videoDet.vod_remarks = item.score || '暂无评分'
            videos.push(videoDet)
        })
        backData.data = videos
        backData.page = page
    } catch (error) {
        backData.error = '获取列表失败～' + error.message
    }
    return JSON.stringify(backData)
}

// 占位，为兼容 uzVideo 规范
async function getSubclassList(args) {
    let backData = new RepVideoSubclassList()
    backData.data = []
    return JSON.stringify(backData)
}
async function getSubclassVideoList(args) {
    let backData = new RepVideoList()
    backData.data = []
    return JSON.stringify(backData)
}