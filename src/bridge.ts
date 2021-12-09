const enum SaveOpt {
    Insert, Update, Delete
}
const enum DataLevel {
    ItemNone, ItemInList, ItemInDb, ListInMap, ListNone
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
        handleConflict: {
            message: string
            negative: BtnCallback
            positive: BtnCallback
        }
    }
    private static updateTime: number
    private static itemRef: Map<string, string[]>
    private static errorMsg = "出错了，请刷新后重试"
    private static newHint(msg: string,
        positive: BtnCallback = ["", () => { }],
        negative: BtnCallback = ["知道了", () => { }],
    ) {
        VM.VUE_DATA.handleConflict = {
            message: msg,
            negative: [negative[0], () => {
                VM.VUE_DATA.handleConflict.message = ""
                negative[1]()
            }],
            positive: [positive[0], () => {
                VM.VUE_DATA.handleConflict.message = ""
                positive[1]()
            }]
        }
        Vue.set(vue, "handleConflict", VM.VUE_DATA.handleConflict)
    }

    static async loadData() {
        await Repo.openDB()
        const itemTable = await Repo.loadFromDB(ITEM_TABLE)
        const listTable = await Repo.loadFromDB(LIST_TABLE)
        console.log("load success")

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
                if (VM.itemRef.has(itemSid)) {
                    VM.itemRef.get(itemSid)!.push(listName)
                } else
                    VM.itemRef.set(itemSid, [listName])
            }
            orderItem.push(arr)
        }
        VM.VUE_DATA = {
            orderList, orderItem,
            handleConflict: {
                message: "",
                negative: ["", () => { }],
                positive: ["", () => { }]
            },
        }
        VM.updateTime = Repo.saveUpdateTime()

        if (orderMap.length == 0) {
            let newList = new NormalList("listName")
            let itemA = new JaDB("itemA")
            let itemB = new JaDB("itemB")
            let itemC = new JaDB("itemC")
            await VM.saveData(newList, SaveOpt.Insert, 0)
            await VM.saveData(itemA, SaveOpt.Insert, 0, 0)
            await VM.saveData(itemB, SaveOpt.Insert, 0, 1)
            await VM.saveData(itemC, SaveOpt.Insert, 0, 2)
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

    static async insertItem(data: Item[], row: number): Promise<boolean> {
        if (!VM.checkUpdateTime()) return false
        await Repo.openDB()
        const list = VM.VUE_DATA.orderList[row]
        const sidSet = new Set(list.arr)
        for (const item of data) {
            if (sidSet.has(item.sid)) {
                VM.newHint(`${list.name}列表中已存在${item.sid}`)
                return false
            }
        }
        try {
            // todo data
            await Repo.saveToDB(ITEM_TABLE, ...data)
            const items = list.arr.map(sid => VM.ALL_DATA.itemTable[sid])
            items.push(...data)
            items.sort(VM.getOrderFun())

            header.arr.splice(col, 0, data.sid)
            await Repo.saveToDB(LIST_TABLE, header)
            allData.itemTable[data.sid] = data
            content.splice(col, 0, data)
        } catch (error) {
            console.error(error)
            VM.newHint(VM.errorMsg)
            return false
        }
        return true
    }

    static async saveData(data: Item | List, opt: SaveOpt,
        row: number, col: number = 0): Promise<Boolean> {
        VM.checkUpdateTime()
        await Repo.openDB()
        const allData = VM.ALL_DATA
        const vueData = VM.VUE_DATA

        if (isItem(data)) {
            const content = vueData.orderItem[row]
            const header = vueData.orderList[row]
            if (opt == SaveOpt.Insert) {
                // 插入新元素，
                // 如果列表中已存在，拒绝插入，弹窗提示，
                // 如果数据库中已存在，新老数据混合，得到最新数据，

                // 验证数据
                // TODO 插入位置，按照分数排序
                if (header.arr.indexOf(data.sid) != -1) {
                    VM.newHint("列表中已存在元素")
                    return false
                }
                const old = allData.itemTable[data.sid]
                if (old != undefined)
                    data = mixItem(old, data)

                // 操作数据
                try {
                    await Repo.saveToDB(ITEM_TABLE, data)
                    header.arr.splice(col, 0, data.sid)
                    await Repo.saveToDB(LIST_TABLE, header)
                    allData.itemTable[data.sid] = data
                    content.splice(col, 0, data)
                } catch (error) {
                    console.error(error)
                    VM.newHint(VM.errorMsg)
                    return false
                }
            } else if (opt == SaveOpt.Update) {
                // 修改元素，从表单传进来的就是最新数据
                try {
                    await Repo.saveToDB(ITEM_TABLE, data)
                    header.arr.splice(col, 1, data.sid)
                    await Repo.saveToDB(LIST_TABLE, header)
                    allData.itemTable[data.sid] = data
                    content.splice(col, 1, data)
                    // todo 测试更新不用split
                    // content[col] = data
                } catch (error) {
                    console.error(error)
                    VM.newHint(VM.errorMsg)
                    return false
                }
            }
        } else {
            if (opt == SaveOpt.Insert) {
                // 插入新列表，
                // 如果数据库中已存在，拒绝插入，弹窗提示
                if (allData.listTable[data.name] != undefined) {
                    VM.newHint("同名列表已存在，列表不允许重名")
                    return false
                }

                try {
                    await Repo.saveToDB(LIST_TABLE, data)
                    allData.orderMap.splice(row, 0, data.name)
                    Repo.saveOrderMap(allData.orderMap)
                    allData.listTable[data.name] = data

                    vueData.orderList.splice(row, 0, data)
                    vueData.orderItem.splice(row, 0, [])
                } catch (error) {
                    console.error(error)
                    VM.newHint(VM.errorMsg)
                    return false
                }

            } else if (opt == SaveOpt.Update) {
                // 修改列表，
                // 如果数据库中已存在，询问是否合并列表

                const old = vueData.orderList[row]
                if (allData.listTable[data.name] != undefined) {
                    VM.newHint("同名列表已存在，是否要合并列表",
                        ["合并", async () => {
                            try {


                            } catch (error) {
                                console.error(error)
                                VM.newHint(VM.errorMsg)
                            }
                        }])
                    return false
                }

                try {
                    await Repo.saveToDB(LIST_TABLE, data)
                    // sa
                    // Repo.saveOrderMap(allData.orderMap)
                } catch (error) {

                }

                allData.orderMap.splice(row, 1, data.name)
                vueData.orderList.splice(row, 1, data)
                vueData.orderItem.splice(row, 1, [])

            }
            allData.listTable[data.name] = data
        }
        return true
    }

    static searchItem(key: string, row: number): ItemSearchResult[] {
        if (key == null || key.length == 0) return []
        const list = VM.VUE_DATA.orderList[row]
        const itemInList: ItemSearchResult[] = []
        const itemInDb: ItemSearchResult[] = []
        if (VM.ALL_DATA.itemTable[key] == undefined)
            itemInList.push({ item: new NormalItem(key), level: DataLevel.ItemNone })

        for (const sid in VM.ALL_DATA.itemTable) {
            if (VM.itemRef.get(sid) == undefined) continue
            if (sid.indexOf(key) != -1) {
                const item = VM.ALL_DATA.itemTable[sid]
                if (VM.itemRef.get(sid)!.indexOf(list.name) != -1)
                    itemInList.push({ item, level: DataLevel.ItemInList })
                else
                    itemInDb.push({ item, level: DataLevel.ItemInDb })
            }
        }
        return itemInList.concat(itemInDb)
    }

    static checkUpdateTime() {
        const errMsg = "当前页面不是最新数据，请不要同时打开两个页面，"
        const time = Repo.loadUpdateTime()
        if (time != VM.updateTime) {
            VM.newHint(errMsg, ["刷新页面", location.reload])
            // throw new Error(errMsg);
            console.error(new Error(errMsg))
            return false
        }
        VM.updateTime = Repo.saveUpdateTime()
        return true
    }

    static async clearData() {
        VM.checkUpdateTime()
        let allData = VM.ALL_DATA
        let vueData = VM.VUE_DATA
        allData.orderMap = []
        allData.listTable = {}
        allData.itemTable = {}
        // Bridge.VUE_DATA.orderList = []
        // Bridge.VUE_DATA.orderItem = []

        Vue.set(vue, "orderList", [])
        Vue.set(vue, "orderItem", [])
        Repo.clearData()
        VM.updateTime = -1
        // init()
        // SaveData.saveToLocal(Bridge.ALL_DATA.orderMap)
    }

    static exportData() {
        VM.checkUpdateTime()
        const blob = new Blob([JSON.stringify(VM.ALL_DATA)],
            { type: 'data:text/plain;charset=utf-8' })
        const a = document.createElement('a')
        a.href = window.URL.createObjectURL(blob)
        a.download = `${getTime()}.jaStar`
        a.click()
        window.URL.revokeObjectURL(a.href)
    }

    static importData(files: FileList) {
        VM.checkUpdateTime()
        const errMsg = "文件格式错误，请重新选择";
        (async () => {
            try {
                const file = files[0]
                if (!file.name.includes(".jaStar"))
                    throw new Error(errMsg)
                const reader = new FileReader()

                reader.onload = async function (this) {
                    try {
                        let data = JSON.parse(this.result as string)
                        for (const key in VM.ALL_DATA) {
                            if (data[key] == undefined)
                                throw new Error(errMsg);
                        }
                        await Repo.resetData(data)
                        // todo 初始化的流程
                        init()
                    } catch (error) {
                        console.error(error)
                        VM.newHint(errMsg)
                    }

                }
                reader.onerror =
                    () => { throw new Error(errMsg) }
                reader.readAsText(file)
            } catch (error) {
                console.error(error)
                VM.newHint(errMsg)
            }
        })()
    }

    static getVueData() {

    }
}
