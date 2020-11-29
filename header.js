const getPhrase = "getPhrase";
const getScheme = "getScheme";
const getConfig = "getConfig";
const getZhuyinDifficulty = "getZhuyinDifficulty";
const getNormalSolvingTime = "getNormalSolvingTime";
const updateStatistics = "updateStatistics";
const getStatistics = "getStatistics";

const FINISH = "finish";
const UNFINISH = "unfinish";

var config = {};

var uidCount = 0;

function getUniqueId() {
    uidCount++;
    return uidCount;
}