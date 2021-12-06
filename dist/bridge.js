"use strict";
class VM {
    static newHint(msg, positive = ["", () => { }], negative = ["知道了", () => { }]) {
        VM.VUE_DATA.handleConflict = {
            message: msg,
            negative: [negative[0], () => {
                    VM.VUE_DATA.handleConflict.message = "";
                    negative[1]();
                }],
            positive: [positive[0], () => {
                    VM.VUE_DATA.handleConflict.message = "";
                    positive[1]();
                }]
        };
        Vue.set(vue, "handleConflict", VM.VUE_DATA.handleConflict);
    }
    static async loadData() {
        await Repo.openDB();
        const itemTable = await Repo.loadFromDB(ITEM_TABLE);
        const listTable = await Repo.loadFromDB(LIST_TABLE);
        console.log("load success");
        const orderMap = Repo.loadOrderMap();
        VM.ALL_DATA = { orderMap, listTable, itemTable };
        VM.itemRef = new Map();
        const orderList = [];
        const orderItem = [];
        for (const listName of orderMap) {
            const list = listTable[listName];
            orderList.push(list);
            const arr = [];
            for (const itemSid of list.arr) {
                arr.push(itemTable[itemSid]);
                if (VM.itemRef.has(itemSid)) {
                    VM.itemRef.get(itemSid).push(listName);
                }
                else
                    VM.itemRef.set(itemSid, [listName]);
            }
            orderItem.push(arr);
        }
        VM.VUE_DATA = {
            orderList, orderItem,
            handleConflict: {
                message: "",
                negative: ["", () => { }],
                positive: ["", () => { }]
            },
        };
        VM.updateTime = Repo.saveUpdateTime();
        if (orderMap.length == 0) {
            let newList = new NormalList("listName");
            let itemA = new JaDB("itemA");
            let itemB = new JaDB("itemB");
            let itemC = new JaDB("itemC");
            await VM.saveData(newList, 0 /* Insert */, 0);
            await VM.saveData(itemA, 0 /* Insert */, 0, 0);
            await VM.saveData(itemB, 0 /* Insert */, 0, 1);
            await VM.saveData(itemC, 0 /* Insert */, 0, 2);
        }
        return VM.VUE_DATA;
    }
    static async insertItem(data, row, col = 0) {
        VM.checkUpdateTime();
        await Repo.openDB();
        const list = VM.VUE_DATA.orderList[row];
        const arrSet = new Set(list.arr);
        for (const item of data) {
            if (arrSet.has(item.sid)) {
                VM.newHint(`${list.name}列表中已存在${item.sid}`);
                return false;
            }
        }
        list.arr;
        new Map();
        return true;
    }
    static async saveData(data, opt, row, col = 0) {
        VM.checkUpdateTime();
        await Repo.openDB();
        const allData = VM.ALL_DATA;
        const vueData = VM.VUE_DATA;
        if (isItem(data)) {
            const content = vueData.orderItem[row];
            const header = vueData.orderList[row];
            if (opt == 0 /* Insert */) {
                // 插入新元素，
                // 如果列表中已存在，拒绝插入，弹窗提示，
                // 如果数据库中已存在，新老数据混合，得到最新数据，
                // 验证数据
                // TODO 插入位置，按照分数排序
                if (header.arr.indexOf(data.sid) != -1) {
                    VM.newHint("列表中已存在元素");
                    return false;
                }
                const old = allData.itemTable[data.sid];
                if (old != undefined)
                    data = mixItem(old, data);
                // 操作数据
                try {
                    await Repo.saveToDB(ITEM_TABLE, data);
                    header.arr.splice(col, 0, data.sid);
                    await Repo.saveToDB(LIST_TABLE, header);
                    allData.itemTable[data.sid] = data;
                    content.splice(col, 0, data);
                }
                catch (error) {
                    console.error(error);
                    VM.newHint(VM.errorMsg);
                    return false;
                }
            }
            else if (opt == 1 /* Update */) {
                // 修改元素，从表单传进来的就是最新数据
                try {
                    await Repo.saveToDB(ITEM_TABLE, data);
                    header.arr.splice(col, 1, data.sid);
                    await Repo.saveToDB(LIST_TABLE, header);
                    allData.itemTable[data.sid] = data;
                    content.splice(col, 1, data);
                    // todo 测试更新不用split
                    // content[col] = data
                }
                catch (error) {
                    console.error(error);
                    VM.newHint(VM.errorMsg);
                    return false;
                }
            }
        }
        else {
            if (opt == 0 /* Insert */) {
                // 插入新列表，
                // 如果数据库中已存在，拒绝插入，弹窗提示
                if (allData.listTable[data.name] != undefined) {
                    VM.newHint("同名列表已存在，列表不允许重名");
                    return false;
                }
                try {
                    await Repo.saveToDB(LIST_TABLE, data);
                    allData.orderMap.splice(row, 0, data.name);
                    Repo.saveOrderMap(allData.orderMap);
                    allData.listTable[data.name] = data;
                    vueData.orderList.splice(row, 0, data);
                    vueData.orderItem.splice(row, 0, []);
                }
                catch (error) {
                    console.error(error);
                    VM.newHint(VM.errorMsg);
                    return false;
                }
            }
            else if (opt == 1 /* Update */) {
                // 修改列表，
                // 如果数据库中已存在，询问是否合并列表
                const old = vueData.orderList[row];
                if (allData.listTable[data.name] != undefined) {
                    VM.newHint("同名列表已存在，是否要合并列表", ["合并", async () => {
                            try {
                            }
                            catch (error) {
                                console.error(error);
                                VM.newHint(VM.errorMsg);
                            }
                        }]);
                    return false;
                }
                try {
                    await Repo.saveToDB(LIST_TABLE, data);
                    // sa
                    // Repo.saveOrderMap(allData.orderMap)
                }
                catch (error) {
                }
                allData.orderMap.splice(row, 1, data.name);
                vueData.orderList.splice(row, 1, data);
                vueData.orderItem.splice(row, 1, []);
            }
            allData.listTable[data.name] = data;
        }
        return true;
    }
    static searchItem(key) {
        const result = [];
        if (key == null || key.length == 0)
            return result;
        for (const sid in VM.ALL_DATA.itemTable) {
            if (sid.indexOf(key) != -1) {
                result.push(VM.ALL_DATA.itemTable[sid]);
            }
        }
        return result;
    }
    static checkUpdateTime() {
        const errMsg = "当前页面不是最新数据，请不要同时打开两个页面，";
        const time = Repo.loadUpdateTime();
        if (time != VM.updateTime) {
            VM.newHint(errMsg, ["刷新页面", location.reload]);
            throw new Error(errMsg);
        }
        VM.updateTime = Repo.saveUpdateTime();
    }
    static async clearData() {
        VM.checkUpdateTime();
        let allData = VM.ALL_DATA;
        let vueData = VM.VUE_DATA;
        allData.orderMap = [];
        allData.listTable = {};
        allData.itemTable = {};
        // Bridge.VUE_DATA.orderList = []
        // Bridge.VUE_DATA.orderItem = []
        Vue.set(vue, "orderList", []);
        Vue.set(vue, "orderItem", []);
        Repo.clearData();
        VM.updateTime = -1;
        // init()
        // SaveData.saveToLocal(Bridge.ALL_DATA.orderMap)
    }
    static exportData() {
        VM.checkUpdateTime();
        const blob = new Blob([JSON.stringify(VM.ALL_DATA)], { type: 'data:text/plain;charset=utf-8' });
        const a = document.createElement('a');
        a.href = window.URL.createObjectURL(blob);
        a.download = `${getTime()}.jaStar`;
        a.click();
        window.URL.revokeObjectURL(a.href);
    }
    static importData(files) {
        VM.checkUpdateTime();
        const errMsg = "文件格式错误，请重新选择";
        (async () => {
            try {
                const file = files[0];
                if (!file.name.includes(".jaStar"))
                    throw new Error(errMsg);
                const reader = new FileReader();
                reader.onload = async function () {
                    try {
                        let data = JSON.parse(this.result);
                        for (const key in VM.ALL_DATA) {
                            if (data[key] == undefined)
                                throw new Error(errMsg);
                        }
                        await Repo.resetData(data);
                        // todo 初始化的流程
                        init();
                    }
                    catch (error) {
                        console.error(error);
                        VM.newHint(errMsg);
                    }
                };
                reader.onerror =
                    () => { throw new Error(errMsg); };
                reader.readAsText(file);
            }
            catch (error) {
                console.error(error);
                VM.newHint(errMsg);
            }
        })();
    }
    static getVueData() {
    }
}
VM.errorMsg = "出错了，请刷新后重试";
