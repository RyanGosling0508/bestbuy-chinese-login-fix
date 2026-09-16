# Best Buy 中文请求头兼容修复

[English](README.md)

[在 Greasy Fork 安装](https://greasyfork.org/zh-CN/scripts/596108-best-buy-%E4%B8%AD%E6%96%87%E8%AF%B7%E6%B1%82%E5%A4%B4%E5%85%BC%E5%AE%B9%E4%BF%AE%E5%A4%8D) · [GitHub 源码](./bestbuy-chinese-header-fix.user.js) · [GitHub 仓库](https://github.com/RyanGosling0508/bestbuy-chinese-login-fix)

这个篡改猴脚本处理 Best Buy 登录时，中文时区名称进入 `x-grid-b` 请求头后触发的字符编码异常，让受影响的用户能够保留 Chrome 中文界面。

**2026-09-16 验证通过：**本地测试通过；Windows Chrome 恢复简体中文显示语言并重启后，启用本脚本并配置篡改猴 Dynamic 注入模式，Best Buy 实际登录成功。账号所有者完成 Chrome 的身份确认后，网站返回了已登录账号状态。

## 针对哪种错误

在 Best Buy 登录页填写邮箱并点击 Continue 后，页面可能显示：

```text
Failed to execute 'fetch' on 'Window': Failed to read the 'headers' property from 'RequestInit': String contains non ISO-8859-1 code point.
```

这是浏览器端的 JavaScript **`TypeError`**。它没有对应的 Best Buy 数字错误码，也不是 HTTP `400`、`401` 或 `403`。浏览器在转换请求头时就拒绝了这次 fetch，因此该请求尚未发送；页面中的其他请求仍可能正常执行。

本脚本针对以下情况：

- 出错页面位于 `https://www.bestbuy.com/identity/`。
- 报错包含上述 `fetch`、`RequestInit`、`headers` 和 `non ISO-8859-1 code point` 信息。
- `x-grid-b` 的 JSON 数据中包含无法用于原始请求头的字符；本次已定位的来源是 Windows 中文 Chrome 返回的中文时区名称。

它不处理密码错误、验证码收不到、CAPTCHA、账号限制、HTTP 状态错误或网络故障。仅凭「使用中文浏览器」不能断定一定是这个问题。

## 原因和修复方式

2026-09-16 检查的 Best Buy 公开登录脚本，会从 `Date.prototype.toString()` 提取时区描述，将其放进 JSON 的 `sT` 字段，再把 `JSON.stringify(...)` 的结果作为 `x-grid-b` 请求头发送。

在受影响环境中，时区字符串是 `GMT-0400 (北美东部夏令时间)`。其中中文字符的码元超过 `U+00FF`，无法转换成浏览器此处要求的字节字符串，因而发生异常。并非所有非 ASCII 字符都会触发该错误；补丁统一转义所有非 ASCII 字符，以生成纯 ASCII 值。同一环境下，把 Chrome **显示语言**改成英文后，日期中的时区名称变为英文，登录成功；只调整网站首选语言并没有消除中文时区字符串。

补丁把该 JSON 文本中的非 ASCII 字符写成等价的 Unicode 转义。例如：

```json
{"sT":"GMT-0400 (北)"}
```

变为：

```json
{"sT":"GMT-0400 (\u5317)"}
```

两者经 JSON 解码后的数据完全相同。脚本先确认内容为有效 JSON，再替换原文字符，不进行 JSON 重新序列化，因此也保留数字的原始写法和现有排版。Unicode 转义属于 [JSON 标准定义的表示方式](https://www.rfc-editor.org/rfc/rfc8259#section-7)。

## 安装和设置

1. 将 `bestbuy-chinese-header-fix.user.js` 安装到篡改猴（Tampermonkey）。也可以新建脚本，删除默认内容，粘贴此文件全部内容并保存。
2. 确认本脚本已启用。
3. 打开 **篡改猴管理面板 → 设置**，必要时切换到高级配置模式，将 **Content Script API** 设为 **UserScripts API Dynamic**，然后保存。此设置会影响篡改猴注入其他脚本的方式。
4. 如果篡改猴提示没有执行用户脚本的权限，在 Chrome 的篡改猴扩展详情里打开 **允许用户脚本（Allow User Scripts）**。Chrome 138+ 提供此扩展独立开关；旧版浏览器的替代设置见[篡改猴官方说明](https://www.tampermonkey.net/faq.php?locale=en&q=Q209)。
5. Chrome 显示语言可以保留中文。关闭后重新打开 Best Buy 登录页，或完整刷新页面，然后再测试邮箱登录步骤。

执行时机很关键：Best Buy 在页面初始化时保存 `window.fetch`，补丁必须提前在网页主 JavaScript 环境中生效。脚本使用 `document-start`、`@sandbox raw` 和 `@grant none`；Chrome 上还需要上述 Dynamic 设置保证足够早的注入。[篡改猴官方文档](https://www.tampermonkey.net/documentation.php?locale=en&q=content_script_api)说明了其他 Chrome 注入模式不提供真正的 `document-start` 支持。

在已经初始化的登录页中途启用脚本后，必须重新加载页面。

## 修改范围和隐私

- 仅在 `https://www.bestbuy.com/identity/*` 顶层页面运行。
- 只处理发往精确域名 `https://www.bestbuy.com`，且路径为 `/identity` 或以 `/identity/` 开头的 fetch 请求中的 `x-grid-b`。
- 只有该头部的值是有效 JSON，且包含非 ASCII 字符时才会改写。
- 支持网站目前使用的普通请求头对象及键值对数组。已有 `Headers` 对象原样通过；如果其值不合法，通常在构造该对象时就已经报错。
- 保留请求体、凭据选项、取消信号、其他请求头及其他 fetch 参数；需要修改时复制参数，不直接改写传入的请求头对象或数组。
- 不增加网络请求，不引入远程依赖，不写日志、不保存数据，也不读取密码、Cookie 或请求体内容。
- 保留 `x-grid-b` 解码后的数据，不删除该请求头、不关闭网站检查，也不绕过身份认证。

## 验证情况与限制

详细测试项目及复现步骤见 [VALIDATION.md](VALIDATION.md)。

安装 Node.js 18 或更新版本后，可以运行无依赖的本地测试：

```sh
npm test
```

实际网站测试使用 1.0.0。发布版 1.0.1 只增加发布元信息，可执行 JavaScript 与实测版本逐字节一致。

本地测试已覆盖中文、日文、表情字符、JSON 等价性、请求参数保留、请求头容器、作用范围边界，以及已观察到的 Best Buy fetch 包装顺序。本地测试没有发送网络请求，不能据此推断网站服务端已接受请求或账号已完成认证。

实测确认了账号所有者完成 Chrome 身份确认后的完整登录结果。此次没有在同一会话中做「停用脚本」的 A/B 对照；中文环境中的原始错误已在此前记录，账号所有者也已确认英文界面能够成功登录。没有单独测试密码和一次性验证码登录路径。

其他浏览器、操作系统、用户脚本管理器和语言环境尚未验证。其他语言可能有相同原因，但这只是推测。

这是临时兼容补丁。Best Buy 改版、请求路径或传输方式变化、请求头格式变化、浏览器或扩展更新，以及注入顺序变化，都可能影响效果。脚本不修复 `XMLHttpRequest`、Worker 请求或在进入包装函数前就已经构造失败的请求头。网站正式修复后，应停用本脚本并重新测试。

撤销方法：在篡改猴中停用或删除本脚本，再刷新 Best Buy 页面。现有页面内存中的包装函数要在刷新后才会消失。

## 依据

- [2026-09-16 检查的 Best Buy 公开登录脚本](https://www.bestbuy.com/~assets/bby/_com/sc-react-sign-on/dist/vendors/vendors-common-a7cf00f330e68ee2901d89e66f6ce28f.js)：模块 `86600` 生成日期时区字段；模块 `50200` 添加 `x-grid-b` 并调用先前保存的 fetch。此版本化资源将来可能被网站移除。
- [篡改猴：Content Script API](https://www.tampermonkey.net/documentation.php?locale=en&q=content_script_api)。
- [篡改猴：执行用户脚本的权限](https://www.tampermonkey.net/faq.php?locale=en&q=Q209)。
- [RFC 8259：JSON 字符串转义](https://www.rfc-editor.org/rfc/rfc8259#section-7)。

本项目与 Best Buy、Tampermonkey 没有隶属或官方支持关系。

## 许可证

MIT，见 [LICENSE](LICENSE)。
