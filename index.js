const cheerio = require('cheerio');
const fs = require('fs');
const iconv = require('iconv-lite');

let { fetchWebPageContent, logger, promisor } = require('./util')
let baseUrl = 'http://www.kekenet.com/kouyu/primary/new900/jichu/';
let saveToFileName = './data/new900_jichu3.json';

function fetchListPageUrls(baseUrl) {
    logger.log('start to fetching:' + baseUrl);
    return fetchWebPageContent(baseUrl).then(res => {
        logger.log(`base url ${baseUrl } fetching done`);
        let $ = cheerio.load(res);
        //on base page
        let listLen = $('.page a').length;
        let listPageUrls = [baseUrl];
        for (let i = 1; i < listLen; i++) {
            let listPageUrl = baseUrl + 'List_' + (i + 1) + '.shtml';
            listPageUrls.push(listPageUrl);
        }
        return listPageUrls;
    });
}

function getAllArticlPageUrls(listPageUrls) {
    let allArticlePageUrls = [];
    logger.log(`start to fetch list page urls, urls count ${listPageUrls.length}`)
    return Promise.all(listPageUrls.map(listPageUrl => {
        logger.log(`start to fetch list page:${listPageUrl}`)
        return fetchWebPageContent(listPageUrl).then(listPageContent => {
            logger.log(`list page ${listPageUrl} fetching done`);
            let $ = cheerio.load(listPageContent);
            //on List page
            let articlePageUrls = $('#menu-list li h2 a').map(function(){return $(this).attr('href')}).toArray();
            logger.log('articlePageUrls', articlePageUrls);
            return articlePageUrls;
        });
    })).then(articlePageUrlsArr => {
        logger.log(`all list page urls fetching are done, results' size:${articlePageUrlsArr.length}`)
        return articlePageUrlsArr.reduce((allArr, arr) => allArr.concat(arr), allArticlePageUrls);
    });
}

function getAllTargetContent(allArticlePageUrls) {
    allArticlePageUrls = allArticlePageUrls.sort((a,b)=>{
        let id1 = a.match(/(\d+)\.\w+$/)[1];
        let id2 = b.match(/(\d+)\.\w+$/)[1];
        return parseInt(id1)>parseInt(id2)?1:-1;
    });
    logger.log(`start to get content from all the page urls, urls count is ${allArticlePageUrls.length}`);
    return Promise.all(allArticlePageUrls.map(articleUrl=>getTargetContentInPage2(articleUrl))).then(contents=>{
        logger.log(`all articles content fetching are done, result length: ${contents.length}`);
        return contents.reduce((allArr,arr)=>allArr.concat(arr),[]);
    });
}

function getTargetContentInPage(articleUrl) {
    //on article page
    logger.log(`start to fetch content in article page:${articleUrl}`);
    return fetchWebPageContent(articleUrl).then(html => {
        logger.log(`content fetching is done in article page ${articleUrl}`);
        let $ = cheerio.load(html);
        let eng = $('#article_eng');
        //content nodes
        let nodes = eng.children().get(1).childNodes;

        let contents = Array.from(nodes).filter(node => (!node.tagName || node.tagName.toUpperCase() != 'BR'));

        return contents.map(node => node.nodeValue).reduce((result, v, idx) => {
            let last = result.slice(-1)[0];
            if (!last || (last.en && last.zh)) {
                last = { en: v };
                result.push(last);
            } else if (!last.en) {
                last.en = v;
            } else if (!last.zh) {
                last.zh = v;
            }

            return result;
        }, []);
    });
}


function getTargetContentInPage2(articleUrl, truncateTitleCount) {
    //on article page
    logger.log(`start to fetch content in article page:${articleUrl}`);
    return fetchWebPageContent(articleUrl).then(html => {
        logger.log(`content fetching is done in article page ${articleUrl}`);
        let $ = cheerio.load(html);
        let scripts = $('script:not([src])');
        console.log('scripts', scripts);
        let str = scripts.map((i,item)=>item.children[0]).filter((i,item)=>(item && item.data.indexOf('thunder_url')>-1)).map((i,item)=>item.data).toArray().join('');
        console.log('str',str);
        let thunder_url_matched = str.match(/thunder_url\s*=\s*["'](.*)["']/);
        
        let contents = [];
        if(thunder_url_matched && thunder_url_matched[1]){
            let thunder_url = thunder_url_matched[1];
            let lrc_url_matched = str.match(/=(http.*\+\s*thunder_url\s*\+\s*['"]\.lrc['"])/);
            if(lrc_url_matched && lrc_url_matched[1]){
                let lrc_url = lrc_url_matched[1];
                lrc_url = lrc_url.replace('thunder_url',thunder_url).replace(/['"\+]/g,'');
                return fetchWebPageContent(lrc_url,{isRtnRaw:true}).then(rawBuffers=>{
                    let lrcContent = iconv.decode(Buffer.concat(rawBuffers),'gbk')
                    console.log(lrcContent);
                    let contents = lrcContentToABCards(lrcContent,2);
                    console.log(contents);
                    return contents;
                });
            }
        }
    });
}


function lrcContentToABCards(lrcContent, truncateTitleCount){
    let matched = lrcContent.match(/\[\d+:\d+\.\d+\].*\r*\n.*/g);
    matched = matched.map(i=>{
        let [_,en, zh] = i.match(/\[\d+:\d+\.\d+\](.*)\r*\n(.*)/);
        return {en, zh};
    });
    let titles = matched.splice(0, truncateTitleCount);
    return [{
        titles,
        contents:matched
    }]; 
}

//getTargetContentInPage2('http://www.kekenet.com/kouyu/200901/17097.shtml');
module.exports = {
    fetchContent:getTargetContentInPage2,
    lrcContentToABCards
}

let p = fetchListPageUrls(baseUrl).then(urls=>getAllArticlPageUrls(urls)).then(urls=>getAllTargetContent(urls));
p.then(r=>{
    logger.log(r);
    return promisor(fs.writeFile, saveToFileName, JSON.stringify(r));
}).catch(err=>logger.error(err))
