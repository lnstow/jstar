const enum DataLevel {
    ItemNone, ItemInList, ItemInDb, ListNone, ListInMap
}
type ItemSearchResult = { item: Item, level: DataLevel }
type ListSearchResult = { list: List, level: DataLevel }
type BtnCallback = [btn: string, onClick: () => void]
type AllData = {
    orderMap: string[]
    listTable: TableObj<List>
    itemTable: TableObj<Item>
}

class VM {
    static ALL_DATA: AllData
    static VUE_DATA: {
        orderList: List[]
        orderItem: Item[][]
        hint: {
            message: string
            negative: BtnCallback
            positive: BtnCallback
        }
    }
    private static updateTime: number
    private static itemRef: Map<string, string[]>
    private static errorMsg = "出错了，请刷新后重试"
    static emptyFunc = () => { }
    static hintCancelBtn: BtnCallback = ["取消", VM.emptyFunc]
    static newHint(msg: string,
        positive: BtnCallback = ["", VM.emptyFunc],
        negative: BtnCallback = ["知道了", VM.emptyFunc],
    ) {
        const hint = VM.VUE_DATA.hint
        hint.message = msg
        hint.negative = [negative[0], () => {
            VM.VUE_DATA.hint.message = ""
            negative[1]()
        }]
        hint.positive = [positive[0], () => {
            VM.VUE_DATA.hint.message = ""
            positive[1]()
        }]
    }

    static genericErrorHint(error: unknown, msg = VM.errorMsg): false {
        console.error(error)
        if (error instanceof DOMException && error.name === "AbortError")
            VM.newHint("网络请求超时，请确保你能访问 Github ，然后重试")
        else if (error instanceof TypeError && error.message === "Failed to fetch")
            VM.newHint("网络错误或跨域访问被禁止，要允许跨域访问，请查看帮助文档")
        else VM.newHint(msg)
        return false
    }

    static async loadData() {
        Remote.init()
        await Repo.openDB()
        const itemTable = await Repo.loadFromDB(ITEM_TABLE)
        const listTable = await Repo.loadFromDB(LIST_TABLE)

        const orderMap: string[] = Repo.loadOrderMap()
        VM.ALL_DATA = { orderMap, listTable, itemTable }
        VM.itemRef = new Map()

        const orderList: List[] = []
        const orderItem: Item[][] = []
        for (const listName of orderMap) {
            const list = listTable[listName]
            orderList.push(list)
            const arr: Item[] = []

            for (const itemSid of list.arr) {
                arr.push(itemTable[itemSid])
                VM.updateItemRef(itemSid, listName)
            }
            orderItem.push(arr)
        }
        VM.VUE_DATA = {
            orderList, orderItem,
            hint: {
                message: "",
                negative: ["", VM.emptyFunc],
                positive: ["", VM.emptyFunc]
            },
        }
        VM.updateTime = Repo.saveUpdateTime()

        if (orderMap.length == 0) {
            await VM.insertList(new NormalList("点我查看列表简介"), 0)
            await VM.insertItem(new NormalItem("itemA", 0,
                `点我输入附带信息
                \n点
                击右下角按钮保存\n点击弹窗外部可以取消修改`), 0)
            await VM.insertItem(new NormalItem("itemB", 0,
                "点我打开item，右下角查看教程"), 0)
            await VM.insertItem(new NormalItem("itemC", 0,
                "排序，介绍右下角图标。现在，学完可以删除啦"), 0)
            // todo 用法//是什么 what is
            vue.uis.show = true
        }

        return VM.VUE_DATA
    }

    /** 分数高在前面，如果i1在前，i1s>i2s，需要返回负数 */
    private static orderByScore(i1: Item, i2: Item): number {
        if (i1.score == i2.score) return i1.date >= i2.date ? -1 : 1
        return i1.score > i2.score ? -1 : 1
    }

    /** 日期新在前面，如果i1在前，i1d>i2d，需要返回负数 */
    private static orderByDate(i1: Item, i2: Item) {
        if (i1.date == i2.date) return i1.score >= i2.score ? -1 : 1
        return i1.date > i2.date ? -1 : 1
    }

    static scoreFirst = true
    static getOrderFun() {
        if (VM.scoreFirst) return VM.orderByScore
        return VM.orderByDate
    }

    static calculateCol(item: Item, list: List) {
        let col = list.arr.findIndex(sid => {
            return VM.getOrderFun()(item, VM.ALL_DATA.itemTable[sid]) < 0
        })
        if (col == -1) col = list.arr.length
        return col
    }

    static async insertItem(item: Item, row: number, col = -1): Promise<boolean> {
        if (!VM.checkUpdateTime()) return false
        const list = VM.VUE_DATA.orderList[row]
        if (!VM.move) list.date = getTime()
        try {
            const redundant = list.arr.indexOf(item.sid)
            item.date = getTime()
            if (VM.move) Repo.saveToDB(ITEM_TABLE, item)
            else await Repo.saveToDB(ITEM_TABLE, item)

            if (col == -1) col = VM.calculateCol(item, list)
            list.arr.splice(col, 0, item.sid)
            if (VM.move) Repo.saveToDB(LIST_TABLE, list)
            else await Repo.saveToDB(LIST_TABLE, list)

            if (VM.itemRef.has(item.sid))
                VM.responsiveCopy(VM.ALL_DATA.itemTable[item.sid], item)
            else VM.ALL_DATA.itemTable[item.sid] = item

            item = VM.ALL_DATA.itemTable[item.sid]
            VM.VUE_DATA.orderItem[row].splice(col, 0, item)
            VM.updateItemRef(item.sid, list.name)

            // 删除列表中的重复item
            if (redundant != -1 && !await VM.deleteItem(row,
                redundant < col ? redundant : redundant + 1)) return false
        } catch (error) {
            return VM.genericErrorHint(error)
        }
        return true
    }

    static async updateItem(item: Item, row: number, col: number): Promise<boolean> {
        if (!VM.checkUpdateTime()) return false
        item.date = getTime()
        try {
            await Repo.saveToDB(ITEM_TABLE, item)
            // VM.responsiveCopy(VM.VUE_DATA.orderItem[row][col], item)
            VM.responsiveCopy(VM.ALL_DATA.itemTable[item.sid], item)
        } catch (error) {
            return VM.genericErrorHint(error)
        }
        return true
    }

    static async deleteItem(row: number, col: number): Promise<boolean> {
        if (!VM.checkUpdateTime()) return false
        const list = VM.VUE_DATA.orderList[row]
        const item = VM.VUE_DATA.orderItem[row][col]
        try {
            list.arr.splice(col, 1)
            if (VM.move) Repo.saveToDB(LIST_TABLE, list)
            else await Repo.saveToDB(LIST_TABLE, list)
            VM.VUE_DATA.orderItem[row].splice(col, 1)
            VM.deleteItemRef(item.sid, list.name)
        } catch (error) {
            return VM.genericErrorHint(error)
        }
        return true
    }

    private static updateItemRef(itemSid: string, listName: string) {
        if (VM.itemRef.has(itemSid)) VM.itemRef.get(itemSid)!.push(listName)
        else VM.itemRef.set(itemSid, [listName])
    }

    private static async deleteItemRef(itemSid: string, listName: string) {
        if (VM.itemRef.has(itemSid)) {
            const refList = VM.itemRef.get(itemSid)!
            if (refList.length == 1) {
                await Repo.deleteFromDb(ITEM_TABLE, VM.ALL_DATA.itemTable[itemSid])
                delete VM.ALL_DATA.itemTable[itemSid]
                VM.itemRef.delete(itemSid)
            } else {
                refList.splice(refList.indexOf(listName), 1)
            }
        }
    }

    private static move = false
    static async moveItem(fr: number, fc: number, tr: number, tc: number): Promise<boolean> {
        if (!VM.checkUpdateTime()) return false
        try {
            if (fr == tr) {
                // 列表内移动item
                const list = VM.VUE_DATA.orderList[fr]
                list.arr.splice(tc, 0, list.arr.splice(fc, 1)[0])

                const items = VM.VUE_DATA.orderItem[fr]
                items.splice(tc, 0, items.splice(fc, 1)[0])
                VM.updateItem(items[tc], tr, tc)
                Repo.saveToDB(LIST_TABLE, list)
                return true
            } else {
                // 跨列表移动item
                VM.move = true
                const item = VM.VUE_DATA.orderItem[fr][fc]

                if (!await VM.insertItem(item, tr, tc)) return false
                return await VM.deleteItem(fr, fc)
            }
        } catch (error) {
            return VM.genericErrorHint(error)
        } finally { VM.move = false }
    }

    static async insertList(list: List, row: number): Promise<boolean> {
        if (!VM.checkUpdateTime()) return false
        const map = VM.ALL_DATA.orderMap
        try {
            await Repo.saveToDB(LIST_TABLE, list)
            map.splice(row, 0, list.name)
            Repo.saveOrderMap(map)
            VM.ALL_DATA.listTable[list.name] = list
            VM.VUE_DATA.orderList.splice(row, 0, list)
            VM.VUE_DATA.orderItem.splice(row, 0, [])
        } catch (error) {
            return VM.genericErrorHint(error)
        }
        return true
    }

    static async updateList(list: List, row: number, time = true): Promise<boolean> {
        if (!VM.checkUpdateTime()) return false
        if (time) list.date = getTime()
        try {
            await Repo.saveToDB(LIST_TABLE, list)
            // VM.responsiveCopy(VM.VUE_DATA.orderList[row], list)
            VM.responsiveCopy(VM.ALL_DATA.listTable[list.name], list)
        } catch (error) {
            return VM.genericErrorHint(error)
        }
        return true
    }

    /** 将newV中的数据复制到oldV中，并删除oldV多余的属性 */
    static responsiveCopy<T>(oldV: T, newV: T) {
        if (oldV === newV) return
        for (const key in oldV) {
            if (!(key in newV)) Vue.delete(oldV, key)
        }
        for (const key in newV) {
            if (key in oldV) oldV[key] = newV[key]
            else Vue.set(oldV, key, newV[key])
        }
    }

    static async deleteList(row: number): Promise<boolean> {
        if (!VM.checkUpdateTime()) return false
        const map = VM.ALL_DATA.orderMap
        const list = VM.VUE_DATA.orderList[row]
        try {
            await Repo.deleteFromDb(LIST_TABLE, list)
            map.splice(row, 1)
            Repo.saveOrderMap(map)
            delete VM.ALL_DATA.listTable[list.name]
            VM.VUE_DATA.orderList.splice(row, 1)
            VM.VUE_DATA.orderItem.splice(row, 1)
            list.arr.forEach(sid => VM.deleteItemRef(sid, list.name))
        } catch (error) {
            return VM.genericErrorHint(error)
        }
        return true
    }

    static async moveList(fromRow: number, toRow: number): Promise<boolean> {
        if (!VM.checkUpdateTime()) return false
        const map = VM.ALL_DATA.orderMap
        try {
            map.splice(toRow, 0, map.splice(fromRow, 1)[0])
            Repo.saveOrderMap(map)
            VM.VUE_DATA.orderList.splice(toRow, 0, VM.VUE_DATA.orderList.splice(fromRow, 1)[0])
            VM.VUE_DATA.orderItem.splice(toRow, 0, VM.VUE_DATA.orderItem.splice(fromRow, 1)[0])
        } catch (error) {
            return VM.genericErrorHint(error)
        }
        return true
    }

    static searchItem(key: string, row: number): ItemSearchResult[] {
        if (key == null || key.length == 0) return []
        const list = VM.VUE_DATA.orderList[row]
        const itemInList: ItemSearchResult[] = []
        const itemInDb: ItemSearchResult[] = []
        if (!VM.itemRef.has(key))
            itemInList.push({ item: new NormalItem(key), level: DataLevel.ItemNone })

        key = key.toLowerCase()
        let item: Item
        VM.itemRef.forEach((refList, sid) => {
            item = VM.ALL_DATA.itemTable[sid]
            if (sid.toLowerCase().includes(key) || item.info.toLowerCase().includes(key)) {
                if (refList.includes(list.name))
                    itemInList.push({ item, level: DataLevel.ItemInList })
                else
                    itemInDb.push({ item, level: DataLevel.ItemInDb })
            }
        })
        itemInList.push.apply(itemInList, itemInDb)
        return itemInList
    }

    static searchList(key: string): ListSearchResult[] {
        if (key == null || key.length == 0
            || key.includes(globalName.listSeparator)) return []
        const map = VM.ALL_DATA.orderMap
        const result: ListSearchResult[] = []
        if (!map.includes(key))
            result.push({ list: new NormalList(key), level: DataLevel.ListNone })

        key = key.toLowerCase()
        let list: List
        map.forEach(listName => {
            list = VM.ALL_DATA.listTable[listName]
            if (listName.toLowerCase().includes(key) || list.info.toLowerCase().includes(key))
                result.push({ list, level: DataLevel.ListInMap })
        })
        return result
    }

    static checkUpdateTime() {
        const errMsg = "当前页面不是最新数据，请不要在多个标签页打开本页面"
        if (Repo.loadUpdateTime() != VM.updateTime) {
            VM.newHint(errMsg, ["刷新页面", location.reload.bind(location)])
            console.error(new Error(errMsg))
            return false
        }
        VM.updateTime = Repo.saveUpdateTime()
        return true
    }

    static getListRow(list: List) { return VM.ALL_DATA.orderMap.indexOf(list.name) }
    static getItemCol(row: number, item: Item) {
        return VM.VUE_DATA.orderList[row].arr.indexOf(item.sid)
    }

    static async clearData() {
        Repo.clearData(true)
        location.reload()
    }

    static exportData() {
        if (!VM.checkUpdateTime()) return
        const blob = new Blob([JSON.stringify(VM.ALL_DATA)],
            { type: 'data:text/plain;charset=utf-8' })
        const a = document.createElement('a')
        a.href = window.URL.createObjectURL(blob)
        a.download = getTime() + globalName.fileExt
        a.click()
        window.URL.revokeObjectURL(a.href)
    }

    static async importData(file: File) {
        if (!VM.checkUpdateTime()) return
        const errMsg = "文件格式错误，请重新选择";
        try {
            if (!file.name.includes(globalName.fileExt))
                throw new Error(errMsg)
            const reader = new FileReader()

            reader.onload = function (this) {
                VM.importDataFromJson(this.result)
            }
            reader.onerror = () => { throw new Error(errMsg) }
            reader.readAsText(file)
        } catch (error) {
            VM.genericErrorHint(error, errMsg)
        }
    }

    static async uploadData() {
        withNetwork(async () => {
            if (await Github.updateGist(JSON.stringify(VM.ALL_DATA)))
                newToast("上传成功")
        })
    }

    static async downloadData() {
        withNetwork(async () => {
            const data = await Github.getGistData()
            if (data) await VM.importDataFromJson(data)
        })
    }

    private static async importDataFromJson(data: any) {
        const errMsg = "文件格式错误，请重新选择";
        try {
            if (typeof data == "string") data = JSON.parse(data)
            for (const key in VM.ALL_DATA) {
                if (data[key] == undefined)
                    throw new Error(errMsg)
            }
            await Repo.resetData(data)
            location.reload()
        } catch (error) {
            VM.genericErrorHint(error, errMsg)
        }
    }
}
