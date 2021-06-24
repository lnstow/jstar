"use strict";
const ban = -1;
const noScore = 0;
const mark = 6;
function isItem(data) {
    return "sid" in data;
}
function getTime() {
    // 将UTC时间转换为本地时间，输出格式"YYYY-MM-DD HH"
    let d = new Date();
    d.setUTCHours(d.getUTCHours() - d.getTimezoneOffset() / 60);
    return d.toISOString().slice(0, 13).replace("T", " ");
}
class JavDB {
    // score: score
    // date: string
    constructor(sid, score = noScore, date = getTime()) {
        this.sid = sid;
        this.score = score;
        this.date = date;
        // sid: string
        this.type = "JavDB";
    }
    get() {
        return "string";
    }
}
class StarList {
    constructor(name, arr = [], alias = [], date = getTime()) {
        this.name = name;
        this.arr = arr;
        this.alias = alias;
        this.date = date;
    }
}
class SaveData {
    // 如果同时有多个openDB请求，就会打开多个数据库连接，后面的覆盖前面的
    // 所以使用await等待数据库打开
    static openDB() {
        return new Promise((resolve, reject) => {
            if (SaveData.DB != null)
                resolve(SaveData.DB);
            let request = window.indexedDB.open("javStar", 1);
            request.onsuccess = function () {
                // console.log("open database")
                SaveData.DB = request.result;
                resolve(SaveData.DB);
            };
            request.onupgradeneeded = function (event) {
                console.log("upgrade database");
                SaveData.DB = request.result;
                switch (event.newVersion) {
                    case 1:
                        if (!SaveData.DB.objectStoreNames.contains("jav_item")) {
                            SaveData.DB.createObjectStore("jav_item", { autoIncrement: false, keyPath: "sid" });
                        }
                        if (!SaveData.DB.objectStoreNames.contains("jav_list")) {
                            SaveData.DB.createObjectStore("jav_list", { autoIncrement: false, keyPath: "name" });
                            // store.createIndex("date", "date", { unique: false })
                        }
                    case 2:
                    default:
                        break;
                }
                // 不要用resolve，因为更新时还没有成功打开数据库
                // resolve(SaveData.DB)
            };
            request.onerror = reject;
        });
    }
    static saveToDB(data, tableName) {
        return new Promise((resolve, reject) => {
            if (SaveData.DB == null) {
                reject("null db");
            }
            else {
                console.log("save to db");
                let count = 0;
                let tx = SaveData.DB.transaction(tableName, "readwrite");
                tx.oncomplete = () => {
                    if (count == 0) {
                        console.log("tx complete");
                        resolve(data);
                    }
                    else
                        console.warn("request count:" + count);
                };
                let store = tx.objectStore(tableName);
                // TODO 遍历对象而不是数组
                console.log(" key in data");
                for (const key in data) {
                    const element = data[key];
                    console.log(element);
                    // if (count++ % 1000 == 0) {
                    //     tx = SaveData.DB.transaction(tableName, "readwrite")
                    //     store = tx.objectStore(tableName)
                    // }
                    count++;
                    let request = store.put(element);
                    request.onsuccess = () => count--;
                    request.onerror = reject;
                }
            }
        });
    }
    static loadFromDB(tableName) {
        return new Promise((resolve, reject) => {
            if (SaveData.DB == null) {
                reject("null db");
            }
            else {
                console.log("load from db");
                let request = SaveData.DB.transaction(tableName, "readonly")
                    .objectStore(tableName).openCursor(null);
                let arr = {};
                const isItem = tableName == "jav_item";
                request.onsuccess = () => {
                    let cursor = request.result;
                    if (cursor) {
                        arr[cursor.value[isItem ? "sid" : "name"]]
                            = cursor.value;
                        cursor.continue();
                    }
                    else
                        resolve(arr);
                };
                request.onerror = reject;
            }
        });
    }
    static deleteFromDb(tableName) {
        return new Promise((resolve, reject) => {
            if (SaveData.DB == null) {
                reject("null db");
            }
            else {
                console.log("delete from db");
                let request = SaveData.DB.transaction(tableName, "readwrite")
                    .objectStore(tableName).openCursor(null);
                const isItem = tableName == "jav_item";
                request.onsuccess = () => {
                    let cursor = request.result;
                    if (cursor) {
                        cursor.delete();
                        cursor.continue();
                    }
                    else
                        resolve("ok");
                };
                request.onerror = reject;
            }
        });
    }
    static saveToLocal(orderMap) {
        localStorage.setItem("jav_map", orderMap.join("  "));
    }
    static loadFromLocal() {
        let orderMap = localStorage.getItem("jav_map");
        return orderMap == null ? [] : orderMap.split("  ");
    }
    static saveToFile(data) {
    }
    static loadFromFile() {
    }
}
SaveData.DB = null;
