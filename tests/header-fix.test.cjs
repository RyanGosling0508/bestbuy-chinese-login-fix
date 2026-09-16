const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const script = fs.readFileSync(path.join(__dirname, '..', 'bestbuy-chinese-header-fix.user.js'), 'utf8');
function setup() {
  const context = vm.createContext({ Headers, Request, URL });
  vm.runInContext(`
    var location = {href:'https://www.bestbuy.com/identity/signin'};
    var window = {fetch: function(input,init) {
      new Headers(init && init.headers);
      return {input,init};
    }};
  `, context);
  vm.runInContext(script, context);
  return context;
}
const context = setup();
vm.runInContext(`
  var original = '{"sT":"GMT-0400 (北美东部夏令时间)","日本語":"東京","emoji":"😀","n":1e2}';
  var body = {unchanged:true};
  var headers = {'x-grid-b':original,'x-other':'unchanged'};
  var init = {method:'POST',body,headers,credentials:'include'};
  var out = window.fetch('/identity/signin',init);
  var fixed = out.init.headers['x-grid-b'];
`, context);
assert.deepEqual(JSON.parse(context.fixed), JSON.parse(context.original));
assert.match(context.fixed, /\\u/);
assert.ok(context.fixed.includes('1e2'));
assert.equal(/[^\x00-\x7f]/.test(context.fixed), false);
assert.equal(context.out.init.body, context.body);
assert.equal(context.out.init.credentials, 'include');
assert.equal(context.headers['x-grid-b'], context.original);
assert.equal(context.out.init.headers['x-other'], 'unchanged');
assert.notEqual(context.out.init, context.init);
vm.runInContext(`
  var pairs = [['X-GRID-B',original],['x-other','ok']];
  var arrayOut = window.fetch('/identity/login',{headers:pairs});
  var asciiInit = {headers:{'x-grid-b':'{"sT":"GMT-0400 (Eastern Daylight Time)"}'}};
  var asciiOut = window.fetch('/identity/login',asciiInit);
  var request = new Request('https://www.bestbuy.com/identity/login');
  var requestOut = window.fetch(request,{headers});
  var ordinaryHeaders = new Headers({'x-grid-b':'{}'});
  var headerInit = {headers:ordinaryHeaders};
  var headerOut = window.fetch('/identity/login',headerInit);
`, context);
assert.deepEqual(JSON.parse(context.arrayOut.init.headers[0][1]), JSON.parse(context.original));
assert.equal(context.pairs[0][1],context.original);
assert.equal(context.asciiOut.init,context.asciiInit);
assert.equal(context.requestOut.input,context.request);
assert.equal(context.headerOut.init,context.headerInit);
// Out-of-scope URLs and malformed JSON remain unmodified and still throw.
for (const url of ['https://example.com/identity/login','https://www.bestbuy.com/cart','https://www.bestbuy.com/identity-other']) {
  assert.throws(()=>vm.runInContext(`window.fetch(${JSON.stringify(url)},init)`,context),TypeError);
}
assert.throws(()=>vm.runInContext(`window.fetch('/identity/login',{headers:{'x-grid-b':'not JSON 北'}})`,context),TypeError);
// Simulate the site's observed wrapper capturing the earlier fetch, then adding x-grid-b.
vm.runInContext(`
  var priorFetch = window.fetch;
  window.fetch = function(input,init) {
    init.headers = {...init.headers,'x-grid-b':original};
    return priorFetch(input,init);
  };
  var chainedOut = window.fetch('/identity/login',{headers:{}});
`,context);
assert.deepEqual(JSON.parse(context.chainedOut.init.headers['x-grid-b']),JSON.parse(context.original));
console.log('PASS: Unicode JSON equivalence; request/body/options preservation; scope; object/array/Headers/Request inputs; site wrapper order. No network requests made.');
