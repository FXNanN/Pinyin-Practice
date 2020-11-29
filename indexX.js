const { ipcRenderer } = require("electron");
const getPhrase = "getPhrase";
const getScheme = "getScheme";
const getConfig = "getConfig";
const getZhuyinDifficulty = "getZhuyinDifficulty";
const getNormalSolvingTime = "getNormalSolvingTime";
const updateStatistics = "updateStatistics";
const getStatistics = "getStatistics";

const FINISH = 0;
const UNFINISH = 1;

const REPLACE = "replace";
const NOT_REPLACE = "notReplace";
const WAIT = "wait";

const lightOpacity = 0.7;

const UI = {

    windowW: 0,
    windowH: 0,

    drawQueue: [], // 需要重绘时推入队列, 重绘完成时需要返回完成标识, 不然不会被清出队列
    onSizeChangeQueue: [],

    pushIntoDrawQueue: function (funcAndID, mode = REPLACE) { // 参数包括了绘制函数和这个绘制函数的ID, 以及遇到相同ID的绘制函数时的处理模式; 如果直接传入函数, 那么就不做处理直接放入队列, ID = ""
        if (typeof funcAndID == "function") { // 如果funcAndID 是一个函数, 那么直接放入队列
            UI.drawQueue.push({func: funcAndID, id: ""});
        }
        else {
            let id = funcAndID.id;
            let needToPushIntoDrawQueue = true;
            for (let i = 0; i < UI.drawQueue.length; i++) {
                if (id == UI.drawQueue[i].id && mode == REPLACE) {
                    UI.drawQueue[i].func = funcAndID.func;
                    needToPushIntoDrawQueue = false;
                }
            }
            if (needToPushIntoDrawQueue) {
                UI.drawQueue.push(funcAndID);
            }
        }

        if (!UI.onDrawLoop_working) {
            UI.animationFrameHandle = window.requestAnimationFrame(UI.onDraw);
        }
    },
    pushIntoOnSizeChanegQueue: function (func) {
        UI.onSizeChangeQueue.push(func);
    },

    animationFrameHandle: 0,

    updateWindowInfo: function () {
        UI.windowW = document.body.clientWidth;
        UI.windowH = document.body.clientHeight;
    },

    init: function () {
        UI.windowH = document.documentElement.clientHeight;
        UI.windowW = document.documentElement.clientWidth;
        console.log("on UI init");
        for (const key in UI) {
            if (UI.hasOwnProperty(key)) {
                if (typeof UI[key] == "object" && UI[key].hasOwnProperty("init")) {
                    console.log("in UI init, has init method", key);
                    UI[key].init();
                }
            }
        }
        UI.animationFrameHandle = window.requestAnimationFrame(UI.onDraw);
    },

    onSizeChange: function () {
        UI.windowH = document.documentElement.clientHeight;
        UI.windowW = document.documentElement.clientWidth;
        for (let i = 0; i < UI.onSizeChangeQueue.length; i++) {
            var resizeFunc = UI.onSizeChangeQueue[i];
            resizeFunc();
        }
    },

    onDrawLoop_working: false,
    onDraw: function (timestamp) { // 处理绘制队列
        UI.onDrawLoop_working = true;
        for (let i = 0; i < UI.drawQueue.length; i++) {
            let drawFunc = UI.drawQueue[i].func;
            let result = drawFunc(timestamp);
            if (result == FINISH) {
                UI.drawQueue.splice(i, 1)
                i--;
            }
        }
        if (UI.drawQueue.length > 0) {
            UI.animationFrameHandle = window.requestAnimationFrame(UI.onDraw);
        }
        else {
            UI.onDrawLoop_working = false;
        }
    },

    //////////////////////////////////////////

    easeOutFactor: function (spendTime, intervalTime, totalAnimationTime) { // 返回X；  下一个值 = 目标值 - （目标 - 现有） * X , 因此，即使窗口尺寸变了，也只需要重新设置target就行了，动画不会被影响 //ease-out
        if (spendTime + intervalTime >= totalAnimationTime) {
            return 0;
        }
        var ratio = spendTime / totalAnimationTime;
        var finishedDistancePercentage = 2 * ratio - ratio * ratio; // 已完成的路程占总行程的百分之几
        ratio = (spendTime + intervalTime) / totalAnimationTime;
        var nextStepDistancePercentage = 2 * ratio - ratio * ratio; // 即将完成的路程占总行程的百分之几
        return (1 - nextStepDistancePercentage) / (1 - finishedDistancePercentage);
    },
    linearFactor: function (spendTime, intervalTime, totalAnimationTime) { // 返回X；  下一个值 = 目标值 - （目标 - 现有） * X , 因此，即使窗口尺寸变了，也只需要重新设置target就行了，动画不会被影响 //ease-out
        if (spendTime + intervalTime >= totalAnimationTime) {
            return 0;
        }
        var finishedDistancePercentage = spendTime / totalAnimationTime; // 已完成的路程占总行程的百分之几
        var nextStepDistancePercentage = (spendTime + intervalTime) / totalAnimationTime; // 即将完成的路程占总行程的百分之几
        return (1 - nextStepDistancePercentage) / (1 - finishedDistancePercentage);
    },

    /////////////////////////////////////////

    main: {
        toolbar: {
            setting: {},
            statistics: {}
        },

        redraw: function () {

        }
    },

    practiceArea: {

        init: function () {
            let thisObj = UI.practiceArea;
            for (const key in thisObj) {
                if (thisObj.hasOwnProperty(key)) {
                    if (typeof thisObj[key] == "object" && thisObj[key].hasOwnProperty("init")) {
                        thisObj[key].init();
                    }
                }
            }
        },

        floatingArea: {

            preBlock_index: 0,
            currentBlock_index: 0,
            nextBlock_index: 0,
            hiddenBlock_index: 0,

            textBlocks: [], //[{"e": blockElement}]

            init: function () {
                console.log("floating area on init");
                var thisObj = UI.practiceArea.floatingArea;

                UI.onSizeChangeQueue.push(thisObj.onSizeChange);

                thisObj.textBlocks.push({ "e": document.getElementById("floatingBlock1") });
                thisObj.textBlocks.push({ "e": document.getElementById("floatingBlock2") });
                thisObj.textBlocks.push({ "e": document.getElementById("floatingBlock3") });
                thisObj.textBlocks.push({ "e": document.getElementById("floatingBlock0") });
                thisObj.preBlock_index = 0;
                thisObj.currentBlock_index = 1;
                thisObj.nextBlock_index = 2;
                thisObj.hiddenBlock_index = 3;

                var currentBlock = UI.practiceArea.floatingArea.textBlocks[UI.practiceArea.floatingArea.currentBlock_index]['e'];
                var nextBlock = UI.practiceArea.floatingArea.textBlocks[UI.practiceArea.floatingArea.nextBlock_index]['e'];
                var preBlock = UI.practiceArea.floatingArea.textBlocks[UI.practiceArea.floatingArea.preBlock_index]['e'];
                var hiddenBlock = UI.practiceArea.floatingArea.textBlocks[UI.practiceArea.floatingArea.hiddenBlock_index]['e'];

                var currentBlockFontSize = thisObj.calCurrentBlockFontSize();
                var smallBlockFontSize = thisObj.calSmallBlockFontSize(currentBlockFontSize);
                currentBlock.style.fontSize = currentBlockFontSize + 'px';
                nextBlock.style.fontSize = smallBlockFontSize + "px";
                preBlock.style.fontSize = smallBlockFontSize + "px";
                hiddenBlock.style.fontSize = smallBlockFontSize + "px";

                var loadPhraseResult = practiceCore.getPhrase();
                thisObj.setBlockText(thisObj.textBlocks[thisObj.currentBlock_index]["e"], loadPhraseResult.current);
                thisObj.setBlockText(thisObj.textBlocks[thisObj.nextBlock_index]["e"], loadPhraseResult.next);
                thisObj.zhuyinArea.init();
                UI.pushIntoDrawQueue({func: UI.practiceArea.floatingArea.redraw, id: "practiceArea_floatingArea_redraw"}, NOT_REPLACE);
            },

            setBlockText: function (floatingBlock, phrase) {
                var thisObj = UI.practiceArea.floatingArea;
                for (let i = 0; i < phrase.length; i++) {
                    let span = document.createElement("span");
                    span.textContent = phrase[i];
                    floatingBlock.appendChild(span);
                }
            },

            animation: {
                switchTime: 250, // ms

                setTarget: function () {
                    var thisObj = UI.practiceArea.floatingArea.animation;

                    thisObj.currentBlockFontSize = UI.practiceArea.floatingArea.calCurrentBlockFontSize();
                    thisObj.smallBlockFontSize = UI.practiceArea.floatingArea.calSmallBlockFontSize(thisObj.currentBlockFontSize);
                    thisObj.intervalW = UI.practiceArea.floatingArea.calIntervalW();

                    var blockHorizontalCentralAxis = UI.windowH * 0.382; // start from left top
                    thisObj.target_currentBlock_fontSize = thisObj.currentBlockFontSize;
                    thisObj.target_preBlock_fontSize = thisObj.smallBlockFontSize;
                    thisObj.target_hiddenBlock_fontSize = thisObj.smallBlockFontSize;
                    thisObj.target_nextBlock_fontSize = thisObj.smallBlockFontSize;

                    var currentBlock = UI.practiceArea.floatingArea.textBlocks[UI.practiceArea.floatingArea.currentBlock_index]['e'];
                    var nextBlock = UI.practiceArea.floatingArea.textBlocks[UI.practiceArea.floatingArea.nextBlock_index]['e'];
                    var preBlock = UI.practiceArea.floatingArea.textBlocks[UI.practiceArea.floatingArea.preBlock_index]['e'];
                    var hiddenBlock = UI.practiceArea.floatingArea.textBlocks[UI.practiceArea.floatingArea.hiddenBlock_index]['e'];

                    var origin_currentBlock_fontSize = window.getComputedStyle(currentBlock, null).fontSize;
                    var origin_preBlock_fontSize = window.getComputedStyle(preBlock, null).fontSize;
                    var origin_hiddenBlock_fontSize = window.getComputedStyle(hiddenBlock, null).fontSize;
                    var origin_nextBlock_fontSize = window.getComputedStyle(nextBlock, null).fontSize;

                    // assume the font size 
                    currentBlock.style.fontSize = thisObj.target_currentBlock_fontSize + 'px';
                    nextBlock.style.fontSize = thisObj.target_nextBlock_fontSize + 'px';
                    preBlock.style.fontSize = thisObj.target_preBlock_fontSize + 'px';
                    hiddenBlock.style.fontSize = thisObj.target_hiddenBlock_fontSize + 'px';

                    thisObj.target_currentBlock_W = currentBlock.offsetWidth;
                    thisObj.target_currentBlock_H = currentBlock.offsetHeight;
                    thisObj.target_nextBlock_W = nextBlock.offsetWidth;
                    thisObj.target_nextBlock_H = nextBlock.offsetHeight;
                    thisObj.target_preBlock_W = preBlock.offsetWidth;
                    thisObj.target_preBlock_H = preBlock.offsetHeight;
                    thisObj.target_hiddenBlock_W = hiddenBlock.offsetWidth;
                    thisObj.target_hiddenBlock_H = hiddenBlock.offsetHeight;

                    thisObj.target_currentBlock_L = Math.round(UI.windowW / 2 - thisObj.target_currentBlock_W / 2);
                    thisObj.target_currentBlock_T = Math.round(blockHorizontalCentralAxis - thisObj.target_currentBlock_H / 2);

                    thisObj.target_nextBlock_L = Math.round(thisObj.target_currentBlock_L + thisObj.target_currentBlock_W + thisObj.intervalW);
                    thisObj.target_nextBlock_T = Math.round(blockHorizontalCentralAxis - thisObj.target_nextBlock_H / 2);

                    thisObj.target_preBlock_L = Math.round(thisObj.target_currentBlock_L - thisObj.intervalW - thisObj.target_preBlock_W);
                    thisObj.target_preBlock_T = Math.round(blockHorizontalCentralAxis - thisObj.target_preBlock_H / 2);

                    thisObj.target_hiddenBlock_L = Math.round(thisObj.target_preBlock_L - thisObj.intervalW - thisObj.target_hiddenBlock_W);
                    thisObj.target_hiddenBlock_T = Math.round(blockHorizontalCentralAxis - thisObj.target_hiddenBlock_H / 2);

                    currentBlock.style.fontSize = origin_currentBlock_fontSize;
                    nextBlock.style.fontSize = origin_nextBlock_fontSize;
                    preBlock.style.fontSize = origin_preBlock_fontSize;
                    hiddenBlock.style.fontSize = origin_hiddenBlock_fontSize;
                },

                isOnAnimation: false,

                smallBlockFontSize: 0,
                currentBlockFontSize: 0,

                intervalW: 0,

                origin_currentBlock_L: 0, // left      looks like that:  [pre] [current] [next]  change name and become   <-- [hidden] [pre] [current] [next]
                origin_currentBlock_T: 0, // top
                origin_currentBlock_fontSize: 0,
                origin_currentBlock_opacity: lightOpacity,
                origin_nextBlock_L: 0,
                origin_nextBlock_T: 0,
                origin_nextBlock_fontSize: 0,
                origin_nextBlock_opacity: 0,
                origin_preBlock_L: 0,
                origin_preBlock_T: 0,
                origin_preBlock_fontSize: 0,
                origin_preBlock_opacity: 1,
                origin_hiddenBlock_L: 0,
                origin_hiddenBlock_T: 0,
                origin_hiddenBlock_fontSize: 0,
                origin_hiddenBlock_opacity: lightOpacity,

                target_currentBlock_L: 0,
                target_currentBlock_T: 0,
                target_currentBlock_W: 0,
                target_currentBlock_H: 0,
                target_currentBlock_fontSize: 0,
                target_currentBlock_opacity: 1,

                target_nextBlock_L: 0,
                target_nextBlock_T: 0,
                target_nextBlock_W: 0,
                target_nextBlock_H: 0,
                target_nextBlock_fontSize: 0,
                target_nextBlock_opacity: lightOpacity,

                target_preBlock_L: 0,
                target_preBlock_T: 0,
                target_preBlock_W: 0,
                target_preBlock_H: 0,
                target_preBlock_fontSize: 0,
                target_preBlock_opacity: lightOpacity,

                target_hiddenBlock_L: 0,
                target_hiddenBlock_T: 0,
                target_hiddenBlock_W: 0,
                target_hiddenBlock_H: 0,
                target_hiddenBlock_fontSize: 0,
                target_hiddenBlock_opacity: 0,

                moveToNext_startTime: 0,
                moveToNext_lastExeTime: 0,

                moveToNext: function (timestamp) {
                    /*
                    在动画过程中，会产生变化的量有：
                    1. 位置
                    2. 字体大小，以及div大小
                    3. 透明度
                    */

                    var currentBlock = UI.practiceArea.floatingArea.textBlocks[UI.practiceArea.floatingArea.currentBlock_index]['e'];
                    var nextBlock = UI.practiceArea.floatingArea.textBlocks[UI.practiceArea.floatingArea.nextBlock_index]['e'];
                    var preBlock = UI.practiceArea.floatingArea.textBlocks[UI.practiceArea.floatingArea.preBlock_index]['e'];
                    var hiddenBlock = UI.practiceArea.floatingArea.textBlocks[UI.practiceArea.floatingArea.hiddenBlock_index]['e'];

                    var thisObj = UI.practiceArea.floatingArea.animation;
                    if (!thisObj.isOnAnimation) { // init the animation
                        thisObj.isOnAnimation = true;
                        thisObj.setTarget();
                        thisObj.moveToNext_startTime = timestamp;
                        thisObj.moveToNext_lastExeTime = timestamp;
                        nextBlock.style.visibility = "visible";
                        // set hiddenBlock position
                        nextBlock.style.left = currentBlock.offsetLeft + currentBlock.offsetWidth + "px";
                        nextBlock.style.top = currentBlock.offsetTop + "px";
                    }

                    //get current style.

                    var now_currentBlock_L = currentBlock.offsetLeft;
                    var now_currentBlock_T = currentBlock.offsetTop;
                    var now_currentBlock_opacity = window.getComputedStyle(currentBlock, null).opacity;
                    var now_currentBlock_fontSize = parseInt(window.getComputedStyle(currentBlock, null).fontSize);

                    var now_preBlock_L = preBlock.offsetLeft;
                    var now_preBlock_T = preBlock.offsetTop;
                    var now_preBlock_opacity = window.getComputedStyle(preBlock, null).opacity;
                    var now_preBlock_fontSize = parseInt(window.getComputedStyle(preBlock, null).fontSize);

                    var now_nextBlock_L = nextBlock.offsetLeft;
                    var now_nextBlock_T = nextBlock.offsetTop;
                    var now_nextBlock_opacity = window.getComputedStyle(nextBlock, null).opacity;
                    var now_nextBlock_fontSize = parseInt(window.getComputedStyle(nextBlock, null).fontSize);

                    var now_hiddenBlock_L = hiddenBlock.offsetLeft;
                    var now_hiddenBlock_T = hiddenBlock.offsetTop;
                    var now_hiddenBlock_opacity = window.getComputedStyle(hiddenBlock, null).opacity;
                    var now_hiddenBlock_fontSize = parseInt(window.getComputedStyle(hiddenBlock, null).fontSize);

                    // set position
                    var easeOutFactor = UI.easeOutFactor(thisObj.moveToNext_lastExeTime - thisObj.moveToNext_startTime, timestamp - thisObj.moveToNext_lastExeTime, thisObj.switchTime);

                    currentBlock.style.left = Math.round(thisObj.target_currentBlock_L - easeOutFactor * (thisObj.target_currentBlock_L - now_currentBlock_L)) + 'px';
                    currentBlock.style.top = Math.round(thisObj.target_currentBlock_T - easeOutFactor * (thisObj.target_currentBlock_T - now_currentBlock_T)) + 'px';
                    currentBlock.style.opacity = thisObj.target_currentBlock_opacity - easeOutFactor * (thisObj.target_currentBlock_opacity - now_currentBlock_opacity);
                    currentBlock.style.fontSize = Math.round(thisObj.target_currentBlock_fontSize - easeOutFactor * (thisObj.target_currentBlock_fontSize - now_currentBlock_fontSize)) + 'px';

                    preBlock.style.left = Math.round(thisObj.target_preBlock_L - easeOutFactor * (thisObj.target_preBlock_L - now_preBlock_L)) + 'px';
                    preBlock.style.top = Math.round(thisObj.target_preBlock_T - easeOutFactor * (thisObj.target_preBlock_T - now_preBlock_T)) + 'px';
                    preBlock.style.opacity = thisObj.target_preBlock_opacity - easeOutFactor * (thisObj.target_preBlock_opacity - now_preBlock_opacity);
                    preBlock.style.fontSize = Math.round(thisObj.target_preBlock_fontSize - easeOutFactor * (thisObj.target_preBlock_fontSize - now_preBlock_fontSize)) + "px";

                    nextBlock.style.left = Math.round(thisObj.target_nextBlock_L - easeOutFactor * (thisObj.target_nextBlock_L - now_nextBlock_L)) + 'px';
                    nextBlock.style.top = Math.round(thisObj.target_nextBlock_T - easeOutFactor * (thisObj.target_nextBlock_T - now_nextBlock_T)) + 'px';
                    nextBlock.style.opacity = thisObj.target_nextBlock_opacity - easeOutFactor * (thisObj.target_nextBlock_opacity - now_nextBlock_opacity);
                    nextBlock.style.fontSize = Math.round(thisObj.target_nextBlock_fontSize - easeOutFactor * (thisObj.target_nextBlock_fontSize - now_nextBlock_fontSize)) + 'px';

                    hiddenBlock.style.left = Math.round(thisObj.target_hiddenBlock_L - easeOutFactor * (thisObj.target_hiddenBlock_L - now_hiddenBlock_L)) + 'px';
                    hiddenBlock.style.top = Math.round(thisObj.target_hiddenBlock_T - easeOutFactor * (thisObj.target_hiddenBlock_T - now_hiddenBlock_T)) + 'px';
                    hiddenBlock.style.opacity = thisObj.target_hiddenBlock_opacity - easeOutFactor * (thisObj.target_hiddenBlock_opacity - now_hiddenBlock_opacity);
                    hiddenBlock.style.fontSize = Math.round(thisObj.target_hiddenBlock_fontSize - easeOutFactor * (thisObj.target_hiddenBlock_fontSize - now_hiddenBlock_fontSize)) + 'px';

                    if (timestamp - thisObj.moveToNext_startTime >= thisObj.switchTime) { //if the whole animation finish
                        thisObj.isOnAnimation = false;
                        hiddenBlock.style.visibility = "hidden";
                        // remove all text in hiddenBlock
                        hiddenBlock.innerHTML = "";
                        UI.practiceArea.floatingArea.zhuyinArea.showPinyin(); //////////////////////////////////////
                        return FINISH;
                    }
                    thisObj.moveToNext_lastExeTime = timestamp;
                    return UNFINISH;
                }
            },

            redraw: function (timestamp) {
                var thisObj = UI.practiceArea.floatingArea;
                var currentBlockFontSize = thisObj.calCurrentBlockFontSize();
                var nextPreBlockFontSize = thisObj.calSmallBlockFontSize(currentBlockFontSize);

                var blockHorizontalCentralAxis = UI.windowH * 0.382; // start from left top

                thisObj.textBlocks[thisObj.currentBlock_index]["e"].style.display = 'flex';
                thisObj.textBlocks[thisObj.preBlock_index]["e"].style.display = 'flex';
                thisObj.textBlocks[thisObj.nextBlock_index]["e"].style.display = 'flex';
                thisObj.textBlocks[thisObj.currentBlock_index]["e"].style.visibility = 'visible';
                thisObj.textBlocks[thisObj.preBlock_index]["e"].style.visibility = 'visible';
                thisObj.textBlocks[thisObj.nextBlock_index]["e"].style.visibility = 'visible';

                thisObj.textBlocks[thisObj.currentBlock_index]["e"].style.fontSize = currentBlockFontSize + 'px';
                thisObj.textBlocks[thisObj.nextBlock_index]["e"].style.fontSize = nextPreBlockFontSize + 'px';
                thisObj.textBlocks[thisObj.hiddenBlock_index]["e"].style.fontSize = nextPreBlockFontSize + 'px';
                thisObj.textBlocks[thisObj.preBlock_index]["e"].style.fontSize = nextPreBlockFontSize + 'px';

                var currentBlockW = thisObj.textBlocks[thisObj.currentBlock_index]["e"].offsetWidth;
                var currentBlockH = thisObj.textBlocks[thisObj.currentBlock_index]["e"].offsetHeight;
                var preBlockW = thisObj.textBlocks[thisObj.preBlock_index]["e"].offsetWidth;
                var preBlockH = thisObj.textBlocks[thisObj.preBlock_index]["e"].offsetHeight;
                var nextBlockW = thisObj.textBlocks[thisObj.nextBlock_index]["e"].offsetWidth;
                var nextBlockH = thisObj.textBlocks[thisObj.nextBlock_index]["e"].offsetHeight;
                var intervalW = thisObj.calIntervalW();

                if (currentBlockW > UI.windowW) { // 文本过长
                    var currentBlockchildList = thisObj.textBlocks[thisObj.currentBlock_index]["e"].childNodes;
                    var onWhichZi = currentBlockchildList[practiceCore.inputArea.onWhichZi_index];
                    var onCurrentZiW = currentBlockchildList[practiceCore.inputArea.onWhichZi_index]; //  这里还需要改进////////////////////////////////////
                    var currentBlockL = Math.round(UI.windowW / 2 - currentBlockW / 2);
                    var currentBlockT = Math.round(blockHorizontalCentralAxis - currentBlockH / 2);
                    if (currentBlockL + onWhichZi.offsetLeft < 0) {
                        currentBlockL = -onWhichZi.offsetLeft;
                    }
                    else if (currentBlockL + onWhichZi.offsetLeft + onWhichZi.offsetWidth > UI.windowW) {
                        currentBlockL -= currentBlockL + onWhichZi.offsetLeft + onWhichZi.offsetWidth - UI.windowW;
                    }

                    thisObj.textBlocks[thisObj.currentBlock_index]["e"].style.left = currentBlockL + 'px';
                    thisObj.textBlocks[thisObj.currentBlock_index]["e"].style.top = currentBlockT + 'px';
                    thisObj.textBlocks[thisObj.preBlock_index]["e"].style.display = 'none';
                    thisObj.textBlocks[thisObj.nextBlock_index]["e"].style.display = 'none';
                    return UNFINISH;
                }
                else {
                    var currentBlockL = Math.round(UI.windowW / 2 - currentBlockW / 2);
                    var currentBlockT = Math.round(blockHorizontalCentralAxis - currentBlockH / 2);
                    var preBlockL = Math.round(currentBlockL - intervalW - preBlockW);
                    var preBlockT = Math.round(blockHorizontalCentralAxis - preBlockH / 2);
                    var nextBlockL = Math.round(currentBlockL + currentBlockW + intervalW);
                    var nextBlockT = Math.round(blockHorizontalCentralAxis - nextBlockH / 2);

                    thisObj.textBlocks[thisObj.currentBlock_index]["e"].style.left = currentBlockL + 'px';
                    thisObj.textBlocks[thisObj.currentBlock_index]["e"].style.top = currentBlockT + 'px';
                    thisObj.textBlocks[thisObj.preBlock_index]["e"].style.left = preBlockL + 'px';
                    thisObj.textBlocks[thisObj.preBlock_index]["e"].style.top = preBlockT + 'px';
                    thisObj.textBlocks[thisObj.nextBlock_index]["e"].style.left = nextBlockL + 'px';
                    thisObj.textBlocks[thisObj.nextBlock_index]["e"].style.top = nextBlockT + 'px';
                }
                thisObj.zhuyinArea.showPinyin();
                return FINISH;
            },

            onSizeChange: function () {
                var thisObj = UI.practiceArea.floatingArea;
                if (!thisObj.animation.isOnAnimation) {
                    UI.pushIntoDrawQueue({func: UI.practiceArea.floatingArea.redraw, id: "practiceArea_floatingArea_redraw"}, NOT_REPLACE);
                }
            },

            nextPhrase: function (newPhrase) {
                var thisObj = UI.practiceArea.floatingArea;
                if (!thisObj.animation.isOnAnimation) {
                    var temp = thisObj.hiddenBlock_index;
                    thisObj.hiddenBlock_index = thisObj.preBlock_index;
                    thisObj.preBlock_index = thisObj.currentBlock_index;
                    thisObj.currentBlock_index = thisObj.nextBlock_index;
                    thisObj.nextBlock_index = temp;

                    thisObj.setBlockText(thisObj.textBlocks[thisObj.nextBlock_index]["e"], newPhrase);
                }
                //thisObj.zhuyinArea.showPinyin();
            },

            calCurrentBlockFontSize: function () {
                var currentBlockFontSize = Math.round(Math.min(UI.windowH, UI.windowW) / 20); // px
                if (currentBlockFontSize < 96) currentBlockFontSize = 96;
                return currentBlockFontSize;
            },
            calSmallBlockFontSize: function (currentBlockFontSize) {
                var nextPreBlockFontSize = Math.round(currentBlockFontSize * 0.618) // px
                return nextPreBlockFontSize;
            },
            calPinyinBlockFontSize: function () {
                var nextPreBlockFontSize = Math.round(UI.practiceArea.floatingArea.calCurrentBlockFontSize() * 0.3) // px
                return nextPreBlockFontSize;
            },
            calIntervalW: function () {
                return Math.round(UI.windowW * 0.08);
            },

            getPhraseSpanWidth: function (index) {
                var thisObj = UI.practiceArea.floatingArea;
                var childrenList = thisObj.textBlocks[thisObj.currentBlock_index]["e"].children;
                if (index >= childrenList.length) {
                    return childrenList[0].offsetWidth;
                }
                return childrenList[index].offsetWidth;
            },

            getCurrentBlockTop: function () {
                var thisObj = UI.practiceArea.floatingArea;
                return thisObj.textBlocks[thisObj.currentBlock_index]["e"].offsetTop;
            },

            zhuyinArea: {
                init: function () {
                    var thisObj = UI.practiceArea.floatingArea.zhuyinArea;
                    thisObj.reset();
                },

                maxZhuyinCount: 10, // 最多纵向显示几个多音字
                zhuyinCount: 1,
                showZhuyin_DiffHigherThan: 0,

                reset: function () {
                    var thisObj = UI.practiceArea.floatingArea.zhuyinArea;
                    if (config.autoZhuyin == "higherThan0.2") {
                        thisObj.showZhuyin_DiffHigherThan = 0.2;
                    }
                    else if (config.autoZhuyin == "higherThan0.6") {
                        thisObj.showZhuyin_DiffHigherThan = 0.6;
                    }

                    if (config.showHeteronym == "heteronym") {
                        thisObj.zhuyinCount = thisObj.maxZhuyinCount;
                    }
                },

                showPinyin: function () { // 先设置拼音，再redraw
                    var thisObj = UI.practiceArea.floatingArea.zhuyinArea;
                    var zhuyinList = [];
                    for (let i = 0; i < practiceCore.phraseList.currentPinyin.length; i++) {
                        let zhuyinListForOneWord = [];
                        if (ipcRenderer.sendSync(getZhuyinDifficulty, practiceCore.phraseList.currentPhrase[i]) >= thisObj.showZhuyin_DiffHigherThan) {
                            for (let j = 0, m = 0; j < practiceCore.phraseList.currentPinyin[i].length && m < thisObj.zhuyinCount; j++, m++) {
                                zhuyinListForOneWord.push(practiceCore.phraseList.currentPinyin[i][j].pinyin);
                            }
                        }
                        zhuyinList.push(zhuyinListForOneWord);
                    }
                    thisObj.setBlockText(zhuyinList);
                    thisObj.redraw();
                },

                setBlockText: function (pinyinList) {
                    var zhuyinArea = document.getElementById("currentPinyin");
                    zhuyinArea.innerHTML = "";
                    for (let i = 0; i < pinyinList.length; i++) {
                        let newPinyinBlock = document.createElement("div");
                        newPinyinBlock.style.width = UI.practiceArea.floatingArea.getPhraseSpanWidth(i) + 'px';
                        newPinyinBlock.style.fontSize = UI.practiceArea.floatingArea.calPinyinBlockFontSize() + 'px';
                        newPinyinBlock.style.display = "flex";
                        newPinyinBlock.style.flexDirection = "column-reverse";
                        newPinyinBlock.style.justifyContent = "center";
                        newPinyinBlock.style.alignItems = "center";
                        newPinyinBlock.style.flexWrap = "nowrap";
                        for (let j = 0; j < pinyinList[i].length; j++) {
                            let newPinyinSpan = document.createElement("span");
                            newPinyinSpan.textContent = pinyinList[i][j];
                            newPinyinBlock.appendChild(newPinyinSpan);
                        }
                        zhuyinArea.appendChild(newPinyinBlock);
                    }
                },

                redraw: function () { // 仅由floatingArea调用
                    var zhuyinArea = document.getElementById("currentPinyin");
                    var zhuyinAreaW = zhuyinArea.offsetWidth;
                    var zhuyinAreaH = zhuyinArea.offsetHeight;
                    zhuyinArea.style.left = UI.windowW / 2 - zhuyinArea.offsetWidth / 2 + 'px';
                    zhuyinArea.style.top = UI.practiceArea.floatingArea.getCurrentBlockTop() - zhuyinAreaH + 'px';
                }
            }
        },

        inputArea: {
            inputElement: {},
            contentList: [],
            cursorPos: 0,

            init: function () {
                var thisObj = UI.practiceArea.inputArea;
                thisObj.inputElement = document.getElementById("inputArea");
                //thisObj.inputElement.add;
                thisObj.inputElement.addEventListener("input", thisObj.updateInputArea);
                thisObj.inputElement.addEventListener("focus", thisObj.onFocus);
                UI.pushIntoDrawQueue({func: UI.practiceArea.inputArea.redraw, id: "practiceArea_inputArea_redraw"}, REPLACE);
                UI.pushIntoOnSizeChanegQueue(thisObj.onSizeChange);
            },

            redraw: function (timestamp) {
                var thisObj = UI.practiceArea.inputArea;
                thisObj.inputElement.style.fontSize = UI.practiceArea.floatingArea.calSmallBlockFontSize() + 'px';
                //thisObj.inputElement.style.lineHeight = UI.practiceArea.floatingArea.calSmallBlockFontSize() + 'px';

                var inputAreaW = thisObj.inputElement.offsetWidth;
                var inputAreaH = thisObj.inputElement.offsetHeight;
                var inputAreaT = Math.round(UI.windowH * 0.382 + UI.practiceArea.floatingArea.calCurrentBlockFontSize() / 2 + inputAreaH / 2);
                var inputAreaL = Math.round(UI.windowW / 2 - inputAreaW / 2);

                // if (inputAreaW < 120) {
                //     inputAreaW = 120;
                //     thisObj.inputElement.style.width = inputAreaW + "px";
                //     inputAreaL = Math.round(UI.windowW / 2 - inputAreaW / 2);
                // }

                thisObj.inputElement.style.top = inputAreaT + 'px';
                thisObj.inputElement.style.left = inputAreaL + 'px';
                return FINISH;
            },

            updateInputArea: function (e) {
                var thisObj = UI.practiceArea.inputArea;

                let text = thisObj.inputElement.textContent;// 提取所有非标签的文本
                thisObj.cursorPos = thisObj.getCursorPos();
                if (thisObj.cursorPos > -1) {
                    thisObj.cursorPos = practiceCore.inputArea.removeInvalidChar(text.substring(0, thisObj.cursorPos), practiceCore.inputArea.validCharList).length;
                }

                /////////////////////////// 传参至practice core 内的处理函数

                practiceCore.inputArea.updateInputArea(text);
            },

            onSizeChange: function () {
                var thisObj = UI.practiceArea.inputArea;
                UI.pushIntoDrawQueue({func: UI.practiceArea.inputArea.redraw, id: "practiceArea_inputArea_redraw"}, REPLACE);
            },

            onFocus: function () { // 废弃
                var thisObj = UI.practiceArea.inputArea;
                console.log('input on focus')
                var selection = window.getSelection();

                //////////////
                // console.log("selection focusNode", selection.anchorNode,  "offset  ", selection.anchorOffset);
                // if (selection.anchorNode != null) {
                //     console.log("////length///// ", selection.anchorNode.length);
                // }
                // console.log("selection focusNode", selection.focusNode,  "offset  ", selection.focusOffset);
                // if (selection.focusNode != null) {
                //     console.log("////length///// ", selection.focusNode.length);
                // }
                // var allNode = document.getElementById("inputArea").childNodes;
                // for (let i = 0; i < allNode.length; i++) {
                //     console.log(allNode[i]);
                // }
                // var allC = document.getElementById("inputArea").children;
                // for (let i = 0; i < allC.length; i++) {
                //     console.log(allC[i]);
                // }

                ////////////////

                if (selection.rangeCount == 0) { // 如果之前没有让任何元素focus过，当第一次onFocus的时候，range是空的。
                    console.log(selection.rangeCount);
                    let range = document.createRange();
                    var spanList = thisObj.inputElement.children;
                    if (spanList.length == 0) {
                        var newSpan = document.createElement("span");
                        newSpan.className = "inputBlock";
                        thisObj.inputElement.appendChild(newSpan);
                        spanList = thisObj.inputElement.children;
                    }
                    range.setStart(spanList[spanList.length - 1], 0)
                    range.setEnd(spanList[spanList.length - 1], 0)
                    range.collapse();
                    selection.removeAllRanges();
                    selection.addRange(range);
                }
            },

            getCursorPos: function () { // 如果选区是一片 拖蓝, 那么返回末尾在inputArea 内的 index; 如果光标不在inputArea 内, 返回-1;
                var thisObj = UI.practiceArea.inputArea;
                var selection = window.getSelection();
                var node = selection.focusNode;
                var offsetInNode = selection.focusOffset;
                var textNodeList = [];

                var getAllTextNode = (node) => {
                    var nodes = node.childNodes;
                    var ret = [];
                    for (let j = 0; j < nodes.length; j++) {
                        if (nodes[j].nodeType == Node.TEXT_NODE) {
                            ret.push(nodes[j]);
                        }
                        else {
                            let result = getAllTextNode(nodes[j]);
                            for (let m = 0; m < result.length; m++) {
                                ret.push(result[m]);
                            }
                        }
                    }
                    return ret;
                };

                textNodeList = getAllTextNode(thisObj.inputElement);

                let isInclude = false;
                let previousTextCount = 0;
                for (let i = 0; i < textNodeList.length; i++) {
                    if (node === textNodeList[i]) {
                        isInclude = true;
                        break;
                    }
                    else {
                        previousTextCount += textNodeList[i].textContent.length;
                    }
                }
                //console.log("the focus node", node, "offset of the cursor", offsetInNode)
                if (isInclude) {
                    return previousTextCount + offsetInNode;
                }
                return -1;
            },

            setCursorPos: function (node, offset) {
                let range = document.createRange();
                let selection = window.getSelection();
                range.setStart(node, offset);
                range.setEnd(node, offset);
                range.collapse();
                selection.removeAllRanges();
                selection.addRange(range);
            },

            setCursorPos: function (index) {
                var thisObj = UI.practiceArea.inputArea;
                let range = document.createRange();
                let selection = window.getSelection();

                var textNodeList = [];

                var getAllTextNode = (node) => {
                    var nodes = node.childNodes;
                    var ret = [];
                    for (let j = 0; j < nodes.length; j++) {
                        if (nodes[j].nodeType == Node.TEXT_NODE) {
                            ret.push(nodes[j]);
                        }
                        else {
                            let result = getAllTextNode(nodes[j]);
                            for (let m = 0; m < result.length; m++) {
                                ret.push(result[m]);
                            }
                        }
                    }
                    return ret;
                };

                textNodeList = getAllTextNode(thisObj.inputElement);

                var textCount = 0;
                let i = 0;
                while (i < textNodeList.length) {
                    if (textCount + textNodeList[i].textContent.length >= index) {
                        break;
                    }
                    textCount += textNodeList[i].textContent.length;
                    i++;
                }
                range.setStart(textNodeList[i], index - textCount);
                range.setEnd(textNodeList[i], index - textCount);
                range.collapse();
                selection.removeAllRanges();
                selection.addRange(range);
            },

            setCursorPosToEnd: function () {
                var thisObj = UI.practiceArea.inputArea;
                let nodes = thisObj.inputElement.childNodes;
                let lastNode = {};
                if (nodes.length <= 0) {
                    lastNode = thisObj.inputElement;
                }
                else {
                    lastNode = nodes[nodes.length - 1];
                    while (lastNode.childNodes.length > 0) {
                        lastNode = lastNode.childNodes[lastNode.childNodes.length - 1]; // 寻找最后一个text子节点
                    }
                }
                let range = document.createRange();
                let selection = window.getSelection();
                //console.log("last node:  ", lastNode, "<node type", lastNode.nodeType, "<nodes in last node:  ", lastNode.childNodes, "<last node text: ", lastNode.textContent);
                range.setStart(lastNode, lastNode.textContent.length);
                range.setEnd(lastNode, lastNode.textContent.length);
                range.collapse();
                selection.removeAllRanges();
                selection.addRange(range);
            },

            clearInputArea: function () {
                UI.practiceArea.inputArea.inputElement.innerHTML = "";
            },

            setTextInTextArea: function (finalMatchingResult) {
                var thisObj = UI.practiceArea.inputArea;

                const unfinish = "unfinish";
                const correct = "correct";
                const incorrect = "incorrect";

                var inputAreaInnerHTML_setTo = "";
                var colorConfig = UI.config.color;
                for (let i = 0; i < finalMatchingResult.length; i++) {
                    if (finalMatchingResult[i].status == unfinish && finalMatchingResult[i].pinyin == "") {
                        break;
                    }
                    var newSpan_innerHTML = "<span class=\"inputBlock\"";
                    if (finalMatchingResult[i].status == correct) {
                        newSpan_innerHTML += "style=\"color:" + colorConfig.colorToHex(colorConfig[colorConfig.currentColorSet].font_corrent) + "\"";
                    }
                    else if (finalMatchingResult[i].status == incorrect) {
                        newSpan_innerHTML += "style=\"color:" + colorConfig.colorToHex(colorConfig[colorConfig.currentColorSet].font_wrong) + "\"";
                    }
                    newSpan_innerHTML += ">" + finalMatchingResult[i].pinyin + "</span>";
                    inputAreaInnerHTML_setTo += newSpan_innerHTML;
                }
                thisObj.inputElement.innerHTML = inputAreaInnerHTML_setTo;
                if (thisObj.cursorPos < 0) {
                    thisObj.setCursorPosToEnd();
                }
                else {
                    thisObj.setCursorPos(thisObj.cursorPos);
                }
                UI.pushIntoDrawQueue({func: UI.practiceArea.inputArea.redraw, id: "practiceArea_inputArea_redraw"}, REPLACE);
            }
        },

        statisticsArea: {
            init: function() {
                UI.pushIntoDrawQueue(UI.practiceArea.statisticsArea.redraw);
                UI.pushIntoDrawQueue(UI.practiceArea.statisticsArea.redraw)
            },

            redraw: function(timestamp) {
                var thisObj = UI.practiceArea.statisticsArea;
                var statisticsData = ipcRenderer.sendSync(getStatistics);
                var speedArea = document.getElementById("speed");
                if (config.speedShowingUnit == "wordPerMin") {
                    let speed = thisObj.calWordPerMin(statisticsData.totalAttemptTimes - statisticsData.totalErrorTimes, statisticsData.totalSolvingTime);
                    if (speed <= 0) {
                        speedArea.innerText = "速度：-- 字/每分钟";
                    }
                    speedArea.innerText = "速度：" + speed + " 字/每分钟";
                }
                else {
                    let speed = thisObj.calWordPerHour(statisticsData.totalAttemptTimes - statisticsData.totalErrorTimes, statisticsData.totalSolvingTime);
                    if (speed <= 0) {
                        speedArea.innerText = "速度：-- 字/每小时";
                    }
                    speedArea.innerText = "速度：" + speed + " 字/每小时";
                }
                var accuracyArea = document.getElementById("accuracyRate");
                if (statisticsData.totalAnimationTime == 0) {
                    accuracyArea.innerText = "准确率：--%";
                }
                else {
                    accuracyArea.innerText = "准确率：" + Math.round((statisticsData.totalAttemptTimes - statisticsData.totalErrorTimes) * 1000 / statisticsData.totalAttemptTimes) / 10 + "%";
                }
                var wordCountArea = document.getElementById("wordCount");
                wordCountArea.innerText = "总字数：" + statisticsData.totalWordCount + "字";

                var statisticsArea = document.getElementById("statisticsArea");
                speedArea.style.fontSize = thisObj.calFontSize() + 'px';
                accuracyArea.style.fontSize = thisObj.calFontSize() + 'px';
                wordCountArea.style.fontSize = thisObj.calFontSize() + 'px';
                statisticsArea.style.backgroundColor = UI.config.color.colorToHex(UI.config.color.dark.background0);
                statisticsArea.style.position = "absolute";
                statisticsArea.style.margin = (Math.min(UI.windowH, UI.windowW) / 61.8) + "px";
                statisticsArea.style.padding = (Math.min(UI.windowH, UI.windowW) / 61.8) + "px";

                return FINISH;
            },

            calFontSize: function() {
                var size = Math.min(UI.windowH, UI.windowW) / 42;
                if (size < 32) size = 20;
                return size;
            },

            calWordPerMin: function(wordCount, time) {
                if (wordCount <= 0 || time <= 0) {
                    return 0;
                }
                var msPerWord = time / wordCount;
                return Math.round(600000 / msPerWord) / 10;
            },

            calWordPerHour: function(wordCount, time) {
                if (wordCount == 0 || time == 0) {
                    return 0;
                }
                var msPerWord = time / wordCount;
                return Math.round(3600000 / msPerWord);
            },
            
        }
    },

    setting: {

    },

    statistics: {

    },

    config: {
        init: function () {
            var thisObj = UI.config;
            thisObj.color.init();
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
                font_normal: { // #D4D4D4
                    R: 212,
                    G: 212,
                    B: 212
                },
                font_corrent: { // #40bf80
                    R: 64,
                    G: 191,
                    B: 128
                },
                font_wrong: { // #ff3333
                    R: 255,
                    G: 51,
                    B: 51
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
                font_corrent: { // #206040
                    R: 32,
                    G: 96,
                    B: 32
                },
                font_wrong: { // #cc0000
                    R: 204,
                    G: 0,
                    B: 0
                }
            },
            colorToHex: function (color) {
                var ret = '#';
                ret = ret + (color.R).toString(16);
                ret = ret + (color.G).toString(16);
                ret = ret + (color.B).toString(16);
                return ret;
            },
            init: function () {
                var thisObj = UI.config.color;
                thisObj.currentColorSet = config["colorMode"];
            }
        }
    }
};



const practiceCore = {
    init: function () {
        practiceCore.loadPhrase();
        practiceCore.inputArea.init();
        practiceCore.statistics.init();
    },

    nextPhrase: function () {
        practiceCore.phraseList.currentPhrase = practiceCore.phraseList.nextPhrase;
        practiceCore.phraseList.currentPinyin = practiceCore.phraseList.nextPinyin
        practiceCore.phraseList.currentPossibleAnswer = practiceCore.phraseList.nextPossibleAnswer;

        practiceCore.phraseList.prePhrase = practiceCore.phraseList.currentPhrase;
        practiceCore.phraseList.prePinyin = practiceCore.phraseList.currentPinyin;
        practiceCore.phraseList.prePossibleAnswer = practiceCore.phraseList.currentPossibleAnswer;

        practiceCore.phraseList.hiddenPhrase = practiceCore.phraseList.prePhrase;
        practiceCore.phraseList.hiddenPinyin = practiceCore.phraseList.prePinyin;
        practiceCore.phraseList.hiddenPossibleAnswer = practiceCore.phraseList.prePossibleAnswer;

        var newPhrase_pinyin_answer = JSON.parse(ipcRenderer.sendSync(getPhrase));

        practiceCore.phraseList.nextPhrase = newPhrase_pinyin_answer.phrase;
        practiceCore.phraseList.nextPinyin = newPhrase_pinyin_answer.pinyinDetails;
        practiceCore.phraseList.nextPossibleAnswer = newPhrase_pinyin_answer.answers;

        ipcRenderer.send(updateStatistics, JSON.stringify(practiceCore.statistics.getStatistics_forCurrentPhrase()));
        practiceCore.statistics.clearOverallStatus(practiceCore.phraseList.currentPhrase.length);

        UI.practiceArea.floatingArea.nextPhrase(newPhrase_pinyin_answer.phrase);
        UI.pushIntoDrawQueue({func: UI.practiceArea.floatingArea.animation.moveToNext, id: "practiceArea_floatingArea_animation_moveToNext"}, REPLACE);
    },

    loadPhrase: function () {
        //return { "current": "开始", "next": "准备", "pre": "", "hidden": ""};
        var phrase_pinyin_answer = JSON.parse(ipcRenderer.sendSync(getPhrase));
        practiceCore.phraseList.currentPhrase = phrase_pinyin_answer.phrase;
        practiceCore.phraseList.currentPinyin = phrase_pinyin_answer.pinyinDetails;
        practiceCore.phraseList.currentPossibleAnswer = phrase_pinyin_answer.answers;
        phrase_pinyin_answer = JSON.parse(ipcRenderer.sendSync(getPhrase));
        practiceCore.phraseList.nextPhrase = phrase_pinyin_answer.phrase;
        practiceCore.phraseList.nextPinyin = phrase_pinyin_answer.pinyinDetails;
        practiceCore.phraseList.nextPossibleAnswer = phrase_pinyin_answer.answers;
        phrase_pinyin_answer = JSON.parse(ipcRenderer.sendSync(getPhrase));
        practiceCore.phraseList.prePhrase = phrase_pinyin_answer.phrase;
        practiceCore.phraseList.prePinyin = phrase_pinyin_answer.pinyinDetails;
        practiceCore.phraseList.prePossibleAnswer = phrase_pinyin_answer.answers;
        phrase_pinyin_answer = JSON.parse(ipcRenderer.sendSync(getPhrase));
        practiceCore.phraseList.hiddenPhrase = phrase_pinyin_answer.phrase;
        practiceCore.phraseList.hiddenPinyin = phrase_pinyin_answer.pinyinDetails;
        practiceCore.phraseList.hiddenPossibleAnswer = phrase_pinyin_answer.answers;
    },

    getPhrase: function () { //return { "current": "开始", "next": "准备", "pre": "", "hidden": ""};
        return { "current": practiceCore.phraseList.currentPhrase, "next": practiceCore.phraseList.nextPhrase, "pre": practiceCore.phraseList.prePhrase, "hidden": practiceCore.phraseList.hiddenPhrase };
    },

    phraseList: {
        currentPhrase: "",
        currentPossibleAnswer: [],
        currentPinyin: [], //[[{"sheng":"p", "yun":"in", "shengdiao": 1, "pinyin": "pīn"}]]
        nextPhrase: "",
        nextPossibleAnswer: [],
        nextPinyin: [],
        prePhrase: "",
        prePossibleAnswer: [],
        prePinyin: [],
        hiddenPhrase: "",
        hiddenPossibleAnswer: [],
        hiddenPinyin: []
    },

    inputArea: {
        inputBlocks: [], // {text, 对错状态, 花费时间，尝试次数}
        validCharList: "",
        onWhichZi_index: 0,

        init: function () {
            practiceCore.inputArea.setValidCharList(JSON.parse(ipcRenderer.sendSync(getScheme)).validCharList);
        },

        setValidCharList: function (validCharList) {
            practiceCore.inputArea.validCharList = validCharList;
        },

        updateInputArea: function (text) {
            var thisObj = practiceCore.inputArea;

            var validText = thisObj.removeInvalidChar(text, thisObj.validCharList); // 合法的字符串


            var allAnswerPossibilityCombination = thisObj.getAllAnswerPossibilityCombination();
            //console.log("all answer combination:    ", allAnswerPossibilityCombination);
            var matchingResultList = [];
            for (let i = 0; i < allAnswerPossibilityCombination.length; i++) {
                matchingResultList.push(thisObj.matchingResult(allAnswerPossibilityCombination[i], validText));
            } // 对每一个可能的答案，进行对比
            console.log("this is matching result", matchingResultList);
            var finalMatchingResult = thisObj.findBestPossibilityCombination(matchingResultList);
            //console.log("this is final matching result", finalMatchingResult);


            var finalMatchingResult_usingString = [];
            for (let i = 0; i < finalMatchingResult.length; i++) { // 把 index 转换为 string
                finalMatchingResult_usingString.push({ status: finalMatchingResult[i].status, pinyin: validText.substring(finalMatchingResult[i].start, finalMatchingResult[i].end), answer: finalMatchingResult[i].answer });
            }

            console.log("this is final matching result, Text:  ", finalMatchingResult_usingString);

            practiceCore.statistics.onInputAreaUpdate(performance.now(), finalMatchingResult_usingString);

            UI.practiceArea.inputArea.setTextInTextArea(finalMatchingResult_usingString);

            /////////////////////////////////////////////

            const unfinish = "unfinish";
            const correct = "correct";
            const incorrect = "incorrect";

            var correctCount = 0;
            var isFinish = true;
            for (let i = 0; i < finalMatchingResult.length; i++) {
                if (finalMatchingResult[i].status == unfinish) {
                    isFinish = false;
                }
                else if (finalMatchingResult[i].status == correct) {
                    correctCount++;
                }
            }

            if (correctCount >= finalMatchingResult.length && config.autoNext == "autoNext_allCorrect") {
                //setTimeout(moveToNext, 1);
                moveToNext();
            }
            else if (isFinish && config.autoNext == "autoNext_onceFinish") {
                //setTimeout(moveToNext, 1);
                moveToNext();
            }
            else if (isFinish && correctCount < finalMatchingResult.length && config.autoClear == "autoClear") {
                UI.practiceArea.inputArea.clearInputArea();
                practiceCore.statistics.clearLastTimeStatus();
            }
        },

        removeInvalidChar: function (string, validCharList) {
            let newString = "";
            for (let i = 0; i < string.length; i++) {
                if (validCharList.indexOf(string[i]) > -1) {
                    newString = newString + string[i];
                }
            }
            return newString;
        },

        findBestPossibilityCombination: function (matchingResultList) {
            var thisObj = practiceCore.inputArea;

            var indexOfBestMatchingResult = 0;
            var difference_correctCount_minus_incorrectCount = Number.MIN_SAFE_INTEGER;
            for (let i = 0; i < matchingResultList.length; i++) {  // 正确尽可能多，错误尽可能少的答案
                let correctCount = 0;
                let incorrectCount = 0;
                for (let j = 0; j < matchingResultList[i].length; j++) {
                    if (matchingResultList[i][j].status == "correct") {
                        correctCount++;
                    }
                    else if (matchingResultList[i][j].status == "incorrect") {
                        incorrectCount++;
                    }
                }
                if (correctCount - incorrectCount >= difference_correctCount_minus_incorrectCount) {
                    difference_correctCount_minus_incorrectCount = correctCount - incorrectCount;
                    indexOfBestMatchingResult = i;
                }
            }
            return matchingResultList[indexOfBestMatchingResult];
        },

        getAllAnswerPossibilityCombination: function () {  // 遍历所有答案（多音字）组合可能性
            var thisObj = practiceCore.inputArea;
            var currentPossibleAnswer = practiceCore.phraseList.currentPossibleAnswer;
            console.log("answer list", currentPossibleAnswer);
            var possibilityList = [];
            for (let i = currentPossibleAnswer.length - 1; i >= 0; i--) {
                let tempList = [];
                for (let j = 0; j < currentPossibleAnswer[i].length; j++) {
                    if (possibilityList.length == 0) {
                        let onePossibleList = [];
                        onePossibleList.push(currentPossibleAnswer[i][j]);
                        tempList.push(onePossibleList);
                        continue;
                    }
                    for (let m = 0; m < possibilityList.length; m++) {
                        let onePossibleList = [];
                        onePossibleList.push(currentPossibleAnswer[i][j]);
                        for (let n = 0; n < possibilityList[m].length; n++) {
                            onePossibleList.push(possibilityList[m][n]);
                        }
                        tempList.push(onePossibleList);
                    }
                }
                possibilityList = tempList.slice();
            }
            return possibilityList;
        },

        matchingResult: function (possibleAnswerCombination, userAnswer) {
            const unfinish = "unfinish";
            const correct = "correct";
            const incorrect = "incorrect";

            var result = [];
            for (let i = 0; i < possibleAnswerCombination.length; i++) {
                result.push({ "status": unfinish, "start": 0, "end": 0, answer: possibleAnswerCombination[i] }); // [start, end)
            }

            var deviation = 1;
            var maxDeviation = 2;
            var deviationToFront = 0;
            var deviationToBack = 1;
            var expectStartingPoint = 0;
            var minPinyinLength = 1;

            for (let i = 0; i < possibleAnswerCombination.length; i++) {
                if (userAnswer.length - expectStartingPoint < possibleAnswerCombination[i].length) { //说明这个字的拼音可能还没有完成
                    if (userAnswer.length - expectStartingPoint + deviationToFront < possibleAnswerCombination[i].length) {
                        if (i > 0 && userAnswer.length - expectStartingPoint > 0) {
                            result[i].start = result[i - 1].end;
                        }
                        break;
                    }
                }
                var answerIndex_in_userAnswer = userAnswer.substring(expectStartingPoint - deviationToFront).indexOf(possibleAnswerCombination[i]);
                if (answerIndex_in_userAnswer > -1 && answerIndex_in_userAnswer <= deviationToFront + deviationToBack) { // 这个字的答案在那里存在且在范围内
                    answerIndex_in_userAnswer += expectStartingPoint - deviationToFront;
                    if (i > 0 && result[i - 1].status == correct) { // 前面的那个字的拼音是正确的
                        if (answerIndex_in_userAnswer > result[i - 1].end) { // 这个答案的前面有剩余的东西
                            result[i].status = correct;
                            result[i].start = answerIndex_in_userAnswer;
                            result[i].end = answerIndex_in_userAnswer + possibleAnswerCombination[i].length;

                            result[i - 1].status = incorrect;
                            result[i - 1].end = answerIndex_in_userAnswer;

                            expectStartingPoint = answerIndex_in_userAnswer + possibleAnswerCombination[i].length;
                            deviationToFront = 0;
                            deviationToBack = 1;
                        }
                        else { // 没有,完全正确
                            result[i].status = correct;
                            result[i].start = answerIndex_in_userAnswer;
                            result[i].end = answerIndex_in_userAnswer + possibleAnswerCombination[i].length;

                            expectStartingPoint = answerIndex_in_userAnswer + possibleAnswerCombination[i].length;
                            deviationToFront = 0;
                            deviationToBack = 1;
                        }
                    }
                    else if (i > 0 && result[i - 1].status == incorrect) { // 前面的那个字的拼音是错误的
                        result[i].status = correct;
                        result[i].start = answerIndex_in_userAnswer;
                        result[i].end = answerIndex_in_userAnswer + possibleAnswerCombination[i].length;

                        result[i - 1].end = answerIndex_in_userAnswer;

                        expectStartingPoint = answerIndex_in_userAnswer + possibleAnswerCombination[i].length;
                        deviationToFront = 0;
                        deviationToBack = 1;
                    }
                    else { // i == 0
                        if (answerIndex_in_userAnswer > 0) {
                            result[i].status = incorrect;
                            result[i].start = 0;
                            result[i].end = answerIndex_in_userAnswer + possibleAnswerCombination[i].length;

                            expectStartingPoint = answerIndex_in_userAnswer + possibleAnswerCombination[i].length;
                            deviationToFront = 0;
                            deviationToBack = 1;
                        }
                        else {
                            result[i].status = correct;
                            result[i].start = answerIndex_in_userAnswer;
                            result[i].end = answerIndex_in_userAnswer + possibleAnswerCombination[i].length;

                            expectStartingPoint = answerIndex_in_userAnswer + possibleAnswerCombination[i].length;
                            deviationToFront = 0;
                            deviationToBack = 1;
                        }
                    }

                    if (i + 1 == possibleAnswerCombination.length) { // i 是最后一个
                        if (result[i].end != userAnswer.length) {
                            result[i].status = incorrect;
                            result[i].start = answerIndex_in_userAnswer;
                            result[i].end = userAnswer.length;
                        }
                    }
                }
                else {
                    if (userAnswer.length - expectStartingPoint < possibleAnswerCombination[i].length) {
                        if (i > 0 && userAnswer.length - expectStartingPoint > 0) {
                            result[i].start = result[i - 1].end;
                        }
                        break;
                    }
                    if (i > 0 && result[i - 1].status == correct) {
                        result[i].status = incorrect;
                        result[i].start = result[i - 1].end;
                        result[i].end = result[i].start + possibleAnswerCombination[i].length;

                        expectStartingPoint = result[i - 1].end + possibleAnswerCombination[i].length;
                        deviationToFront = 1;
                        deviationToBack = 1;
                        if (possibleAnswerCombination[i].length <= 1) {
                            deviationToFront = 0;
                        }
                    }
                    else if (i > 0 && result[i - 1].status == incorrect) {
                        result[i].status = incorrect;
                        result[i].start = result[i - 1].end;
                        result[i].end = result[i].start + possibleAnswerCombination[i].length;

                        expectStartingPoint = result[i].end;
                        deviationToFront++;
                        deviationToBack = 1;
                        while (expectStartingPoint - deviationToFront < result[i].start + minPinyinLength) {
                            deviationToFront--;
                        }
                    }
                    else { // i == 0
                        result[i].status = incorrect;
                        result[i].start = 0;
                        result[i].end = result[i].start + possibleAnswerCombination[i].length;

                        expectStartingPoint = result[i].end;
                        deviationToFront = 1;
                        deviationToBack = 1;
                        if (possibleAnswerCombination[i].length <= 1) {
                            deviationToFront = 0;
                        }
                    }
                }
            }

            var lastSpanIndex = result.length;
            while (lastSpanIndex > 0) { // 寻找最后一个用户答案覆盖的拼音块spzn
                lastSpanIndex--;
                if (result[lastSpanIndex].start > 0) {
                    break;
                }
            }
            result[lastSpanIndex].end = userAnswer.length;
            if (lastSpanIndex > 0) {
                result[lastSpanIndex].start = result[lastSpanIndex - 1].end;
            }

            return result;
        }
    },

    statistics: {
        lastTimeStatus: [], // [{"status": "notStarted | unfinish | correct | incorrect"}]
        lastTimestamp: 0,

        overallStatus: [], // [{"attemptTimes": 1, "errorTimes": 0, "totalTime": 0 ms, pinyin: "", word: "", answer: ""}] // coldBootTime

        init: function () {
            practiceCore.statistics.lastTimeStamp = performance.now();
        },

        onInputAreaUpdate: function (timestamp, finalMatchingResult_usingString) { // 统计拼写时间和正确率
            var thisObj = practiceCore.statistics;

            const notStarted = "notStarted";
            const unfinish = "unfinish";
            const correct = "correct";
            const incorrect = "incorrect";

            if (thisObj.lastTimeStatus.length == 0 || thisObj.overallStatus.length == 0) {
                thisObj.clearOverallStatus(practiceCore.phraseList.currentPhrase.length);
            }

            for (let i = 0; i < finalMatchingResult_usingString.length; i++) {
                if (thisObj.lastTimeStatus[i].status == notStarted && finalMatchingResult_usingString[i].status == unfinish && finalMatchingResult_usingString[i].pinyin != "") { // not start to not finish
                    thisObj.lastTimeStatus[i].status = unfinish;
                    thisObj.overallStatus[i].attemptTimes++;
                    thisObj.overallStatus[i].coldBootTime = thisObj.getTimeInterval(thisObj.lastTimestamp, timestamp); ///////////////////////
                    if (i == 0) {
                        let publicTimeForWholePhrase = thisObj.getTimeInterval(thisObj.lastTimestamp, timestamp);
                        let temp_divide = 3 + finalMatchingResult_usingString.length;
                        const maxPreSolvingCount = 4; // 看一眼能解决几个字的拼音
                        if (temp_divide > 3 + maxPreSolvingCount) {
                            temp_divide = 3 + maxPreSolvingCount;
                        }
                        thisObj.overallStatus[0].totalTime += Math.round(publicTimeForWholePhrase * 3 / temp_divide);
                        for (let j = 0; j < finalMatchingResult_usingString.length; j++) {
                            thisObj.overallStatus[j].totalTime += Math.round(publicTimeForWholePhrase * (temp_divide - 3) / temp_divide / finalMatchingResult_usingString.length);
                        }
                    } 
                    else {
                        thisObj.overallStatus[i].totalTime += thisObj.getTimeInterval(thisObj.lastTimestamp, timestamp);
                    }
                }
                else if (thisObj.lastTimeStatus[i].status == notStarted && (finalMatchingResult_usingString[i].status == correct || finalMatchingResult_usingString[i].status == incorrect)) {
                    thisObj.lastTimeStatus[i].status = finalMatchingResult_usingString[i].status;
                    thisObj.overallStatus[i].attemptTimes++;
                    if (finalMatchingResult_usingString[i].status == incorrect) thisObj.overallStatus[i].errorTimes++;
                    thisObj.overallStatus[i].coldBootTime = thisObj.getTimeInterval(thisObj.lastTimestamp, timestamp); ///////////////////////
                    if (i == 0) {
                        let publicTimeForWholePhrase = thisObj.getTimeInterval(thisObj.lastTimestamp, timestamp);
                        let temp_divide = 3 + finalMatchingResult_usingString.length;
                        const maxPreSolvingCount = 4; // 看一眼能解决几个字的拼音
                        if (temp_divide > 3 + maxPreSolvingCount) {
                            temp_divide = 3 + maxPreSolvingCount;
                        }
                        thisObj.overallStatus[0].totalTime += Math.round(publicTimeForWholePhrase * 3 / temp_divide);
                        for (let j = 0; j < finalMatchingResult_usingString.length; j++) {
                            thisObj.overallStatus[j].totalTime += Math.round(publicTimeForWholePhrase * (temp_divide - 3) / temp_divide / finalMatchingResult_usingString.length);
                        }
                    } 
                    else {
                        thisObj.overallStatus[i].totalTime += thisObj.getTimeInterval(thisObj.lastTimestamp, timestamp);
                    }
                }
                else if (thisObj.lastTimeStatus[i].status == unfinish) {
                    if (finalMatchingResult_usingString[i].status == incorrect) {
                        thisObj.overallStatus[i].errorTimes++;
                        thisObj.lastTimeStatus[i].status = finalMatchingResult_usingString[i].status;
                        thisObj.overallStatus[i].totalTime += thisObj.getTimeInterval(thisObj.lastTimestamp, timestamp);
                    }
                    else if (finalMatchingResult_usingString[i].status == unfinish && finalMatchingResult_usingString[i].pinyin == "") {
                        thisObj.lastTimeStatus[i].status = notStarted;
                        thisObj.overallStatus[i].totalTime += thisObj.getTimeInterval(thisObj.lastTimestamp, timestamp);
                        if (thisObj.overallStatus[i].attemptTimes > 1) thisObj.overallStatus[i].attemptTimes--;
                    }
                    else {
                        thisObj.lastTimeStatus[i].status = finalMatchingResult_usingString[i].status;
                        thisObj.overallStatus[i].totalTime += thisObj.getTimeInterval(thisObj.lastTimestamp, timestamp);
                    }
                }
                else if (thisObj.lastTimeStatus[i].status == incorrect && finalMatchingResult_usingString[i].status == correct) {
                    thisObj.lastTimeStatus[i].status = finalMatchingResult_usingString[i].status;
                    thisObj.overallStatus[i].attemptTimes++;
                    thisObj.overallStatus[i].totalTime += thisObj.getTimeInterval(thisObj.lastTimestamp, timestamp);
                }
                else if (thisObj.lastTimeStatus[i].status == incorrect && finalMatchingResult_usingString[i].status == unfinish) {
                    thisObj.lastTimeStatus[i].status = finalMatchingResult_usingString[i].status;
                    thisObj.overallStatus[i].attemptTimes++;
                    thisObj.overallStatus[i].totalTime += thisObj.getTimeInterval(thisObj.lastTimestamp, timestamp);
                }
                thisObj.overallStatus[i].pinyin = finalMatchingResult_usingString[i].pinyin;
                thisObj.overallStatus[i].answer = finalMatchingResult_usingString[i].answer;
                thisObj.overallStatus[i].word = practiceCore.phraseList.currentPhrase[i];
            }
            thisObj.lastTimestamp = timestamp;
        },

        clearOverallStatus: function (phraseLength) {
            var thisObj = practiceCore.statistics;
            console.log("for overall status: XXXXXXXXXXXXXXXXXXXXXXXXXX", thisObj.overallStatus);
            const notStarted = "notStarted";
            thisObj.lastTimeStatus = [];
            thisObj.overallStatus = [];
            for (let i = 0; i < phraseLength; i++) {
                thisObj.lastTimeStatus.push({ "status": notStarted });
                let newObj = {};
                newObj.attemptTimes = 0;
                newObj.errorTimes = 0;
                newObj.totalTime = 0;
                newObj.pinyin = "";
                newObj.word = "";
                newObj.answer = "";
                thisObj.overallStatus.push(newObj);
            }
        },

        clearLastTimeStatus: function () {
            var thisObj = practiceCore.statistics;
            const notStarted = "notStarted";
            thisObj.lastTimeStatus = [];
            for (let i = 0; i < thisObj.overallStatus.length; i++) {
                thisObj.lastTimeStatus.push({ "status": notStarted });
            }
        },

        getTimeInterval: function (t1, t2) {
            var ret = t2 - t1;
            var noramlSolvingTime = ipcRenderer.sendSync(getNormalSolvingTime);
            var minRestingTime = noramlSolvingTime * 3; // 超过多少毫秒之后不算入拼写时间
            const maxRestingTime = 6000; // ms
            if (minRestingTime > maxRestingTime) {
                minRestingTime = maxRestingTime;
            }
            if (ret > minRestingTime) {
                return noramlSolvingTime / 2; // 默认的解决时间
            }
            return ret;
        },

        getStatistics_forCurrentPhrase: function () {
            //if (practiceCore.statistics.overallStatus[0].totalTime > 600) practiceCore.statistics.overallStatus[0].totalTime -= UI.practiceArea.floatingArea.animation.switchTime + 50; // 减去动画时间
            if (practiceCore.statistics.overallStatus.length == 0) return []; ///////////////////////////////////////////////////////////
            return practiceCore.statistics.overallStatus; // [{"attemptTimes": 1, "errorTimes": 0, "totalTime": 0 ms, pinyin: ""}]
        }
    }

}

var config = {}

window.onload = () => { // 渲染进程入口
    config = JSON.parse(ipcRenderer.sendSync(getConfig)); //////////////////////////// 需要异步
    practiceCore.init();
    UI.init();
}

window.onresize = () => {
    UI.onSizeChange();
}

function testOnClick() { //////////////////////
    if (UI.practiceArea.floatingArea.animation.isOnAnimation) {
        return;
    }
    practiceCore.nextPhrase();
}

function moveToNext() {
    practiceCore.nextPhrase();
    UI.pushIntoDrawQueue(UI.practiceArea.statisticsArea.redraw);
    setTimeout(UI.practiceArea.inputArea.clearInputArea, 150);
}