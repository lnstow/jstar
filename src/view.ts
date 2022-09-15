declare class Vue {
    constructor(p: unknown)
    [prop: string]: any
    static set: <T, P extends keyof T>(
        target: T, propName: P, value: T[P]
    ) => unknown
    static delete: <T, P extends keyof T>(
        target: T, propName: P
    ) => unknown
    $watch: <T>(
        propName: string, onChange: (newV: T, oldV: T) => void
    ) => unknown
    static component: (name: string, comp: {
        props?: string[]
        template: string
        data?: () => unknown
        methods?: unknown
    }) => unknown
}
declare class Vuetify {
    constructor(p?: unknown)
}

let vue: Vue
const theme = {
    theme: {
        dark: Repo.loadDark(),
        options: {
            themeCache: {
                get: (_: any) => Repo.loadTheme(),
                set: (_: any, theme: string) => Repo.saveTheme(theme),
            },
        },
    },
}
const darkColor = {
    1: "#388e3c",
    2: "#1976d2",
    3: "#512da8",
    4: "#C18A26",// "#f57c00",
    0: "#616161",
    "-5": "#5d4037",    //zongse
    10: "#d32f2f",
    primary: "#00796b"
}
const lightColor = {
    1: "#a5d6a7",           // green 200
    2: "#90caf9",           // blue 200
    3: "#b39ddb",           // deep purple 200
    4: "#ffcc80",           // orange 200
    0: "#bdbdbd",           // grey 500
    "-5": "#947A6D",        // #947A6D 胡桃 棕色
    10: "#e57373",          // red 300
    primary: "#78C2C4"      // #78C2C4 白群 青色
    // #66BAB7 水浅葱 青色 备选主色
}
const uic = {
    dialogWidth: 700,
    cardWidth: 120,
}

window.addEventListener("focus", VM.checkUpdateTime)
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
                clickInfo: [0, 0, DataLevel.ItemNone],
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
            }
        },
        vuetify: new Vuetify(theme),
        components: {
            // https://github.com/kutlugsahin/vue-smooth-dnd/issues/167
            // 'container': (window as any).VueSmoothDnd.Container,
            // 'draggable': (window as any).VueSmoothDnd.Draggable,
        },
        methods: {
            moveEnd() { DndHelper.applyDrag() },
            moveList(dropResult: DropResult) {
                let i = removedIndex(dropResult)
                if (i != null) DndHelper.prepareFrom(i)
                i = addedIndex(dropResult)
                if (i != null) DndHelper.prepareTo(i)
            },
            moveItem(row: number, dropResult: DropResult) {
                let i = removedIndex(dropResult)
                if (i != null) DndHelper.prepareFrom(row, i)
                i = addedIndex(dropResult)
                if (i != null) DndHelper.prepareTo(row, i)
            },
            showListDialog: function (row: number, list: ListSearchResult
                = { list: vue.orderList[row], level: DataLevel.ListInMap }) {
                vue.clickInfo[0] = row
                vue.clickInfo[2] = list.level
                vue.newList = Object.assign({}, list.list)
                vue.showList = true
            },
            showItemDialog: function (row: number, col: number, item: ItemSearchResult
                = { item: vue.orderItem[row][col], level: DataLevel.ItemInList }) {
                vue.clickInfo[0] = row
                vue.clickInfo[1] = col
                vue.clickInfo[2] = item.level
                vue.newItem = Object.assign({}, item.item)
                vue.showItem = true
            },
            hideEditDialog: function () { vue.showList = false; vue.showItem = false },
            saveDataCallback: function (ok: boolean) {
                if (ok) { tempData = []; vue.hideEditDialog(); vue.searchData() }
            },
            // showSearchDialog -> searchData -> requestEditDialog 
            // -> show(Item/List)Dialog -> submitData
            showSearchDialog: function (row: number,
                requestSearchItem: boolean, col = row) {
                vue.clickInfo[0] = row
                // 下一行是为了，搜索列表时，记录首次点击的行数，因为
                // 创建多个列表时，需要保持每次插入位置都在当前行下面
                tempIdx = col
                vue.requestSearchItem = requestSearchItem
                vue.searchText = null
                vue.searchResult = []
                vue.showSearch = true
            },
            searchData: function () {
                vue.localLoading = true
                vue.searchResult = []
                debounce(vue.searchDataDelay)
            },
            searchDataDelay() {
                vue.searchResult = vue.requestSearchItem ?
                    VM.searchItem(vue.searchText, vue.clickInfo[0]) :
                    VM.searchList(vue.searchText)
                vue.localLoading = false
            },
            requestEditDialog: function (data: ItemSearchResult | ListSearchResult) {
                switch (data.level) {
                    case DataLevel.ItemNone:
                    case DataLevel.ItemInDb:
                        vue.showItemDialog(vue.clickInfo[0], tempIdx + 1, data)
                        break
                    case DataLevel.ItemInList:
                        const list = vue.orderList[vue.clickInfo[0]] as List
                        const item = (data as ItemSearchResult).item
                        const col = list.arr.indexOf(item.sid)
                        vue.showItemDialog(vue.clickInfo[0], col, data)
                        break
                    case DataLevel.ListNone:
                        vue.showListDialog(tempIdx + 1, data)
                        break
                    case DataLevel.ListInMap:
                        const row = VM.ALL_DATA.orderMap
                            .indexOf((data as ListSearchResult).list.name)
                        vue.showListDialog(row, data)
                        break
                }
            },
            submitData: function (row: number = vue.clickInfo[0],
                col: number = vue.clickInfo[1]) {
                const data = vue.showItem ? vue.newItem : vue.newList
                const cb = vue.saveDataCallback
                switch (vue.clickInfo[2] as DataLevel) {
                    case DataLevel.ItemNone:
                        VM.insertItem(data, row, col).then(cb)
                        break
                    case DataLevel.ItemInList:
                        VM.updateItem(data, row, col).then(cb)
                        break
                    case DataLevel.ItemInDb:
                        VM.insertItem(data, row, col).then(cb)
                        break
                    case DataLevel.ListNone:
                        VM.insertList(data, row).then(cb)
                        break
                    case DataLevel.ListInMap:
                        VM.updateList(data, row).then(cb)
                        break
                }
            },
            submitBtnText: function () {
                if (vue == null) return ""
                switch (vue.clickInfo[2] as DataLevel) {
                    case DataLevel.ItemNone: case DataLevel.ListNone: return "添加"
                    case DataLevel.ItemInList: case DataLevel.ListInMap: return "修改"
                    case DataLevel.ItemInDb: return "修改并添加"
                    default: return ""
                }
            },
            dialogTitle: function () {
                if (vue == null) return ""
                if (vue.showItem) return vue.submitBtnText() + '---' + vue.newItem.sid
                else return vue.submitBtnText() + '---' + vue.newList.name
            },
            iconEdit(level: DataLevel = vue?.clickInfo?.[2]): boolean {
                return level != DataLevel.ItemNone && level != DataLevel.ListNone
            },
            iconCreate(level: DataLevel = vue?.clickInfo?.[2]): boolean {
                return level != DataLevel.ItemInList && level != DataLevel.ListInMap
            },
            switchNextItem(next: boolean) {
                let row = vue.clickInfo[0], col = vue.clickInfo[1]
                col += next ? 1 : -1
                if (col == vue.orderList[row].arr.length) {
                    if (++row == vue.orderList.length) return
                    col = 0
                } else if (col == -1) {
                    if (--row == -1) return
                    col = vue.orderList[row].arr.length - 1
                }
                vue.showItemDialog(row, col)
            },
            switchListExpand: function (row: number) {
                const list = vue.orderList[row] as List
                list.e ^= 1
                VM.updateList(list, row, false)
            },
            deleteList: function (row: number) {
                VM.newHint("删除列表后不能撤销，你确定吗？",
                    ["确定删除", () => VM.deleteList(row)], VM.hintCancelBtn)
            },
            deleteItem: function (row: number, col: number) {
                vue.newItem = vue.orderItem[row][col]
                VM.deleteItem(row, col).then(ok => {
                    if (ok) newToast("已删除", ["撤销", () => {
                        VM.insertItem(vue.newItem, row, col)
                    }])
                })
            },
            importData: function (ev: Event) {
                const input = ev.target as HTMLInputElement
                if (input.files != null && input.value) {
                    const file = input.files[0]
                    input.value = ""
                    VM.importData(file)
                }
            },
            aboutData(opt: string) {
                switch (opt) {
                    case "sid": copyText(vue.newItem.sid); break
                    case "upload": VM.newHint("本地数据 将覆盖 远程数据",
                        ["确定上传", VM.uploadData], VM.hintCancelBtn)
                        break
                    case "download": VM.newHint("远程数据 将覆盖 本地数据",
                        ["确定下载", VM.downloadData], VM.hintCancelBtn)
                        break
                    case "clear": VM.newHint("清空本地数据？",
                        ["确定", VM.clearData], VM.hintCancelBtn)
                        break
                    case "export": VM.exportData(); break
                }
            },
            aboutRemote(opt: string) {
                switch (opt) {
                    case "gist": shareUrl(true); break
                    case "token": shareUrl(false); break
                    case "help": Remote.gotoProject(); break
                    case "access": Remote.gotoGist(); break
                    case "edit": withNetwork(async () => {
                        if (await Github.createGist(vue.uis.token))
                            newToast("修改成功")
                    })
                }
            },
            transform(item: Item, key: keyof Item, value: string): string {
                return PM.parseItemProp(item, key, value)
            },
        },
        computed: {
            uic() { return uic },
        },
    })

    vue.$watch("searchText", (n, o) => {
        if (n == '') vue.searchText = null
        if (vue.showSearch) vue.searchData()
    })

    vue.$watch<boolean>("$vuetify.theme.dark", (n, o) => {
        Repo.saveDark(n)
        vue.colorss = n ? darkColor : lightColor
    })
    vue.$watch<boolean>("networkMode", (n, o) => Repo.saveNetwork(n))
    vue.$watch<boolean>("showItem", restoreSearchResult)
    vue.$watch<boolean>("showList", restoreSearchResult)

    init()
    test()
})

let tempIdx = 0
let tempData: any
function restoreSearchResult(otherDialogShow: boolean) {
    if (vue.showSearch) {
        if (otherDialogShow) {
            tempData = vue.searchResult
            vue.searchResult = []
        } else vue.searchResult = tempData
    }
}

function init() {
    VM.loadData().then(v => {
        vue.orderItem = v.orderItem
        vue.orderList = v.orderList
        vue.hint = v.hint
    })
}

let debounceTimer: number | null = null
function debounce(fn: Function, delay: number = 500) {
    if (debounceTimer != null) clearTimeout(debounceTimer)
    debounceTimer = setTimeout(fn, delay)
}

function shareUrl(forGist: boolean) {
    copyText(Github.getShareUrl(forGist, !forGist))
}

async function copyText(text: string) {
    try {
        await navigator.clipboard.writeText(text)
        newToast("已复制")
    } catch (error) {
        console.error(error)
        newToast(text)
    }
}

async function withNetwork(block: () => Promise<void>) {
    if (!VM.checkUpdateTime()) return
    vue.networkLoading = true
    await block()
    vue.networkLoading = false
}

function newToast(msg: string, btn: BtnCallback | null = null) {
    vue.toast.msg = msg
    vue.toast.btn = btn ? btn[0] : null
    vue.toast.click = btn ? () => {
        btn[1]()
        vue.toast.show = false
    } : null
    vue.toast.show = true
}

function test() {
    let time = 1

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
        Github.test()
    }, time++ * 1000);
}

// function initView() {
//     Vue.component("score-radio", {
//         props: ["score", "color"],
//         template: `<v-radio :value="score" :color="color">
//         <template v-slot:label>
//             <span :style="{color: color}"><slot></slot></span>
//         </template>
//     </v-radio>`
//     })
// }

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
 */

declare type DropResult = {
    added: { newIndex: number } | null
    removed: { oldIndex: number } | null
    moved: { newIndex: number, oldIndex: number } | null
}
function removedIndex(result: DropResult) {
    if (result.moved) return result.moved.oldIndex
    if (result.removed) return result.removed.oldIndex
    return null
}
function addedIndex(result: DropResult) {
    if (result.moved) return result.moved.newIndex
    if (result.added) return result.added.newIndex
    return null
}
class DndHelper {
    private static fromRow = -1
    private static fromCol = -1
    private static toRow = -1
    private static toCol = -1
    static prepareFrom(row: number, col: number = -1) {
        this.fromRow = row
        this.fromCol = col
    }
    static prepareTo(row: number, col: number = -1) {
        this.toRow = row
        this.toCol = col
    }
    static applyDrag() {
        if (this.fromRow == -1 || this.toRow == -1) return
        if ((this.fromRow == this.toRow) && (this.fromCol == this.toCol)) {
            // do nothing but reset value
        } else if (this.fromCol == -1) {
            VM.moveList(this.fromRow, this.toRow)
        } else {
            VM.moveItem(this.fromRow, this.fromCol, this.toRow, this.toCol)
        }
        console.log(`from: ${this.fromRow}, ${this.fromCol} 
        to: ${this.toRow}, ${this.toCol}`)

        this.fromRow = this.fromCol = this.toRow = this.toCol = -1
    }
}
