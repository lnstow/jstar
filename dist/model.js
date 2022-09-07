"use strict";
const ban = -5;
const mark = 10;
function isItem(data) {
    return "score" in data;
}
function getTime() {
    // 将UTC时间转换为本地时间，输出格式"YYYY-MM-DD_HH"
    const d = new Date();
    d.setUTCHours(d.getUTCHours() - d.getTimezoneOffset() / 60);
    return d.toISOString().slice(0, 13).replace("T", "_");
}
class JaDb {
    constructor(sid, score = 0, info = "", date = getTime()) {
        this.sid = sid;
        this.score = score;
        this.info = info;
        this.date = date;
        this.t = 0 /* JaDb */;
    }
}
class NormalItem {
    constructor(sid, score = 0, info = "", date = getTime()) {
        this.sid = sid;
        this.score = score;
        this.info = info;
        this.date = date;
    }
}
class NormalList {
    constructor(name, arr = [], info = "", e = 1, date = getTime()) {
        this.name = name;
        this.arr = arr;
        this.info = info;
        this.e = e;
        this.date = date;
    }
}
const globalName = {
    listSeparator: "$@`#",
    fileExt: ".jaStar"
};
const ITEM_TABLE = "ja_item";
const LIST_TABLE = "ja_list";
class Repo {
    // 如果同时有多个openDB请求，就会打开多个数据库连接，后面的覆盖前面的
    // 所以使用await等待数据库打开
    static openDB() {
        return new Promise((resolve, reject) => {
            if (Repo.DB != undefined) {
                resolve(Repo.DB);
                return;
            }
            const request = window.indexedDB.open("jaStar", 1);
            request.onsuccess = function () {
                // console.log("open database")
                Repo.DB = request.result;
                Repo.DB.onversionchange = function () {
                    this.close();
                };
                resolve(Repo.DB);
            };
            request.onupgradeneeded = function (event) {
                // console.log("upgrade database")
                Repo.DB = request.result;
                switch (event.newVersion) {
                    case 1:
                        if (!Repo.DB.objectStoreNames.contains(ITEM_TABLE)) {
                            Repo.DB.createObjectStore(ITEM_TABLE, { autoIncrement: false, keyPath: "sid" });
                        }
                        if (!Repo.DB.objectStoreNames.contains(LIST_TABLE)) {
                            Repo.DB.createObjectStore(LIST_TABLE, { autoIncrement: false, keyPath: "name" });
                            // store.createIndex("date", "date", { unique: false })
                        }
                    case 2:
                    default:
                        break;
                }
                // 不要用resolve，因为更新时还没有成功打开数据库
                // resolve(DataRepo.DB)
            };
            request.onerror = reject;
        });
    }
    static saveToDB(tableName, ...data) {
        return new Promise((resolve, reject) => {
            const tx = Repo.DB.transaction(tableName, "readwrite");
            const store = tx.objectStore(tableName);
            tx.oncomplete = () => resolve(data);
            try {
                for (const element of data) {
                    const request = store.put(element);
                }
            }
            catch (error) {
                tx.abort();
                reject(error);
            }
        });
    }
    static loadFromDB(tableName) {
        return new Promise((resolve, reject) => {
            const request = Repo.DB.transaction(tableName, "readonly")
                .objectStore(tableName).openCursor(null);
            const isItem = tableName == ITEM_TABLE;
            const arr = {};
            request.onsuccess = () => {
                const cursor = request.result;
                if (cursor) {
                    arr[cursor.value[isItem ? "sid" : "name"]]
                        = cursor.value;
                    cursor.continue();
                }
                else
                    resolve(arr);
            };
            request.onerror = reject;
        });
    }
    static deleteFromDb(tableName, ...data) {
        return new Promise((resolve, reject) => {
            const tx = Repo.DB.transaction(tableName, "readwrite");
            const store = tx.objectStore(tableName);
            const isItem = tableName == ITEM_TABLE;
            tx.oncomplete = () => resolve("delete ok");
            tx.onerror = reject;
            tx.onabort = reject;
            data.forEach(element => store.delete(isItem ? element.sid : element.name));
        });
    }
    static clearData(clearLs = false) {
        if (Repo.DB != undefined) {
            Repo.DB = undefined;
            window.indexedDB.deleteDatabase("jaStar");
        }
        localStorage.removeItem(Repo.lsKey.map);
        if (!clearLs)
            return;
        Github.clearUser();
        for (const key in Repo.lsKey) {
            localStorage.removeItem(Repo.lsKey[key]);
        }
    }
    static async resetData(data, clearLs = false) {
        Repo.clearData(clearLs);
        await Repo.openDB();
        const items = [];
        for (const key in data.itemTable)
            items.push(data.itemTable[key]);
        await Repo.saveToDB(ITEM_TABLE, ...items);
        const lists = [];
        for (const key in data.listTable)
            lists.push(data.listTable[key]);
        await Repo.saveToDB(LIST_TABLE, ...lists);
        Repo.saveOrderMap(data.orderMap);
    }
    static saveOrderMap(orderMap) {
        localStorage.setItem(Repo.lsKey.map, orderMap.join(globalName.listSeparator));
    }
    static loadOrderMap() {
        const orderMap = localStorage.getItem(Repo.lsKey.map);
        return orderMap == null ? [] : orderMap.split(globalName.listSeparator);
    }
    static saveUpdateTime() {
        const time = new Date().getTime();
        localStorage.setItem(Repo.lsKey.updateTime, time.toString());
        return time;
    }
    static loadUpdateTime() {
        const time = localStorage.getItem(Repo.lsKey.updateTime);
        return time == null ? -1 : Number.parseInt(time);
    }
    static saveTheme(theme) { localStorage.setItem(Repo.lsKey.theme, theme); }
    static loadTheme() { return localStorage.getItem(Repo.lsKey.theme); }
    static saveDark(dark) { localStorage.setItem(Repo.lsKey.dark, `${dark}`); }
    static loadDark() { return localStorage.getItem(Repo.lsKey.dark) == "true"; }
    static saveNetwork(network) { localStorage.setItem(Repo.lsKey.network, `${network}`); }
    static loadNetwork() { return localStorage.getItem(Repo.lsKey.network) == "true"; }
}
Repo.lsKey = {
    map: "ja_map",
    updateTime: "ja_update_time",
    theme: "ja_theme",
    dark: "ja_dark",
    network: "ja_network",
};
