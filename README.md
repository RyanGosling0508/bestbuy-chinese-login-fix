# Best Buy localized-header compatibility fix

[中文说明](README.zh-CN.md)

[Install from Greasy Fork](https://greasyfork.org/zh-CN/scripts/596108-best-buy-%E4%B8%AD%E6%96%87%E8%AF%B7%E6%B1%82%E5%A4%B4%E5%85%BC%E5%AE%B9%E4%BF%AE%E5%A4%8D) · [GitHub source](./bestbuy-chinese-header-fix.user.js) · [GitHub repository](https://github.com/RyanGosling0508/bestbuy-chinese-login-fix)

A small Tampermonkey userscript for the Best Buy sign-in error caused by a localized time-zone name in the `x-grid-b` request header. It is intended to let affected users keep Chrome's Chinese display language.

**Verified on 2026-09-16:** local tests passed, and actual Best Buy sign-in succeeded in Windows Chrome with its display language restored to Simplified Chinese, this script enabled, and Tampermonkey's Dynamic injection mode configured. The account owner completed Chrome's authentication confirmation; the site then returned to an authenticated account state.

## The exact error this addresses

On Best Buy's sign-in page, submitting the email step may show:

```text
Failed to execute 'fetch' on 'Window': Failed to read the 'headers' property from 'RequestInit': String contains non ISO-8859-1 code point.
```

This is a browser-side JavaScript **`TypeError`**, not an HTTP status such as `400`, `401`, or `403`, and not a numbered Best Buy error code. The affected fetch fails while converting its headers, before that request can be sent. Other page requests may still run.

This script targets the combination of:

- A top-level page under `https://www.bestbuy.com/identity/`.
- The exact header-conversion error above.
- A non-ASCII localized string inside the JSON value of Best Buy's `x-grid-b` header, as observed with Chinese Chrome on Windows.

It does not fix incorrect credentials, verification-code failures, CAPTCHA challenges, account restrictions, HTTP errors, or network failures. A browser being Chinese alone is not sufficient to diagnose this issue.

## What causes it

In the Best Buy public sign-in bundle inspected on 2026-09-16, the site obtains a time-zone string from `Date.prototype.toString()`, stores it as `sT` in a JSON object, and sends `JSON.stringify(...)` as `x-grid-b`.

In the affected environment, the date contained `GMT-0400 (北美东部夏令时间)`. Those Chinese characters have code units above `U+00FF` and cannot be converted to the byte-string header value expected by the browser. Not every non-ASCII character causes this exception; the patch escapes all non-ASCII characters to produce an ASCII-only value. Changing Chrome's display language to English changed the time-zone name and allowed login; changing only preferred web-content language had not removed the Chinese date text in that environment.

The userscript escapes non-ASCII UTF-16 code units in that JSON text, for example:

```json
{"sT":"GMT-0400 (北)"}
```

becomes:

```json
{"sT":"GMT-0400 (\u5317)"}
```

The parsed JSON data is unchanged. The code validates JSON first, then replaces characters in the original text; it does not parse and reserialize the data, so the spelling of numbers and existing formatting are retained. JSON Unicode escaping is defined in [RFC 8259, section 7](https://www.rfc-editor.org/rfc/rfc8259#section-7).

## Installation in Chrome with Tampermonkey

1. Install the `bestbuy-chinese-header-fix.user.js` file in Tampermonkey, or create a new userscript, replace the starter contents with that file, and save.
2. Ensure this script is enabled.
3. In **Tampermonkey Dashboard → Settings**, switch to advanced configuration if needed and select **Content Script API → UserScripts API Dynamic**. Save the setting. This setting affects how Tampermonkey injects userscripts, including other installed scripts.
4. If Tampermonkey reports that it cannot execute userscripts, open its Chrome extension details and enable **Allow User Scripts**. Chrome 138+ provides this per-extension toggle; Tampermonkey documents alternatives for older browser versions in its [permission instructions](https://www.tampermonkey.net/faq.php?locale=en&q=Q209).
5. Keep Chrome's display language set to Chinese. Close and reopen the Best Buy sign-in page, or reload it fully, before testing the email step.

Early execution matters: Best Buy captures `window.fetch` during startup. The patch must run in the page's main JavaScript world before that capture. This script requests `document-start`, `@sandbox raw`, and `@grant none`; the Dynamic API setting supplies the required early injection on Chrome. Tampermonkey's [Content Script API documentation](https://www.tampermonkey.net/documentation.php?locale=en&q=content_script_api) explains why its other Chrome injection modes do not provide real `document-start` support.

Enabling a script after the sign-in page has already initialized does not repair that existing page. Reload it.

## Scope and behavior

- Injects only into top-level `https://www.bestbuy.com/identity/*` pages.
- Wraps the page's `fetch` and only changes `x-grid-b` for requests whose origin is exactly `https://www.bestbuy.com` and whose path is `/identity` or starts with `/identity/`.
- Changes a header value only when it is valid JSON containing non-ASCII characters.
- Supports the site's plain header object and arrays of header pairs. Existing `Headers` objects pass through unchanged; an invalid value would already have failed while constructing such an object.
- Preserves the original request body, credentials option, signal, other headers, and other fetch options. It creates copies when changing headers and does not mutate the supplied header object or pair array.
- Adds no network requests, remote dependencies, logging, or persistent storage. It does not inspect passwords, cookies, or request bodies.
- Preserves the decoded `x-grid-b` data. It does not remove that header, disable Best Buy checks, or bypass authentication.

## Verification and limitations

See [VALIDATION.md](VALIDATION.md) for a reproducible test matrix and the distinction between local proof and actual site behavior.

Run the dependency-free local test suite with Node.js 18 or newer:

```sh
npm test
```

The real-site test used version 1.0.0. Release 1.0.1 only adds publication metadata; the executable JavaScript is byte-for-byte identical.

Local tests passed for Chinese, Japanese, emoji, JSON equivalence, request-option preservation, header containers, scope boundaries, and the observed Best Buy fetch-wrapper order. These tests make no network requests and do not establish server acceptance or successful authentication.

The real-site test verified full login after the account owner completed Chrome's authentication confirmation. No script-disabled A/B comparison was performed in that same session; the original Chinese-language failure was documented earlier, and the account owner had previously confirmed English-language login succeeded. Separate password and one-time-code flows were not tested.

Other browsers, operating systems, userscript managers, and locales have not been verified. Other locales may have the same underlying issue, but that is an inference, not a test result.

This is a temporary compatibility workaround. A Best Buy code change, a different request path or transport, a changed header format, a browser/extension update, or different script timing can make it ineffective. It does not patch `XMLHttpRequest`, workers, or headers constructed before the wrapper sees them. If Best Buy fixes its encoding, disable this userscript and test without it.

To remove it, disable or delete this script in Tampermonkey and reload the Best Buy page. Existing open pages keep their in-memory wrapper until reloaded.

## Evidence and references

- [Best Buy public sign-in bundle inspected on 2026-09-16](https://www.bestbuy.com/~assets/bby/_com/sc-react-sign-on/dist/vendors/vendors-common-a7cf00f330e68ee2901d89e66f6ce28f.js): module `86600` builds the date-derived time-zone field; module `50200` adds `x-grid-b` and calls its captured fetch. The site's versioned asset may later disappear.
- [Tampermonkey: Content Script API](https://www.tampermonkey.net/documentation.php?locale=en&q=content_script_api).
- [Tampermonkey: permission to execute userscripts](https://www.tampermonkey.net/faq.php?locale=en&q=Q209).
- [RFC 8259: JSON string escaping](https://www.rfc-editor.org/rfc/rfc8259#section-7).

This is an independent project and is not affiliated with Best Buy or Tampermonkey.

## License

MIT. See [LICENSE](LICENSE).
