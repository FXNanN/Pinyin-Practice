const { ipcRenderer } = require("electron");
const getPhrase = "getPhrase";
const getScheme = "getScheme";
const getConfig = "getConfig";
const getZhuyinDifficulty = "getZhuyinDifficulty";
const getNormalSolvingTime = "getNormalSolvingTime";
const updateStatistics = "updateStatistics";
const getStatistics = "getStatistics";

const FINISH = "finish";
const UNFINISH = "unfinish";

const REPLACE = "replace";
const NOT_REPLACE = "notReplace";
const WAIT = "wait";

const UI = {
    windowW: 0,
    windowH: 0,

    drawQueue: [], // 需要重绘时推入队列, 重绘完成时需要返回完成标识, 不然不会被清出队列
    onSizeChangeQueue: [],

    pushIntoDrawQueue: function (funcAndID: any, mode = REPLACE) { // 参数包括了绘制函数和这个绘制函数的ID, 以及遇到相同ID的绘制函数时的处理模式; 如果直接传入函数, 那么就不做处理直接放入队列, ID = ""
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
}

class InputAreaForAnswer {
    inputElement: HTMLElement;
    contentList: Array<number>;
    cursorPos: number;

    redrawID: string;

    UI: UI;
    onInput: (text: string)=> void;
    removeInvalidChar: (text: string)=>string;

    public init(inputElement: HTMLElement): void {
        this.inputElement = inputElement;
        this.inputElement.addEventListener("input", this.updateInputArea);
        this.UI.pushIntoDrawQueue({ func: this.redraw, id: this.redrawID }, REPLACE);
        this.UI.pushIntoOnSizeChanegQueue(this.onSizeChange);
    }

    public redraw(timestamp: number): string {
        this.inputElement.style.fontSize = this.calSmallBlockFontSize() + 'px';
        //thisObj.inputElement.style.lineHeight = UI.practiceArea.floatingArea.calSmallBlockFontSize() + 'px';

        var inputAreaW = this.inputElement.offsetWidth;
        var inputAreaH = this.inputElement.offsetHeight;
        var inputAreaT = Math.round(UI.windowH * 0.382 + UI.practiceArea.floatingArea.calCurrentBlockFontSize() / 2 + inputAreaH / 2);
        var inputAreaL = Math.round(UI.windowW / 2 - inputAreaW / 2);

        // if (inputAreaW < 120) {
        //     inputAreaW = 120;
        //     thisObj.inputElement.style.width = inputAreaW + "px";
        //     inputAreaL = Math.round(UI.windowW / 2 - inputAreaW / 2);
        // }

        this.inputElement.style.top = inputAreaT + 'px';
        this.inputElement.style.left = inputAreaL + 'px';
        return FINISH;
    }

    public updateInputArea(e: Event): void {
        let text = this.inputElement.textContent;// 提取所有非标签的文本
        this.cursorPos = this.getCursorPos();
        if (this.cursorPos > -1) {
            this.cursorPos = this.removeInvalidChar(text.substring(0, this.cursorPos)).length;
        }

        /////////////////////////// 传参至practice core 内的处理函数

        this.onInput(text);
    }

    public onSizeChange(): string {
        this.UI.pushIntoDrawQueue({ func: this.redraw, id: this.redrawID }, REPLACE);
        return FINISH;
    }

    public getCursorPos(): number { // 如果选区是一片 拖蓝, 那么返回末尾在inputArea 内的 index; 如果光标不在inputArea 内, 返回-1;
        var selection = window.getSelection();
        var node = selection.focusNode;
        var offsetInNode = selection.focusOffset;
        var textNodeList = [];

        textNodeList = this.getAllTextNode(this.inputElement);

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
    }

    public setCursorPos(node: Node, offset: number): void {
        let range = document.createRange();
        let selection = window.getSelection();
        range.setStart(node, offset);
        range.setEnd(node, offset);
        range.collapse();
        selection.removeAllRanges();
        selection.addRange(range);
    }

    public setCursorPos(index: number): void {
        let range = document.createRange();
        let selection = window.getSelection();

        var textNodeList = [];

        textNodeList = this.getAllTextNode(this.inputElement);

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
    }

    setCursorPosToEnd(): void {
        let nodes = this.inputElement.childNodes;
        let lastNode: Node;
        if (nodes.length <= 0) {
            lastNode = this.inputElement;
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
    }

    private getAllTextNode(node: Node): Array<Node> {
        var nodes = node.childNodes;
        var ret = [];
        for (let j = 0; j < nodes.length; j++) {
            if (nodes[j].nodeType == Node.TEXT_NODE) {
                ret.push(nodes[j]);
            }
            else {
                let result = this.getAllTextNode(nodes[j]);
                for (let m = 0; m < result.length; m++) {
                    ret.push(result[m]);
                }
            }
        }
        return ret;
    }

    public clearInputArea() {
        this.inputElement.innerHTML = "";
    }


}


function easeOutFactor(spendTime: number, intervalTime: number, totalAnimationTime: number): number { // 返回X；  下一个值 = 目标值 - （目标 - 现有） * X , 因此，即使窗口尺寸变了，也只需要重新设置target就行了，动画不会被影响 //ease-out
    if (spendTime + intervalTime >= totalAnimationTime) {
        return 0;
    }
    var ratio = spendTime / totalAnimationTime;
    var finishedDistancePercentage = 2 * ratio - ratio * ratio; // 已完成的路程占总行程的百分之几
    ratio = (spendTime + intervalTime) / totalAnimationTime;
    var nextStepDistancePercentage = 2 * ratio - ratio * ratio; // 即将完成的路程占总行程的百分之几
    return (1 - nextStepDistancePercentage) / (1 - finishedDistancePercentage);
}

function linearFactor(spendTime: number, intervalTime: number, totalAnimationTime: number): number { // 返回X；  下一个值 = 目标值 - （目标 - 现有） * X , 因此，即使窗口尺寸变了，也只需要重新设置target就行了，动画不会被影响 //ease-out
    if (spendTime + intervalTime >= totalAnimationTime) {
        return 0;
    }
    var finishedDistancePercentage = spendTime / totalAnimationTime; // 已完成的路程占总行程的百分之几
    var nextStepDistancePercentage = (spendTime + intervalTime) / totalAnimationTime; // 即将完成的路程占总行程的百分之几
    return (1 - nextStepDistancePercentage) / (1 - finishedDistancePercentage);
}

const practiceArea = {

    init: function () {
        let thisObj = practiceArea;
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
            var thisObj = practiceArea.floatingArea;

            UI.onSizeChangeQueue.push(thisObj.onSizeChange);

            thisObj.textBlocks.push({ "e": document.getElementById("floatingBlock1") });
            thisObj.textBlocks.push({ "e": document.getElementById("floatingBlock2") });
            thisObj.textBlocks.push({ "e": document.getElementById("floatingBlock3") });
            thisObj.textBlocks.push({ "e": document.getElementById("floatingBlock0") });
            thisObj.preBlock_index = 0;
            thisObj.currentBlock_index = 1;
            thisObj.nextBlock_index = 2;
            thisObj.hiddenBlock_index = 3;

            var currentBlock = practiceArea.floatingArea.textBlocks[practiceArea.floatingArea.currentBlock_index]['e'];
            var nextBlock = practiceArea.floatingArea.textBlocks[practiceArea.floatingArea.nextBlock_index]['e'];
            var preBlock = practiceArea.floatingArea.textBlocks[practiceArea.floatingArea.preBlock_index]['e'];
            var hiddenBlock = practiceArea.floatingArea.textBlocks[practiceArea.floatingArea.hiddenBlock_index]['e'];

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
            UI.pushIntoDrawQueue({func: practiceArea.floatingArea.redraw, id: "practiceArea_floatingArea_redraw"}, NOT_REPLACE);
        },

        setBlockText: function (floatingBlock, phrase) {
            var thisObj = practiceArea.floatingArea;
            for (let i = 0; i < phrase.length; i++) {
                let span = document.createElement("span");
                span.textContent = phrase[i];
                floatingBlock.appendChild(span);
            }
        },

        redraw: function (timestamp): string {
            var thisObj = practiceArea.floatingArea;
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
            var preBlockW: number = thisObj.textBlocks[thisObj.preBlock_index]["e"].offsetWidth;
            var preBlockH: number = thisObj.textBlocks[thisObj.preBlock_index]["e"].offsetHeight;
            var nextBlockW: number = thisObj.textBlocks[thisObj.nextBlock_index]["e"].offsetWidth;
            var nextBlockH: number = thisObj.textBlocks[thisObj.nextBlock_index]["e"].offsetHeight;
            var intervalW: number = thisObj.calIntervalW();

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
            var thisObj = practiceArea.floatingArea;
            if (!thisObj.animation.isOnAnimation) {
                UI.pushIntoDrawQueue({func: practiceArea.floatingArea.redraw, id: "practiceArea_floatingArea_redraw"}, NOT_REPLACE);
            }
        },

        nextPhrase: function (newPhrase) {
            var thisObj = practiceArea.floatingArea;
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

        calCurrentBlockFontSize: function (): number {
            var currentBlockFontSize = Math.round(Math.min(UI.windowH, UI.windowW) / 20); // px
            if (currentBlockFontSize < 96) currentBlockFontSize = 96;
            return currentBlockFontSize;
        },
        calSmallBlockFontSize: function (currentBlockFontSize): number {
            var nextPreBlockFontSize = Math.round(currentBlockFontSize * 0.618) // px
            return nextPreBlockFontSize;
        },
        calPinyinBlockFontSize: function (): number {
            var nextPreBlockFontSize = Math.round(practiceArea.floatingArea.calCurrentBlockFontSize() * 0.3) // px
            return nextPreBlockFontSize;
        },
        calIntervalW: function (): number {
            return Math.round(UI.windowW * 0.08);
        },

        getPhraseSpanWidth: function (index): number {
            var thisObj = practiceArea.floatingArea;
            var childrenList = thisObj.textBlocks[thisObj.currentBlock_index]["e"].children;
            if (index >= childrenList.length) {
                return childrenList[0].offsetWidth;
            }
            return childrenList[index].offsetWidth;
        },

        getCurrentBlockTop: function () {
            var thisObj = practiceArea.floatingArea;
            return thisObj.textBlocks[thisObj.currentBlock_index]["e"].offsetTop;
        },

        zhuyinArea: {
            init: function () {
                var thisObj = practiceArea.floatingArea.zhuyinArea;
                thisObj.reset();
            },

            maxZhuyinCount: 10, // 最多纵向显示几个多音字
            zhuyinCount: 1,
            showZhuyin_DiffHigherThan: 0,

            reset: function () {
                var thisObj = practiceArea.floatingArea.zhuyinArea;
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
                var thisObj = practiceArea.floatingArea.zhuyinArea;
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
                    newPinyinBlock.style.width = practiceArea.floatingArea.getPhraseSpanWidth(i) + 'px';
                    newPinyinBlock.style.fontSize = practiceArea.floatingArea.calPinyinBlockFontSize() + 'px';
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
                zhuyinArea.style.top = practiceArea.floatingArea.getCurrentBlockTop() - zhuyinAreaH + 'px';
            }
        }
    },

    inputArea: {
        inputElement: new HTMLElement,
        contentList: [],
        cursorPos: 0,

        init: function () {
            var thisObj = practiceArea.inputArea;
            thisObj.inputElement = document.getElementById("inputArea");
            //thisObj.inputElement.add;
            thisObj.inputElement.addEventListener("input", thisObj.updateInputArea);
            thisObj.inputElement.addEventListener("focus", thisObj.onFocus);
            UI.pushIntoDrawQueue({func: practiceArea.inputArea.redraw, id: "practiceArea_inputArea_redraw"}, REPLACE);
            UI.pushIntoOnSizeChanegQueue(thisObj.onSizeChange);
        },

        redraw: function (timestamp) {
            var thisObj = practiceArea.inputArea;
            thisObj.inputElement.style.fontSize = practiceArea.floatingArea.calSmallBlockFontSize() + 'px';
            //thisObj.inputElement.style.lineHeight = UI.practiceArea.floatingArea.calSmallBlockFontSize() + 'px';

            var inputAreaW = thisObj.inputElement.offsetWidth;
            var inputAreaH = thisObj.inputElement.offsetHeight;
            var inputAreaT = Math.round(UI.windowH * 0.382 + practiceArea.floatingArea.calCurrentBlockFontSize() / 2 + inputAreaH / 2);
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
            var thisObj = practiceArea.inputArea;

            let text = thisObj.inputElement.textContent;// 提取所有非标签的文本
            thisObj.cursorPos = thisObj.getCursorPos();
            if (thisObj.cursorPos > -1) {
                thisObj.cursorPos = practiceCore.inputArea.removeInvalidChar(text.substring(0, thisObj.cursorPos), practiceCore.inputArea.validCharList).length;
            }

            /////////////////////////// 传参至practice core 内的处理函数

            practiceCore.inputArea.updateInputArea(text);
        },

        onSizeChange: function () {
            var thisObj = practiceArea.inputArea;
            UI.pushIntoDrawQueue({func: practiceArea.inputArea.redraw, id: "practiceArea_inputArea_redraw"}, REPLACE);
        },

        getCursorPos: function () { // 如果选区是一片 拖蓝, 那么返回末尾在inputArea 内的 index; 如果光标不在inputArea 内, 返回-1;
            var thisObj = practiceArea.inputArea;
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
            var thisObj = practiceArea.inputArea;
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
            practiceArea.inputArea.inputElement.innerHTML = "";
        },

        setTextInTextArea: function (finalMatchingResult) {
            var thisObj = practiceArea.inputArea;

            const unfinish = "unfinish";
            const correct = "correct";
            const incorrect = "incorrect";

            var inputAreaInnerHTML_setTo = "";
            var colorConfig = UI_Config.color;
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
            UI.pushIntoDrawQueue({func: practiceArea.inputArea.redraw, id: "practiceArea_inputArea_redraw"}, REPLACE);
        }
    },

    statisticsArea: {
        init: function() {
            UI.pushIntoDrawQueue(practiceArea.statisticsArea.redraw);
            UI.pushIntoDrawQueue(practiceArea.statisticsArea.redraw)
        },

        redraw: function(timestamp) {
            var thisObj = practiceArea.statisticsArea;
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
            statisticsArea.style.backgroundColor = UI_Config.color.colorToHex(UI_Config.color.dark.background0);
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
}

const UI_config = {
    init: function () {
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