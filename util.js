let promisor = function (fn) {
    let args = Array.prototype.slice.call(arguments, 1);
    return new Promise(function (rs, rj) {
        args.push(function (data) {
            let err;
            if (arguments.length > 1) {
                err = data;
                data = arguments[1]; 
            }
            if (err) rj(err);
            rs(data);
        });
        let rtn = fn.apply(null, args);
        if (rtn && rtn.on) {
            rtn.on('error', e => rj(e));
        }
    });
}
function readableToString(res, isRtnRaw = false) {
    return new Promise((rs, rj) => {
        let rawData = [];
        res.on('data', (chunk) => { rawData.push(chunk); });
        res.on('end', () => {
            if(isRtnRaw){
                rs(rawData);
            }else{
                rs(rawData.map(i=>i.toString('utf8')).join(''));
            }
        });
        res.on('error', (err) => rj(err));
    });
}
function fetchWebPage(url) {
    let main;
    if (url.toLowerCase().indexOf('https') > -1) {
        main = require('https');
    } else {
        main = require('http');
    }
    return promisor(main.get, url).then(res => {
        const { statusCode } = res;
        let error;
        if (statusCode !== 200) {
            error = new Error('Request Failed.\n' +
                `Status Code: ${statusCode}`);
        }

        if (error) {
            throw error;
        };

        return res;
    });
}

const logger = {
    _log: function () {
        let args = Array.prototype.slice.call(arguments, 0);
        let type = args.slice(-1)[0] || 'info';
        let _args = args.slice(0, -1);
        let method = console[type.toLowerCase()] || console.log;
        return method.apply(null, _args);
    },
    log:function(){
        let args = Array.prototype.slice.call(arguments, 0);
        args.push('log');
        this._log.apply(this,args);
    },
    error:function(){
        let args = Array.prototype.slice.call(arguments, 0);
        args.push('error');
        this._log.apply(this,args);
    }
}
module.exports = {
    promisor,
    fetchWebPage,
    fetchWebPageContent: (url, opts={}) => fetchWebPage(url).then(res => readableToString(res, opts.isRtnRaw)),
    logger
}