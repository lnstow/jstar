declare class Vue {
    constructor(p: unknown)
    [prop: string]: unknown
    static set: (...p: unknown[]) => unknown
    $watch: (...p: unknown[]) => unknown
}
declare class Vuetify {
    constructor(p?: unknown)
}

let app: Vue
window.addEventListener("load", function () {
    app = new Vue({
        el: '#app',
        data: function () {
            return {
                orderItem: [],
                orderList: [],
                updateTime: 0,
                scoreColor: {
                    1: "green",
                    2: "teal",
                    3: "blue",
                    4: "purple",
                    5: "golden",
                    0: "grey",
                    "-1": "black",
                    6: "red",
                },
                newList: "",
                newItem: ""
            }
        },
        vuetify: new Vuetify(),
        methods: {
            addList: function (listIndex: number) {
                Bridge.insertData(new StarList("newList" + listIndex), listIndex)
            },
            addItem: function (listIndex: number, itemIndex: number) {
                Bridge.insertData(new JaDB("item" + itemIndex), listIndex, itemIndex)
            },
            deleteAll: function () {
                Bridge.deleteData()
            }
        }
    })

    Bridge.loadData()
        .then(v => {
            app.orderItem = v.orderItem
            app.orderList = v.orderList
            console.log(app.orderItem)
            console.log(app.orderList)
        })

})

// 网络请求https://cn.vuejs.org/v2/guide/computed.html
// let lines = "abd  ssni  mide  pred\
// ass"
// let arr = lines.split("  ")
// var app = new Vue({
//     el: '#app',
//     data: {
//         arr: arr
//     },
//     vuetify: new Vuetify(),

// })
// app.$watch('arr', function (newValue, oldValue) {
//     console.log(oldValue)
//     console.log(newValue)
// })

// setTimeout(() => {
//     arr.push("mide-asd")
// }, 2000)

// setTimeout(() => {
//     arr.splice(2, 1, "aa", "bb")
// }, 2500)

// Vue.component('todo-item', {
//     props: ['item'],
//     template: '<li>{{item}}</li>'
// })

// var app = new Vue({
//     el: '#a2',
//     data: {
//         arr: arr

//     },
//     vuetify: new Vuetify(),
// })

// new Vue({
//     el: '#vuetify',
//     data: {
//         message: "asd"
//     },
//     vuetify: new Vuetify(),
// })