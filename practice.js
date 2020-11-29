/// <reference path = "UI.js"/>
/// <reference path = "header.js"/>

//const { ipcRenderer } = require("electron");

function practice_init() {
    practiceCore.init();
    practiceArea.init();
}

const practiceCore = {
    init: function() {
        practiceCore.loadPhrase();
        practiceCore.inputArea.init();
        practiceCore.statistics.init();
    },

    phraseInfoList: [],

    moveToNextPhrase: function(clearDelay = null) {
        practiceCore.phraseInfoList.push(new PhraseInfo());
        practiceCore.phraseInfoList.splice(0, 1);

        //practiceCore.inputArea.lastMatchingResult = [];

        ipcRenderer.send(updateStatistics, JSON.stringify(practiceCore.statistics.getStatistics_forCurrentPhrase()));
        practiceCore.statistics.clearOverallStatus(practiceCore.getCurrentPhraseInfo().phrase.length);

        practiceArea.floatingArea.moveToNextPhrase(practiceCore.phraseInfoList[1]);
        practiceArea.statisticsArea.updateStatisticsData();
        if (clearDelay == null) {
            practiceArea.inputArea.keepThenClear();
        } else {
            practiceArea.inputArea.keepThenClear(clearDelay);
        }
    },

    loadPhrase: function() {
        practiceCore.phraseInfoList.push(new PhraseInfo());
        practiceCore.phraseInfoList.push(new PhraseInfo());
    },

    getPhrase: function(index) {
        if (index < 0 || index > practiceCore.phraseInfoList.length) {
            console.log("error");
            return;
        }
        return practiceCore.phraseInfoList[index];
    },

    getCurrentPhraseInfo() {
        return practiceCore.phraseInfoList[0];
    },

    inputArea: {
        inputBlocks: [], // {text, 对错状态, 花费时间，尝试次数}
        validCharList: "",
        onWhichZi_index: 0,
        freezeInputArea: false, // 暂时冻结输入区域，这时输入会触发特殊的处理方法
        inputArea_clear_timeoutID: 0,

        lastMatchingResult: [],

        init: function() {
            practiceCore.inputArea.setValidCharList(JSON.parse(ipcRenderer.sendSync(getScheme)).validCharList);
        },

        setValidCharList: function(validCharList) {
            practiceCore.inputArea.validCharList = validCharList;
        },

        updateInputArea: function(text) {
            let thisObj = practiceCore.inputArea;

            if (thisObj.freezeInputArea) {
                let oldText = ""
                for (let i = 0; i < thisObj.lastMatchingResult.length; i++) {
                    oldText += thisObj.lastMatchingResult[i].pinyin;
                }
                let difference_between_oldText_and_newText = "";
                let oldText_index = 0;
                let newText_index = 0;
                let newCursorPos = -1;
                while (newText_index < text.length) {
                    if (oldText_index >= oldText.length || (oldText_index < oldText.length && oldText[oldText_index] != text[newText_index])) {
                        difference_between_oldText_and_newText += text[newText_index];
                        newText_index++;
                        if (newText_index == practiceArea.inputArea.cursorPos) {
                            newCursorPos = difference_between_oldText_and_newText.length;
                        }
                    } else {
                        oldText_index++;
                        newText_index++;
                    }
                }
                practiceArea.inputArea.cursorPos = newCursorPos;
                clearTimeout(thisObj.inputArea_clear_timeoutID);
                thisObj.freezeInputArea = false;
                if (difference_between_oldText_and_newText.length == 0) {
                    practiceArea.inputArea.clearInputArea();
                    practiceArea.inputArea.setCursorPosToEnd();
                    return;
                } else {
                    text = difference_between_oldText_and_newText;
                }
            }

            let validText = thisObj.removeInvalidChar(text, thisObj.validCharList); // 合法的字符串


            let allAnswerPossibilityCombination = thisObj.getAllAnswerPossibilityCombination();
            //console.log("all answer combination:    ", allAnswerPossibilityCombination);
            let matchingResultList = [];
            for (let i = 0; i < allAnswerPossibilityCombination.length; i++) {
                matchingResultList.push(thisObj.matchingResult(allAnswerPossibilityCombination[i], validText));
                matchingResultList.push(thisObj.matchingResult_exactLength(allAnswerPossibilityCombination[i], validText));
            } // 对每一个可能的答案，进行对比
            //console.log("this is matching result", matchingResultList);
            let finalMatchingResult = thisObj.findBestPossibilityCombination(matchingResultList);
            //console.log("this is final matching result", finalMatchingResult);


            const unfinish = "unfinish";
            const correct = "correct";
            const incorrect = "incorrect";

            let finalMatchingResult_usingString = [];
            let allIncorrectIndex = [];
            let allCorrectIndex = [];
            let allUnfinishIndex = [];
            for (let i = 0; i < finalMatchingResult.length; i++) { // 把 index 转换为 string
                finalMatchingResult_usingString.push({ status: finalMatchingResult[i].status, pinyin: validText.substring(finalMatchingResult[i].start, finalMatchingResult[i].end), answer: finalMatchingResult[i].answer });
                if (finalMatchingResult[i].status == incorrect) {
                    allIncorrectIndex.push(i);
                } else if (finalMatchingResult[i].status == correct) {
                    allCorrectIndex.push(i);
                } else {
                    allUnfinishIndex.push(i);
                }
            }

            //console.log("this is final matching result, Text:  ", finalMatchingResult_usingString);

            practiceCore.statistics.onInputAreaUpdate(performance.now(), finalMatchingResult_usingString);

            practiceArea.inputArea.setTextInTextArea(finalMatchingResult_usingString);

            /////////////////////////////////////////////

            let onWhichWord_index = 0;
            while (onWhichWord_index < finalMatchingResult.length) { // 把 index 转换为 string
                if (finalMatchingResult[onWhichWord_index].status == "unfinish")
                    break;
                onWhichWord_index++;
            }
            if (onWhichWord_index >= finalMatchingResult.length) onWhichWord_index = finalMatchingResult.length - 1;
            practiceArea.floatingArea.getCurrentBlock().update_onWhichWord(onWhichWord_index);

            if (practiceArea.floatingArea.getCurrentBlock().phraseBlockElement.offsetWidth > UI.windowW) {
                UI.pushIntoDrawQueue({ func: practiceArea.floatingArea.redraw, id: "practiceArea_floatingArea_redraw" }, REPLACE);
            }

            /////////////////////////////////////////////

            for (let i = 0; i < allIncorrectIndex.length; i++) {
                if (typeof thisObj.lastMatchingResult[allIncorrectIndex[i]] == "undefined" || thisObj.lastMatchingResult[allIncorrectIndex[i]].status != incorrect) {
                    practiceArea.floatingArea.getCurrentBlock().createIncorrectAnimation(allIncorrectIndex[i]);
                }
            }

            /////////////////////////////////////////////

            thisObj.lastMatchingResult = finalMatchingResult_usingString;

            let correctCount = allCorrectIndex.length;
            let isFinish = (allUnfinishIndex.length == 0);

            if (correctCount >= finalMatchingResult.length && config.autoNext == "autoNext_allCorrect") {
                practiceCore.moveToNextPhrase(0);
            } else if (isFinish && config.autoNext == "autoNext_onceFinish") {
                if (correctCount >= finalMatchingResult_usingString.length) {
                    practiceCore.moveToNextPhrase(0);
                } else {
                    practiceCore.moveToNextPhrase();
                }
            } else if (isFinish && correctCount < finalMatchingResult.length && config.autoClear == "autoClear") {
                practiceArea.floatingArea.getCurrentBlock().update_onWhichWord(0);
                //UI.pushIntoDrawQueue({ func: practiceArea.floatingArea.redraw, id: "practiceArea_floatingArea_redraw" }, REPLACE);
                practiceArea.inputArea.keepThenClear();
                practiceCore.statistics.clearLastTimeStatus();
            }
        },

        removeInvalidChar: function(string, validCharList) {
            let newString = "";
            for (let i = 0; i < string.length; i++) {
                if (validCharList.indexOf(string[i]) > -1) {
                    newString = newString + string[i];
                }
            }
            return newString;
        },

        findBestPossibilityCombination: function(matchingResultList) {
            let thisObj = practiceCore.inputArea;

            let indexOfBestMatchingResult = 0;
            let difference_correctCount_minus_incorrectCount = Number.MIN_SAFE_INTEGER;
            for (let i = 0; i < matchingResultList.length; i++) { // 正确尽可能多，错误尽可能少的答案
                let correctCount = 0;
                let incorrectCount = 0;
                for (let j = 0; j < matchingResultList[i].length; j++) {
                    if (matchingResultList[i][j].status == "correct") {
                        correctCount++;
                    } else if (matchingResultList[i][j].status == "incorrect") {
                        incorrectCount++;
                    }
                }
                if (correctCount - incorrectCount >= difference_correctCount_minus_incorrectCount) {
                    difference_correctCount_minus_incorrectCount = correctCount - incorrectCount;
                    indexOfBestMatchingResult = i;
                }
            }
            //console.log("best answer: ", matchingResultList[indexOfBestMatchingResult]);
            return matchingResultList[indexOfBestMatchingResult];
        },

        getAllAnswerPossibilityCombination: function() { // 遍历所有答案（多音字）组合可能性
            let thisObj = practiceCore.inputArea;
            let currentPossibleAnswer = practiceCore.getCurrentPhraseInfo().possibleAnswerList;
            //console.log("answer list", currentPossibleAnswer);
            let possibilityList = [];
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

        matchingResult: function(possibleAnswerCombination, userAnswer) {
            const unfinish = "unfinish";
            const correct = "correct";
            const incorrect = "incorrect";

            let result = [];
            for (let i = 0; i < possibleAnswerCombination.length; i++) {
                result.push({ "status": unfinish, "start": 0, "end": 0, answer: possibleAnswerCombination[i] }); // [start, end)
            }

            let deviation = 1;
            let maxDeviation = 2;
            let deviationToFront = 0;
            let deviationToBack = 1;
            let expectStartingPoint = 0;
            let minPinyinLength = 1;

            for (let i = 0; i < possibleAnswerCombination.length; i++) {
                if (userAnswer.length - expectStartingPoint < possibleAnswerCombination[i].length) { //说明这个字的拼音可能还没有完成
                    if (userAnswer.length - expectStartingPoint + deviationToFront < possibleAnswerCombination[i].length) {
                        if (i > 0 && userAnswer.length - expectStartingPoint > 0) {
                            result[i].start = result[i - 1].end;
                        }
                        break;
                    }
                }
                let answerIndex_in_userAnswer = userAnswer.substring(expectStartingPoint - deviationToFront).indexOf(possibleAnswerCombination[i]);
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
                        } else { // 没有,完全正确
                            result[i].status = correct;
                            result[i].start = answerIndex_in_userAnswer;
                            result[i].end = answerIndex_in_userAnswer + possibleAnswerCombination[i].length;

                            expectStartingPoint = answerIndex_in_userAnswer + possibleAnswerCombination[i].length;
                            deviationToFront = 0;
                            deviationToBack = 1;
                        }
                    } else if (i > 0 && result[i - 1].status == incorrect) { // 前面的那个字的拼音是错误的
                        result[i].status = correct;
                        result[i].start = answerIndex_in_userAnswer;
                        result[i].end = answerIndex_in_userAnswer + possibleAnswerCombination[i].length;

                        result[i - 1].end = answerIndex_in_userAnswer;

                        expectStartingPoint = answerIndex_in_userAnswer + possibleAnswerCombination[i].length;
                        deviationToFront = 0;
                        deviationToBack = 1;
                    } else { // i == 0
                        if (answerIndex_in_userAnswer > 0) {
                            result[i].status = incorrect;
                            result[i].start = 0;
                            result[i].end = answerIndex_in_userAnswer + possibleAnswerCombination[i].length;

                            expectStartingPoint = answerIndex_in_userAnswer + possibleAnswerCombination[i].length;
                            deviationToFront = 0;
                            deviationToBack = 1;
                        } else {
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
                } else {
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
                    } else if (i > 0 && result[i - 1].status == incorrect) {
                        result[i].status = incorrect;
                        result[i].start = result[i - 1].end;
                        result[i].end = result[i].start + possibleAnswerCombination[i].length;

                        expectStartingPoint = result[i].end;
                        deviationToFront++;
                        deviationToBack = 1;
                        while (expectStartingPoint - deviationToFront < result[i].start + minPinyinLength) {
                            deviationToFront--;
                        }
                    } else { // i == 0
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

            let lastSpanIndex = result.length;
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
        },

        matchingResult_exactLength: function(possibleAnswerCombination, userAnswer) {
            const unfinish = "unfinish";
            const correct = "correct";
            const incorrect = "incorrect";

            let result = [];
            for (let i = 0; i < possibleAnswerCombination.length; i++) {
                result.push({ "status": unfinish, "start": 0, "end": 0, answer: possibleAnswerCombination[i] }); // [start, end)
            }

            let expectStartingPoint = 0;
            for (let i = 0; i < possibleAnswerCombination.length; i++) {
                let remainText = userAnswer.substring(expectStartingPoint);
                if (remainText.length < possibleAnswerCombination[i].length) { //说明这个字的拼音可能还没有完成
                    result[i].start = expectStartingPoint;
                    result[i].end = userAnswer.length;
                    break;
                } else if (remainText.indexOf(possibleAnswerCombination[i]) == 0) {
                    result[i].status = correct;
                    result[i].start = expectStartingPoint;
                    result[i].end = expectStartingPoint + possibleAnswerCombination[i].length;
                } else {
                    result[i].status = incorrect;
                    result[i].start = expectStartingPoint;
                    result[i].end = expectStartingPoint + possibleAnswerCombination[i].length;
                }
                expectStartingPoint += possibleAnswerCombination[i].length;
            }
            return result;
        }
    },

    statistics: {
        lastTimeStatus: [], // [{"status": "notStarted | unfinish | correct | incorrect"}]
        lastTimestamp: 0,
        needToshowAllZhuyin: false, // 避免多次调用showzhuyin 函数，引起多次重绘

        overallStatus: [], // [{"attemptTimes": 1, "errorTimes": 0, "totalTime": 0 ms, pinyin: "", word: "", answer: "", firstZhuyin: {sheng, yun, shengdiao, pinyin}, zhuyinCount: 1}, showedZhuyin: false] // coldBootTime

        normalSolvingTime: 500,

        init: function() {
            practiceCore.statistics.lastTimeStamp = performance.now();
            practiceCore.statistics.normalSolvingTime = ipcRenderer.sendSync(getNormalSolvingTime);
            practiceCore.statistics.needToshowAllZhuyin = false;
        },

        onInputAreaUpdate: function(timestamp, finalMatchingResult_usingString) { // 统计拼写时间和正确率
            let thisObj = practiceCore.statistics;

            const notStarted = "notStarted";
            const unfinish = "unfinish";
            const correct = "correct";
            const incorrect = "incorrect";

            if (thisObj.lastTimeStatus.length == 0 || thisObj.overallStatus.length == 0) {
                thisObj.clearOverallStatus(practiceCore.getCurrentPhraseInfo().phrase.length);
            }

            for (let i = 0; i < finalMatchingResult_usingString.length; i++) {
                if (thisObj.lastTimeStatus[i].status == notStarted && finalMatchingResult_usingString[i].status == unfinish && finalMatchingResult_usingString[i].pinyin != "") { // not start to not finish
                    thisObj.lastTimeStatus[i].status = unfinish;
                    thisObj.overallStatus[i].attemptTimes++;

                    if (i == 0) {
                        let publicTimeForWholePhrase = thisObj.getTimeInterval(thisObj.lastTimestamp, timestamp);
                        let temp_divide = 3 + finalMatchingResult_usingString.length; // 3 表示比例
                        const maxPreSolvingCount = Math.round(publicTimeForWholePhrase / thisObj.normalSolvingTime / 0.8); // 看一眼能解决几个字的拼音
                        if (temp_divide > 3 + maxPreSolvingCount) {
                            temp_divide = 3 + maxPreSolvingCount;
                        }
                        thisObj.overallStatus[0].totalTime += Math.round(publicTimeForWholePhrase * 3 / temp_divide);
                        if (!thisObj.overallStatus[0].hasOwnProperty("coldBootTime"))
                            thisObj.overallStatus[0].coldBootTime = Math.round(publicTimeForWholePhrase * 3 / temp_divide);
                        else if (thisObj.overallStatus[0].attemptTimes < 1)
                            thisObj.overallStatus[0].coldBootTime += Math.round(publicTimeForWholePhrase * 3 / temp_divide);

                        for (let j = 0; j + 1 < finalMatchingResult_usingString.length && j < maxPreSolvingCount; j++) {
                            let timeForInvolvedWord = Math.round(publicTimeForWholePhrase * (temp_divide - 3) / temp_divide / maxPreSolvingCount);
                            thisObj.overallStatus[j + 1].totalTime += timeForInvolvedWord

                            if (!thisObj.overallStatus[j + 1].hasOwnProperty("coldBootTime"))
                                thisObj.overallStatus[j + 1].coldBootTime = timeForInvolvedWord;
                            else if (thisObj.overallStatus[i].attemptTimes < 1)
                                thisObj.overallStatus[j + 1].coldBootTime += timeForInvolvedWord;
                        }
                    } else {
                        thisObj.overallStatus[i].totalTime += thisObj.getTimeInterval(thisObj.lastTimestamp, timestamp);
                        if (!thisObj.overallStatus[i].hasOwnProperty("coldBootTime"))
                            thisObj.overallStatus[i].coldBootTime = thisObj.getTimeInterval(thisObj.lastTimestamp, timestamp);
                        else if (thisObj.overallStatus[i].attemptTimes <= 1)
                            thisObj.overallStatus[i].coldBootTime += thisObj.getTimeInterval(thisObj.lastTimestamp, timestamp);
                    }
                    if (thisObj.overallStatus[i].attemptTimes <= 1) {
                        thisObj.overallStatus[i].showedZhuyin = practiceArea.floatingArea.getCurrentBlock().isIndex_showedZhuyin(i);
                    }
                } else if (thisObj.lastTimeStatus[i].status == notStarted && (finalMatchingResult_usingString[i].status == correct || finalMatchingResult_usingString[i].status == incorrect)) {
                    thisObj.lastTimeStatus[i].status = finalMatchingResult_usingString[i].status;
                    thisObj.overallStatus[i].attemptTimes++;
                    if (finalMatchingResult_usingString[i].status == incorrect) {
                        thisObj.overallStatus[i].errorTimes++;
                        if (thisObj.overallStatus[i].errorTimes >= config.howManyErrTimesShowZhuyin) thisObj.needToshowAllZhuyin = true;
                    }

                    if (i == 0) {
                        let publicTimeForWholePhrase = thisObj.getTimeInterval(thisObj.lastTimestamp, timestamp);
                        let temp_divide = 3 + finalMatchingResult_usingString.length; // 3 表示比例
                        const maxPreSolvingCount = Math.round(publicTimeForWholePhrase / thisObj.normalSolvingTime / 0.8); // 看一眼能解决几个字的拼音
                        if (temp_divide > 3 + maxPreSolvingCount) {
                            temp_divide = 3 + maxPreSolvingCount;
                        }
                        thisObj.overallStatus[0].totalTime += Math.round(publicTimeForWholePhrase * 3 / temp_divide);
                        if (!thisObj.overallStatus[0].hasOwnProperty("coldBootTime"))
                            thisObj.overallStatus[0].coldBootTime = Math.round(publicTimeForWholePhrase * 3 / temp_divide);
                        else if (thisObj.overallStatus[0].attemptTimes < 1)
                            thisObj.overallStatus[0].coldBootTime += Math.round(publicTimeForWholePhrase * 3 / temp_divide);

                        for (let j = 0; j + 1 < finalMatchingResult_usingString.length && j < maxPreSolvingCount; j++) {
                            let timeForInvolvedWord = Math.round(publicTimeForWholePhrase * (temp_divide - 3) / temp_divide / maxPreSolvingCount);
                            thisObj.overallStatus[j + 1].totalTime += timeForInvolvedWord

                            if (!thisObj.overallStatus[j + 1].hasOwnProperty("coldBootTime"))
                                thisObj.overallStatus[j + 1].coldBootTime = timeForInvolvedWord;
                            else if (thisObj.overallStatus[i].attemptTimes < 1)
                                thisObj.overallStatus[j + 1].coldBootTime += timeForInvolvedWord;
                        }
                    } else {
                        thisObj.overallStatus[i].totalTime += thisObj.getTimeInterval(thisObj.lastTimestamp, timestamp);
                        if (!thisObj.overallStatus[i].hasOwnProperty("coldBootTime"))
                            thisObj.overallStatus[i].coldBootTime = thisObj.getTimeInterval(thisObj.lastTimestamp, timestamp);
                        else if (thisObj.overallStatus[i].attemptTimes <= 1)
                            thisObj.overallStatus[i].coldBootTime += thisObj.getTimeInterval(thisObj.lastTimestamp, timestamp);
                    }

                    if (thisObj.overallStatus[i].attemptTimes <= 1) {
                        thisObj.overallStatus[i].showedZhuyin = practiceArea.floatingArea.getCurrentBlock().isIndex_showedZhuyin(i);
                    }
                } else if (thisObj.lastTimeStatus[i].status == unfinish) {
                    if (finalMatchingResult_usingString[i].status == incorrect) {
                        thisObj.overallStatus[i].errorTimes++;
                        if (thisObj.overallStatus[i].errorTimes >= config.howManyErrTimesShowZhuyin) thisObj.needToshowAllZhuyin = true;
                        thisObj.lastTimeStatus[i].status = finalMatchingResult_usingString[i].status;
                        thisObj.overallStatus[i].totalTime += thisObj.getTimeInterval(thisObj.lastTimestamp, timestamp);
                    } else if (finalMatchingResult_usingString[i].status == unfinish && finalMatchingResult_usingString[i].pinyin == "") {
                        thisObj.lastTimeStatus[i].status = notStarted;
                        thisObj.overallStatus[i].totalTime += thisObj.getTimeInterval(thisObj.lastTimestamp, timestamp);
                        if (thisObj.overallStatus[i].attemptTimes > 1) thisObj.overallStatus[i].attemptTimes--;
                    } else {
                        thisObj.lastTimeStatus[i].status = finalMatchingResult_usingString[i].status;
                        thisObj.overallStatus[i].totalTime += thisObj.getTimeInterval(thisObj.lastTimestamp, timestamp);
                    }
                } else if (thisObj.lastTimeStatus[i].status == incorrect && finalMatchingResult_usingString[i].status == correct) {
                    thisObj.lastTimeStatus[i].status = finalMatchingResult_usingString[i].status;
                    thisObj.overallStatus[i].attemptTimes++;
                    thisObj.overallStatus[i].totalTime += thisObj.getTimeInterval(thisObj.lastTimestamp, timestamp);
                } else if (thisObj.lastTimeStatus[i].status == incorrect && finalMatchingResult_usingString[i].status == unfinish) {
                    thisObj.lastTimeStatus[i].status = finalMatchingResult_usingString[i].status;
                    thisObj.overallStatus[i].attemptTimes++;
                    thisObj.overallStatus[i].totalTime += thisObj.getTimeInterval(thisObj.lastTimestamp, timestamp);
                }
                thisObj.overallStatus[i].pinyin = finalMatchingResult_usingString[i].pinyin;
                thisObj.overallStatus[i].answer = finalMatchingResult_usingString[i].answer;
                thisObj.overallStatus[i].showedZhuyin = practiceArea.floatingArea.getCurrentBlock().isIndex_showedZhuyin(i);
            }
            thisObj.lastTimestamp = timestamp;
            if (thisObj.needToshowAllZhuyin && practiceArea.floatingArea.getCurrentBlock().showZhuyin_DiffHigherThan > 0) {
                practiceArea.floatingArea.getCurrentBlock().showZhuyin({ forceToShowAllPinyin: true });
            }
        },

        clearOverallStatus: function(phraseLength) {
            let thisObj = practiceCore.statistics;
            //console.log("for overall status: XXXXXXXXXXXXXXXXXXXXXXXXXX", thisObj.overallStatus);
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
                newObj.word = practiceCore.getCurrentPhraseInfo().phrase[i];
                newObj.answer = "";
                newObj.firstZhuyin = practiceCore.getCurrentPhraseInfo().zhuyinList[i][0];
                newObj.zhuyinCount = practiceCore.getCurrentPhraseInfo().zhuyinList[i].length;
                newObj.showedZhuyin = practiceArea.floatingArea.getCurrentBlock().isIndex_showedZhuyin(i);
                thisObj.overallStatus.push(newObj);
            }
            thisObj.needToshowAllZhuyin = false;
        },

        clearLastTimeStatus: function() {
            let thisObj = practiceCore.statistics;
            const notStarted = "notStarted";
            const unfinish = "unfinish";
            for (let i = 0; i < thisObj.overallStatus.length; i++) {
                if (thisObj.lastTimeStatus[i].status == unfinish && thisObj.overallStatus[i].totalAttemptTimes > 0 && thisObj.overallStatus[i].totalAttemptTimes < thisObj.overallStatus[i].totalErrorTimes)
                    thisObj.overallStatus[i].attemptTimes--;
                thisObj.lastTimeStatus[i].status = notStarted;
            }
            thisObj.normalSolvingTime = ipcRenderer.sendSync(getNormalSolvingTime);
        },

        getTimeInterval: function(t1, t2) {
            let ret = t2 - t1;
            let minRestingTime = Math.max(practiceCore.statistics.normalSolvingTime * 6, 2500); // 超过多少毫秒之后不算入拼写时间
            const maxRestingTime = 6000; // ms
            if (minRestingTime > maxRestingTime) {
                minRestingTime = maxRestingTime;
            }
            if (ret > minRestingTime) {
                return practiceCore.statistics.normalSolvingTime + Math.min(practiceCore.statistics.normalSolvingTime * 0.1, 100); // 默认的解决时间
            }
            return ret;
        },

        getStatistics_forCurrentPhrase: function() {
            //if (practiceCore.statistics.overallStatus[0].totalTime > 600) practiceCore.statistics.overallStatus[0].totalTime -= UI.practiceArea.floatingArea.animation.switchTime + 50; // 减去动画时间
            if (practiceCore.statistics.overallStatus.length == 0) return []; ///////////////////////////////////////////////////////////
            return practiceCore.statistics.overallStatus; // [{"attemptTimes": 1, "errorTimes": 0, "totalTime": 0 ms, pinyin: ""}]
        }
    }

}


const practiceArea = {

    init: function() {
        let thisObj = practiceArea;
        document.getElementById("practiceArea").tabIndex = -1;
        for (const key in thisObj) {
            if (thisObj.hasOwnProperty(key)) {
                if (typeof thisObj[key] == "object" && thisObj[key].hasOwnProperty("init")) {
                    thisObj[key].init();
                }
            }
        }
    },

    floatingArea: {

        floatingBlockList: [],
        currentBlock_index: 0, // 指明现在正在接受练习的 floatingBlock, 因为currentBlock 的位置是必须先被指定，其他前后的block 才能确定位置。

        init: function() {
            let thisObj = practiceArea.floatingArea;

            UI.onSizeChangeQueue.push(thisObj.onSizeChange);

            let phraseInfo = practiceCore.getPhrase(0);
            thisObj.floatingBlockList.push(new FloatingBlock(phraseInfo.phrase, phraseInfo.zhuyinList, FloatingBlock.CURRENT));
            thisObj.currentBlock_index = 0;
            phraseInfo = practiceCore.getPhrase(1);
            thisObj.floatingBlockList.push(new FloatingBlock(phraseInfo.phrase, phraseInfo.zhuyinList, FloatingBlock.NEXT, thisObj.floatingBlockList[0]));

            UI.pushIntoDrawQueue({ func: practiceArea.floatingArea.redraw, id: "practiceArea_floatingArea_redraw" }, NOT_REPLACE);
        },

        redraw: function(timestamp) {
            let thisObj = practiceArea.floatingArea;
            thisObj.floatingBlockList[thisObj.currentBlock_index].redraw(timestamp);
            for (let i = 0; i < thisObj.floatingBlockList.length; i++) {
                if (i != thisObj.currentBlock_index) {
                    thisObj.floatingBlockList[i].redraw(timestamp);
                }
            }
            return FINISH;
        },

        onSizeChange: function() {
            let thisObj = practiceArea.floatingArea;
            thisObj.floatingBlockList[thisObj.currentBlock_index].onSizeChange();
            for (let i = 0; i < thisObj.floatingBlockList.length; i++) {
                if (i != thisObj.currentBlock_index) {
                    thisObj.floatingBlockList[i].onSizeChange();
                }
            }
        },

        moveToNextPhrase: function(nextPhraseInfo) {
            let thisObj = practiceArea.floatingArea;
            thisObj.floatingBlockList.push(new FloatingBlock(nextPhraseInfo.phrase, nextPhraseInfo.zhuyinList, FloatingBlock.NEWBORN, thisObj.floatingBlockList[thisObj.floatingBlockList.length - 1]));
            practiceArea.floatingArea.currentBlock_index++;
            for (let i = 0; i < thisObj.floatingBlockList.length; i++) {
                if (thisObj.floatingBlockList[i].checkNeedToDelete()) {
                    thisObj.floatingBlockList[i].destory();
                    thisObj.floatingBlockList.splice(i, 1);
                    if (i < this.currentBlock_index) {
                        this.currentBlock_index--;
                    }
                    i--;
                }
            }
            UI.requestToRecordFPS(); //////////////////////////////

            thisObj.floatingBlockList[thisObj.currentBlock_index].moveToNextStage(); // current
            if (thisObj.currentBlock_index - 1 >= 0) { // prev
                thisObj.floatingBlockList[thisObj.currentBlock_index - 1].moveToNextStage();
            }
            if (thisObj.currentBlock_index - 2 >= 0) { // old
                thisObj.floatingBlockList[thisObj.currentBlock_index - 2].moveToNextStage();
            }
            if (thisObj.currentBlock_index + 1 < thisObj.floatingBlockList.length) { // next
                thisObj.floatingBlockList[thisObj.currentBlock_index + 1].moveToNextStage();
            }
        },

        getCurrentBlock: function() {
            return practiceArea.floatingArea.floatingBlockList[practiceArea.floatingArea.currentBlock_index];
        }
    },

    inputArea: {
        inputElement: {},
        contentList: [],
        cursorPos: 0,

        init: function() {
            let thisObj = practiceArea.inputArea;
            thisObj.inputElement = document.getElementById("inputArea");
            thisObj.inputElement.style.color = UI_config.color.colorToHex(UI_config.color[config.colorMode].font_normal);

            thisObj.inputElement.addEventListener("input", thisObj.updateInputArea);
            thisObj.inputElement.addEventListener("keydown", thisObj.onSpecificKeyDown);
            //thisObj.inputElement.addEventListener("focus", thisObj.onFocus);
            UI.pushIntoDrawQueue({ func: practiceArea.inputArea.redraw, id: "practiceArea_inputArea_redraw" }, REPLACE);
            UI.pushIntoOnSizeChanegQueue(thisObj.onSizeChange);
        },

        redraw: function(timestamp) {
            let thisObj = practiceArea.inputArea;
            thisObj.inputElement.style.fontSize = FloatingBlock.calCurrentBlockFontSize() * 0.8 + 'px';

            let inputAreaW = thisObj.inputElement.offsetWidth;
            let inputAreaH = thisObj.inputElement.offsetHeight;
            let inputAreaT = Math.round(UI.windowH * 0.382 + FloatingBlock.calCurrentBlockFontSize() + inputAreaH / 1.3);
            let inputAreaL = Math.round(UI.windowW / 2 - inputAreaW / 2);

            thisObj.inputElement.style.top = inputAreaT + 'px';
            thisObj.inputElement.style.left = inputAreaL + 'px';
            return FINISH;
        },

        updateInputArea: function(e) {
            let thisObj = practiceArea.inputArea;

            let text = thisObj.inputElement.textContent; // 提取所有非标签的文本
            thisObj.cursorPos = thisObj.getCursorPos();
            if (thisObj.cursorPos > -1) {
                thisObj.cursorPos = practiceCore.inputArea.removeInvalidChar(text.substring(0, thisObj.cursorPos), practiceCore.inputArea.validCharList).length;
            }

            /////////////////////////// 传参至practice core 内的处理函数

            practiceCore.inputArea.updateInputArea(text);
        },

        onSpecificKeyDown: function(event) {
            if (event.keyCode == 13) { // enter
                practiceArea.floatingArea.getCurrentBlock().update_onWhichWord(0);
                UI.pushIntoDrawQueue({ func: practiceArea.floatingArea.redraw, id: "practiceArea_floatingArea_redraw" }, REPLACE);
                if (practiceCore.inputArea.freezeInputArea) {
                    clearTimeout(practiceCore.inputArea.inputArea_clear_timeoutID);
                    practiceCore.inputArea.freezeInputArea = false;
                }
                practiceArea.inputArea.clearInputArea();
                practiceCore.statistics.clearLastTimeStatus();
            } else if (event.keyCode == 9) { // tab
                if (practiceArea.floatingArea.getCurrentBlock().showZhuyin_DiffHigherThan > 0) {
                    practiceArea.floatingArea.getCurrentBlock().showZhuyin_DiffHigherThan = 0;
                    if (ipcRenderer.sendSync(getZhuyinDifficulty, practiceArea.floatingArea.getCurrentBlock().getCurrentWord()) > 0.2) {
                        let index = practiceArea.floatingArea.getCurrentBlock().getCurrentWordIndex();
                        if (typeof practiceCore.statistics.overallStatus[index].coldBootTime == "undefined") {
                            practiceCore.statistics.overallStatus[index].coldBootTime = practiceCore.statistics.normalSolvingTime;
                        }
                        practiceCore.statistics.overallStatus[index].coldBootTime *= 1.5;
                        practiceCore.statistics.overallStatus[index].coldBootTime += 250;
                    }
                } else {
                    practiceArea.floatingArea.getCurrentBlock().zhuyinCount = practiceArea.floatingArea.getCurrentBlock().maxZhuyinCount;
                }
                practiceArea.floatingArea.getCurrentBlock().showZhuyin();
            }
        },

        onSizeChange: function() {
            let thisObj = practiceArea.inputArea;
            UI.pushIntoDrawQueue({ func: practiceArea.inputArea.redraw, id: "practiceArea_inputArea_redraw" }, REPLACE);
        },

        getCursorPos: function() { // 如果选区是一片 拖蓝, 那么返回末尾在inputArea 内的 index; 如果光标不在inputArea 内, 返回-1;
            let thisObj = practiceArea.inputArea;
            let selection = window.getSelection();
            let node = selection.focusNode;
            let offsetInNode = selection.focusOffset;
            let textNodeList = [];

            let getAllTextNode = (node) => {
                let nodes = node.childNodes;
                let ret = [];
                for (let j = 0; j < nodes.length; j++) {
                    if (nodes[j].nodeType == Node.TEXT_NODE) {
                        ret.push(nodes[j]);
                    } else {
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
                } else {
                    previousTextCount += textNodeList[i].textContent.length;
                }
            }
            //console.log("the focus node", node, "offset of the cursor", offsetInNode)
            if (isInclude) {
                return previousTextCount + offsetInNode;
            }
            return -1;
        },

        setCursorPos: function(node, offset) {
            let range = document.createRange();
            let selection = window.getSelection();
            range.setStart(node, offset);
            range.setEnd(node, offset);
            range.collapse();
            selection.removeAllRanges();
            selection.addRange(range);
        },

        setCursorPos: function(index) {
            let thisObj = practiceArea.inputArea;
            if (index < 0 || index > thisObj.inputElement.textContent.length) {
                thisObj.setCursorPosToEnd();
            }

            let range = document.createRange();
            let selection = window.getSelection();

            let textNodeList = [];

            let getAllTextNode = (node) => {
                let nodes = node.childNodes;
                let ret = [];
                for (let j = 0; j < nodes.length; j++) {
                    if (nodes[j].nodeType == Node.TEXT_NODE) {
                        ret.push(nodes[j]);
                    } else {
                        let result = getAllTextNode(nodes[j]);
                        for (let m = 0; m < result.length; m++) {
                            ret.push(result[m]);
                        }
                    }
                }
                return ret;
            };

            textNodeList = getAllTextNode(thisObj.inputElement);

            let textCount = 0;
            let i = 0;
            while (i < textNodeList.length) {
                if (textCount + textNodeList[i].textContent.length >= index) {
                    break;
                }
                textCount += textNodeList[i].textContent.length;
                i++;
            }
            if (textNodeList.length > i) {
                range.setStart(textNodeList[i], index - textCount);
                range.setEnd(textNodeList[i], index - textCount);
            } else {
                range.setStart(thisObj.inputElement, 0);
                range.setEnd(thisObj.inputElement, 0);
            }
            range.collapse();
            selection.removeAllRanges();
            selection.addRange(range);
        },

        setCursorPosToEnd: function() {
            let thisObj = practiceArea.inputArea;
            let nodes = thisObj.inputElement.childNodes;
            let lastNode = {};
            if (nodes.length <= 0) {
                lastNode = thisObj.inputElement;
            } else {
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

        clearInputArea: function() {
            practiceArea.inputArea.inputElement.innerHTML = "";
            UI.pushIntoDrawQueue({ func: practiceArea.inputArea.redraw, id: "practiceArea_inputArea_redraw" }, REPLACE);
        },

        setTextInTextArea: function(finalMatchingResult) {
            let thisObj = practiceArea.inputArea;

            const unfinish = "unfinish";
            const correct = "correct";
            const incorrect = "incorrect";

            let inputAreaInnerHTML_setTo = "";
            let colorConfig = UI_config.color;
            for (let i = 0; i < finalMatchingResult.length; i++) {
                if (finalMatchingResult[i].status == unfinish && finalMatchingResult[i].pinyin == "") {
                    break;
                }
                let newSpan_innerHTML = "<span class=\"inputBlock\"";
                if (finalMatchingResult[i].status == correct) {
                    newSpan_innerHTML += "style=\"color:" + colorConfig.colorToHex(colorConfig[colorConfig.currentColorSet].font_corrent) + "\"";
                } else if (finalMatchingResult[i].status == incorrect) {
                    newSpan_innerHTML += "style=\"color:" + colorConfig.colorToHex(colorConfig[colorConfig.currentColorSet].font_wrong) + "\"";
                }
                newSpan_innerHTML += ">" + finalMatchingResult[i].pinyin + "</span>";
                inputAreaInnerHTML_setTo += newSpan_innerHTML;
            }
            thisObj.inputElement.innerHTML = inputAreaInnerHTML_setTo;
            if (thisObj.cursorPos < 0) {
                thisObj.setCursorPosToEnd();
            } else {
                thisObj.setCursorPos(thisObj.cursorPos);
            }
            UI.pushIntoDrawQueue({ func: practiceArea.inputArea.redraw, id: "practiceArea_inputArea_redraw" }, REPLACE);
        },

        keepThenClear: function(delay = practiceCore.statistics.normalSolvingTime * 4) {
            if (!practiceCore.inputArea.freezeInputArea) {
                practiceCore.inputArea.freezeInputArea = true;
                clearTimeout(practiceCore.inputArea.inputArea_clear_timeoutID);
                if (delay == 0) {
                    practiceCore.inputArea.freezeInputArea = false;
                    practiceArea.inputArea.clearInputArea();
                } else {
                    practiceCore.inputArea.inputArea_clear_timeoutID = setTimeout(practiceArea.inputArea.keepThenClear, delay, 0);
                }
            } else {
                practiceCore.inputArea.freezeInputArea = false;
                practiceArea.inputArea.clearInputArea();
            }
        }
    },

    statisticsArea: {
        showStatisticsArea: true,

        init: function() {
            practiceArea.statisticsArea.updateStatisticsData();
            UI.pushIntoOnSizeChanegQueue(practiceArea.statisticsArea.onSizeChange);
            document.getElementById("practiceArea").addEventListener("keydown", practiceArea.statisticsArea.showHidestatisticsArea);
            if (config.showStatisticsArea == "none") {
                practiceArea.statisticsArea.showStatisticsArea = false;
            }
            //document.addEventListener("keydown", practiceArea.statisticsArea.showHidestatisticsArea);
        },

        showHidestatisticsArea: function(event) {
            if (event.keyCode == 72 && event.ctrlKey) {
                practiceArea.statisticsArea.showStatisticsArea = !practiceArea.statisticsArea.showStatisticsArea;
                UI.pushIntoDrawQueue({ func: practiceArea.statisticsArea.redraw, id: "practiceArea_statisticsArea_redraw" }, REPLACE);
            }
        },

        statisticsData: {},
        updateStatisticsData: function() {
            practiceArea.statisticsArea.statisticsData = ipcRenderer.sendSync(getStatistics);
            UI.pushIntoDrawQueue({ func: practiceArea.statisticsArea.redraw, id: "practiceArea_statisticsArea_redraw" }, REPLACE);
        },

        onSizeChange: function() {
            practiceArea.statisticsArea.redraw();
        },

        redraw: function(timestamp) {
            let thisObj = practiceArea.statisticsArea;
            if (!thisObj.showStatisticsArea) {
                document.getElementById("statisticsArea").style.visibility = "hidden";
                return FINISH;
            }
            document.getElementById("statisticsArea").style.visibility = "visible";
            let statisticsData = thisObj.statisticsData;
            let speedArea = document.getElementById("speed");
            speedArea.style.color = UI_config.color.colorToHex(UI_config.color[config.colorMode].font_normal);
            if (config.speedShowingUnit == "wordPerMin") {
                let speed = thisObj.calWordPerMin(statisticsData.totalAttemptTimes - statisticsData.totalErrorTimes, statisticsData.totalSolvingTime);
                if (speed <= 0) {
                    speedArea.innerText = "速度：-- 字/每分钟";
                }
                speedArea.innerText = "速度：" + speed + " 字/每分钟";
            } else {
                let speed = thisObj.calWordPerHour(statisticsData.totalAttemptTimes - statisticsData.totalErrorTimes, statisticsData.totalSolvingTime);
                if (speed <= 0) {
                    speedArea.innerText = "速度：-- 字/每小时";
                }
                speedArea.innerText = "速度：" + speed + " 字/每小时";
            }
            let accuracyArea = document.getElementById("accuracyRate");
            accuracyArea.style.color = UI_config.color.colorToHex(UI_config.color[config.colorMode].font_normal);
            if (statisticsData.totalAnimationTime == 0) {
                accuracyArea.innerText = "准确率：--%";
            } else {
                accuracyArea.innerText = "准确率：" + Math.round((statisticsData.totalAttemptTimes - statisticsData.totalErrorTimes) * 1000 / statisticsData.totalAttemptTimes) / 10 + "%";
            }
            let wordCountArea = document.getElementById("wordCount");
            wordCountArea.innerText = "总字数：" + statisticsData.totalWordCount + "字";
            wordCountArea.style.color = UI_config.color.colorToHex(UI_config.color[config.colorMode].font_normal);

            let statisticsArea = document.getElementById("statisticsArea");
            speedArea.style.fontSize = thisObj.calFontSize() + 'px';
            accuracyArea.style.fontSize = thisObj.calFontSize() + 'px';
            wordCountArea.style.fontSize = thisObj.calFontSize() + 'px';
            let background1Color = UI_config.color[config.colorMode].background1;
            statisticsArea.style.backgroundColor = "rgba(" + background1Color['R'] + "," + background1Color['G'] + ',' + background1Color['B'] + ',' + 0.7 + ')';
            statisticsArea.style.margin = Math.round(Math.min(UI.windowH, UI.windowW) / 61.8) + "px";
            statisticsArea.style.padding = Math.round(Math.min(UI.windowH, UI.windowW) / 61.8) + "px";
            // statisticsArea.style.left = "0px";
            // statisticsArea.style.top = "0px";

            return FINISH;
        },

        calFontSize: function() {
            let size = Math.min(UI.windowH, UI.windowW) / 42;
            if (size < 32) size = 20;
            return size;
        },

        calWordPerMin: function(wordCount, time) {
            if (wordCount <= 0 || time <= 0) {
                return 0;
            }
            let msPerWord = time / wordCount;
            return Math.round(600000 / msPerWord) / 10;
        },

        calWordPerHour: function(wordCount, time) {
            if (wordCount == 0 || time == 0) {
                return 0;
            }
            let msPerWord = time / wordCount;
            return Math.round(3600000 / msPerWord);
        },

    }
}


class PhraseInfo {
    phrase = "";
    zhuyinList = []; //[[{"sheng":"p", "yun":"in", "shengdiao": 1, "pinyin": "pīn"}]]
    possibleAnswerList = [];

    constructor() {
        let phrase_pinyin_answer = JSON.parse(ipcRenderer.sendSync(getPhrase));
        this.phrase = phrase_pinyin_answer.phrase;
        this.zhuyinList = phrase_pinyin_answer.pinyinDetails;
        this.possibleAnswerList = phrase_pinyin_answer.answers;
    }
}


class FloatingBlock {
    static CURRENT = "current";
    static NEXT = "next";
    static PREV = "prev";
    static NEWBORN = "newBorn";
    static OLD = "old";

    floatingBlock;
    zhuyinBlockElement;
    zhuyinElementList = [];
    currentWordPointerElement;
    phraseBlockElement;
    wordElementList = [];

    phrase = "";
    zhuyinList = [];

    onWhichWord_index = 0;
    stage = FloatingBlock.CURRENT;

    previousBlock;
    nextBlock;

    constructor(phrase, zhuyinList, stage, previousBlock = null) {
        this.phrase = phrase;
        this.zhuyinList = zhuyinList;
        this.stage = stage;
        this.previousBlock = previousBlock;
        this.uid = getUniqueId();
        if (previousBlock != null) this.previousBlock.nextBlock = this; // 自动设置上一个Block的nextBlock

        this.phraseBlock_animate = this.phraseBlock_animate.bind(this);
        this.redraw = this.redraw.bind(this);
        this.onSizeChange = this.onSizeChange.bind(this);

        let floatingArea = document.getElementById("floatingArea");
        this.floatingBlock = document.createElement("div");
        this.floatingBlock.id = "floatingBlock_" + this.uid;
        this.floatingBlock.style.position = "absolute";
        this.floatingBlock.style.width = floatingArea.offsetWidth + "px";
        this.floatingBlock.style.height = floatingArea.offsetHeight + 'px';
        this.floatingBlock.style.left = '0px';
        this.floatingBlock.style.top = '0px';
        floatingArea.appendChild(this.floatingBlock);

        this.phraseBlockElement = document.createElement("div");
        this.phraseBlockElement.style.color = UI_config.color.colorToHex(UI_config.color[config.colorMode].font_normal);
        this.phraseBlockElement.style.whiteSpace = "nowrap";
        this.phraseBlockElement.style.position = "absolute";
        this.setPhraseBlockText(this.phraseBlockElement, phrase);
        this.floatingBlock.appendChild(this.phraseBlockElement);

        this.zhuyinBlockElement = document.createElement("div");
        this.zhuyinBlockElement.style.color = UI_config.color.colorToHex(UI_config.color[config.colorMode].font_normal);
        this.zhuyinBlockElement.style.position = "absolute";
        this.zhuyinBlockElement.style.whiteSpace = "nowrap";
        this.resetZhuyin();
        this.showZhuyin();
        this.floatingBlock.appendChild(this.zhuyinBlockElement);

        let currentWordPointerElement = document.createElement("div");
        currentWordPointerElement.textContent = "\u2022";
        currentWordPointerElement.style.fontSize = FloatingBlock.calCurrentBlockFontSize() + 'px';
        currentWordPointerElement.style.color = UI_config.color.colorToHex(UI_config.color[config.colorMode].font_normal);
        currentWordPointerElement.style.position = "absolute";
        this.currentWordPointerElement = currentWordPointerElement;
        this.floatingBlock.appendChild(currentWordPointerElement);

        this.redraw();
    }

    destory() {
        let floatingArea = document.getElementById("floatingArea");
        // if (this.phraseBlockElement != null) floatingArea.removeChild(this.phraseBlockElement);
        // if (this.zhuyinBlockElement != null) floatingArea.removeChild(this.zhuyinBlockElement);
        // if (this.currentWordPointerElement != null) floatingArea.removeChild(this.currentWordPointerElement);
        if (this.floatingBlock != null) {
            floatingArea.removeChild(this.floatingBlock);
            this.floatingBlock = null;
        }
    }

    moveToNextStage() {
        if (this.stage == FloatingBlock.CURRENT) {
            this.stage = FloatingBlock.PREV;
        } else if (this.stage == FloatingBlock.PREV) {
            this.stage = FloatingBlock.OLD;
        } else if (this.stage == FloatingBlock.NEXT) {
            this.stage = FloatingBlock.CURRENT;
        } else if (this.stage == FloatingBlock.NEWBORN) {
            this.stage = FloatingBlock.NEXT;
        } else {
            this.stage == FloatingBlock.OLD;
        }
        UI.pushIntoDrawQueue(this.phraseBlock_animate);
    }

    onSizeChange() {
        let floatingArea = document.getElementById("floatingArea");
        this.floatingBlock.style.width = floatingArea.offsetWidth + 'px';
        this.floatingBlock.style.height = floatingArea.offsetHeight + 'px';
        if (this.floatingBlock_isOnAnimation) {
            this.phraseBlock_setTargetSizeAnsPos();
        } else {
            this.redraw();
        }
    }

    getRedrawID() {
        return "floatingBlock_redraw_" + this.uid;
    }

    setPhraseBlockText(floatingBlockElement, phrase) {
        this.wordElementList = [];
        let wordSpanList = [];
        for (let i = 0; i < phrase.length; i++) {
            let span = document.createElement("span");
            span.innerText = phrase[i];
            floatingBlockElement.appendChild(span);
            wordSpanList.push(span);
            this.wordElementList.push(span);
        }
        return wordSpanList;
    }

    redraw(timestamp) {
        // 颜色 透明度 字号与尺寸 位置
        if (this.stage == FloatingBlock.CURRENT) {
            this.floatingBlock.style.opacity = 1;
        } else {
            this.floatingBlock.style.opacity = FloatingBlock.lightOpacity;
        }
        this.redraw_phraseBlock_sizeAndPos();
        this.redrawZhuyin();
        this.redrawCurrentWordPointer();
        return FINISH;
    }

    redraw_phraseBlock_sizeAndPos() { // 必须先知道CurrentBlock的尺寸和位置，才能设置Next 和 prev 的尺寸和位置
        let blockHorizontalCentralAxis = UI.windowH * 0.382; // start from left top
        if (this.stage == FloatingBlock.CURRENT) {
            this.phraseBlockElement.style.fontSize = FloatingBlock.calCurrentBlockFontSize() + 'px';
            let blockW = this.phraseBlockElement.offsetWidth;
            let blockH = this.phraseBlockElement.offsetHeight;
            if (blockW > UI.windowW) {
                let blockL = (UI.windowW / 2 - this.wordElementList[this.onWhichWord_index].offsetLeft);
                let blockT = (blockHorizontalCentralAxis - blockH / 2);
                this.phraseBlockElement.style.left = blockL + 'px';
                this.phraseBlockElement.style.top = blockT + 'px';
            } else {
                let blockL = (UI.windowW / 2 - blockW / 2);
                let blockT = (blockHorizontalCentralAxis - blockH / 2);
                this.phraseBlockElement.style.left = blockL + 'px';
                this.phraseBlockElement.style.top = blockT + 'px';
            }
        } else if (this.stage == FloatingBlock.NEXT) {
            this.phraseBlockElement.style.fontSize = FloatingBlock.calSmallBlockFontSize() + 'px';
            let blockW = this.phraseBlockElement.offsetWidth;
            let blockH = this.phraseBlockElement.offsetHeight;
            let blockL = (this.previousBlock.phraseBlockElement.offsetLeft + this.previousBlock.phraseBlockElement.offsetWidth + FloatingBlock.calIntervalW());
            let blockT = (blockHorizontalCentralAxis - blockH / 2);
            this.phraseBlockElement.style.left = blockL + 'px';
            this.phraseBlockElement.style.top = blockT + 'px';
        } else if (this.stage == FloatingBlock.PREV) {
            this.phraseBlockElement.style.fontSize = FloatingBlock.calSmallBlockFontSize() + 'px';
            let blockW = this.phraseBlockElement.offsetWidth;
            let blockH = this.phraseBlockElement.offsetHeight;
            let blockL = (this.nextBlock.phraseBlockElement.offsetLeft - blockW - FloatingBlock.calIntervalW());
            let blockT = (blockHorizontalCentralAxis - blockH / 2);
            this.phraseBlockElement.style.left = blockL + 'px';
            this.phraseBlockElement.style.top = blockT + 'px';
        } else if (this.stage == FloatingBlock.NEWBORN) {
            this.floatingBlock.style.opacity = 0;
            this.phraseBlockElement.style.fontSize = FloatingBlock.calCurrentBlockFontSize() / 2 + 'px';
            let blockW = this.phraseBlockElement.offsetWidth;
            let blockH = this.phraseBlockElement.offsetHeight;
            let blockL = (this.previousBlock.phraseBlockElement.offsetLeft + this.previousBlock.phraseBlockElement.offsetWidth + FloatingBlock.calIntervalW());
            let blockT = (blockHorizontalCentralAxis - blockH / 2);
            this.phraseBlockElement.style.left = blockL + 'px';
            this.phraseBlockElement.style.top = blockT + 'px';
        } else {
            this.phraseBlockElement.style.fontSize = FloatingBlock.calCurrentBlockFontSize() / 2 + 'px';
            let blockW = this.phraseBlockElement.offsetWidth;
            let blockH = this.phraseBlockElement.offsetHeight;
            let blockL = UI.windowW + FloatingBlock.calIntervalW();
            let blockT = (blockHorizontalCentralAxis - blockH / 2);
            this.phraseBlockElement.style.left = blockL + 'px';
            this.phraseBlockElement.style.top = blockT + 'px';
        }
    }

    phraseBlock_animate(timestamp) {
        if (!this.floatingBlock_isOnAnimation) { // init the animation
            this.floatingBlock_isOnAnimation = true;
            this.phraseBlock_setTargetSizeAnsPos();
            this.floatingBlock_startTime = timestamp;
            this.floatingBlock_lastExeTime = timestamp;
            return UNFINISH;
        }

        //get current style.

        let now_L = parseFloat(window.getComputedStyle(this.phraseBlockElement).left);
        let now_T = parseFloat(window.getComputedStyle(this.phraseBlockElement).top);
        let now_opacity = parseFloat(window.getComputedStyle(this.floatingBlock).opacity);
        let now_fontSize = parseFloat(window.getComputedStyle(this.phraseBlockElement).fontSize);;

        // set position
        let easeOutFactor = calEaseOutFactor(this.floatingBlock_lastExeTime - this.floatingBlock_startTime, timestamp - this.floatingBlock_lastExeTime, this.floatingBlock_switchTime);

        this.phraseBlockElement.style.left = this.phraseBlock_targetL - easeOutFactor * (this.phraseBlock_targetL - now_L) + 'px';
        this.phraseBlockElement.style.top = this.phraseBlock_targetT - easeOutFactor * (this.phraseBlock_targetT - now_T) + 'px';
        this.floatingBlock.style.opacity = this.floatingBlock_target_opacity - easeOutFactor * (this.floatingBlock_target_opacity - now_opacity);
        this.phraseBlockElement.style.fontSize = this.phraseBlock_targetFontSize - easeOutFactor * (this.phraseBlock_targetFontSize - now_fontSize) + 'px';
        this.phraseBlock_targetFontSize
        this.redrawZhuyin();
        this.redrawCurrentWordPointer();

        if (timestamp - this.floatingBlock_startTime >= this.floatingBlock_switchTime) { //if the whole animation finish
            this.floatingBlock_isOnAnimation = false;
            UI.printFPS(); /////////////////////////////////////////////
            if (this.stage == FloatingBlock.OLD) {
                this.needToDelete = true;
            }
            return FINISH;
        }
        this.floatingBlock_lastExeTime = timestamp;
        return UNFINISH;
    }

    floatingBlock_isOnAnimation = false;

    static lightOpacity = 0.5;

    phraseBlock_targetW = 0;
    phraseBlock_targetH = 0;
    phraseBlock_targetFontSize = 0;
    phraseBlock_targetL = 0;
    phraseBlock_targetT = 0;
    floatingBlock_target_opacity = 1;

    floatingBlock_startTime = 0;
    floatingBlock_lastExeTime = 0;
    floatingBlock_switchTime = 250;

    phraseBlock_setTargetSizeAnsPos() {
        let phraseBlockHorizontalCentralAxis = UI.windowH * 0.382; // start from left top

        let copiedFloatingBlock = document.createElement("div"); // 拷贝出一个不可见的floatingBlock目标
        let copiedPhraseBlock = this.phraseBlockElement.cloneNode(true);
        copiedFloatingBlock.appendChild(copiedPhraseBlock);
        let copiedZhuyinBlock = this.zhuyinBlockElement.cloneNode(true);
        copiedFloatingBlock.appendChild(copiedZhuyinBlock);
        let copiedCurrentWordPointer = this.currentWordPointerElement.cloneNode(true);
        copiedFloatingBlock.appendChild(copiedCurrentWordPointer);
        copiedFloatingBlock.style.visibility = "hidden";
        document.getElementById("floatingArea").appendChild(copiedFloatingBlock);

        if (this.stage == FloatingBlock.CURRENT) {
            copiedPhraseBlock.style.fontSize = FloatingBlock.calCurrentBlockFontSize() + 'px';
            this.phraseBlock_targetFontSize = FloatingBlock.calCurrentBlockFontSize();
            this.floatingBlock_target_opacity = 1;
            let phraseBlockW = copiedPhraseBlock.offsetWidth;
            let phraseBlockH = copiedPhraseBlock.offsetHeight;
            this.phraseBlock_targetW = phraseBlockW;
            this.phraseBlock_targetH = phraseBlockH;
            if (phraseBlockW > UI.windowW) {
                this.phraseBlock_targetL = (UI.windowW / 2 - copiedPhraseBlock.children[0].offsetLeft);
                this.phraseBlock_targetT = (phraseBlockHorizontalCentralAxis - phraseBlockH / 2);
            } else {
                this.phraseBlock_targetL = (UI.windowW / 2 - phraseBlockW / 2);
                this.phraseBlock_targetT = (phraseBlockHorizontalCentralAxis - phraseBlockH / 2);
            }
        } else if (this.stage == FloatingBlock.NEXT) {

            copiedPhraseBlock.style.fontSize = FloatingBlock.calSmallBlockFontSize() + 'px';
            let phraseBlockW = copiedPhraseBlock.offsetWidth;
            let phraseBlockH = copiedPhraseBlock.offsetHeight;
            let phraseBlockL = (this.previousBlock.phraseBlock_targetL + this.previousBlock.phraseBlock_targetW + FloatingBlock.calIntervalW());
            let phraseBlockT = (phraseBlockHorizontalCentralAxis - phraseBlockH / 2);

            this.phraseBlock_targetW = phraseBlockW;
            this.phraseBlock_targetH = phraseBlockH;
            this.phraseBlock_targetFontSize = FloatingBlock.calSmallBlockFontSize();
            this.phraseBlock_targetL = phraseBlockL;
            this.phraseBlock_targetT = phraseBlockT;
            this.floatingBlock_target_opacity = FloatingBlock.lightOpacity;
        } else if (this.stage == FloatingBlock.PREV) {
            copiedPhraseBlock.style.fontSize = FloatingBlock.calSmallBlockFontSize() + 'px';
            let phraseBlockW = copiedPhraseBlock.offsetWidth;
            let phraseBlockH = copiedPhraseBlock.offsetHeight;
            let phraseBlockL = (this.nextBlock.phraseBlock_targetL - phraseBlockW - FloatingBlock.calIntervalW());
            let phraseBlockT = (phraseBlockHorizontalCentralAxis - phraseBlockH / 2);

            this.phraseBlock_targetW = phraseBlockW;
            this.phraseBlock_targetH = phraseBlockH;
            this.phraseBlock_targetFontSize = FloatingBlock.calSmallBlockFontSize();
            this.phraseBlock_targetL = phraseBlockL;
            this.phraseBlock_targetT = phraseBlockT;
            this.floatingBlock_target_opacity = FloatingBlock.lightOpacity;
        } else if (this.stage == FloatingBlock.OLD) {
            copiedPhraseBlock.style.fontSize = FloatingBlock.calCurrentBlockFontSize() / 2 + 'px';
            let phraseBlockW = copiedPhraseBlock.offsetWidth;
            let phraseBlockH = copiedPhraseBlock.offsetHeight;
            let phraseBlockL = (this.nextBlock.phraseBlock_targetL - phraseBlockW - FloatingBlock.calIntervalW());
            let phraseBlockT = (phraseBlockHorizontalCentralAxis - phraseBlockH / 2);

            this.phraseBlock_targetW = phraseBlockW;
            this.phraseBlock_targetH = phraseBlockH;
            this.phraseBlock_targetFontSize = FloatingBlock.calCurrentBlockFontSize() / 2;
            this.phraseBlock_targetL = phraseBlockL;
            this.phraseBlock_targetT = phraseBlockT;
            this.floatingBlock_target_opacity = 0;
        } else {
            copiedPhraseBlock.style.fontSize = FloatingBlock.calCurrentBlockFontSize() / 2 + 'px';
            let phraseBlockW = copiedPhraseBlock.offsetWidth;
            let phraseBlockH = copiedPhraseBlock.offsetHeight;
            let phraseBlockL = 0 - FloatingBlock.calIntervalW() - phraseBlockW;
            let phraseBlockT = Math.round(phraseBlockHorizontalCentralAxis - phraseBlockH / 2);

            this.phraseBlock_targetW = phraseBlockW;
            this.phraseBlock_targetH = phraseBlockH;
            this.phraseBlock_targetFontSize = FloatingBlock.calSmallBlockFontSize() / 2;
            this.phraseBlock_targetL = phraseBlockL;
            this.phraseBlock_targetT = phraseBlockT;
            this.floatingBlock_target_opacity = FloatingBlock.lightOpacity;
        }
        document.getElementById("floatingArea").removeChild(copiedFloatingBlock);
    }

    showZhuyin(forceToShowAllPinyin = false, forceToHeteronym = false) { // 包括了设置注音 和 重绘注音
        if (forceToShowAllPinyin) {
            this.showZhuyin_DiffHigherThan = 0;
        }
        if (forceToHeteronym) {
            this.zhuyinCount = this.maxZhuyinCount;
        }
        let zhuyinList = [];
        for (let i = 0; i < this.wordElementList.length; i++) {
            let zhuyinListForOneWord = [];
            if (ipcRenderer.sendSync(getZhuyinDifficulty, this.phrase[i]) >= this.showZhuyin_DiffHigherThan) {
                for (let j = 0, m = 0; j < this.zhuyinList[i].length && m < this.zhuyinCount; j++, m++) {
                    zhuyinListForOneWord.push(this.zhuyinList[i][j].pinyin);
                }
            }
            zhuyinList.push(zhuyinListForOneWord);
        }
        this.setZhuyinBlockText(zhuyinList);
        this.redrawZhuyin();
    }

    maxZhuyinCount = 10; // 最多纵向显示几个多音字
    zhuyinCount = 1;
    showZhuyin_DiffHigherThan = 0;

    resetZhuyin() {
        // if (config.autoZhuyin == "higherThan0.2") {
        //     this.showZhuyin_DiffHigherThan = 0.2;
        // } else if (config.autoZhuyin == "higherThan0.6") {
        //     this.showZhuyin_DiffHigherThan = 0.6;
        // } else if (config.autoZhuyin == "allZhuyin") {
        //     this.showZhuyin_DiffHigherThan = 0;
        // } else {
        //     this.showZhuyin_DiffHigherThan = 1;
        // }

        this.showZhuyin_DiffHigherThan = config.autoZhuyin;

        if (config.showHeteronym == "heteronym") {
            this.zhuyinCount = this.maxZhuyinCount;
        } else {
            this.zhuyinCount = 1;
        }
    }

    setZhuyinBlockText(zhuyinList) {
        this.zhuyinBlockElement.innerHTML = "";
        this.zhuyinElementList = [];
        let zhuyinFontSize = FloatingBlock.calZhuyinBlockFontSize(FloatingBlock.calCurrentBlockFontSize());
        if (this.phraseBlockElement != null) {
            zhuyinFontSize = FloatingBlock.calZhuyinBlockFontSize(parseFloat(window.getComputedStyle(this.phraseBlockElement).fontSize))
        }
        for (let i = 0; i < zhuyinList.length; i++) {
            let newZhuyinBlock = document.createElement("div");
            newZhuyinBlock.style.fontSize = zhuyinFontSize + "px";
            newZhuyinBlock.style.display = "flex";
            newZhuyinBlock.style.flexDirection = "column-reverse";
            newZhuyinBlock.style.justifyContent = "center";
            newZhuyinBlock.style.alignItems = "center";
            newZhuyinBlock.style.flexWrap = "nowrap";
            newZhuyinBlock.style.position = "absolute";
            for (let j = 0; j < zhuyinList[i].length; j++) {
                let newPinyinSpan = document.createElement("span");
                newPinyinSpan.textContent = zhuyinList[i][j];
                newZhuyinBlock.appendChild(newPinyinSpan);
            }
            this.zhuyinBlockElement.appendChild(newZhuyinBlock);
            this.zhuyinElementList.push(newZhuyinBlock);
        }
    }

    redrawZhuyin() { // 仅重绘注音
        if (this.zhuyinElementList.length <= 0) return FINISH;
        if (this.showZhuyin_DiffHigherThan >= 1) {
            return FINISH;
        }
        let zhuyinFontSize = FloatingBlock.calZhuyinBlockFontSize(FloatingBlock.calCurrentBlockFontSize());
        if (this.phraseBlockElement != null) {
            zhuyinFontSize = FloatingBlock.calZhuyinBlockFontSize(parseFloat(window.getComputedStyle(this.phraseBlockElement).fontSize))
        }
        this.zhuyinBlockElement.style.color = UI_config.color.colorToHex(UI_config.color[config.colorMode].font_normal);
        for (let i = 0; i < this.zhuyinElementList.length; i++) {
            this.zhuyinElementList[i].style.fontSize = zhuyinFontSize + 'px';
        }

        let wordElementWidthList = [];
        let wordElementLeftList = [];
        let zhuyinElementWidthList = [];
        for (let i = 0; i < this.zhuyinElementList.length; i++) {
            wordElementLeftList.push(this.wordElementList[i].offsetLeft);
            wordElementWidthList.push(this.wordElementList[i].offsetWidth);
            zhuyinElementWidthList.push(this.zhuyinElementList[i].offsetWidth);
        }

        for (let i = 0; i < this.zhuyinElementList.length; i++) {
            this.zhuyinElementList[i].style.left = (wordElementLeftList[i] + wordElementWidthList[i] / 2 - zhuyinElementWidthList[i] / 2) + 'px';
            this.zhuyinElementList[i].style.bottom = "0px";
        }
        this.zhuyinBlockElement.style.top = this.phraseBlockElement.offsetTop + 'px'; // zhuyin Block 长宽为0，是一个点
        this.zhuyinBlockElement.style.left = this.phraseBlockElement.offsetLeft + 'px';
        return FINISH;
    }

    isIndex_showedZhuyin(index) {
        if (index < 0 || index >= this.zhuyinElementList.length) return false;
        return this.zhuyinElementList[index].children.length > 1;
    }

    static calCurrentBlockFontSize() {
        const minFontSize = 96;
        let currentBlockFontSize = Math.round(Math.min(UI.windowH, UI.windowW) / 20); // px
        if (currentBlockFontSize < minFontSize) currentBlockFontSize = minFontSize;
        return currentBlockFontSize;
    }
    static calSmallBlockFontSize() {
        let nextPreBlockFontSize = Math.round(FloatingBlock.calCurrentBlockFontSize() * 0.7) // px
        return nextPreBlockFontSize;
    }
    static calZhuyinBlockFontSize(phraseFontSize) {
        let zhuyinBlockFontSize = Math.round(phraseFontSize * 0.27) // px
        return zhuyinBlockFontSize;
    }
    static calIntervalW() {
        let ret = Math.round(UI.windowW * 0.075);
        if (ret < 96) ret = 96;
        return ret;
    }

    update_onWhichWord(index) {
        this.onWhichWord_index = index;
        UI.pushIntoDrawQueue({ func: this.redrawCurrentWordPointer.bind(this), id: this.getRedrawID() + "_redrawCurrentWordPointer" }, REPLACE);
    }

    redrawCurrentWordPointer() {
        if (this.stage != FloatingBlock.CURRENT) {
            this.currentWordPointerElement.style.visibility = "hidden";
            return FINISH;
        }
        if (this.onWhichWord_index >= length.length || this.onWhichWord_index < 0) {
            this.currentWordPointerElement.style.visibility = "hidden";
            return FINISH;
        }
        this.currentWordPointerElement.style.visibility = "visible";
        this.currentWordPointerElement.style.fontSize = FloatingBlock.calSmallBlockFontSize() + 'px';
        let w = this.currentWordPointerElement.offsetWidth;
        let h = this.currentWordPointerElement.offsetHeight;
        let l = this.phraseBlockElement.offsetLeft + this.wordElementList[this.onWhichWord_index].offsetLeft + this.wordElementList[this.onWhichWord_index].offsetWidth / 2 - w / 2;
        let t = this.phraseBlockElement.offsetTop + this.phraseBlockElement.offsetHeight - h / 3;
        this.currentWordPointerElement.style.left = l + 'px';
        this.currentWordPointerElement.style.top = t + 'px';
        return FINISH;
    }

    getCurrentWord() {
        if (this.onWhichWord_index >= 0 && this.onWhichWord_index < this.phrase.length) {
            return this.phrase[this.onWhichWord_index];
        }
        return this.phrase[0];
    }

    getCurrentWordIndex() {
        if (this.onWhichWord_index >= 0 && this.onWhichWord_index < this.phrase.length) {
            return this.onWhichWord_index;
        }
        return 0;
    }

    needToDelete = false;
    checkNeedToDelete() {
        return this.needToDelete || (this.stage == FloatingBlock.OLD && (this.phraseBlockElement.offsetLeft + this.phraseBlockElement.offsetWidth <= 0 || parseFloat(getComputedStyle(this.phraseBlockElement).opacity) <= 0));
    }

    createIncorrectAnimation(index) {
        new practice_createIncorrectAnimation(this, index);
    }
}

function practice_createIncorrectAnimation(floatingBlock, index) {
    this.incorrectAnimation = function(timestamp) {
        if (!this.isOnAnimation) { // init the animation
            this.isOnAnimation = true;
            this.wordSpan.style.color = UI_config.color.colorToHex(UI_config.color[config.colorMode].font_wrong);
            this.target_R = UI_config.color[config.colorMode].font_normal['R'];
            this.target_G = UI_config.color[config.colorMode].font_normal['G'];
            this.target_B = UI_config.color[config.colorMode].font_normal['B'];
            this.startTime = timestamp;
            this.lastExeTime = timestamp;
            return UNFINISH;
        }

        //get current style.

        let now_color_raw = window.getComputedStyle(this.wordSpan).color;
        let nowRGB = styleColorToRGB(now_color_raw);
        let nowR = nowRGB.R;
        let nowG = nowRGB.G;
        let nowB = nowRGB.B;

        // set position
        let easyInFactor = calEaseInFactor(this.lastExeTime - this.startTime, timestamp - this.lastExeTime, this.switchTime);
        let R = this.target_R - easyInFactor * (this.target_R - nowR);
        let G = this.target_G - easyInFactor * (this.target_G - nowG);
        let B = this.target_B - easyInFactor * (this.target_B - nowB);
        this.wordSpan.style.color = "rgb(" + R + ',' + G + ',' + B + ')';

        if (timestamp - this.startTime >= this.switchTime) { //if the animation finish
            this.isOnAnimation = false;
            this.wordSpan.color = this.target_color;
            return FINISH;
        }
        this.lastExeTime = timestamp;
        return UNFINISH;
    };
    this.incorrectAnimation = this.incorrectAnimation.bind(this);
    this.isOnAnimation = false;
    this.wordSpan = floatingBlock.wordElementList[index];
    this.switchTime = 900;
    let id = floatingBlock.getRedrawID() + "_" + index + "_incorrectAnimation";
    UI.pushIntoDrawQueue({ func: this.incorrectAnimation, id: id }, REPLACE);
}