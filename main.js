const electron = require("electron");
const app = electron.app;
const BrowserWindow = electron.BrowserWindow;
const path = require("path");
const url = require("url");
const remote = electron.remote;
const { ipcMain } = require('electron');
var pinyin = require("pinyin");
var iconv = require("iconv-lite");
var iconv_jscardet = require("iconv-jschardet");

/*
    需要在终端中指向 native 模块文件夹，运行：node-gyp rebuild --target=x.x.x --dist-url=https://atom.io/download/electron 
    或者：node-gyp rebuild --target=1.2.3 --arch=x64 --dist-url=https://electronjs.org/headers
    以编译对应native版本的模块
*/

let win;

function createWindow() {
    win = new BrowserWindow({
        width: parseInt(electron.screen.getPrimaryDisplay().size.width / 1.5),
        height: parseInt(electron.screen.getPrimaryDisplay().size.height / 1.2),
        webPreferences: { nodeIntegration: true } //必须加上这句话
    });

    loadConfig();
    loadResource();
    loadStatistics();
    initIpcMain();

    win.loadURL(url.format({
        pathname: path.join(__dirname, 'index.html'),
        protocol: 'file',
        slashes: true
    }));
    //win.webContents.openDevTools(); ////////////////

    win.on('closed', () => {
        saveStaticsReport();
        saveStatistics();
        saveConfig();
        saveResourse();
        win = null;
    })

    const Menu = electron.Menu;
    Menu.setApplicationMenu(null);

    // var temp = phraseBankManage.txt_to_phraseBank("C:/Users/fuxia/Desktop/final lib/target/dict1zi.txt");
    // phraseBankManage.savePhraseBank(temp, "单字库");
    // var temp = phraseBankManage.txt_to_phraseBank("C:/Users/fuxia/Desktop/final lib/target/dict2zi.txt");
    // phraseBankManage.savePhraseBank(temp, "双字库");
    // var temp = phraseBankManage.txt_to_phraseBank("C:/Users/fuxia/Desktop/final lib/target/dict3zi.txt");
    // phraseBankManage.savePhraseBank(temp, "三字库");
    // var temp = phraseBankManage.txt_to_phraseBank("C:/Users/fuxia/Desktop/final lib/target/dict4zi.txt");
    // phraseBankManage.savePhraseBank(temp, "四字库");
    // var temp = phraseBankManage.txt_to_phraseBank("C:/Users/fuxia/Desktop/final lib/target/dict5zi.txt");
    // phraseBankManage.savePhraseBank(temp, "短语库");
    // var temp = phraseBankManage.txt_to_phraseBank("C:/Users/fuxia/Desktop/final lib/target/现代汉语常用词词库（修改稿）.txt");
    // phraseBankManage.savePhraseBank(temp, "常用词语");
}

app.on('ready', createWindow); //electron 加载完成，添加监听

app.on('window-all-closed', () => { //结束
    if (process.platform !== 'darwin') {
        app.quit()
    }
});

app.on('uncaughtException', error => {
    log.error(error.stack || JSON.stringify(error));
    app.exit();
});


///////////////////////////////

const config = {
    scheme: "",
    howManyErrTimesShowZhuyin: 1,
    howManyErrTimesShowAnswer: 3,
    colorMode: "",
    autoNext: "",
    autoClear: "",
    autoZhuyin: "",
    showHeteronym: "",
    phraseBanks_using: [],
    speedShowingUnit: "",
    showStatisticsArea: ""
}

const resource = {
    scheme: {},
    allScheme: {},
    phraseBanks: [], // [{name: "", phrases: [], classify: {{}}, selectOpportunity: 1.0 }] 用户选中要练习的字库
    allPhraseBanks: [], // [{name: "", phrases: [], classify: {{}}, selectOpportunity: 1.0 }] 所有的字库
    zhuyinDefault: {} // {"短语": [{zhuyinList: [pinyin], weight: 1}] ... }
}

const statistics = {
    zhuyinDifficulty: {},
    pinyinDifficulty: [], //[{ "sheng": "", "yun": "a", "difficulty": 1}]
    totalSolvingTime: 0,
    totalErrorTimes: 0,
    totalAttemptTimes: 0,
    totalWordCount: 0,
    averageSolvingTime: 0,
    normalSolvingTime: 0,
    standardSolvingTime: 700,
    normalColdBootTime: 0
}

function loadConfig() {
    var fs = require('fs');
    var config_path = path.join(__dirname, "config.json").replace(/\\/g, "\/");
    var rawConfig = JSON.parse(fs.readFileSync(config_path));
    config.scheme = rawConfig.scheme;
    config.howManyErrTimesShowZhuyin = rawConfig.howManyErrTimesShowZhuyin;
    config.howManyErrTimesShowAnswer = rawConfig.howManyErrTimesShowAnswer;
    config.colorMode = rawConfig.colorMode;
    config.autoNext = rawConfig.autoNext;
    config.autoClear = rawConfig.autoClear;
    config.autoZhuyin = rawConfig.autoZhuyin;
    config.showHeteronym = rawConfig.showHeteronym;
    config.phraseBanks_using = rawConfig.phraseBanks_using;
    config.speedShowingUnit = rawConfig.speedShowingUnit;
    config.showStatisticsArea = rawConfig.showStatisticsArea;
}

function loadResource() {
    var fs = require('fs');
    var wordBank_path = path.join(__dirname, "/resource/wordBank.json").replace(/\\/g, "\/");
    // fs.readFile(wordBank_path, (err, data) => {
    //     var result = JSON.parse(data);
    //     resource.wordBank = result.word;
    //     resource.classify = result.classify;
    // });

    // resource.pinyin_fenlei = JSON.parse(fs.readFileSync(wordBank_path));
    // var ziFile_path = path.join(__dirname, "/resource/ziFile.json").replace(/\\/g, "\/");
    // resource.ziFile = JSON.parse(fs.readFileSync(ziFile_path));
    // resource.ziKeys = Object.keys(resource.ziFile);

    var allScheme_path = path.join(__dirname, "/resource/scheme.json").replace(/\\/g, "\/");
    resource.allScheme = JSON.parse(fs.readFileSync(allScheme_path));
    resource.scheme = resource.allScheme[config['scheme']];

    var phraseBankDir_path = path.join(__dirname, "/resource/phrase/").replace(/\\/g, "\/");
    var phraseBankList = fs.readdirSync(phraseBankDir_path);
    for (let i = 0; i < phraseBankList.length; i++) {
        if (phraseBankList[i].length > 5 && phraseBankList[i].substring(phraseBankList[i].length - 5, phraseBankList[i].length) == ".json") {
            let phraseBank_path = phraseBankDir_path + phraseBankList[i];
            let rawPhraseBank = JSON.parse(fs.readFileSync(phraseBank_path));
            resource.allPhraseBanks.push({ name: phraseBankList[i].substring(0, phraseBankList[i].length - 5), phrases: rawPhraseBank.phrases, classify: rawPhraseBank.classify, selectOpportunity: rawPhraseBank.selectOpportunity });
        }
    }
    for (let i = 0; i < resource.allPhraseBanks.length; i++) {
        for (let j = 0; j < config.phraseBanks_using.length; j++) {
            if (resource.allPhraseBanks[i]["name"] == config.phraseBanks_using[j]) {
                resource.phraseBanks.push(resource.allPhraseBanks[i]);
            }
        }
    }
    var zhuyinDefault_path = path.join(__dirname, "/resource/zhuyinDefault.json").replace(/\\/g, "\/");
    resource.zhuyinDefault = JSON.parse(fs.readFileSync(zhuyinDefault_path));
}

function saveResourse() {
    var fs = require('fs');
    var zhuyinDefault_path = path.join(__dirname, "/resource/zhuyinDefault.json").replace(/\\/g, "\/");
    fs.writeFileSync(zhuyinDefault_path, JSON.stringify(resource.zhuyinDefault, null, 4));
}


function loadStatistics() {
    var fs = require('fs');
    var zhuyinDiff_path = path.join(__dirname, "/resource/zhuyinDiff.json").replace(/\\/g, "\/");
    statistics.zhuyinDifficulty = JSON.parse(fs.readFileSync(zhuyinDiff_path));
    var pinyinDiff_path = path.join(__dirname, "/resource/pinyinDiff.json").replace(/\\/g, "\/");
    statistics.pinyinDifficulty = JSON.parse(fs.readFileSync(pinyinDiff_path));
    var statistics_path = path.join(__dirname, "/resource/statistics.json").replace(/\\/g, "\/");
    var rawStatistics = JSON.parse(fs.readFileSync(statistics_path));
    statistics.totalSolvingTime = rawStatistics.totalSolvingTime;
    statistics.totalErrorTimes = rawStatistics.totalErrorTimes;
    statistics.totalAttemptTimes = rawStatistics.totalAttemptTimes;
    statistics.totalWordCount = rawStatistics.totalWordCount;
    statistics.averageSolvingTime = rawStatistics.averageSolvingTime;
    statistics.normalSolvingTime = rawStatistics.normalSolvingTime;
    statistics.standardSolvingTime = rawStatistics.standardSolvingTime;
    statistics.normalColdBootTime = rawStatistics.normalColdBootTime;
    var reviewPool_path = path.join(__dirname, "/resource/reviewPool.json").replace(/\\/g, "\/");
    randomPhraseGenerator.reviewPool = JSON.parse(fs.readFileSync(reviewPool_path));
}

function saveStatistics() {
    var fs = require('fs');
    var copyStatistics = {};
    copyStatistics.totalSolvingTime = statistics.totalSolvingTime;
    copyStatistics.totalErrorTimes = statistics.totalErrorTimes;
    copyStatistics.totalAttemptTimes = statistics.totalAttemptTimes;
    copyStatistics.totalWordCount = statistics.totalWordCount;
    copyStatistics.averageSolvingTime = statistics.averageSolvingTime;
    copyStatistics.normalSolvingTime = statistics.normalSolvingTime;
    copyStatistics.standardSolvingTime = statistics.standardSolvingTime;
    copyStatistics.normalColdBootTime = statistics.normalColdBootTime;
    var statistics_path = path.join(__dirname, "/resource/statistics.json").replace(/\\/g, "\/");
    fs.writeFileSync(statistics_path, JSON.stringify(copyStatistics, null, 4));
    var zhuyinDiff_path = path.join(__dirname, "/resource/zhuyinDiff.json").replace(/\\/g, "\/");
    fs.writeFileSync(zhuyinDiff_path, JSON.stringify(statistics.zhuyinDifficulty, null, 4));
    var pinyinDiff_path = path.join(__dirname, "/resource/pinyinDiff.json").replace(/\\/g, "\/");
    fs.writeFileSync(pinyinDiff_path, JSON.stringify(statistics.pinyinDifficulty, null, 4));
    var reviewPool_path = path.join(__dirname, "/resource/reviewPool.json").replace(/\\/g, "\/");
    fs.writeFileSync(reviewPool_path, JSON.stringify(randomPhraseGenerator.reviewPool, null, 4));
}

function saveConfig() {
    var fs = require('fs');
    var config_path = path.join(__dirname, "config.json").replace(/\\/g, "\/");
    fs.writeFileSync(config_path, JSON.stringify(config, null, 4));
}




///////////////////////////////////////////////

// function getNewPhrase() {
//     // temp
//     var randNum = Math.random();
//     var phraseGroup = "";
//     if (randNum < 0.8) {
//         phraseGroup = Math.ceil(randNum * 5).toString();
//     }
//     else {
//         phraseGroup = "more";
//     }
//     var temp = resource.wordBank;
//     var totalLength = resource.wordBank[phraseGroup].length;
//     var index = Math.floor(totalLength * Math.random());
//     //return "不属";/////////////////////////////////////////////
//     return resource.wordBank[phraseGroup][index];
// }

function getAnswerList(phrase) {
    var processedAnswer = getPinyinDetailList(phrase);
    var answerList = [];
    for (let i = 0; i < processedAnswer.length; i++) {
        answerList.push([]);
        for (let j = 0; j < processedAnswer[i].length; j++) {
            let resultOf_shengYun_convertTo_answer = shengYun_convertTo_answer(processedAnswer[i][j].sheng, processedAnswer[i][j].yun);
            for (let m = 0; m < resultOf_shengYun_convertTo_answer.length; m++) {
                answerList[i].push(resultOf_shengYun_convertTo_answer[m]);
            }
        }
    }
    return answerList; // 返回 每个字的所有可能答案
}

function getPinyinDetailList(phrase, needDefault = true) {
    var rawPinyin = pinyin(phrase, { heteronym: true });
    if (needDefault) {
        var bestPinyinList = pinyin(phrase, { segment: true });
    }
    // 调整顺序，把最贴切的拼音放在首个
    var processedPinyinList = [];
    for (let i = 0; i < rawPinyin.length; i++) {
        let pinyinListForOne = [];
        for (let j = 0; j < rawPinyin[i].length; j++) {
            let pinyinDetail = getPinyinDetail(rawPinyin[i][j]);
            if (isValidPinyin(pinyinDetail)) {
                if (needDefault && pinyinDetail.pinyin == bestPinyinList[i][0]) {
                    pinyinListForOne.unshift(pinyinDetail);
                } else {
                    pinyinListForOne.push(pinyinDetail);
                }
            }
        }
        processedPinyinList.push(pinyinListForOne);
    }

    if (needDefault) {
        if (typeof resource.zhuyinDefault[phrase] == "undefined") {
            for (let i = 0; i < processedPinyinList.length; i++) {
                if (typeof resource.zhuyinDefault[phrase[i]] == "undefined") {
                    continue;
                }
                let defaultPinyin = resource.zhuyinDefault[phrase[i]][0].pinyin[0];
                for (let j = 0; j < processedPinyinList[i].length; j++) {
                    if (processedPinyinList[i][j].pinyin == defaultPinyin.pinyin) {
                        if (j == 0) break;
                        let temp = processedPinyinList[i].splice(j, 1)[0];
                        processedPinyinList[i].unshift(temp);
                        break;
                    }
                }
            }
        } else {
            let defaultPinyinList = resource.zhuyinDefault[phrase][0].pinyin;
            for (let i = 0; i < processedPinyinList.length; i++) {
                for (let j = 0; j < processedPinyinList[i].length; j++) {
                    if (processedPinyinList[i][j].pinyin == defaultPinyinList[i].pinyin) {
                        if (j == 0) break;
                        let temp = processedPinyinList[i].splice(j, 1)[0];
                        processedPinyinList[i].unshift(temp);
                        break;
                    }
                }
            }
        }
    }

    return processedPinyinList; // [[{"sheng":"p", "yun":"in", "shengdiao": 1, "pinyin": "pīn"}]]
}

function getPinyinDetail(pinyin) { // argument: pinyin
    var ret = { "sheng": "", "yun": "", "shengdiao": 0, "pinyin": pinyin };

    //声母
    ret.sheng = pinyin[0];
    var yun_startAt = 1
    if ((pinyin[0] == 's' || pinyin[0] == 'c' || pinyin[0] == 'z') && pinyin[1] == 'h') {
        ret["sheng"] = ret["sheng"] + 'h';
        yun_startAt = 2;
    } else if (isYuanYin(pinyin[0])) {
        ret["sheng"] = "";
        yun_startAt = 0;
    }

    if (yun_startAt >= pinyin.length || !isYuanYin(pinyin[yun_startAt])) {
        return ret; // if ret.yun == '', there is an error
    }

    // 韵母 声调
    var shengdiao = 0;
    while (yun_startAt < pinyin.length) {
        let yunChar = formatYunChar(pinyin[yun_startAt]);
        shengdiao += yunChar[1];
        ret['yun'] = ret['yun'] + yunChar[0]
        yun_startAt += 1
    }
    ret['shengdiao'] = shengdiao

    return ret
}

function isYuanYin(c) {
    if (c == 'a' || c == 'e' || c == 'i' || c == 'o' || c == 'u' || c == 'v') {
        return true;
    }
    if (c == 'ā' || c == 'á' || c == 'ǎ' || c == 'à') {
        return true;
    }
    if (c == 'ē' || c == 'é' || c == 'ě' || c == 'è') {
        return true;
    }
    if (c == 'ī' || c == 'í' || c == 'ǐ' || c == 'ì') {
        return true;
    }
    if (c == 'ō' || c == 'ó' || c == 'ǒ' || c == 'ò') {
        return true;
    }
    if (c == 'ū' || c == 'ú' || c == 'ǔ' || c == 'ù') {
        return true;
    }
    if (c == 'ǖ' || c == 'ǘ' || c == 'ǚ' || c == 'ǜ' || c == 'ü') {
        return true;
    }
    return false;
}

function formatYunChar(c) {
    if (c == 'ā') {
        return ['a', 1]
    }
    if (c == 'á') {
        return ['a', 2]
    }
    if (c == 'ǎ') {
        return ['a', 3]
    }
    if (c == 'à') {
        return ['a', 4]
    }
    if (c == 'ē') {
        return ['e', 1]
    }
    if (c == 'é') {
        return ['e', 2]
    }
    if (c == 'ě') {
        return ['e', 3]
    }
    if (c == 'è') {
        return ['e', 4]
    }
    if (c == 'ī') {
        return ['i', 1]
    }
    if (c == 'í') {
        return ['i', 2]
    }
    if (c == 'ǐ') {
        return ['i', 3]
    }
    if (c == 'ì') {
        return ['i', 4]
    }
    if (c == 'ō') {
        return ['o', 1]
    }
    if (c == 'ó') {
        return ['o', 2]
    }
    if (c == 'ǒ') {
        return ['o', 3]
    }
    if (c == 'ò') {
        return ['o', 3]
    }
    if (c == 'ū') {
        return ['u', 1]
    }
    if (c == 'ú') {
        return ['u', 2]
    }
    if (c == 'ǔ') {
        return ['u', 3]
    }
    if (c == 'ù') {
        return ['u', 4]
    }
    if (c == 'ǖ') {
        return ['v', 1]
    }
    if (c == 'ǘ') {
        return ['v', 2]
    }
    if (c == 'ǚ') {
        return ['v', 3]
    }
    if (c == 'ǜ') {
        return ['v', 4]
    }
    if (c == 'ü') {
        return ['v', 0]
    }
    return [c, 0]
}

function isValidPinyin(pinyinDetail) {
    return !(pinyinDetail.yun == '');
}

function shengYun_convertTo_answer(sheng, yun) {
    var answerList = [];
    var shengAnswer = [];
    var yunAnswer = [];
    if (sheng == "") {
        answerList.push(resource.scheme["other"][yun]);
    } else {
        if (typeof resource.scheme["sheng"][sheng] == "string") {
            shengAnswer.push(resource.scheme["sheng"][sheng]);
        } else {
            shengAnswer = resource.scheme["sheng"][sheng];
        }

        if (typeof resource.scheme["yun"][yun] == "string") {
            yunAnswer.push(resource.scheme["yun"][yun]);
        } else {
            yunAnswer = resource.scheme["yun"][yun];
        }

        for (let shengIndex = 0; shengIndex < shengAnswer.length; shengIndex++) {
            for (let yunIndex = 0; yunIndex < yunAnswer.length; yunIndex++) {
                answerList.push(shengAnswer[shengIndex] + yunAnswer[yunIndex]);
            }
        }
    }
    return answerList;
}



/////////////////////////////////

function updateZhuyinDiff(statisticsData) {
    for (let i = 0; i < statisticsData.length; i++) {
        if (statisticsData[i].attemptTimes <= 0 || typeof statisticsData[i].coldBootTime == "undefined" || statisticsData[i].answer.length <= 0) continue;
        let zhuyinDiff_v = calZhuyinDiff_variance(statisticsData[i].coldBootTime, statisticsData[i].totalTime / statisticsData[i].attemptTimes / statisticsData[i].answer.length, statisticsData[i].errorTimes, statisticsData[i].showedZhuyin);
        if (typeof statistics.zhuyinDifficulty[statisticsData[i].word] == "undefined") {
            statistics.zhuyinDifficulty[statisticsData[i].word] = 0.5 + zhuyinDiff_v * 2;
        } else {
            statistics.zhuyinDifficulty[statisticsData[i].word] += zhuyinDiff_v;
        }

        if (statistics.zhuyinDifficulty[statisticsData[i].word] < 0) statistics.zhuyinDifficulty[statisticsData[i].word] = 0;
        if (statistics.zhuyinDifficulty[statisticsData[i].word] > 1) statistics.zhuyinDifficulty[statisticsData[i].word] = 1;
        // console.log(
        //     calZhuyinDiff_variance(statisticsData[i].coldBootTime, statisticsData[i].totalTime / statisticsData[i].attemptTimes / statisticsData[i].answer.length, statisticsData[i].errorTimes / statisticsData[i].attemptTimes),
        //     "statistics.zhuyinDifficulty[word]: ", statistics.zhuyinDifficulty[statisticsData[i].word], "zhuyinDiff:  ", zhuyinDiff_v,
        //     statisticsData[i].coldBootTime, statisticsData[i].totalTime / statisticsData[i].attemptTimes / statisticsData[i].answer.length, statisticsData[i].errorTimes / statisticsData[i].attemptTimes
        // );
        //console.log("zhuyin diff adjust: ", calZhuyinDiff_variance(statisticsData[i].totalTime, statisticsData[i].errorTimes / statisticsData[i].attemptTimes), "for zi: ", statisticsData[i].word);
        report += statisticsData[i].word + "  zhuyin diff change: " + zhuyinDiff_v + "  cbt: " + statisticsData[i].coldBootTime + "  akt: " + statisticsData[i].totalTime / statisticsData[i].attemptTimes / statisticsData[i].answer.length + "  ErrorTimes: " + statisticsData[i].errorTimes + "  showedZhuyin: " + statisticsData[i].showedZhuyin + "  normal cdt: " + 　statistics.normalColdBootTime + "  normal time: " + statistics.normalSolvingTime + "\n";
    }
    report += "\n\n";
}

function calZhuyinDiff_varianceX(coldBootTime, averageKeyTime, errorRatio) {
    const maxVariance = 0.03; // absolute value < 0.3
    var diffV = coldBootTime * 2 + averageKeyTime - statistics.normalSolvingTime * 3;
    console.log("original diffV", diffV);
    if (diffV < 0) {
        diffV = Math.sqrt(Math.abs(diffV) / statistics.standardSolvingTime) * -1 * maxVariance;
    } else {
        diffV = Math.sqrt(diffV * 2 / statistics.standardSolvingTime) * maxVariance / 3;
    }
    if (errorRatio > 0 && errorRatio <= 0.5) {
        diffV += 0.01
    } else if (errorRatio > 0.5) {
        diffV += maxVariance * 0.8;
    }
    if (Math.abs(diffV) > maxVariance) {
        diffV = diffV / Math.abs(diffV) * maxVariance;
    }
    return diffV;
}

function calZhuyinDiff_varianceXX(coldBootTime, averageKeyTime, errorCount, showedZhuyin) {
    const maxDecrease = -0.1;
    const maxIncrease = 0.2;
    var diffV = 2.5 * (coldBootTime - statistics.normalColdBootTime - Math.min(statistics.normalColdBootTime * 0.2, 150)) / statistics.normalColdBootTime + (averageKeyTime - statistics.normalSolvingTime - Math.min(statistics.normalSolvingTime * 0.25, 180)) / statistics.normalSolvingTime;
    diffV *= maxIncrease / 7;

    console.log("cbt: ", coldBootTime, "akt: ", averageKeyTime, "diffv: ", diffV);

    if (showedZhuyin) {
        if (errorCount > 0) {
            diffV += maxIncrease * 0.08;
        }
        diffV *= 0.6;
    } else {
        if (errorCount <= 0) {
            diffV *= 2;
            if (errorCount > 0) {
                diffV += maxIncrease * 0.08;
            }
        } else if (errorCount == 1) {
            diffV += maxIncrease * 0.2;
        } else {
            diffV += maxIncrease * 0.1;
        }
    }
    console.log("diffv", diffV);
    return 0;
}

function calZhuyinDiff_variance(coldBootTime, averageKeyTime, errorCount, showedZhuyin) {
    let diffV = 0;
    let v_cbt = (coldBootTime - statistics.normalColdBootTime - Math.min(statistics.normalColdBootTime * 0.15, 150) - 150) / statistics.normalColdBootTime;
    if (v_cbt > 0) {
        diffV += Math.pow(v_cbt * 1.2, 2) * 1.2;
    } else {
        diffV += 2 * v_cbt;
    }
    diffV += (averageKeyTime - statistics.normalSolvingTime - Math.min(statistics.normalSolvingTime * 0.2, 180) - 150) / statistics.normalSolvingTime;

    if (showedZhuyin) {
        const maxDecrease = -0.075;
        const maxIncrease = 0.02;
        diffV = diffV / 3.5;

        if (diffV > 0) {
            diffV *= maxIncrease;
        } else {
            diffV *= Math.abs(maxDecrease);
        }

        if (errorCount > 0) {
            diffV += maxIncrease * 0.1;
        }

        if (diffV > maxIncrease) diffV = maxIncrease;
        if (diffV < maxDecrease) diffV = maxDecrease;
    } else {
        const maxDecrease = -0.01;
        const maxIncrease = 0.17;

        diffV = diffV / 3.5;

        if (diffV > 0) {
            diffV *= maxIncrease;
        } else {
            diffV *= Math.abs(maxDecrease);
        }

        if (errorCount <= 0) {
            diffV *= 1.5;
        } else if (errorCount == 1) {
            diffV += maxIncrease * 0.4;
        } else {
            diffV += maxIncrease * 0.2;
        }

        if (diffV > maxIncrease) diffV = maxIncrease;
        if (diffV < maxDecrease) diffV = maxDecrease;
    }
    return diffV;
}

function updatePinyinDiff(statisticsData) {
    const minDifficulty = 0.01;
    const maxDifficulty = 20;
    const double_DiffVariance_underThisValue = 2;
    for (let i = 0; i < statisticsData.length; i++) {
        if (statisticsData[i].attemptTimes <= 0) continue;
        let diffVariance = calPinyinDiff_variance(statisticsData[i].totalTime, statisticsData[i].attemptTimes, statisticsData[i].errorTimes, statisticsData[i].answer.length);
        let pinyinDetailForWord = findPinyinUsingAnswer(statisticsData[i].word, statisticsData[i].answer);
        if (pinyinDetailForWord == null) {
            console.log("pinyinDetailForWord  is  null !!!!!!!!!!!!!!!!\n", getPinyinDetailList(statisticsData[i].word)[0], "user answer:  ", statisticsData[i].pinyin);
            continue;
        }
        for (let j = 0; j < statistics.pinyinDifficulty.length; j++) {
            if (statistics.pinyinDifficulty[j].sheng == pinyinDetailForWord.sheng) {
                if (diffVariance > 0 && statistics.pinyinDifficulty[j].difficulty < double_DiffVariance_underThisValue) {
                    statistics.pinyinDifficulty[j].difficulty += diffVariance * 2;
                } else {
                    statistics.pinyinDifficulty[j].difficulty += diffVariance;
                }
                if (statistics.pinyinDifficulty[j].difficulty < minDifficulty) statistics.pinyinDifficulty[j].difficulty = minDifficulty;
                if (statistics.pinyinDifficulty[j].difficulty > maxDifficulty) statistics.pinyinDifficulty[j].difficulty = maxDifficulty;
            }
            if (statistics.pinyinDifficulty[j].yun == pinyinDetailForWord.yun) {
                if (diffVariance > 0 && statistics.pinyinDifficulty[j].difficulty < double_DiffVariance_underThisValue) {
                    statistics.pinyinDifficulty[j].difficulty += diffVariance * 2;
                } else {
                    statistics.pinyinDifficulty[j].difficulty += diffVariance;
                }
                if (statistics.pinyinDifficulty[j].difficulty < minDifficulty) statistics.pinyinDifficulty[j].difficulty = minDifficulty;
                if (statistics.pinyinDifficulty[j].difficulty > maxDifficulty) statistics.pinyinDifficulty[j].difficulty = maxDifficulty;
            }
        }
        report += statisticsData[i].word + "  pinyin diff change: " + diffVariance + "  Time: " + statisticsData[i].totalTime + " cold boot Time: " + statisticsData[i].coldBootTime + "  AttemptTimes: " + statisticsData[i].attemptTimes + "  ErrorTimes: " + statisticsData[i].errorTimes + "  normal time: " + statistics.normalSolvingTime + "  average time: " + statistics.averageSolvingTime + "\n";
        //report += statisticsData[i].word + "  Time: " + statisticsData[i].totalTime + "  AttemptTimes: " + statisticsData[i].attemptTimes + "  ErrorTimes: " + statisticsData[i].errorTimes + "  pinyin diff change: " + diffVariance + "  normal time: " + statistics.normalSolvingTime + "  average time: " + statistics.averageSolvingTime + "\n";

    }
    report += "\n\n";
}

function findPinyinUsingAnswer(word, answer) { // return pinyinDetail
    var pinyinDetailList = getPinyinDetailList(word, false);
    for (let i = 0; i < pinyinDetailList[0].length; i++) {
        let answerForPinyinDetail = shengYun_convertTo_answer(pinyinDetailList[0][i].sheng, pinyinDetailList[0][i].yun);
        if (typeof answerForPinyinDetail == "string") {
            if (answerForPinyinDetail == answer) {
                return pinyinDetailList[0][i];
            }
        } else {
            for (let j = 0; j < answerForPinyinDetail.length; j++) {
                if (answerForPinyinDetail[j] == answer) {
                    return pinyinDetailList[0][i];
                }
            }
        }
    }
    return null;
}

function calPinyinDiff_variance(time, attemptTimes, errorTimes, answerLength) {
    const maxVariance = 2; // absolute value < 2
    var validAttemptTimes = attemptTimes - errorTimes;
    if (validAttemptTimes <= 1) validAttemptTimes = 1;
    var perAttemptTime = time / validAttemptTimes;
    var diffV = perAttemptTime - statistics.normalSolvingTime * answerLength;
    if (diffV < 0) {
        diffV = Math.sqrt(Math.abs(diffV) / statistics.normalSolvingTime / answerLength) * -0.25 * maxVariance;
    } else {
        diffV = Math.sqrt(diffV * 1.5 / statistics.normalSolvingTime / answerLength) * maxVariance / 3;
    }

    if (errorTimes > 0) {
        diffV += 0.4;
        diffV += errorTimes * 0.15
    } else diffV -= 0.2
    if (diffV > maxVariance) diffV = maxVariance;
    return diffV;
}

function updatePhraseDiff(statisticsData) { // 判断这个字是否需要加入复习
    const maxPhraseDiff = 5;
    const standardPhraseLength = 4; // 为了让任何长度的短语都标准化为一个相似长度时的正确率
    let phraseDiff = 0;
    let text = "";
    for (let i = 0; i < statisticsData.length; i++) {
        if (statisticsData[i].totalTime > statisticsData[i].answer.length * statistics.normalSolvingTime * 1.2) {
            phraseDiff++;
        }
        if (statisticsData[i].errorTimes > 0 && phraseDiff < 2) {
            phraseDiff++;
        }
        phraseDiff += statisticsData[i].errorTimes;
        text += statisticsData[i].word;
    }
    phraseDiff = phraseDiff * standardPhraseLength / statisticsData.length;
    if (phraseDiff >= 3) {
        phraseDiff /= 2;
        console.log("this phrase need to put into review pool: ", phraseDiff);
        if (randomPhraseGenerator.reviewPool.hasOwnProperty(text)) { // 判断需要复习的存储池里是否有这个元素
            randomPhraseGenerator.reviewPool[text] += phraseDiff;
        } else {
            randomPhraseGenerator.reviewPool[text] = phraseDiff;
        }
        return true;
    } else {
        if (randomPhraseGenerator.reviewPool.hasOwnProperty(text)) { // 判断需要复习的存储池里是否有这个元素
            randomPhraseGenerator.reviewPool[text] -= 1;
            if (randomPhraseGenerator.reviewPool[text] <= 0) {
                delete randomPhraseGenerator.reviewPool[text];
            } else if (randomPhraseGenerator.reviewPool[text] > maxPhraseDiff) {
                randomPhraseGenerator.reviewPool[text] = maxPhraseDiff;
            }
        }
        return false;
    }
}

function updateSolvingTime(statisticsData) {
    for (let i = 0; i < statisticsData.length; i++) {
        if (statisticsData[i].attemptTimes <= 0) continue;
        let perAttemptTime = statisticsData[i].totalTime / statisticsData[i].attemptTimes / statisticsData[i].answer.length;
        if (statisticsData[i].errorTimes <= 1) {
            if (Math.abs(statistics.normalSolvingTime - perAttemptTime) > Math.min(perAttemptTime * 0.3, statistics.normalSolvingTime * 0.3) + 300) {
                statistics.normalSolvingTime += (perAttemptTime - statistics.normalSolvingTime) * 0.25;
            } else if (Math.abs(statistics.normalSolvingTime - perAttemptTime) > Math.min(perAttemptTime * 0.25, statistics.normalSolvingTime * 0.25)) {
                statistics.normalSolvingTime += (perAttemptTime - statistics.normalSolvingTime) * 0.05;
            } else {
                statistics.normalSolvingTime += (perAttemptTime - statistics.normalSolvingTime) * 0.1;
            }
        }
    }
    console.log("normalSolvingTime:  ", statistics.normalSolvingTime);

    for (let i = 0; i < statisticsData.length; i++) {
        if (typeof statisticsData[i].coldBootTime == "undefined") {
            continue;
        }
        statistics.normalColdBootTime += (statisticsData[i].coldBootTime - statistics.normalColdBootTime) * 0.1;
    }

    for (let i = 0; i < statisticsData.length; i++) {
        if (statisticsData[i].attemptTimes <= 0) continue;
        statistics.totalSolvingTime += statisticsData[i].totalTime;
        statistics.totalErrorTimes += statisticsData[i].errorTimes;
        statistics.totalAttemptTimes += statisticsData[i].attemptTimes;
    }

    if (statistics.totalAttemptTimes >= 125) { // 用于削弱先前的统计结果对后来的影响
        let diminishFactor = 0.75;
        if (statistics.totalErrorTimes / statistics.totalAttemptTimes > 0.08) { //如果错误率过大，自动缩小之前那些错误对之后的影响，让数据变得好看一些
            diminishFactor = 0.6;
        }
        statistics.totalAttemptTimes = Math.ceil(statistics.totalAttemptTimes * diminishFactor);
        statistics.totalErrorTimes = (statistics.totalErrorTimes * diminishFactor);
        statistics.totalSolvingTime = Math.round(statistics.totalSolvingTime * diminishFactor);
    }
    statistics.averageSolvingTime = statistics.totalSolvingTime / statistics.totalAttemptTimes;
    console.log("average SolvingTime:  ", statistics.averageSolvingTime);
    statistics.totalWordCount += statisticsData.length;
}

function updateDefaultZhuyin(statisticsData) {
    let heteronymCount = 0;
    let allCorrent = true;
    let allPinyinMatchFirstZhuyin = true;
    let phrase = ""
    let firstZhuyinList = [];

    for (let i = 0; i < statisticsData.length; i++) {
        phrase += statisticsData[i].word;
        firstZhuyinList.push(statisticsData[i].firstZhuyin);
        if (statisticsData[i].answer == "") return;
        if (statisticsData[i].zhuyinCount > 1) {
            heteronymCount++;
        }
        if (statisticsData[i].pinyin != statisticsData[i].answer) {
            allCorrent = false;
        }
        // if (shengYun_convertTo_answer(statisticsData[i].firstZhuyin.sheng, statisticsData[i].firstZhuyin.yun) != statisticsData[i].answer) {
        //     allPinyinMatchFirstZhuyin = false;
        // }
    }

    if (heteronymCount <= 0) // 无多音字时退出
        return;
    // if (allPinyinMatchFirstZhuyin && typeof resource.zhuyinDefault[phrase] == "undefined") {
    //     // 所有拼音符合显示出来的默认注音（既来自pinyin模组的首个拼音），且zhuyinDefault内无此短语的默认注音时，退出
    //     return; 
    // }

    let pinyinList = [];
    for (let i = 0; i < statisticsData.length; i++) {
        pinyinList.push(findPinyinUsingAnswer(statisticsData[i].word, statisticsData[i].answer));
    }

    if (allCorrent) {
        addZhuyinWeightInDefaultZhuyin(phrase, pinyinList);
    } else {
        addZhuyinWeightInDefaultZhuyin(phrase, pinyinList, 0.5);
    }

    for (let i = 0; i < statisticsData.length; i++) {
        if (statisticsData[i].zhuyinCount > 1 && statisticsData[i].pinyin == statisticsData[i].answer) {
            let onePinyin = [];
            onePinyin.push(pinyinList[i]);
            addZhuyinWeightInDefaultZhuyin(phrase[i], onePinyin);
        }
    }
}

function comparePinyinListTo(p1, p2, checkShengDiao = false) {
    if (p1.length != p2.length) return;
    for (let i = 0; i < p1.length; i++) {
        if (p1[i].sheng != p2[i].sheng || p1[i].yun != p2[i].yun || (checkShengDiao && p1[i].shengdiao != p2[i].shengdiao)) {
            return false;
        }
    }
    return true;
}

function addZhuyinWeightInDefaultZhuyin(phrase, pinyinList, weightIncreasement = 1) {
    if (typeof resource.zhuyinDefault[phrase] == "undefined") {
        resource.zhuyinDefault[phrase] = [];
        let newPinyinAndWeight = { pinyin: pinyinList, weight: weightIncreasement };
        resource.zhuyinDefault[phrase].push(newPinyinAndWeight);
    } else {
        let indexOf_same_pinyinList_in_zhuyinDefault = -1;
        for (let i = 0; i < resource.zhuyinDefault[phrase].length; i++) {
            if (comparePinyinListTo(pinyinList, resource.zhuyinDefault[phrase][i].pinyin)) {
                indexOf_same_pinyinList_in_zhuyinDefault = i;
                break;
            }
        }

        if (indexOf_same_pinyinList_in_zhuyinDefault < 0) { // 这个注音不在default中
            let newPinyinAndWeight = { pinyin: pinyinList, weight: weightIncreasement };
            resource.zhuyinDefault[phrase].push(newPinyinAndWeight);
            return;
        }

        resource.zhuyinDefault[phrase][indexOf_same_pinyinList_in_zhuyinDefault].weight += weightIncreasement;
        regulateDefaultZhuyinWeight(phrase);
    }
}

function regulateDefaultZhuyinWeight(phrase) {
    if (typeof resource.zhuyinDefault[phrase] == "undefined" || resource.zhuyinDefault[phrase].length == 0) return;

    const maxWeight = 20;
    const maxExcelWeight = 2;

    let sortFunc = function(pinyin_weight1, pinyin_weight2) { // 从大到小
        return pinyin_weight2.weight - pinyin_weight1.weight;
    };

    resource.zhuyinDefault[phrase].sort(sortFunc);

    if (resource.zhuyinDefault[phrase][0].weight > maxWeight) {
        let factor = maxWeight / resource.zhuyinDefault[phrase][0].weight;
        for (let i = 0; i < resource.zhuyinDefault[phrase].length; i++) {
            resource.zhuyinDefault[phrase][i].weight = Math.round(resource.zhuyinDefault[phrase][i].weight * factor);
        }
    }

    if (resource.zhuyinDefault[phrase].length > 1 && resource.zhuyinDefault[phrase][0].weight - resource.zhuyinDefault[phrase][1].weight > maxExcelWeight) {
        // 防止某一个zhuyinList领先太多, 导致多次重复输入别的拼音也无法改变注音
        resource.zhuyinDefault[phrase][0].weight = resource.zhuyinDefault[phrase][1].weight + maxExcelWeight;
    }
}

/////////////////////////////////


const randomPhraseGenerator = {

    reviewPool: {},
    defaultPhrase: "空",

    getRandomPhrase: () => {
        const minReviewPoolLengthToBeSelected = 20;
        if (Object.keys(randomPhraseGenerator.reviewPool).length > minReviewPoolLengthToBeSelected && Math.random() > 0.55) {
            //return randomPhraseGenerator.getPhraseFromReviewPool();
            let temp = randomPhraseGenerator.getPhraseFromReviewPool();
            return temp;
        } else {
            let temp = randomPhraseGenerator.getPhraseFromPinyin();
            return temp;
        }
    },

    getPhraseFromReviewPool: () => {
        const maxRangeSize = 50;
        var phraseList = Object.keys(randomPhraseGenerator.reviewPool);
        var randomStartIndex = Math.floor(Math.random() * phraseList.length);
        var randomRangeSize = phraseList.length - randomStartIndex;
        if (randomRangeSize > maxRangeSize) randomRangeSize = maxRangeSize;
        var totalDiff = 0;
        for (let i = randomStartIndex; i < randomStartIndex + randomRangeSize; i++) {
            totalDiff += Math.ceil(randomPhraseGenerator.reviewPool[phraseList[i]]);
        }
        var randomDiffSum = Math.random() * totalDiff;
        var phraseIndex = randomStartIndex;
        while (phraseIndex < randomStartIndex + randomRangeSize) {
            if (randomDiffSum < Math.ceil(randomPhraseGenerator.reviewPool[phraseList[phraseIndex]])) {
                break;
            }
            randomDiffSum -= Math.ceil(randomPhraseGenerator.reviewPool[phraseList[phraseIndex]]);
            phraseIndex++;
        }
        return phraseList[phraseIndex];
    },
    // 在 reviewPool，难度越大被选中的概率越大。然后在 0 和 难度总和数值 之间获得随机数
    // 遍历所有完整拼音，如果这个随机数大于这个拼音的难度，随机数 -= 拼音难度，continue；如此一来，这个随机数终究会落在[0, 某个拼音难度) 的范围内

    getPhraseFromPinyin: (tryTimesCount = 0) => {
        const maxTryTimes = 3;

        if (resource.phraseBanks.length <= 0) {
            return randomPhraseGenerator.defaultPhrase;
        }

        var totalPhraseBankSelectOpportunity = 0; // 调整被选中的可能性
        for (let i = 0; i < resource.phraseBanks.length; i++) {
            totalPhraseBankSelectOpportunity += resource.phraseBanks[i].selectOpportunity;
        }
        var randomNum_whichBank = Math.random() * totalPhraseBankSelectOpportunity;
        var bankIndex = 0;
        while (bankIndex < resource.phraseBanks.length - 1) {
            if (randomNum_whichBank < resource.phraseBanks[bankIndex].selectOpportunity) {
                break;
            }
            bankIndex++;
            randomNum_whichBank -= resource.phraseBanks[bankIndex].selectOpportunity;
        }
        if (tryTimesCount >= maxTryTimes) {
            if (resource.phraseBanks[bankIndex].phrases.length <= 0) {
                return randomPhraseGenerator.defaultPhrase;
            } else {
                let randomPhraseNum = Math.floor(Math.random() * resource.phraseBanks[bankIndex].phrases.length);
                return resource.phraseBanks[bankIndex].phrases[randomPhraseNum];
            }
        }
        var shengAndYun = randomPhraseGenerator.getRandomPinyin_basedOnDiff();
        if (typeof resource.phraseBanks[bankIndex].classify[shengAndYun.sheng][shengAndYun.yun] == "undefined" || resource.phraseBanks[bankIndex].classify[shengAndYun.sheng][shengAndYun.yun].length == 0) {
            return randomPhraseGenerator.getPhraseFromPinyin(tryTimesCount++);
        }

        let randomPhraseNum = Math.floor(Math.random() * resource.phraseBanks[bankIndex].classify[shengAndYun.sheng][shengAndYun.yun].length);
        return resource.phraseBanks[bankIndex]["classify"][shengAndYun.sheng][shengAndYun.yun][randomPhraseNum];
    },

    getRandomPinyin_basedOnDiff: () => {
        var totalPinyinDiff = 0;
        for (let i = 0; i < statistics.pinyinDifficulty.length; i++) {
            totalPinyinDiff += statistics.pinyinDifficulty[i].difficulty;
        }
        var randomNum = Math.random() * totalPinyinDiff;
        for (let i = 0; i < statistics.pinyinDifficulty.length; i++) {
            if (randomNum < statistics.pinyinDifficulty[i].difficulty) {
                return { sheng: statistics.pinyinDifficulty[i].sheng, yun: statistics.pinyinDifficulty[i].yun };
            }
            randomNum -= statistics.pinyinDifficulty[i].difficulty;
        }
        return { sheng: statistics.pinyinDifficulty[0].sheng, yun: statistics.pinyinDifficulty[0].yun }
    }


}

var report = ""; ///////////////////////////////////////////

function saveStaticsReport() {
    var fs = require('fs');
    var config_path = path.join(__dirname, "report.json").replace(/\\/g, "\/");
    fs.writeFileSync(config_path, report);
}

function initIpcMain() {
    ipcMain.on("getConfig", (event) => {
        event.returnValue = JSON.stringify(config, '    ');
    });
    ipcMain.on("getPhrase", (event) => {
        var returnValue = {};
        returnValue.phrase = randomPhraseGenerator.getRandomPhrase();
        returnValue.pinyinDetails = getPinyinDetailList(returnValue.phrase); //[[{"sheng":"p", "yun":"in", "shengdiao": 1, "pinyin": "pīn"}]]
        returnValue.answers = getAnswerList(returnValue.phrase)
        event.returnValue = JSON.stringify(returnValue);
    });
    ipcMain.on("getScheme", (event) => {
        event.returnValue = JSON.stringify(resource.scheme);
    });
    ipcMain.on("getZhuyinDifficulty", (event, word) => {
        if (typeof statistics.zhuyinDifficulty[word] == "undefined") {
            statistics.zhuyinDifficulty[word] = 0.7;
        }
        event.returnValue = statistics.zhuyinDifficulty[word];
    });
    ipcMain.on("getNormalSolvingTime", (event) => {
        event.returnValue = statistics.normalSolvingTime;
    });
    ipcMain.on("updateStatistics", (event, statisticsRawData) => {
        var statisticsData = JSON.parse(statisticsRawData);
        for (let i = 0; i < statisticsData.length; i++) {
            report += statisticsData[i].word + "  Time: " + statisticsData[i].totalTime + " cold boot Time: " + statisticsData[i].coldBootTime + "  AttemptTimes: " + statisticsData[i].attemptTimes + "  ErrorTimes: " + statisticsData[i].errorTimes + "\n";
        }
        report += "\n";
        updateSolvingTime(statisticsData);
        updateZhuyinDiff(statisticsData);
        updatePinyinDiff(statisticsData);
        report += updatePhraseDiff(statisticsData) + '\n';
        report += "\n";
        updateDefaultZhuyin(statisticsData);
    });
    ipcMain.on("getStatistics", (event) => {
        var copyStatistics = {};
        copyStatistics.totalSolvingTime = statistics.totalSolvingTime;
        copyStatistics.totalErrorTimes = statistics.totalErrorTimes;
        copyStatistics.totalAttemptTimes = statistics.totalAttemptTimes;
        copyStatistics.totalWordCount = statistics.totalWordCount;
        copyStatistics.averageSolvingTime = statistics.averageSolvingTime;
        copyStatistics.normalSolvingTime = statistics.normalSolvingTime;
        copyStatistics.standardSolvingTime = statistics.standardSolvingTime;
        event.returnValue = copyStatistics;
    });
    // ipcMain.on("getNextZi", (event) => {
    //     if (config.enableAutoReview){
    //         core.currentZi = core.randomZiGenerator.getRandomZi();
    //     }
    //     else{
    //         core.currentZi = resource.ziKeys[getRandomInt(0, ziKeys.length)];
    //     }
    //     event.returnValue = (String)(core.currentZi);
    // });

    // ipcMain.on("getStandardSolvingTime", (event) => {
    //     event.returnValue = config.standardSolvingTime;
    // });
    // ipcMain.on("updatePerformance", (event, errTimes, solvingTime) => {
    //     statistics.totalZi++;
    //     statistics.totalTime += solvingTime;
    //     if (errTimes > 0) statistics.totalERR++;
    //     core.randomZiGenerator.update_difficulty(core.currentZi, errTimes, solvingTime);
    // });
    // ipcMain.on("getPerformance", (event) => {
    //     if (statistics.totalZi >= 100) { // 
    //         statistics.totalZi = Math.floor(statistics.totalZi * 0.7);
    //         statistics.totalTime *= 0.7;
    //         statistics.totalERR = Math.floor(statistics.totalERR * 0.7);
    //     }
    //     var p = {
    //         "ziPerMin": Math.round(statistics.totalZi / statistics.totalTime * 600000) / 10,
    //         "accuracy": Math.round((statistics.totalZi - statistics.totalERR) / statistics.totalZi * 1000) / 10,
    //         "standardSolvingTime": Math.round(config.standardSolvingTime)
    //     };
    //     event.returnValue = JSON.stringify(p);
    // });
}

const phraseBankManage = {
    txt_to_phraseBank: (path) => {
        var phraseList = phraseBankManage.loadFrom_toPhraseList(path);
        var phraseBank = {};
        phraseBank.phrases = [];
        phraseBank.classify = {};
        phraseBank.selectOpportunity = 1.0; // 越大被选中的几率越大，可在0 - 1 之间随意选取。

        for (let i = 0; i < phraseList.length; i++) {
            let pinyinClassifyList = phraseBankManage.getAllPinyinInPhrase_ignoreShengDiao(phraseList[i]); // [{sheng: "", yun: ""}]
            if (pinyinClassifyList.length <= 0) continue;
            phraseBank.phrases.push(phraseList[i]);
            for (let j = 0; j < pinyinClassifyList.length; j++) {
                if (phraseBank.classify.hasOwnProperty(pinyinClassifyList[j].sheng)) {
                    if (phraseBank.classify[pinyinClassifyList[j].sheng].hasOwnProperty(pinyinClassifyList[j].yun)) {
                        phraseBank.classify[pinyinClassifyList[j].sheng][pinyinClassifyList[j].yun].push(phraseList[i]);
                    } else {
                        phraseBank.classify[pinyinClassifyList[j].sheng][pinyinClassifyList[j].yun] = [];
                        phraseBank.classify[pinyinClassifyList[j].sheng][pinyinClassifyList[j].yun].push(phraseList[i]);
                    }
                } else {
                    phraseBank.classify[pinyinClassifyList[j].sheng] = {};
                    phraseBank.classify[pinyinClassifyList[j].sheng][pinyinClassifyList[j].yun] = [];
                    phraseBank.classify[pinyinClassifyList[j].sheng][pinyinClassifyList[j].yun].push(phraseList[i]);
                }
            }

        }
        return phraseBank;
    },

    loadFrom_toPhraseList: (path) => {
        var fs = require("fs");
        path = path.replace(/\\/g, "\/");
        var rawData = fs.readFileSync(path);
        // 编码判断与转换，只支持utf8 和 GB 编码
        var encode = "utf8";
        var encodeTemp = iconv_jscardet.detect(rawData);
        if (encodeTemp.confidence > 0.5) {
            if (iconv.encodingExists(encodeTemp.encoding)) {
                encode = encodeTemp.encoding;
            }
        }
        var phrases = iconv.decode(rawData, encode);
        // 读取为行
        var phraseList = [];
        let tempLine = "";
        const maxLineLength = 100;
        for (let i = 0; i < phrases.length; i++) {
            if (phrases[i] == '\n') {
                if (tempLine != "") {
                    phraseList.push(tempLine);
                }
                tempLine = ""
            } else if (tempLine.length > maxLineLength) {
                continue;
            } else if (phraseBankManage.isChinese(phrases[i])) {
                tempLine += phrases[i];
            }
        }
        if (tempLine != "") {
            phraseList.push(tempLine);
        }
        return phraseList;
    },

    isChinese: (c) => {
        return c[0] >= '\u4e00' && c[0] <= '\u9fa5';
    },

    getAllPinyinInPhrase_ignoreShengDiao: (phrase) => {
        var pinyinList = [] // [{sheng: "", yun: ""}]
        let pinyinDetailList = getPinyinDetailList(phrase, false);
        if (pinyinDetailList.length <= 0) return [];
        for (let i = 0; i < pinyinDetailList.length; i++) {
            if (pinyinDetailList[i].length <= 0) return [];
            for (let j = 0; j < pinyinDetailList[i].length; j++) {
                let shengAndYun = { sheng: pinyinDetailList[i][j].sheng, yun: pinyinDetailList[i][j].yun };
                let needToPushIntoPinyinList = true;
                for (let m = 0; m < pinyinList.length; m++) {
                    if (shengAndYun.sheng == pinyinList[m].sheng && shengAndYun.yun == pinyinList[m].yun) {
                        needToPushIntoPinyinList = false;
                        break;
                    }
                }
                if (needToPushIntoPinyinList) {
                    pinyinList.push(shengAndYun);
                }
            }
        }
        return pinyinList;
    },

    savePhraseBank: (phraseBank, phraseBankName) => {
        var fs = require('fs');
        var fileName = phraseBankName + ".json";
        var save_path = path.join(__dirname, "resource/phrase/", fileName).replace(/\\/g, "\/");
        fs.writeFileSync(save_path, JSON.stringify(phraseBank, null, 4));
    }

}