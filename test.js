var data = require('./data/new900_jichu.json');
data.sort((a,b)=>{
	let {en:aIdx} = a;
	let { en: bIdx } = b;
	return parseInt(aIdx)>parseInt(bIdx)?1:-1;
});
console.log(data.slice(0,50));
