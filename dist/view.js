"use strict";
let vue;
const theme = {
    theme: {
        dark: Repo.loadDark(),
        options: {
            themeCache: {
                get: (_) => Repo.loadTheme(),
                set: (_, theme) => Repo.saveTheme(theme),
            },
        },
    },
};
const darkColor = {
    1: "#388e3c",
    2: "#1976d2",
    3: "#512da8",
    4: "#f57c00",
    0: "#616161",
    "-5": "#5d4037",
    10: "#d32f2f",
    primary: "#00796b"
};
const lightColor = {
    1: "#a5d6a7",
    2: "#90caf9",
    3: "#b39ddb",
    4: "#ffcc80",
    0: "#bdbdbd",
    "-5": "#947A6D",
    10: "#e57373",
    primary: "#78C2C4" // #78C2C4 白群 青色
    // #66BAB7 水浅葱 青色 备选主色
};
window.addEventListener("focus", () => vue.checkDataValid());
window.addEventListener("load", function () {
    initView();
    vue = new Vue({
        el: '#app',
        data: function () {
            return {
                orderItem: [],
                orderList: [],
                scoreColor: Repo.loadDark() ? darkColor : lightColor,
                // todo rename
                colors: {},
                hint: {
                    message: "",
                    negative: ["", () => { }],
                    positive: ["", () => { }]
                },
                newList: new NormalList(""),
                newItem: new NormalItem(""),
                showList: false,
                showItem: false,
                showSearch: false,
                showGlobal: false,
                /** row,col,dataLevel */
                clickInfo: [0, 0, 0 /* ItemNone */],
                globalEditMode: false,
                networkMode: Repo.loadNetwork(),
                localLoading: false,
                networkLoading: false,
                searchText: "",
                searchResult: [],
                requestSearchItem: false,
                dialogWidth: 700,
                cardWidth: 140,
                cardHeight: 260,
            };
        },
        vuetify: new Vuetify(theme),
        methods: {
            checkDataValid: function () { VM.checkUpdateTime(); },
            showListDialog: function (row, list = { list: vue.orderList[row], level: 4 /* ListInMap */ }) {
                vue.clickInfo[0] = row;
                vue.clickInfo[2] = list.level;
                vue.newList = Object.assign({}, list.list);
                vue.showList = true;
            },
            showItemDialog: function (row, col, item = { item: vue.orderItem[row][col], level: 1 /* ItemInList */ }) {
                vue.clickInfo[0] = row;
                vue.clickInfo[1] = col;
                vue.clickInfo[2] = item.level;
                vue.newItem = Object.assign({}, item.item);
                console.log(vue.newItem);
                vue.showItem = true;
            },
            hideEditDialog: function () { vue.showList = false; vue.showItem = false; },
            saveDataCallback: function (ok) {
                if (ok) {
                    tempData = [];
                    vue.hideEditDialog();
                    vue.searchData();
                }
            },
            // showSearchDialog -> searchData -> requestEditDialog 
            // -> show(Item/List)Dialog -> submitData
            showSearchDialog: function (row, requestSearchItem) {
                vue.clickInfo[0] = row;
                // 下一行是为了，搜索列表时，记录首次点击的行数，因为如果
                // 点击搜索结果中的编辑按钮，需要改变当前行数
                vue.clickInfo[1] = row;
                vue.requestSearchItem = requestSearchItem;
                vue.searchText = "";
                vue.searchResult = [];
                vue.showSearch = true;
            },
            searchData: function () {
                vue.localLoading = true;
                vue.searchResult = [];
                debounce(() => {
                    vue.searchResult = vue.requestSearchItem ?
                        VM.searchItem(vue.searchText, vue.clickInfo[0]) :
                        VM.searchList(vue.searchText);
                    vue.localLoading = false;
                });
            },
            requestEditDialog: function (data) {
                vue.clickInfo[2] = data.level;
                switch (data.level) {
                    case 0 /* ItemNone */:
                    case 2 /* ItemInDb */:
                        vue.showItemDialog(vue.clickInfo[0], -1, data);
                        break;
                    case 1 /* ItemInList */:
                        const list = vue.orderList[vue.clickInfo[0]];
                        const item = data.item;
                        const col = list.arr.indexOf(item.sid);
                        vue.showItemDialog(vue.clickInfo[0], col, data);
                        break;
                    case 3 /* ListNone */:
                        vue.showListDialog(vue.clickInfo[1], data);
                        break;
                    case 4 /* ListInMap */:
                        const row = VM.ALL_DATA.orderMap
                            .indexOf(data.list.name);
                        vue.showListDialog(row, data);
                        break;
                }
            },
            submitData: function (row = vue.clickInfo[0], col = vue.clickInfo[1]) {
                const data = vue.showItem ? vue.newItem : vue.newList;
                const cb = vue.saveDataCallback;
                switch (vue.clickInfo[2]) {
                    case 0 /* ItemNone */:
                        VM.insertItem(data, row, 0).then(cb);
                        break;
                    case 1 /* ItemInList */:
                        VM.updateItem(data, row, col).then(cb);
                        break;
                    case 2 /* ItemInDb */:
                        VM.insertItem(data, row, 0).then(cb);
                        break;
                    case 3 /* ListNone */:
                        VM.insertList(data, row).then(cb);
                        break;
                    case 4 /* ListInMap */:
                        VM.updateList(data, row).then(cb);
                        break;
                }
            },
            submitBtnText: function () {
                if (vue == null)
                    return "";
                switch (vue.clickInfo[2]) {
                    case 0 /* ItemNone */:
                    case 3 /* ListNone */: return "添加";
                    case 1 /* ItemInList */:
                    case 4 /* ListInMap */: return "编辑";
                    case 2 /* ItemInDb */: return "编辑并添加";
                    default: return "";
                }
            },
            dialogTitle: function () {
                if (vue == null)
                    return "";
                if (vue.showItem)
                    return vue.submitBtnText() + vue.newItem.sid;
                else
                    return vue.submitBtnText() + vue.newList.name;
            },
            deleteList: function (row) {
                VM.newHint("删除列表后不能撤销，你确定吗？", ["确定删除", () => VM.deleteList(row)], ["取消", VM.emptyFunc]);
            },
            deleteItem: function (row, col) {
                vue.newList = vue.orderList[row];
                vue.newItem = vue.orderItem[row][col];
                VM.deleteItem(row, col);
            },
            importData: function (ev) {
                const input = ev.target;
                console.log(input.files);
                console.log(input.value);
                if (input.files != null) {
                    const files = input.files;
                    input.value = "";
                    VM.importData(files);
                }
            },
            exportData: function () {
                VM.exportData();
            },
            clearData: function () {
                VM.clearData();
            },
        },
        computed: {
            va: function () {
                return Object.keys(VM.ALL_DATA.itemTable);
            },
            vc: (a, b) => false,
        }
    });
    vue.$watch("searchText", (n, o) => {
        console.log(`searchText: ${n}`);
        if (vue.showSearch)
            vue.searchData();
    });
    vue.$watch("$vuetify.theme.dark", (n, o) => {
        Repo.saveDark(n);
        vue.scoreColor = n ? darkColor : lightColor;
    });
    vue.$watch("networkMode", (n, o) => Repo.saveNetwork(n));
    vue.$watch("showItem", restoreSearchResult);
    vue.$watch("showList", restoreSearchResult);
    init();
    test();
});
let tempData;
function restoreSearchResult(otherDialogShow) {
    if (vue.showSearch) {
        if (otherDialogShow) {
            tempData = vue.searchResult;
            vue.searchResult = [];
        }
        else
            vue.searchResult = tempData;
    }
}
function init() {
    VM.loadData()
        .then(v => {
        vue.orderItem = v.orderItem;
        vue.orderList = v.orderList;
        vue.hint = v.hint;
        console.log(vue.orderItem);
        console.log(vue.orderList);
    });
}
let debounceTimer = null;
function debounce(fn, delay = 999) {
    if (debounceTimer != null)
        clearTimeout(debounceTimer);
    debounceTimer = setTimeout(fn, delay);
}
function test() {
    let time = 1;
    VM.tryFetchItem();
    // setTimeout(() => {
    //     VM.VUE_DATA.orderItem[0][0].score = 6;
    //     (VM.VUE_DATA.orderItem[0][0] as Item).mixNewData(new JaDB("22"))
    //     vue.addList(0)
    //     vue.addList(2)
    //     vue.addList(3)
    // }, time++ * 1000);
    // setTimeout(() => {
    //     vue.addItem(0, 0)
    //     vue.addItem(2, 0)
    //     vue.addItem(0, 1)
    // }, time++ * 1000);
    setTimeout(() => {
        // vue.addList(0)
        // vue.submitItem(0, 0)
        // VM.exportData()
        // VM.VUE_DATA.orderItem[0][0].score = 6
    }, time++ * 1000);
}
function initView() {
    Vue.component("score-radio", {
        props: ["score", "color"],
        template: `<v-radio :value="score" :color="color">
        <template v-slot:label>
            <span :style="{color: color}"><slot></slot></span>
        </template>
    </v-radio>`
    });
}
// 网络请求https://cn.vuejs.org/v2/guide/computed.html
// vue.$watch('arr', function (newValue, oldValue) {
//     console.log(oldValue)
//     console.log(newValue)
// })
/*
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀ ⣀⣀⡀⠀⠀⣀⡀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⢸⣿⣿⣿⠀⣼⣿⣿⣦⡀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⣀⠀⠀⠀⠀⢸⣿⣿⡟⢰⣿⣿⣿⠟⠁⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀⢰⣿⠿⢿⣦⣀⠀⠘⠛⠛⠃⠸⠿⠟⣫⣴⣶⣾⡆⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀⠸⣿⡀⠀⠉⢿⣦⡀⠀⠀⠀⠀⠀⠀⠛⠿⠿⣿⠃⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠙⢿⣦⠀⠀⠹⣿⣶⡾⠛⠛⢷⣦⣄⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⣿⣧⠀⠀⠈⠉⣀⡀⠀⠀⠙⢿⡇⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⢀⣠⣴⡿⠟⠋⠀⠀⢠⣾⠟⠃⠀⠀⠀⢸⣿⡆⠀⠀⠀⠀⠀
⠀⠀⠀⠀⢀⣠⣶⡿⠛⠉⠀⠀⠀⠀⠀⣾⡇⠀⠀⠀⠀⠀⢸⣿⠇⠀⠀⠀⠀⠀
⠀⢀⣠⣾⠿⠛⠁⠀⠀⠀⠀⠀⠀⠀⢀⣼⣧⣀⠀⠀⠀⢀⣼⠇⠀⠀⠀⠀⠀⠀
⠀⠈⠋⠁⠀⠀⠀⠀⠀⠀⠀⠀⢀⣴⡿⠋⠙⠛⠛⠛⠛⠛⠁⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⣀⣾⡿⠋⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀⠀⢾⠿⠋⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀


起风了
三国
热爱105

SSIS-005
MIDE-941
SSIS-082
 */ 
