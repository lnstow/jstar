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
        Remote.tryFetchItem();
    }
    static gotoProject() { window.open("https://github.com/lnstow/jstar"); }
    static gotoGist() { window.open(`https://gist.github.com/${Github['gist']}`); }
    static tryFetchItem() {
        // Remote.fetch()
    }
    static async fetch(url) {
        try {
            const res = await fetch(url, {
                method: "GET",
                mode: "cors",
            });
            console.log(res);
            console.log(res.headers);
            console.log(res.body);
            const res_1 = await res.text();
            console.log(res_1);
        }
        catch (err) {
            console.warn(err);
        }
    }
}
