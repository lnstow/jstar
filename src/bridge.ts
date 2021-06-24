class Bridge {
    static ALL_DATA: { orderMap: string[], listTable: TableObj<list>, itemTable: TableObj<item> }
    static VUE_DATA: { orderList: list[], orderItem: item[][] }

    static async loadData() {
        await SaveData.openDB()
        let itemTable = await SaveData.loadFromDB("jav_item")
        let listTable = await SaveData.loadFromDB("jav_list")
        let orderMap: string[] = SaveData.loadFromLocal()
        Bridge.ALL_DATA = { orderMap: orderMap, listTable: listTable, itemTable: itemTable }

        let orderItem: item[][] = []
        let orderList: list[] = []
        for (const iterator of orderMap) {
            const list = listTable[iterator]
            orderList.push(list)
            let arr: item[] = []

            console.log(iterator)

            for (const iterator of list.arr) {
                console.log(iterator)
                arr.push(itemTable[iterator])
            }
            orderItem.push(arr)
        }
        Bridge.VUE_DATA = { orderList: orderList, orderItem: orderItem }

        if (orderMap.length == 0) {
            let newList = new StarList("listName")
            let itemA = new JavDB("itemA")
            let itemB = new JavDB("itemB")
            let itemC = new JavDB("itemC")
            await Bridge.insertData(newList, 0)
            await Bridge.insertData(itemA, 0, 0)
            await Bridge.insertData(itemB, 0, 1)
            await Bridge.insertData(itemC, 0, 2)
        }

        // TODO 根据上次删除时间，运行清除
        return Bridge.VUE_DATA
    }

    static async saveData(data: item | list, update: boolean,
        row: number, col: number = 0) {
        // TODO 更新数据前，验证是否最新
        await SaveData.openDB()
        let dataWrapper: TableObj<item | list> = {}
        let allData = Bridge.ALL_DATA
        let vueData = Bridge.VUE_DATA
        console.log(`row:${row},col:${col}`);

        if (isItem(data)) {
            let list = vueData.orderList[row]
            console.log(vueData);
            // if (allData.itemArr[data.sid] == undefined) {
            list.arr.splice(col + 1, 0, data.sid)
            allData.itemTable[data.sid] = data

            dataWrapper[data.sid] = data
            SaveData.saveToDB(dataWrapper, "jav_item")
            delete dataWrapper[data.sid]
            dataWrapper[list.name] = list
            SaveData.saveToDB(dataWrapper, "jav_list")
            // } else { console.log("element exists") }
            // if (list.arr.indexOf(data.sid) == -1) {
            vueData.orderItem[row].splice(col + 1, 0, data)
            // } else { console.log("element exists") }

        } else {
            // TODO  检查是否存在元素，检查是更新元素还是新增元素
            // if (Bridge.ALL_DATA.listArr[data.name] == undefined) {
            allData.orderMap.splice(row + 1, 0, data.name)
            allData.listTable[data.name] = data

            dataWrapper[data.name] = data
            SaveData.saveToDB(dataWrapper, "jav_list")
            SaveData.saveToLocal(Bridge.ALL_DATA.orderMap)

            vueData.orderList.splice(row + 1, 0, data)
            vueData.orderItem.splice(row + 1, 0, [])
            // } else {
            //     console.log("元素已存在");
            // }
        }
    }

    static async insertData(data: item | list, row: number, col: number = 0) {
        return Bridge.saveData(data, false, row, col)
    }

    static async updateData(data: item | list, row: number, col: number = 0) {
        return Bridge.saveData(data, true, row, col)
    }

    static async deleteData() {
        let allData = Bridge.ALL_DATA
        let vueData = Bridge.VUE_DATA
        allData.orderMap = []
        allData.listTable = {}
        allData.itemTable = {}
        // Bridge.VUE_DATA.orderList = []
        // Bridge.VUE_DATA.orderItem = []

        Vue.set(app, "orderList", [])
        Vue.set(app, "orderItem", [])
        SaveData.deleteFromDb("jav_item")
        SaveData.deleteFromDb("jav_list")
        localStorage.removeItem("jav_map")
        // SaveData.saveToLocal(Bridge.ALL_DATA.orderMap)
    }

    static exportData() {

    }

    static importData() {
        let arr: TableObj<item> = {}
        for (let i = 0; i < 350; i++) {
            arr["item" + i] = new JavDB("item" + i)
        }
        SaveData.saveToDB(arr, "jav_item")
    }

    static getVueData() {

    }
}
