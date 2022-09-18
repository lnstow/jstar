"use strict";
class Github {
    static getFileName(index) {
        return `jstar${index}${globalName.fileExt}`;
    }
    static saveUser(gist, token) {
        localStorage.setItem(Github.lsKey.gist, gist);
        localStorage.setItem(Github.lsKey.token, token);
        Github.loadUser();
    }
    static loadUser() {
        // todo 本地和参数冲突///没有数据自动下载
        const s = new URLSearchParams(location.search);
        Github.gist = s.get(Github.lsKey.gist)
            || localStorage.getItem(Github.lsKey.gist) || "";
        Github.token = s.get(Github.lsKey.token)
            || localStorage.getItem(Github.lsKey.token) || "";
        vue.uis.token = Github.token;
        console.log(Github.token, Github.gist);
    }
    static clearUser() {
        localStorage.removeItem(Github.lsKey.gist);
        localStorage.removeItem(Github.lsKey.token);
    }
    static test() {
        // Github.createGist().then(res =>
        // Github.updateGist("1111111111".repeat(100 * 900*2))
        // .then(_ => { 
        // Github.getGistData().then(res=>console.log(res))
        // })
        // )
    }
    static getHeader(checkToken) {
        const token = Github.token != "" ? `token ${Github.token}` : "";
        if (checkToken && token == "")
            throw new Error("请先设置token");
        return {
            // application/vnd.github.raw
            Accept: "application/vnd.github.v3+json",
            Authorization: token,
            "Content-Type": "application/json",
        };
    }
    static async checkResp(res, methodName) {
        if (!res.ok)
            throw new Error(`${methodName} ${res.status} ${await res.text()}`);
        return await res.json();
    }
    static async findGist() {
        const res = await fetch("https://api.github.com/gists?per_page=100", {
            method: "GET",
            headers: Github.getHeader(true),
            signal: Remote.timeout(),
            cache: "no-cache"
        });
        const res_1 = await Github.checkResp(res, "findGist");
        for (const it of res_1) {
            if (it.description == Github.gistKey.desc) {
                return it.id;
            }
        }
        return "";
    }
    static async createGist(newToken = Github.token) {
        const last = Github.token;
        try {
            Github.token = newToken;
            const gist = await Github.findGist();
            if (gist != "") {
                Github.saveUser(gist, newToken);
                return true;
            }
            const res = await fetch("https://api.github.com/gists", {
                method: "POST",
                headers: Github.getHeader(true),
                signal: Remote.timeout(),
                body: JSON.stringify({
                    description: Github.gistKey.desc,
                    files: {
                        [Github.getFileName(0)]: {
                            content: "init",
                        }
                    },
                    public: false
                })
            });
            const res_1 = await Github.checkResp(res, "createGist");
            Github.saveUser(res_1.id, newToken);
            return true;
        }
        catch (error) {
            console.error(error);
            VM.newHint("你还没有设置账号，去看看帮助文档？", ["去看看", Remote.gotoProject], ["还是算了", VM.emptyFunc]);
            Github.token = last;
            return false;
        }
    }
    static async updateGist(data) {
        try {
            if (Github.token == "")
                throw Error("没有token");
            if (Github.gist == "" && !await Github.createGist())
                return false;
            const files = {};
            const limit = 1000 * 9000; // 9MB
            for (let i = 0; i < data.length; i += limit) {
                files[Github.getFileName(i / limit)] = {
                    content: data.slice(i, Math.min(data.length, i + limit)),
                };
            }
            const res = await fetch(`https://api.github.com/gists/${Github.gist}`, {
                method: "PATCH",
                headers: Github.getHeader(true),
                signal: Remote.timeout(),
                body: JSON.stringify({
                    description: Github.gistKey.desc,
                    files: files,
                })
            });
            await Github.checkResp(res, "updateGist");
            return true;
        }
        catch (error) {
            return VM.genericErrorHint(error, "上传数据失败，请检查账号和网络");
        }
    }
    static async getGistData() {
        try {
            if (Github.gist == "") {
                if (Github.token == "")
                    throw Error("没有gist");
                if (!await Github.createGist())
                    return null;
            }
            const res = await fetch(`https://api.github.com/gists/${Github.gist}`, {
                method: "GET",
                headers: Github.getHeader(false),
                signal: Remote.timeout(),
            });
            const res_1 = await Github.checkResp(res, "getGistData");
            const f = res_1.files;
            const str = [];
            for (let i = 0; i < Object.keys(f).length; i++) {
                const el = f[Github.getFileName(i)];
                if (el.truncated == true) {
                    const res = await fetch(el.raw_url, {
                        method: "GET",
                        headers: Github.getHeader(false),
                        signal: Remote.timeout(),
                    });
                    const text = await res.text();
                    // console.log(`${res.status}///获取远程数据`)
                    // todo 检查status，如果失败，提示cors跨域设置
                    str.push(text);
                }
                else
                    str.push(el.content);
            }
            return str.join("");
        }
        catch (error) {
            VM.genericErrorHint(error, "下载数据失败，请检查账号和网络");
            return null;
        }
    }
    static getShareUrl(gist, token) {
        let url = new URL(location.origin + location.pathname);
        if (gist && Github.gist)
            url.searchParams.append(Github.lsKey.gist, Github.gist);
        if (token && Github.token)
            url.searchParams.append(Github.lsKey.token, Github.token);
        return url.toString();
    }
}
Github.lsKey = {
    gist: "ja_gist",
    token: "ja_token",
};
Github.gistKey = {
    desc: `jstar${globalName.fileExt}`,
};
class Remote {
    static timeout(ms = 7000) {
        const controller = new AbortController();
        setTimeout(() => controller.abort(), ms);
        return controller.signal;
    }
    static init() {
        Github.loadUser();
        PM.start();
    }
    static gotoProject() { window.open("https://github.com/lnstow/jstar"); }
    static gotoGist() { window.open(`https://gist.github.com/${Github['gist']}`); }
    static async fetch(url, cors = true) {
        try {
            const res = await fetch(url, {
                method: "GET",
                mode: cors ? "cors" : "no-cors",
                signal: Remote.timeout(15000),
            });
            return await res.text();
        }
        catch (err) {
            console.warn(err);
            return "";
        }
    }
}
class PM {
    static async testConnect(striceIdx = -1) {
        if (striceIdx != -1)
            return await PM.parserArr[striceIdx].checkValid();
        for (let i = 0; i < PM.parserArr.length; i++) {
            if (await PM.parserArr[i].checkValid()) {
                PM.firstIdx = i;
                return true;
            }
        }
        return false;
    }
    static parseItemProp(item, key, value) {
        if (item.t == undefined)
            return value;
        return PM.parserArr[item.t].parseItemProp(item, key, value);
    }
    static push(item, strictMode = false, startIdx = item.t ? item.t : PM.firstIdx) {
        for (const arr of PM.queue) {
            if (arr[0].sid == item.sid)
                return;
        }
        PM.queue.push([item, strictMode, startIdx]);
        if (PM.queue.length == 1 && PM.isStart)
            PM.tryUpdate();
    }
    static async start() {
        if (vue.networkMode)
            await PM.testConnect();
        PM.isStart = true;
        if (PM.queue.length != 0)
            PM.tryUpdate();
    }
    static async tryUpdate() {
        if (!vue.networkMode)
            return PM.next();
        const item = PM.queue[0][0];
        const strictMode = PM.queue[0][1];
        const startIdx = PM.queue[0][2];
        let p = PM.parserArr[startIdx];
        if (strictMode && !p.isValid
            && !await PM.testConnect(startIdx))
            return PM.next();
        if (!p.isValid)
            p = PM.parserArr[PM.firstIdx];
        if (!p.isValid) {
            if (!await PM.testConnect())
                return PM.next();
            else
                p = PM.parserArr[PM.firstIdx];
        }
        const tempItem = p.build();
        tempItem.sid = item.sid;
        tempItem.score = item.score;
        tempItem.date = item.date;
        tempItem.info = item.info;
        const html = await p.tryFetch(tempItem.sid);
        if (html == "")
            return PM.next();
        const ok = await p.tryParse(html, tempItem);
        console.log(tempItem, "network");
        if (ok)
            VM.updateItem(tempItem, 0, 0, false);
        PM.next();
    }
    static next() {
        PM.queue.shift();
        if (PM.queue.length != 0)
            PM.tryUpdate();
    }
}
PM.firstIdx = 0;
PM.parserArr = [
    {
        domain: "https://javdb.com",
        rejectCheck: 3,
        build() { return new JaDb(""); },
        isValid: true,
        async checkValid() {
            if (this.isValid)
                return true;
            if (this.rejectCheck <= 0)
                return this.isValid;
            this.rejectCheck--;
            this.isValid =
                (await Remote.fetch(`${this.domain}/v/0RRwDa`)).length != 0;
            return this.isValid;
        },
        parseItemProp(item, key, value) {
            switch (key) {
                case "a1": return this.domain + '/v/' + item.c.slice(item.c.indexOf('/') + 1);
                case "a2": return 'https://javfinder.li/search/movie/' + item.sid;
                case "a3": return 'https://missav.com/search/' + item.sid;
                case "a4": return 'https://jable.tv/search/' + item.sid + '/';
                // 'https://jav.guru/?s=' + item.sid
                // 'https://javdoe.to/search/movie/' + item.sid
                // 'https://javfree.la/search/movie/' + item.sid
                // 'https://www2.javhdporn.net/search/' + item.sid
                // 'https://avgle.com/search/videos?search_type=videos&search_query='+item.sid
                case "a5": return 'https://netflav.com/search?type=title&keyword=' + item.sid;
                case "a6": return 'https://supjav.com/?s=' + item.sid;
                case "c2":
                    if (item.v == undefined) {
                        if (item.c == undefined)
                            return 'https://pics.dmm.co.jp/mono/movie/n/now_printing/now_printing.jpg';
                        else {
                            const v = item.sid.toLowerCase().replace('-', '');
                            return `https://pics.dmm.co.jp/mono/movie/adult/${v}/${v}ps.jpg`;
                        }
                    }
                    let v = item.v.slice(item.v.lastIndexOf('/') + 1);
                    if (v.length >= 5 && v[v.length - 4] != '0') {
                        v = v.slice(0, v.length - 3) + '00' + v.slice(v.length - 3);
                    }
                    return `https://pics.dmm.co.jp/digital/video/${v}/${v}ps.jpg`;
                case 'c': return `https://c0.jdbstatic.com/covers/${value}.jpg`;
                case 'v': {
                    if (value == undefined)
                        return '';
                    const v = value.slice(value.lastIndexOf('/') + 1);
                    return `https://cc3001.dmm.co.jp/litevideo/freepv/${value}/${v}_dm_w.mp4`;
                }
                default: return value;
            }
        },
        async tryFetch(sid) {
            const res = await Remote.fetch(`${this.domain}/search?q=${sid}&f=all`);
            if (res.length == 0)
                this.isValid = false;
            return res;
        },
        async tryParse(html, temp) {
            let i1 = 0, i2 = 0;
            i1 = html.indexOf('-lis');
            if (i1 == -1)
                return false;
            i1 = html.indexOf('href', i1 + 10) + 6;
            i2 = html.indexOf('"', i1);
            const url = html.slice(i1, i2);
            if (url.length == 0)
                return false;
            i1 = html.indexOf('src', i2 + 10) + 5;
            i2 = html.indexOf('"', i1 + 10);
            const cov = html.slice(i1, i2);
            if (!cov.startsWith("http")
                || !cov.endsWith("jpg"))
                return false;
            i1 = html.indexOf('g>', i2 + 10) + 2;
            i2 = html.indexOf('<', i1);
            if (html.slice(i1, i2)
                != temp.sid.toUpperCase())
                return false;
            temp.c = cov.slice(cov.indexOf('rs/') + 3, cov.lastIndexOf('.'));
            html = await Remote.fetch(`${this.domain}${url}`);
            if (html.length == 0)
                return false;
            i1 = html.indexOf('ysi');
            if (i1 == -1)
                return await this.parseCorsVideo(temp);
            i1 = html.indexOf('src', i1 + 10) + 5;
            i2 = html.indexOf('"', i1);
            const v = html.slice(i1, i2);
            if (v.length == 0 || !v.startsWith("//") || !v.endsWith("mp4"))
                return await this.parseCorsVideo(temp);
            temp.v = v.slice(v.indexOf('pv/') + 3, v.lastIndexOf('/'));
            return true;
        },
        async parseCorsVideo(temp) {
            const html = await Remote.fetch(`https://www.r18.com/common/search/searchword=${temp.sid}/`);
            if (html == "")
                return true;
            let i1 = 0, i2 = 0;
            i1 = html.indexOf('w=');
            if (i1 == -1)
                return true;
            i1 += 3;
            i2 = html.indexOf('"', i1);
            const v = html.slice(i1, i2);
            if (v.length == 0 || !v.startsWith("htt")
                || !v.endsWith("mp4"))
                return true;
            temp.v = v.slice(v.indexOf('pv/') + 3, v.lastIndexOf('/'));
            return true;
        }
    }
];
PM.queue = [];
PM.isStart = false;
