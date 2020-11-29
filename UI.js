/// <reference path = "practice.js" />
/// <reference path = "index.js" />

const REPLACE = "replace";
const NOT_REPLACE = "notReplace";
const WAIT = "wait";

const lightOpacity = 0.7;

const UI = {

    windowW: 0,
    windowH: 0,

    drawQueue: [], // 需要重绘时推入队列, 重绘完成时需要返回完成标识, 不然不会被清出队列
    onSizeChangeQueue: [],

    pushIntoDrawQueue: function(funcAndID, mode = REPLACE) { // 参数包括了绘制函数和这个绘制函数的ID, 以及遇到相同ID的绘制函数时的处理模式; 如果直接传入函数, 那么就不做处理直接放入队列, ID = ""
        //如果 mode == REPLACE 那么老函数舍弃，新函数推入队末
        if (typeof funcAndID == "function") { // 如果funcAndID 是一个函数, 那么直接放入队列
            UI.drawQueue.push({ func: funcAndID, id: "" });
        } else {
            let id = funcAndID.id;
            let needToPushIntoDrawQueue = true;
            for (let i = 0; i < UI.drawQueue.length; i++) {
                if (id == UI.drawQueue[i].id && mode == REPLACE) {
                    UI.drawQueue.splice(i, 1);
                    i--;
                }
            }
            if (needToPushIntoDrawQueue) {
                UI.drawQueue.push(funcAndID);
            }
        }

        if (!UI.onDrawLoop_working) {
            UI.exe_requestAnimationFrame();
        }
    },
    pushIntoOnSizeChanegQueue: function(func) {
        UI.onSizeChangeQueue.push(func);
    },

    animationFrameHandle: 0,

    updateWindowInfo: function() {
        UI.windowW = document.body.clientWidth;
        UI.windowH = document.body.clientHeight;
    },

    init: function() {
        UI.windowH = document.documentElement.clientHeight;
        UI.windowW = document.documentElement.clientWidth;
        UI_config.init();
        document.getElementsByTagName("html")[0].style.backgroundColor = UI_config.color.colorToHex(UI_config.color[config.colorMode].background0);
        document.body.style.backgroundColor = UI_config.color.colorToHex(UI_config.color[config.colorMode].background0);

        for (const key in UI) {
            if (UI.hasOwnProperty(key)) {
                if (typeof UI[key] == "object" && UI[key].hasOwnProperty("init")) {
                    UI[key].init();
                }
            }
        }
        if (!UI.onDrawLoop_working) {
            UI.exe_requestAnimationFrame();
        }
    },

    onSizeChange: function() {
        UI.windowH = document.documentElement.clientHeight;
        UI.windowW = document.documentElement.clientWidth;
        for (let i = 0; i < UI.onSizeChangeQueue.length; i++) {
            var resizeFunc = UI.onSizeChangeQueue[i];
            resizeFunc();
        }
    },

    exe_requestAnimationFrame: function() {
        UI.onDrawLoop_working = true;
        window.requestAnimationFrame(UI.onDraw);
    },

    onDrawLoop_working: false,
    onDraw: function(timestamp) { // 处理绘制队列
        UI.onDrawLoop_working = true;
        for (let i = 0; i < UI.drawQueue.length; i++) {
            let drawFunc = UI.drawQueue[i].func;
            //console.log("in onDraw:  ", UI.drawQueue[i].id);
            let result = drawFunc(timestamp);
            if (result == FINISH) {
                UI.drawQueue.splice(i, 1)
                i--;
            }
        }
        if (UI.drawQueue.length > 0) {
            UI.exe_requestAnimationFrame();
        } else {
            UI.onDrawLoop_working = false;
        }
        if (UI.needToFrameCount) UI.frameCount++; //////////////////////////////
        //console.log("时间差：", (timestamp - UI.lastTimestamp));
        UI.lastTimestamp = timestamp;
    },

    lastTimestamp: 0,
    frameCount: 0,
    recordStartTime: 0,
    needToFrameCount: false,
    requestToRecordFPS: function() {
        UI.frameCount = 0;
        UI.recordStartTime = new Date().getTime();
        UI.needToFrameCount = true;
    },
    printFPS() {
        if (!UI.needToFrameCount) return;
        UI.needToFrameCount = false;
        let nowTime = new Date().getTime();
        console.log("FPS: ", Math.round(1000 * UI.frameCount / (nowTime - UI.recordStartTime)));
        console.log("ms per frame: ", Math.round((nowTime - UI.recordStartTime) / UI.frameCount));
        console.log("total frame & ms: ", UI.frameCount, Math.round((nowTime - UI.recordStartTime)));
    },

    main: {
        toolbar: {
            setting: {},
            statistics: {}
        },

        redraw: function() {

        }
    },

    toolBar: {
        init() {
            document.getElementById("toolBar").style.backgroundColor = UI_config.color.colorToHex(UI_config.color[config.colorMode].background1);
        }
    },

    setting: {

    },

    statistics: {

    }
};

function calEaseOutFactor(spendTime, intervalTime, totalAnimationTime) { // 返回X；  下一个值 = 目标值 - （目标 - 现有） * X , 因此，即使窗口尺寸变了，也只需要重新设置target就行了，动画不会被影响 //ease-out
    if (spendTime + intervalTime >= totalAnimationTime) {
        return 0;
    }
    var ratio = spendTime / totalAnimationTime;
    var finishedDistancePercentage = 2 * ratio - ratio * ratio; // 已完成的路程占总行程的百分之几
    ratio = (spendTime + intervalTime) / totalAnimationTime;
    var nextStepDistancePercentage = 2 * ratio - ratio * ratio; // 即将完成的路程占总行程的百分之几
    return (1 - nextStepDistancePercentage) / (1 - finishedDistancePercentage);
}

function calLinearFactor(spendTime, intervalTime, totalAnimationTime) { // 返回X；  下一个值 = 目标值 - （目标 - 现有） * X , 因此，即使窗口尺寸变了，也只需要重新设置target就行了，动画不会被影响 //ease-out
    if (spendTime + intervalTime >= totalAnimationTime) {
        return 0;
    }
    var finishedDistancePercentage = spendTime / totalAnimationTime; // 已完成的路程占总行程的百分之几
    var nextStepDistancePercentage = (spendTime + intervalTime) / totalAnimationTime; // 即将完成的路程占总行程的百分之几
    return (1 - nextStepDistancePercentage) / (1 - finishedDistancePercentage);
}

function calEaseInFactor(spendTime, intervalTime, totalAnimationTime) { // 返回X；  下一个值 = 目标值 - （目标 - 现有） * X , 因此，即使窗口尺寸变了，也只需要重新设置target就行了，动画不会被影响 //ease-out
    if (spendTime + intervalTime >= totalAnimationTime) {
        return 0;
    }
    var ratio = spendTime / totalAnimationTime;
    var finishedDistancePercentage = Math.pow(ratio, 3); // 已完成的路程占总行程的百分之几
    ratio = (spendTime + intervalTime) / totalAnimationTime;
    var nextStepDistancePercentage = Math.pow(ratio, 3); // 即将完成的路程占总行程的百分之几
    return (1 - nextStepDistancePercentage) / (1 - finishedDistancePercentage);
}


const UI_config = {
    init: function() {
        UI_config.color.init();
    },
    color: {
        currentColorSet: "",
        dark: {
            background0: { // #121212
                R: 18,
                G: 18,
                B: 18
            },
            background1: { // #2d2d30
                R: 45,
                G: 45,
                B: 48
            },
            font_normal: { // #C2C2C2
                R: 194,
                G: 194,
                B: 194
            },
            font_corrent: { // #38C680
                R: 56,
                G: 198,
                B: 128
            },
            font_wrong: { // #E64242
                R: 230,
                G: 66,
                B: 66
            }
        },
        light: {
            background0: { // #fafafa
                R: 250,
                G: 250,
                B: 250
            },
            background1: { // #cccccc
                R: 204,
                G: 204,
                B: 204
            },
            font_normal: { // #000000
                R: 0,
                G: 0,
                B: 0
            },
            font_corrent: { // #119B33
                R: 17,
                G: 155,
                B: 51
            },
            font_wrong: { // ##FF1616
                R: 255,
                G: 22,
                B: 22
            }
        },
        colorToHex: function(color) {
            let ret = '#';
            let temp = ""
            temp = (color.R).toString(16);
            if (temp.length < 2) temp = "0" + temp;
            ret += temp;
            temp = (color.G).toString(16);
            if (temp.length < 2) temp = "0" + temp;
            ret += temp;
            temp = (color.B).toString(16);
            if (temp.length < 2) temp = "0" + temp;
            ret += temp;
            return ret;
        },
        init: function() {
            var thisObj = UI_config.color;
            thisObj.currentColorSet = config["colorMode"];
        }
    }
}

function styleColorToRGB(styleColor) {
    let r = 0;
    let g = 0;
    let b = 0;
    if (styleColor.indexOf('rgb') > -1) {
        let temp = styleColor.replace("rgb", "");
        temp = temp.replace("(", "");
        temp = temp.replace(")", "");
        temp = temp.replace(" ", "");

        r = parseInt(temp.substring(0, temp.indexOf(",")));
        temp = temp.substring(temp.indexOf(',') + 1);
        g = parseInt(temp.substring(0, temp.indexOf(",")));
        temp = temp.substring(temp.indexOf(',') + 1);
        b = parseInt(temp.substring(0));
    }
    return { R: r, G: g, B: b };
}