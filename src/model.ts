const ban = -5
const mark = 10
type iScore = 1 | 2 | 3 | 4 | 0 | typeof ban | typeof mark
type iType = "JaDB" | "Jg0" | "JaBus" | "JaLib" | "Normal"
// 不要在 Item或List 中定义非静态方法，
// 因为从数据库读取出来的只有属性，
// 只能调用 Item或List 类的静态方法
interface Item {
    sid: string
    type: iType
    score: iScore
    date: string
    extraInfo: string
}
interface List {
    name: string
    arr: string[]
    date: string
    extraInfo: string
}
function isItem(data: Item | List): data is Item {
    return "type" in data
}
function getTime(): string {
    // 将UTC时间转换为本地时间，输出格式"YYYY-MM-DD+HH"
    const d = new Date()
    d.setUTCHours(d.getUTCHours() - d.getTimezoneOffset() / 60)
    return d.toISOString().slice(0, 13).replace("T", "+")
}

class JaDB implements Item {
    type: iType = "JaDB"
    constructor(public sid: string, public score: iScore = 0,
        public extraInfo = "", public date = getTime()) {

    }

    static get(): string {
        return "string"
    }
}

class NormalItem implements Item {
    type: iType = "Normal"
    constructor(public sid: string, public score: iScore = 0,
        public extraInfo = "", public date = getTime()) {

    }
}

class NormalList implements List {
    constructor(public name: string, public arr: string[] = [],
        public extraInfo: string = "", public date: string = getTime()) {

    }

}

const ITEM_TABLE = "ja_item"
const LIST_TABLE = "ja_list"
type TableObj<T> = {
    [index: string]: T
    [index: number]: never
}
type TableType = {
    [ITEM_TABLE]: Item
    [LIST_TABLE]: List
}

class Repo {
    private static DB: IDBDatabase

    // 如果同时有多个openDB请求，就会打开多个数据库连接，后面的覆盖前面的
    // 所以使用await等待数据库打开
    static openDB() {
        return new Promise<IDBDatabase>((resolve, reject) => {
            if (Repo.DB != undefined) {
                resolve(Repo.DB)
                return
            }
            const request = window.indexedDB.open("jaStar", 1)
            request.onsuccess = function () {
                // console.log("open database")
                Repo.DB = request.result
                Repo.DB.onversionchange = function (this) {
                    this.close()
                }
                resolve(Repo.DB)
            }
            request.onupgradeneeded = function (event) {
                // console.log("upgrade database")
                Repo.DB = request.result
                switch (event.newVersion) {
                    case 1:
                        if (!Repo.DB.objectStoreNames.contains(ITEM_TABLE)) {
                            Repo.DB.createObjectStore(ITEM_TABLE,
                                { autoIncrement: false, keyPath: "sid" })
                        }
                        if (!Repo.DB.objectStoreNames.contains(LIST_TABLE)) {
                            Repo.DB.createObjectStore(LIST_TABLE,
                                { autoIncrement: false, keyPath: "name" })
                            // store.createIndex("date", "date", { unique: false })
                        }
                    case 2:
                    default:
                        break;
                }
                // 不要用resolve，因为更新时还没有成功打开数据库
                // resolve(DataRepo.DB)
            }
            request.onerror = reject
        })
    }

    static saveToDB<T extends keyof TableType>(tableName: T,
        ...data: TableType[T][]) {
        return new Promise((resolve, reject) => {
            const tx = Repo.DB.transaction(tableName, "readwrite")
            const store = tx.objectStore(tableName)
            tx.oncomplete = () => resolve(data)

            try {
                for (const element of data) {
                    const request = store.put(element)
                }
            } catch (error) {
                tx.abort()
                reject(error)
            }
        })
    }

    static loadFromDB<T extends keyof TableType>(tableName: T) {
        return new Promise<TableObj<TableType[T]>>((resolve, reject) => {

            const request: IDBRequest<IDBCursorWithValue | null>
                = Repo.DB.transaction(tableName, "readonly")
                    .objectStore(tableName).openCursor(null)
            const isItem = tableName == ITEM_TABLE
            const arr: TableObj<TableType[T]> = {}

            request.onsuccess = () => {
                const cursor = request.result
                if (cursor) {
                    arr[cursor.value[isItem ? "sid" : "name"] as string]
                        = cursor.value
                    cursor.continue()
                } else
                    resolve(arr)
            }
            request.onerror = reject
        })
    }


    static deleteFromDb<T extends keyof TableType>(tableName: T,
        ...data: TableType[T][]) {
        return new Promise((resolve, reject) => {
            const tx = Repo.DB.transaction(tableName, "readwrite")
            const store = tx.objectStore(tableName)
            const isItem = tableName == ITEM_TABLE

            tx.oncomplete = () => resolve("delete ok")
            tx.onerror = reject
            tx.onabort = reject
            data.forEach(element =>
                store.delete(isItem ? (element as Item).sid : (element as List).name)
            )
        })
    }

    static clearData() {
        if (Repo.DB != undefined) {
            Repo.DB = undefined as unknown as IDBDatabase
            window.indexedDB.deleteDatabase("jaStar")
        }
        for (const key in Repo.lsKey) {
            localStorage.removeItem((Repo.lsKey as TableObj<string>)[key])
        }
    }

    static async resetData(data: AllData) {
        Repo.clearData()
        await Repo.openDB()

        const items: Item[] = []
        for (const key in data.itemTable)
            items.push(data.itemTable[key])
        await Repo.saveToDB(ITEM_TABLE, ...items)

        const lists: List[] = []
        for (const key in data.listTable)
            lists.push(data.listTable[key])
        await Repo.saveToDB(LIST_TABLE, ...lists)

        Repo.saveOrderMap(data.orderMap)
    }

    private static lsKey = {
        map: "ja_map",
        updateTime: "ja_update_time",
        theme: "ja_theme",
        dark: "ja_dark",
        network: "ja_network",
    }

    static saveOrderMap(orderMap: string[]) {
        localStorage.setItem(Repo.lsKey.map, orderMap.join("$@`#"))
    }

    static loadOrderMap(): string[] {
        const orderMap = localStorage.getItem(Repo.lsKey.map)
        return orderMap == null ? [] : orderMap.split("$@`#")
    }

    static saveUpdateTime(): number {
        const time = new Date().getTime()
        localStorage.setItem(Repo.lsKey.updateTime, time.toString())
        return time
    }

    static loadUpdateTime(): number {
        const time = localStorage.getItem(Repo.lsKey.updateTime)
        return time == null ? -1 : Number.parseInt(time)
    }

    static saveTheme(theme: string) { localStorage.setItem(Repo.lsKey.theme, theme) }
    static loadTheme(): string | null { return localStorage.getItem(Repo.lsKey.theme) }
    static saveDark(dark: boolean) { localStorage.setItem(Repo.lsKey.dark, `${dark}`) }
    static loadDark(): boolean { return localStorage.getItem(Repo.lsKey.dark) == "true" }
    static saveNetwork(network: boolean) { localStorage.setItem(Repo.lsKey.network, `${network}`) }
    static loadNetwork(): boolean { return localStorage.getItem(Repo.lsKey.network) == "true" }
}
