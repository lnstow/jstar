"use strict";
class Bridge {
    static async loadData() {
        await SaveData.openDB();
        let itemArr = await SaveData.loadFromDB("jav_item");
        let listArr = await SaveData.loadFromDB("jav_list");
        let orderMap = SaveData.loadFromLocal();
        Bridge.ALL_DATA = { itemArr: itemArr, listArr: listArr, orderMap: orderMap };
        let orderItem = [];
        let orderList = [];
        console.log("iterator of orderMap");
        for (const iterator of orderMap) {
            const list = listArr[iterator];
            orderList.push(list);
            let arr = [];
            console.log(iterator);
            for (const iterator of list.arr) {
                console.log(iterator);
                arr.push(itemArr[iterator]);
            }
            orderItem.push(arr);
        }
        Bridge.VUE_DATA = { orderItem: orderItem, orderList: orderList };
        if (orderMap.length == 0) {
            let newList = new StarList("listName");
            let itemA = new JavDB("itemA");
            let itemB = new JavDB("itemB");
            let itemC = new JavDB("itemC");
            await Bridge.insertData(newList, 0);
            await Bridge.insertData(itemA, 0, 0);
            await Bridge.insertData(itemB, 0, 1);
            await Bridge.insertData(itemC, 0, 2);
        }
        return Bridge.VUE_DATA;
    }
    static async saveData(data, update, listIndex, itemIndex = 0) {
        await SaveData.openDB();
        let dataWrapper = {};
        let allData = Bridge.ALL_DATA;
        let vueData = Bridge.VUE_DATA;
        console.log(listIndex);
        console.log(itemIndex);
        if (isItem(data)) {
            let list = vueData.orderList[listIndex];
            console.log(vueData);
            // if (allData.itemArr[data.sid] == undefined) {
            list.arr.splice(itemIndex + 1, 0, data.sid);
            allData.itemArr[data.sid] = data;
            dataWrapper[data.sid] = data;
            SaveData.saveToDB(dataWrapper, "jav_item");
            delete dataWrapper[data.sid];
            dataWrapper[list.name] = list;
            SaveData.saveToDB(dataWrapper, "jav_list");
            // } else { console.log("element exists") }
            // if (list.arr.indexOf(data.sid) == -1) {
            vueData.orderItem[listIndex].splice(itemIndex + 1, 0, data);
            // } else { console.log("element exists") }
        }
        else {
            // TODO  检查是否存在元素，检查是更新元素还是新增元素
            // if (Bridge.ALL_DATA.listArr[data.name] == undefined) {
            allData.orderMap.splice(listIndex + 1, 0, data.name);
            allData.listArr[data.name] = data;
            dataWrapper[data.name] = data;
            SaveData.saveToDB(dataWrapper, "jav_list");
            SaveData.saveToLocal(Bridge.ALL_DATA.orderMap);
            vueData.orderList.splice(listIndex + 1, 0, data);
            vueData.orderItem.splice(listIndex + 1, 0, []);
            // } else {
            //     console.log("元素已存在");
            // }
        }
    }
    static async insertData(data, listIndex, itemIndex = 0) {
        return Bridge.saveData(data, false, listIndex, itemIndex);
    }
    static async updateData(data, listIndex, itemIndex = 0) {
        return Bridge.saveData(data, true, listIndex, itemIndex);
    }
    static async deleteData() {
        let allData = Bridge.ALL_DATA;
        let vueData = Bridge.VUE_DATA;
        allData.orderMap = [];
        allData.listArr = {};
        allData.itemArr = {};
        // Bridge.VUE_DATA.orderList = []
        // Bridge.VUE_DATA.orderItem = []
        Vue.set(app, "orderList", []);
        Vue.set(app, "orderItem", []);
        SaveData.deleteFromDb("jav_item");
        SaveData.deleteFromDb("jav_list");
        localStorage.removeItem("jav_map");
        // SaveData.saveToLocal(Bridge.ALL_DATA.orderMap)
    }
    static exportData() {
    }
    static importData() {
        let arr = {};
        for (let i = 0; i < 350; i++) {
            arr["item" + i] = new JavDB("item" + i);
        }
        SaveData.saveToDB(arr, "jav_item");
    }
    static getVueData() {
    }
}
