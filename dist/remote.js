"use strict";
class Github {
    static getFileName(index) {
        return `jstar${index}${globalName.fileExt}`;
    }
    static saveUser(gist, token) {
        localStorage.setItem(Github.lsKey.gist, gist);
        localStorage.setItem(Github.lsKey.token, token);
        Github.gist = gist;
        Github.token = token;
    }
    static loadUser() {
        if (Github.gist == null)
            Github.gist = localStorage.getItem(Github.lsKey.gist);
        if (Github.token == null)
            Github.token = localStorage.getItem(Github.lsKey.token);
        return { gist: Github.gist, token: Github.token };
    }
    static test() {
        Github.loadUser();
        Github.detectUrlParam();
        // https://github.com/settings/tokens/new?scopes=gist
        // Github.createGist().then(res =>
        // Github.updateGist("1111111111".repeat(100 * 900*2))
        // .then(_ => { 
        // Github.getGistData().then(res=>console.log(res))
        // })
        // )
        // fetch("url", {
        //     method: "GET",
        //     mode: "cors",
        // }).then(res => {
        //     console.log(res)
        //     console.log(res.headers)
        //     console.log(res.body)
        //     return res.text()
        // }).then(res => {
        //     console.log(res)
        // }).catch(err => { console.warn(err) })
    }
    static getHeader(checkToken) {
        const token = (Github.token != null && Github.token != "") ?
            `token ${Github.token}` : "";
        if (checkToken && token == "")
            throw new Error("请先设置token");
        return {
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
    static async createGist() {
        try {
            const id = await Github.findGist();
            const token = Github.token ? Github.token : "";
            if (id != "") {
                Github.saveUser(id, token);
                return true;
            }
            const res = await fetch("https://api.github.com/gists", {
                method: "POST",
                headers: Github.getHeader(true),
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
            Github.saveUser(res_1.id, token);
            return true;
        }
        catch (error) {
            return VM.genericErrorHint(error, "创建失败，请手动创建");
        }
    }
    static async updateGist(data) {
        try {
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
                body: JSON.stringify({
                    description: Github.gistKey.desc,
                    files: files,
                })
            });
            await Github.checkResp(res, "updateGist");
            return true;
        }
        catch (error) {
            return VM.genericErrorHint(error, "更新失败，请检查token和gist");
        }
    }
    static async getGistData() {
        try {
            const res = await fetch(`https://api.github.com/gists/${Github.gist}`, {
                method: "GET",
                headers: Github.getHeader(false),
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
                    });
                    const text = await res.text();
                    // todo 检查status，如果失败，提示cors跨域设置
                    str.push(text);
                }
                else
                    str.push(el.content);
            }
            return str.join("");
        }
        catch (error) {
            VM.genericErrorHint(error, "无效的gist数据");
            return null;
        }
    }
    static async detectUrlParam() {
        const s = new URLSearchParams(location.search);
        console.log(`gist:${s.get(Github.lsKey.gist)}`);
        const pureUrl = location.origin + location.pathname;
        const share = `${pureUrl}?${Github.lsKey.gist}=${localStorage.getItem(Github.lsKey.gist)}`;
        const account = `${share}&${Github.lsKey.token}=${localStorage.getItem(Github.lsKey.token)}`;
        console.log(`share:${share}\naccount:${account}`);
    }
}
Github.gist = null;
Github.token = null;
Github.lsKey = {
    gist: "ja_gist",
    token: "ja_token",
};
Github.gistKey = {
    desc: `jstar${globalName.fileExt}`,
};
