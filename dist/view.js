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
    4: "#C18A26",
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
const uic = {
    dialogWidth: 700,
    cardWidth: 120,
};
window.addEventListener("focus", VM.checkUpdateTime);
// window.addEventListener("error", VM.genericErrorHint)
window.addEventListener("load", function () {
    vue = new Vue({
        el: '#app',
        data: function () {
            return {
                orderItem: [],
                orderList: [],
                colorss: Repo.loadDark() ? darkColor : lightColor,
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
                /** row,col,dataLevel */
                clickInfo: [0, 0, 0 /* ItemNone */],
                editMode: false,
                networkMode: Repo.loadNetwork(),
                localLoading: false,
                networkLoading: false,
                searchText: "",
                searchResult: [],
                requestSearchItem: false,
                uis: {
                    show: false,
                    search: false,
                    token: "",
                    video: false,
                },
                toast: {
                    show: false,
                    msg: "",
                    btn: "",
                    click: () => { }
                },
            };
        },
        vuetify: new Vuetify(theme),
        components: {
        // https://github.com/kutlugsahin/vue-smooth-dnd/issues/167
        // 'container': (window as any).VueSmoothDnd.Container,
        // 'draggable': (window as any).VueSmoothDnd.Draggable,
        },
        methods: {
            moveEnd() { DndHelper.applyDrag(); },
            moveList(dropResult) {
                let i = removedIndex(dropResult);
                if (i != null)
                    DndHelper.prepareFrom(i);
                i = addedIndex(dropResult);
                if (i != null)
                    DndHelper.prepareTo(i);
            },
            moveItem(row, dropResult) {
                let i = removedIndex(dropResult);
                if (i != null)
                    DndHelper.prepareFrom(row, i);
                i = addedIndex(dropResult);
                if (i != null)
                    DndHelper.prepareTo(row, i);
            },
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
            showSearchDialog: function (row, requestSearchItem, col = row) {
                vue.clickInfo[0] = row;
                // 下一行是为了，搜索列表时，记录首次点击的行数，因为
                // 创建多个列表时，需要保持每次插入位置都在当前行下面
                tempIdx = col;
                vue.requestSearchItem = requestSearchItem;
                vue.searchText = null;
                vue.searchResult = [];
                vue.showSearch = true;
            },
            searchData: function () {
                vue.localLoading = true;
                vue.searchResult = [];
                debounce(vue.searchDataDelay);
            },
            searchDataDelay() {
                vue.searchResult = vue.requestSearchItem ?
                    VM.searchItem(vue.searchText, vue.clickInfo[0]) :
                    VM.searchList(vue.searchText);
                vue.localLoading = false;
            },
            requestEditDialog: function (data) {
                switch (data.level) {
                    case 0 /* ItemNone */:
                    case 2 /* ItemInDb */:
                        vue.showItemDialog(vue.clickInfo[0], tempIdx + 1, data);
                        break;
                    case 1 /* ItemInList */:
                        const list = vue.orderList[vue.clickInfo[0]];
                        const item = data.item;
                        const col = list.arr.indexOf(item.sid);
                        vue.showItemDialog(vue.clickInfo[0], col, data);
                        break;
                    case 3 /* ListNone */:
                        vue.showListDialog(tempIdx + 1, data);
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
                        VM.insertItem(data, row, col).then(cb);
                        break;
                    case 1 /* ItemInList */:
                        VM.updateItem(data, row, col).then(cb);
                        break;
                    case 2 /* ItemInDb */:
                        VM.insertItem(data, row, col).then(cb);
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
                    case 4 /* ListInMap */: return "修改";
                    case 2 /* ItemInDb */: return "修改并添加";
                    default: return "";
                }
            },
            dialogTitle: function () {
                if (vue == null)
                    return "";
                if (vue.showItem)
                    return vue.submitBtnText() + '---' + vue.newItem.sid;
                else
                    return vue.submitBtnText() + '---' + vue.newList.name;
            },
            iconEdit(level = vue?.clickInfo?.[2]) {
                return level != 0 /* ItemNone */ && level != 3 /* ListNone */;
            },
            iconCreate(level = vue?.clickInfo?.[2]) {
                return level != 1 /* ItemInList */ && level != 4 /* ListInMap */;
            },
            switchListExpand: function (row) {
                const list = vue.orderList[row];
                list.e ^= 1;
                VM.updateList(list, row, false);
            },
            deleteList: function (row) {
                VM.newHint("删除列表后不能撤销，你确定吗？", ["确定删除", () => VM.deleteList(row)], VM.hintCancelBtn);
            },
            deleteItem: function (row, col) {
                vue.newItem = vue.orderItem[row][col];
                VM.deleteItem(row, col).then(ok => {
                    if (ok)
                        newToast("已删除", ["撤销", () => {
                                VM.insertItem(vue.newItem, row, col);
                            }]);
                });
            },
            importData: function (ev) {
                const input = ev.target;
                if (input.files != null && input.value) {
                    const file = input.files[0];
                    input.value = "";
                    VM.importData(file);
                }
            },
            aboutData(opt) {
                switch (opt) {
                    case "sid":
                        copyText(vue.newItem.sid);
                        break;
                    case "upload":
                        VM.newHint("本地数据 将覆盖 远程数据", ["确定上传", VM.uploadData], VM.hintCancelBtn);
                        break;
                    case "download":
                        VM.newHint("远程数据 将覆盖 本地数据", ["确定下载", VM.downloadData], VM.hintCancelBtn);
                        break;
                    case "clear":
                        VM.newHint("清空本地数据？", ["确定", VM.clearData], VM.hintCancelBtn);
                        break;
                    case "export":
                        VM.exportData();
                        break;
                }
            },
            aboutRemote(opt) {
                switch (opt) {
                    case "gist":
                        shareUrl(true);
                        break;
                    case "token":
                        shareUrl(false);
                        break;
                    case "help":
                        Remote.gotoProject();
                        break;
                    case "access":
                        Remote.gotoGist();
                        break;
                    case "edit": withNetwork(async () => {
                        if (await Github.createGist(vue.uis.token))
                            newToast("修改成功");
                    });
                }
            },
            transform(item, key, value) {
                return PM.parseItemProp(item, key, value);
            },
        },
        computed: {
            uic() { return uic; },
        },
    });
    vue.$watch("searchText", (n, o) => {
        if (n == '')
            vue.searchText = null;
        if (vue.showSearch)
            vue.searchData();
    });
    vue.$watch("$vuetify.theme.dark", (n, o) => {
        Repo.saveDark(n);
        vue.colorss = n ? darkColor : lightColor;
    });
    vue.$watch("networkMode", (n, o) => Repo.saveNetwork(n));
    vue.$watch("showItem", restoreSearchResult);
    vue.$watch("showList", restoreSearchResult);
    init();
    test();
});
let tempIdx = 0;
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
    VM.loadData().then(v => {
        vue.orderItem = v.orderItem;
        vue.orderList = v.orderList;
        vue.hint = v.hint;
    });
}
let debounceTimer = null;
function debounce(fn, delay = 500) {
    if (debounceTimer != null)
        clearTimeout(debounceTimer);
    debounceTimer = setTimeout(fn, delay);
}
function shareUrl(forGist) {
    copyText(Github.getShareUrl(forGist, !forGist));
}
async function copyText(text) {
    try {
        await navigator.clipboard.writeText(text);
        newToast("已复制");
    }
    catch (error) {
        console.error(error);
        newToast(text);
    }
}
async function withNetwork(block) {
    if (!VM.checkUpdateTime())
        return;
    vue.networkLoading = true;
    await block();
    vue.networkLoading = false;
}
function newToast(msg, btn = null) {
    vue.toast.msg = msg;
    vue.toast.btn = btn ? btn[0] : null;
    vue.toast.click = btn ? () => {
        btn[1]();
        vue.toast.show = false;
    } : null;
    vue.toast.show = true;
}
function test() {
    let time = 1;
    // setTimeout(() => {
    //     VM.VUE_DATA.orderItem[0][0].score = 6;
    //     (VM.VUE_DATA.orderItem[0][0] as Item).mixNewData(new JaDb("22"))
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
        Github.test();
    }, time++ * 1000);
}
function removedIndex(result) {
    if (result.moved)
        return result.moved.oldIndex;
    if (result.removed)
        return result.removed.oldIndex;
    return null;
}
function addedIndex(result) {
    if (result.moved)
        return result.moved.newIndex;
    if (result.added)
        return result.added.newIndex;
    return null;
}
class DndHelper {
    static prepareFrom(row, col = -1) {
        this.fromRow = row;
        this.fromCol = col;
    }
    static prepareTo(row, col = -1) {
        this.toRow = row;
        this.toCol = col;
    }
    static applyDrag() {
        if (this.fromRow == -1 || this.toRow == -1)
            return;
        if ((this.fromRow == this.toRow) && (this.fromCol == this.toCol)) {
            // do nothing but reset value
        }
        else if (this.fromCol == -1) {
            VM.moveList(this.fromRow, this.toRow);
        }
        else {
            VM.moveItem(this.fromRow, this.fromCol, this.toRow, this.toCol);
        }
        console.log(`from: ${this.fromRow}, ${this.fromCol} 
        to: ${this.toRow}, ${this.toCol}`);
        this.fromRow = this.fromCol = this.toRow = this.toCol = -1;
    }
}
DndHelper.fromRow = -1;
DndHelper.fromCol = -1;
DndHelper.toRow = -1;
DndHelper.toCol = -1;
