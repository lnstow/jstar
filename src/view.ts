declare class Vue {
    constructor(p: unknown)
    [prop: string]: any
    static set: <T, P extends keyof T>(
        target: T,
        propName: P,
        value: T[P]
    ) => unknown
    $watch: <T>(
        propName: string,
        onChange: (newV: T, oldV: T) => void
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
    4: "#f57c00",
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

window.addEventListener("focus", function () {
    vue.checkDataValid()
})

window.addEventListener("load", function () {
    initView()
    vue = new Vue({
        el: '#app',
        data: function () {
            return {
                orderItem: [],
                orderList: [],
                scoreColor: Repo.loadDark() ? darkColor : lightColor,
                // todo rename
                colors: {},
                handleConflict: {
                    message: "",
                    negative: ["", () => { }],
                    positive: ["", () => { }]
                },
                newList: new NormalList(""),
                newItem: new NormalItem(""),
                showItem: false,
                showList: false,
                formRules: [],
                /** row,col,create */
                clickInfo: [0, 0, true],
                globalEditMode: false,
                localLoading: false,
                remoteLoading: false,
                searchText: "",
                st2: "",
                st3: "",
                searchResult: [],
            }
        },
        vuetify: new Vuetify(theme),
        methods: {
            checkDataValid: function () { VM.checkUpdateTime() },
            showListDialog: function (create: boolean, row: number) {
                vue.clickInfo[0] = row
                vue.clickInfo[2] = create
                vue.newList = new NormalList("")
                if (!create) Object.assign(vue.newList, vue.orderList[row])
                vue.showList = true
            },
            hideListDialog: function () { vue.showList = false },
            showItemDialog: function (create: boolean, row: number, col: number = 0) {
                vue.clickInfo[0] = row
                vue.clickInfo[1] = col
                vue.clickInfo[2] = create
                vue.newItem = new NormalItem("")
                if (!create) Object.assign(vue.newItem, vue.orderItem[row][col])
                vue.showItem = true
            },
            hideItemDialog: function () { vue.showItem = false },

            submitData: function (
                row: number = vue.clickInfo[0],
                col: number = vue.clickInfo[1]
            ) {
                const data = vue.showItem ? vue.newItem : vue.newList
                const opt = vue.clickInfo[2] ? SaveOpt.Insert : SaveOpt.Update
                VM.saveData(data, opt, row, col).then(ok => {
                    ok ? vue.hideListDialog() : console.log("shibai");
                })
            },
            searchItem: function () {
                vue.localLoading = true
                vue.searchResult = []
                debounce(() => {
                    vue.searchResult = VM.searchItem(vue.st2, vue.clickInfo[0])
                    vue.localLoading = false
                })
            },
            testClick: function () {
                console.log("213");

            },
            importData: function (ev: Event) {
                const input = ev.target as HTMLInputElement
                console.log(input.files);
                console.log(input.value);


                if (input.files != null) {
                    const files = input.files
                    input.value = ""

                    VM.importData(files)

                }
            },
            exportData: function () {
                VM.exportData()
            },
            clearData: function () {
                VM.clearData()
            }
        },
        computed: {
            searchData: function () {
                return Object.keys(VM.ALL_DATA.itemTable)
            },
            vc: (a: unknown, b: unknown) => false,
        }
    })

    vue.$watch("handleConflict", (n, o) => {
        console.log("change!!!!!!!!");

    })

    vue.$watch("searchText", (n, o) => {
        console.log(`searchText: ${n}`);

    })
    vue.$watch("st2", (n, o) => {
        console.log(`st2: ${n}`);
        vue.searchItem()
    })
    vue.$watch("st3", (n, o) => {
        console.log(`st3: ${n}`);
    })

    vue.$watch<boolean>("$vuetify.theme.dark", (n, o) => {
        Repo.saveDark(n)
        vue.scoreColor = n ? darkColor : lightColor
    })

    init()

    test()

})

function init() {
    VM.loadData()
        .then(v => {
            vue.orderItem = v.orderItem
            vue.orderList = v.orderList
            vue.handleConflict = v.handleConflict
            console.log(vue.orderItem)
            console.log(vue.orderList)
        })
}

let debounceTimer: number | null = null
function debounce(fn: Function, delay: number = 999) {
    if (debounceTimer != null) clearTimeout(debounceTimer)
    debounceTimer = setTimeout(fn, delay)
}

function test() {
    let time = 1

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
    })

    // Vue.component("score-radio", {
    //     props: ["score", "color", "text"],
    //     template: `<v-radio :value="score" :color="color">
    //     <template v-slot:label>
    //         <span :style="{color: color}">{{text}}</span>
    //     </template>
    // </v-radio>`
    // })

}
// 网络请求https://cn.vuejs.org/v2/guide/computed.html
// vue.$watch('arr', function (newValue, oldValue) {
//     console.log(oldValue)
//     console.log(newValue)
// })

// Vue.component('todo-item', {
//     props: ['item'],
//     template: '<li>{{item}}</li>'
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