/// <reference path = "UI.js"/>
/// <reference path = "practice.js"/>
/// <reference path = "header.js"/>

const { ipcRenderer } = require("electron");


window.onload = () => { // 渲染进程入口
    console.log("onload");
    config = JSON.parse(ipcRenderer.sendSync(getConfig)); //////////////////////////// 需要异步
    UI.init();
    practice_init();
}

window.onresize = () => {
    UI.onSizeChange();
}