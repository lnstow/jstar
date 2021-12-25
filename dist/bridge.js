"use strict";
class VM {
    static newHint(msg, positive = ["", VM.emptyFunc], negative = ["知道了", VM.emptyFunc]) {
        const hint = VM.VUE_DATA.hint;
        hint.message = msg;
        hint.negative = [negative[0], () => {
                VM.VUE_DATA.hint.message = "";
                negative[1]();
            }];
        hint.positive = [positive[0], () => {
                VM.VUE_DATA.hint.message = "";
                positive[1]();
            }];
    }
    static async loadData() {
        await Repo.openDB();
        const itemTable = await Repo.loadFromDB(ITEM_TABLE);
        const listTable = await Repo.loadFromDB(LIST_TABLE);
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
                VM.updateItemRef(itemSid, listName);
            }
            orderItem.push(arr);
        }
        VM.VUE_DATA = {
            orderList, orderItem,
            hint: {
                message: "",
                negative: ["", VM.emptyFunc],
                positive: ["", VM.emptyFunc]
            },
        };
        VM.updateTime = Repo.saveUpdateTime();
        if (orderMap.length == 0) {
            await VM.insertList(new NormalList("listName"), 0);
            await VM.insertItem(new NormalItem("itemA"), 0);
            await VM.insertItem(new NormalItem("itemB"), 0);
            await VM.insertItem(new NormalItem("itemC"), 0);
        }
        return VM.VUE_DATA;
    }
    /** 分数高在前面，如果i1在前，i1s>i2s，需要返回负数 */
    static orderByScore(i1, i2) {
        if (i1.score == i2.score)
            return i1.date >= i2.date ? -1 : 1;
        return i1.score > i2.score ? -1 : 1;
    }
    /** 日期新在前面，如果i1在前，i1d>i2d，需要返回负数 */
    static orderByDate(i1, i2) {
        if (i1.date == i2.date)
            return i1.score >= i2.score ? -1 : 1;
        return i1.date > i2.date ? -1 : 1;
    }
    static getOrderFun() {
        if (VM.scoreFirst)
            return VM.orderByScore;
        return VM.orderByDate;
    }
    static calculateCol(item, list) {
        let col = list.arr.findIndex(sid => {
            return VM.getOrderFun()(item, VM.ALL_DATA.itemTable[sid]) < 0;
        });
        if (col == -1)
            col = list.arr.length;
        return col;
    }
    static async insertItem(item, row, col = -1) {
        if (!VM.checkUpdateTime())
            return false;
        const list = VM.VUE_DATA.orderList[row];
        list.date = getTime();
        try {
            item.date = getTime();
            await Repo.saveToDB(ITEM_TABLE, item);
            if (col == -1)
                col = VM.calculateCol(item, list);
            list.arr.splice(col, 0, item.sid);
            await Repo.saveToDB(LIST_TABLE, list);
            if (VM.itemRef.has(item.sid))
                VM.responsiveCopy(VM.ALL_DATA.itemTable[item.sid], item);
            else
                VM.ALL_DATA.itemTable[item.sid] = item;
            item = VM.ALL_DATA.itemTable[item.sid];
            VM.VUE_DATA.orderItem[row].splice(col, 0, item);
            VM.updateItemRef(item.sid, list.name);
        }
        catch (error) {
            console.error(error);
            VM.newHint(VM.errorMsg);
            return false;
        }
        return true;
    }
    static async updateItem(item, row, col) {
        if (!VM.checkUpdateTime())
            return false;
        item.date = getTime();
        const list = VM.VUE_DATA.orderList[row];
        list.date = getTime();
        try {
            await Repo.saveToDB(LIST_TABLE, list);
            await Repo.saveToDB(ITEM_TABLE, item);
            // VM.responsiveCopy(VM.VUE_DATA.orderItem[row][col], item)
            VM.responsiveCopy(VM.ALL_DATA.itemTable[item.sid], item);
        }
        catch (error) {
            console.error(error);
            VM.newHint(VM.errorMsg);
            return false;
        }
        return true;
    }
    static async deleteItem(row, col) {
        if (!VM.checkUpdateTime())
            return false;
        const list = VM.VUE_DATA.orderList[row];
        const item = VM.VUE_DATA.orderItem[row][col];
        try {
            list.date = getTime();
            list.arr.splice(col, 1);
            await Repo.saveToDB(LIST_TABLE, list);
            VM.VUE_DATA.orderItem[row].splice(col, 1);
            VM.deleteItemRef(item.sid, list.name);
        }
        catch (error) {
            console.error(error);
            VM.newHint(VM.errorMsg);
            return false;
        }
        return true;
    }
    static updateItemRef(itemSid, listName) {
        if (VM.itemRef.has(itemSid))
            VM.itemRef.get(itemSid).push(listName);
        else
            VM.itemRef.set(itemSid, [listName]);
    }
    static async deleteItemRef(itemSid, listName) {
        if (VM.itemRef.has(itemSid)) {
            const refList = VM.itemRef.get(itemSid);
            if (refList.length == 1) {
                await Repo.deleteFromDb(ITEM_TABLE, VM.ALL_DATA.itemTable[itemSid]);
                delete VM.ALL_DATA.itemTable[itemSid];
                VM.itemRef.delete(itemSid);
            }
            else {
                refList.splice(refList.indexOf(listName), 1);
            }
        }
    }
    static async insertList(list, row) {
        if (!VM.checkUpdateTime())
            return false;
        const map = VM.ALL_DATA.orderMap;
        // todo 插入位置
        row = row + 1;
        try {
            await Repo.saveToDB(LIST_TABLE, list);
            map.splice(row, 0, list.name);
            Repo.saveOrderMap(map);
            VM.ALL_DATA.listTable[list.name] = list;
            VM.VUE_DATA.orderList.splice(row, 0, list);
            VM.VUE_DATA.orderItem.splice(row, 0, []);
        }
        catch (error) {
            console.error(error);
            VM.newHint(VM.errorMsg);
            return false;
        }
        return true;
    }
    static async updateList(list, row) {
        if (!VM.checkUpdateTime())
            return false;
        list.date = getTime();
        try {
            await Repo.saveToDB(LIST_TABLE, list);
            // VM.responsiveCopy(VM.VUE_DATA.orderList[row], list)
            VM.responsiveCopy(VM.ALL_DATA.listTable[list.name], list);
        }
        catch (error) {
            console.error(error);
            VM.newHint(VM.errorMsg);
            return false;
        }
        return true;
    }
    /** 将newV中的数据复制到oldV中，并删除oldV多余的属性 */
    static responsiveCopy(oldV, newV) {
        for (const key in oldV) {
            if (!(key in newV))
                Vue.delete(oldV, key);
        }
        for (const key in newV) {
            if (key in oldV)
                oldV[key] = newV[key];
            else
                Vue.set(oldV, key, newV[key]);
        }
    }
    static async deleteList(row) {
        if (!VM.checkUpdateTime())
            return false;
        const map = VM.ALL_DATA.orderMap;
        const list = VM.VUE_DATA.orderList[row];
        try {
            await Repo.deleteFromDb(LIST_TABLE, list);
            map.splice(row, 1);
            Repo.saveOrderMap(map);
            delete VM.ALL_DATA.listTable[list.name];
            VM.VUE_DATA.orderList.splice(row, 1);
            VM.VUE_DATA.orderItem.splice(row, 1);
            list.arr.forEach(sid => VM.deleteItemRef(sid, list.name));
        }
        catch (error) {
            console.error(error);
            VM.newHint(VM.errorMsg);
            return false;
        }
        return true;
    }
    static searchItem(key, row) {
        if (key == null || key.length == 0)
            return [];
        const list = VM.VUE_DATA.orderList[row];
        const itemInList = [];
        const itemInDb = [];
        if (!VM.itemRef.has(key))
            itemInList.push({ item: new NormalItem(key), level: 0 /* ItemNone */ });
        key = key.toLowerCase();
        let item;
        VM.itemRef.forEach((refList, sid) => {
            item = VM.ALL_DATA.itemTable[sid];
            if (sid.toLowerCase().includes(key) || item.extraInfo.toLowerCase().includes(key)) {
                if (refList.includes(list.name))
                    itemInList.push({ item, level: 1 /* ItemInList */ });
                else
                    itemInDb.push({ item, level: 2 /* ItemInDb */ });
            }
        });
        return itemInList.concat(itemInDb);
    }
    static searchList(key) {
        if (key == null || key.length == 0)
            return [];
        const map = VM.ALL_DATA.orderMap;
        const result = [];
        if (!map.includes(key))
            result.push({ list: new NormalList(key), level: 3 /* ListNone */ });
        key = key.toLowerCase();
        let list;
        map.forEach(listName => {
            list = VM.ALL_DATA.listTable[listName];
            if (listName.toLowerCase().includes(key) || list.extraInfo.toLowerCase().includes(key))
                result.push({ list, level: 4 /* ListInMap */ });
        });
        return result;
    }
    static checkUpdateTime() {
        const errMsg = "当前页面不是最新数据，请不要同时打开两个页面";
        const time = Repo.loadUpdateTime();
        if (time != VM.updateTime) {
            VM.newHint(errMsg, ["刷新页面", location.reload.bind(location)]);
            console.error(new Error(errMsg));
            return false;
        }
        VM.updateTime = Repo.saveUpdateTime();
        return true;
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
VM.emptyFunc = () => { };
VM.scoreFirst = true;
