# Validation record and reproduction

Last verified: 2026-09-16.

The live test used script version 1.0.0. Version 1.0.1 changes publication metadata only; its executable JavaScript is byte-for-byte identical. Local tests were rerun against the packaged 1.0.1 file.

The real-site test completed full login after the account owner handled Chrome's authentication confirmation. This was not inferred merely from reaching the next step. No same-session comparison with the script disabled was performed; separate password and one-time-code paths were not tested.

## Test matrix

| Test | Expected observation | Current evidence |
| --- | --- | --- |
| Chinese display language, no patch, original Best Buy email step | Header conversion TypeError appears | Reproduced in the investigated Windows Chrome environment |
| Read `new Date().toString()` in affected Chrome | Localized time-zone text includes Chinese characters | Observed `GMT-0400 (北美东部夏令时间)` |
| Read date and language again after restoring Chinese and restarting Chrome | Chinese locale and time-zone text still present while patched login succeeds | Confirmed `navigator.language` was `zh-CN`; date still included `GMT-0400 (北美东部夏令时间)` |
| Preferred web-content language English, display language still Chinese | Locale issue may remain | `navigator.language` was `en` while date text was Chinese in the investigated environment |
| English display language after browser restart, no patch | Time-zone name becomes English; original error removed | Observed English date text; user confirmed successful login |
| Construct a header from literal Chinese JSON, without network | Browser rejects non-byte-string value | Reproduced locally again after Chinese-language restart; first invalid character was `北` (`U+5317`, decimal 21271) |
| Construct a header after Unicode escaping | Header construction succeeds; parsed JSON equals original | PASS |
| Chinese, Japanese, and emoji JSON data | Exact decoded data preserved, including surrogate pairs | PASS in local automated test |
| Existing JSON number spelling and non-target headers | Remain unchanged | PASS in local automated test |
| Request body, credentials option, original input | Preserved; original headers not mutated | PASS in local automated test |
| Plain object and array-of-pairs headers; `Request` input | Scoped patch works | PASS in local automated test |
| Existing `Headers` object and ASCII-only value | Passed through without change | PASS in local automated test |
| Foreign origin, `/cart`, and `/identity-other` | Left unchanged | PASS in local automated test |
| Malformed JSON | Left unchanged rather than guessed or rewritten | PASS in local automated test |
| Site wrapper captures patched fetch, later inserts `x-grid-b` | Earlier patch processes the inserted header | PASS in local simulated-wrapper test |
| Chinese display language + Tampermonkey Dynamic + script enabled + freshly loaded real Best Buy page | Original error absent; email step advances | **PASS — Chrome Simplified Chinese confirmed after restart; script enabled and Dynamic setting persisted; original error absent** |
| Full account authentication in that patched Chinese environment | Authenticated account state confirmed | **PASS — account owner completed Chrome authentication confirmation; Best Buy returned to the homepage with an authenticated account greeting** |
| Same-session script-disabled A/B comparison | Reproduce the old error before re-enabling | Not performed; earlier original-error observations used as baseline |
| Separate password / one-time-code sign-in paths | Original encoding exception absent throughout each path | Not tested |
| Disable script and reload after Best Buy ships its own fix | Normal login continues | Not yet applicable |

Local tests simulate only the observed calling pattern and do not contact Best Buy. They do not prove server acceptance, main-world injection, extension timing, or authentication.

## Small self-contained browser test

The repository's complete dependency-free local checks run with `npm test` (Node.js 18+) or `node tests/header-fix.test.cjs`. They use Node's built-in assertion, VM, and Fetch API implementations; browser/site verification remains the separate procedure below.

The following can be run in a local test page or browser developer console. It performs no requests and uses no account data. The exact wording of the initial exception varies by browser.

```js
const original = JSON.stringify({
  sT: 'GMT-0400 (北美东部夏令时间)',
  sample: '日本語 😀'
});

try {
  new Headers({ 'x-grid-b': original });
  console.log('Unexpected: literal Unicode accepted');
} catch (error) {
  console.log(error.name, error.message);
}

const escaped = original.replace(/[\u0080-\uffff]/g, character =>
  '\\u' + character.charCodeAt(0).toString(16).padStart(4, '0')
);
new Headers({ 'x-grid-b': escaped });
console.assert(!/[^\x00-\x7f]/.test(escaped));
console.assert(JSON.stringify(JSON.parse(escaped)) === original);
console.log('PASS: ASCII-only header; decoded JSON preserved');
```

## Actual-site verification procedure

1. Record OS, Chrome version, Tampermonkey version, script version, display language, and date-string time-zone description. Do not record passwords, session values, email addresses, or authentication codes in the public report.
2. Save the script, enable it, and select Tampermonkey's `UserScripts API Dynamic` injection mode. Confirm Chrome has allowed userscripts for the extension.
3. Restore the intended Chinese display language and restart Chrome if required. Verify that browser UI language and the date's time-zone text are actually Chinese; a language preference alone does not prove this.
4. Open a fresh Best Buy sign-in page through its normal website flow. Do not reuse a page that initialized before the script was enabled.
5. Enter the account owner's email and submit once. Record whether the exact original error appears or the intended next authentication step is reached. Do not publish the account identifier.
6. If full authentication is needed, let the account owner complete required private credentials or verification. Record full login separately from removal of the header exception.
7. If the original error persists, inspect userscript permission, Dynamic mode, page reload, script scope, and injection order before treating the local proof as invalid. Record the observed failure honestly.

Use the current webpage outcome as evidence. A green script toggle, a Tampermonkey script count, or a successful offline `Headers` constructor test does not by itself prove the actual login fix.
