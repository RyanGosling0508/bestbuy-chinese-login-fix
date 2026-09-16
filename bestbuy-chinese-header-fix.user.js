// ==UserScript==
// @name         Best Buy 中文请求头兼容修复
// @name:en      Best Buy Chinese Chrome Login Fix
// @namespace    local.bestbuy.header-encoding
// @version      1.0.1
// @description  将 Best Buy x-grid-b JSON 中的非 ASCII 字符转义，保持原数据含义。
// @description:en Fix the Best Buy sign-in fetch header TypeError caused by a localized time-zone value in x-grid-b, only on www.bestbuy.com/identity pages and requests.
// @author       RyanGosling0508
// @license      MIT
// @homepageURL  https://github.com/RyanGosling0508/bestbuy-chinese-login-fix
// @supportURL   https://github.com/RyanGosling0508/bestbuy-chinese-login-fix/issues
// @match        https://www.bestbuy.com/identity/*
// @run-at       document-start
// @sandbox      raw
// @grant        none
// @noframes
// ==/UserScript==

// Chrome / Tampermonkey: select Content Script API = UserScripts API Dynamic.
// This must run before Best Buy captures window.fetch during its bootstrap.
// Disable this script and reload the page to remove the patch.
// No logging, remote dependencies, additional requests, or persistent storage.

(() => {
  'use strict';
  const underlyingFetch = window.fetch;
  if (typeof underlyingFetch !== 'function') return;

  function encodeValue(name, value) {
    if (typeof name !== 'string' || name.toLowerCase() !== 'x-grid-b' ||
        typeof value !== 'string' || !/[\u0080-\uffff]/.test(value)) return value;
    try { JSON.parse(value); } catch { return value; }
    return value.replace(/[\u0080-\uffff]/g,
      char => '\\u' + char.charCodeAt(0).toString(16).padStart(4, '0'));
  }

  function encodeHeaders(headers) {
    if (!headers || headers instanceof Headers) return headers;
    let changed = false;
    if (Array.isArray(headers)) {
      const copy = headers.map(pair => {
        if (!Array.isArray(pair) || pair.length !== 2) return pair;
        const value = encodeValue(pair[0], pair[1]);
        if (value === pair[1]) return pair;
        changed = true;
        return [pair[0], value];
      });
      return changed ? copy : headers;
    }
    // Best Buy currently supplies an ordinary record of header names/values.
    const proto = Object.getPrototypeOf(headers);
    if (proto !== Object.prototype && proto !== null) return headers;
    let copy;
    for (const name of Object.keys(headers)) {
      const value = encodeValue(name, headers[name]);
      if (value === headers[name]) continue;
      if (!copy) copy = Object.assign(Object.create(proto), headers);
      copy[name] = value;
    }
    return copy || headers;
  }

  window.fetch = function (input, init) {
    let patchedInit = init;
    try {
      const url = new URL(input instanceof Request ? input.url : input, location.href);
      if (url.origin === 'https://www.bestbuy.com' &&
          /^\/identity(?:\/|$)/.test(url.pathname) && init && init.headers) {
        const headers = encodeHeaders(init.headers);
        if (headers !== init.headers) patchedInit = { ...init, headers };
      }
    } catch {
      // Let the original fetch handle unsupported inputs in its normal way.
    }
    // Preserve the request body, credentials, signal, and all other options.
    return Reflect.apply(underlyingFetch, this, [input, patchedInit]);
  };
})();
