const ban = -1
const noScore = 0
const mark = 6
type iScore = 1 | 2 | 3 | 4 | 5 | 0 | -1 | 6
type iType = "JavDB" | "Jg0" | "JavBus" | "JavLib" | "NoMovie"
interface item {
    sid: string
    type: iType
    score: iScore
    date: string
    get: () => string
}
interface list {
    name: string
    arr: string[]
    alias: string[]
    date: string
}
type TableObj<T extends item | list> = {
    [index: string]: T
    [index: number]: never
}

function isItem(data: item | list): data is item {
    return "sid" in data
}
function getTime(): string {
    // 将UTC时间转换为本地时间，输出格式"YYYY-MM-DD HH"
    let d = new Date()
    d.setUTCHours(d.getUTCHours() - d.getTimezoneOffset() / 60)
    return d.toISOString().slice(0, 13).replace("T", " ")
}

class JavDB implements item {
    // sid: string
    type: iType = "JavDB"
    // score: score
    // date: string

    constructor(public sid: string, public score: iScore = noScore,
        public date = getTime()) {

    }

    get(): string {
        return "string"
    }
}
class StarList implements list {
    constructor(public name: string, public arr: string[] = [],
        public alias: string[] = [], public date: string = getTime()) {

    }

}

type TableName = {
    "jav_item": item
    "jav_list": list
}
class SaveData {
    static DB: IDBDatabase | null = null

    // 如果同时有多个openDB请求，就会打开多个数据库连接，后面的覆盖前面的
    // 所以使用await等待数据库打开
    static openDB() {
        return new Promise((resolve, reject) => {
            if (SaveData.DB != null) resolve(SaveData.DB)
            let request = window.indexedDB.open("javStar", 1)
            request.onsuccess = function () {
                // console.log("open database")
                SaveData.DB = request.result
                resolve(SaveData.DB)
            }
            request.onupgradeneeded = function (event) {
                console.log("upgrade database")
                SaveData.DB = request.result
                switch (event.newVersion) {
                    case 1:
                        if (!SaveData.DB.objectStoreNames.contains("jav_item")) {
                            SaveData.DB.createObjectStore("jav_item",
                                { autoIncrement: false, keyPath: "sid" })
                        }
                        if (!SaveData.DB.objectStoreNames.contains("jav_list")) {
                            SaveData.DB.createObjectStore("jav_list",
                                { autoIncrement: false, keyPath: "name" })
                            // store.createIndex("date", "date", { unique: false })
                        }
                    case 2:
                    default:
                        break;
                }
                // 不要用resolve，因为更新时还没有成功打开数据库
                // resolve(SaveData.DB)
            }
            request.onerror = reject
        })
    }

    static saveToDB(data: TableObj<item | list>, tableName: keyof TableName) {
        return new Promise((resolve, reject) => {
            if (SaveData.DB == null) {
                reject("null db")
            } else {
                console.log("save to db")
                let count = 0
                let tx = SaveData.DB.transaction(tableName, "readwrite")
                tx.oncomplete = () => {
                    if (count == 0) {
                        console.log("tx complete")
                        resolve(data)
                    } else
                        console.warn("request count:" + count)
                }
                let store = tx.objectStore(tableName)
                // TODO 遍历对象而不是数组
                console.log(" key in data");

                for (const key in data) {
                    const element = data[key]
                    console.log(element);

                    // if (count++ % 1000 == 0) {
                    //     tx = SaveData.DB.transaction(tableName, "readwrite")
                    //     store = tx.objectStore(tableName)
                    // }
                    count++
                    let request = store.put(element)
                    request.onsuccess = () => count--
                    request.onerror = reject
                }
            }
        })
    }

    static loadFromDB<T extends keyof TableName>(tableName: T):
        Promise<TableObj<TableName[T]>> {
        return new Promise((resolve, reject) => {
            if (SaveData.DB == null) {
                reject("null db")
            } else {
                console.log("load from db")

                let request: IDBRequest<IDBCursorWithValue | null>
                    = SaveData.DB.transaction(tableName, "readonly")
                        .objectStore(tableName).openCursor(null)
                let arr: TableObj<TableName[T]> = {}
                const isItem = tableName == "jav_item"
                request.onsuccess = () => {
                    let cursor = request.result
                    if (cursor) {
                        arr[cursor.value[isItem ? "sid" : "name"] as string]
                            = cursor.value
                        cursor.continue()
                    } else
                        resolve(arr)
                }
                request.onerror = reject
            }
        })
    }

    static deleteFromDb(tableName: keyof TableName) {
        return new Promise((resolve, reject) => {
            if (SaveData.DB == null) {
                reject("null db")
            } else {
                console.log("delete from db")

                let request: IDBRequest<IDBCursorWithValue | null>
                    = SaveData.DB.transaction(tableName, "readwrite")
                        .objectStore(tableName).openCursor(null)
                const isItem = tableName == "jav_item"
                request.onsuccess = () => {
                    let cursor = request.result
                    if (cursor) {
                        cursor.delete()
                        cursor.continue()
                    } else
                        resolve("ok")
                }
                request.onerror = reject
            }
        })
    }

    static saveToLocal(orderMap: string[]) {
        localStorage.setItem("jav_map", orderMap.join("  "))
    }

    static loadFromLocal(): string[] {
        let orderMap = localStorage.getItem("jav_map")
        return orderMap == null ? [] : orderMap.split("  ")
    }

    static saveToFile(data: item) {

    }

    static loadFromFile() {

    }
}
