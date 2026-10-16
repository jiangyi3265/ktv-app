# ktv-app

面向顾客、食堂配送人员及 KTV 移动管理员的 UniApp 包厢点餐客户端。

## 项目简介

按照已确认的五张 UI 画布实现 22 个 uni-app Vue 3 页面。顾客、食堂配送、KTV 移动管理共用设计组件，并通过同级 ktv-backend 后端共享 MySQL 数据。

## 技术栈

| 类别 | 实际使用 |
| --- | --- |
| 跨端框架 | uni-app 3（Vue 3 编译器，3.0.0-5020620260917001） |
| 语言与界面 | JavaScript、Vue 3.4.21、SCSS、Tabler Icons |
| 构建 | Vite 5.2.8、npm、Node.js 22 / 24 |
| 支持输出 | H5、微信小程序；小程序需配置实际 AppID 并真机验证 |
| 数据 | uni.request / uni.uploadFile、服务端共享状态、客户端轮询 |
| 验证 | Node.js 内置测试；可选 Playwright 浏览器检查 |

## 关联仓库

| 项目 | 说明 | GitHub |
| --- | --- | --- |
| ktv-backend | 后端 API、共享订单与权限服务 | [ktv-backend](https://github.com/jiangyi3265/ktv-backend) |
| ktv-admin | PC 运营管理基础框架 | [ktv-admin](https://github.com/jiangyi3265/ktv-admin) |
| ktv-app | 顾客、食堂配送及 KTV 移动管理客户端 | [ktv-app](https://github.com/jiangyi3265/ktv-app) |

## 快速启动

```powershell
npm ci
npm run dev:api
# 在另一个终端启动前端
npm run dev:h5
```

先按后端 README 准备数据库、Redis、`DB_URL` / `DB_USER` / `DB_PASSWORD` 与 `JWT_SECRET` 环境变量，并在同一终端运行 `npm run dev:api`。该脚本首次生成移动管理员与食堂的初始密码；请勿先用另一组初始密码初始化 KTV 业务数据。也可以由后端独立启动，此时无需运行 `dev:api`。

浏览器访问 `http://127.0.0.1:5174/`。桌面宽度显示 22 页索引，手机宽度显示实际应用布局。索引仅存在于 H5 桌面评审界面，小程序不包含这个侧栏。

建议将三个仓库克隆到同一父目录。启动脚本自动查找同级 `ktv-backend`，也兼容原本地 `RuoYi-Vue` 文件夹；其他位置可用 `KTV_BACKEND_DIR` 指定。首次启动后端前，在同级 `ktv-backend` 目录执行 `mvn -pl ruoyi-admin -am package -DskipTests`。沿用若依现有 MySQL / Redis 配置，新增 `ktv_shared_state` 与 `ktv_session` 两张表；不覆盖原有若依账号或系统表。

三个入口可以在不同浏览器、无痕窗口或同一局域网设备中分别打开：

- 顾客：`/#/pages/index/index?room=A08`，服务端分配独立访客身份。
- 食堂：`/#/pages/supplier/workbench`，使用食堂账号登录。
- 管理：`/#/pages/admin/index`，使用 KTV 管理员账号登录。

启动脚本首次生成随机初始密码，管理员 `ktv-admin` 和食堂 `A01` 的登录信息在 **`.local/access.json`**（已忽略，不提交）。请妥善保存；后续启动不会覆盖数据库中的密码。手机同一局域网访问时，将 URL 主机改为运行电脑的局域网 IP，端口仍为 `5174`；电脑防火墙须允许该端口。后端默认仅监听本机，H5 通过 Vite 的 `/ktv-api` 代理访问。

三端打开时每秒同步一次；隐藏时暂停，恢复前台后立即拉取。断线显示提示并自动重连，写入失败不显示保存成功。订单与配置存储在 MySQL，购物车、所选包厢和当前登录令牌保留在各设备本地。管理员修改餐品、包厢、账号权限后，其他端自动更新。

原稿评审数据使用 `npm run dev:design`，单独运行在 `5175`，不会写入共享后端；`VITE_KTV_MODE=design` 只用于视觉评审。默认 `5174` 使用真实共享订单，因此新顾客的购物车和订单为空。

桌面评审按各张原稿的手机长宽比展示；手机端使用设备可视高度。`styles/reference.css` 记录按 390 px 内容宽度换算的逐页尺寸，修正了 H5 `uni-view` / `uni-button` 默认盒模型及行高。五组页面分别引用对应原稿中的食物摄影，保留原来的图片构图。

H5 内置约 109 KB 的 Noto Sans SC 字形子集（命名为 KTV UI Sans，附 SIL OFL 许可证），统一标题、正文、金额与按钮的字重。新增文案时可使用 `python scripts/build-font.py <NotoSansSC-VF.ttf 路径>` 重新生成；需要 Python 的 `fonttools` 和 `brotli`。微信小程序当前使用系统字体；若要同步指定字体，需按平台要求配置 HTTPS 字体地址并进行真机验证。

```powershell
npm run build:h5
npm run build:mp-weixin
npm test
```

- H5 输出：`dist/build/h5`
- 微信小程序输出：`dist/build/mp-weixin`，可导入微信开发者工具。
- HBuilderX 可直接打开本目录；命令行工具通过 `scripts/uni.mjs` 兼容现有项目根目录结构。
- `manifest.json` 尚未填写微信小程序 AppID，当前构建使用游客 AppID；真机接入需填写实际 AppID。

## 页面对应

| 编号 | 页面               | uni-app 路由                |
| ---- | ------------------ | --------------------------- |
| 01   | 扫码点餐           | `/pages/index/index`        |
| 02   | 已选餐品           | `/pages/customer/cart`      |
| 03   | 确认订单           | `/pages/customer/checkout`  |
| 04   | 微信支付面板       | `/pages/customer/payment`   |
| 05   | 支付成功           | `/pages/customer/success`   |
| 06   | 我的订单           | `/pages/customer/orders`    |
| 07   | 制作与配送进度     | `/pages/customer/progress`  |
| 08   | 已送达             | `/pages/customer/completed` |
| 09   | 接单工作台         | `/pages/supplier/workbench` |
| 10   | 待接单详情         | `/pages/supplier/detail`    |
| 11   | 制作与出餐         | `/pages/supplier/preparing` |
| 12   | 配送与确认送达     | `/pages/supplier/delivery`  |
| 13   | 管理首页           | `/pages/admin/index`        |
| 14   | 包厢管理           | `/pages/admin/rooms`        |
| 15   | 专属二维码         | `/pages/admin/qrcode`       |
| 16   | 餐品管理           | `/pages/admin/products`     |
| 17   | 餐品编辑           | `/pages/admin/product-edit` |
| 18   | 订单管理           | `/pages/admin/orders`       |
| 19   | 订单与支付记录     | `/pages/admin/order-detail` |
| 20   | 外包账号           | `/pages/admin/accounts`     |
| 21   | 权限与订单分配     | `/pages/admin/permissions`  |
| 22   | 支付配置与状态记录 | `/pages/admin/payment`      |

H5 路由前加 `/#`。扫码参数示例：`/#/pages/index/index?room=A08`。

## 已实现的前端交互

- 餐品分类与搜索，购物车增减、清空、金额联动，确认订单及支付面板。
- 明确标识的模拟支付，服务端按当前售价创建待付款订单，模拟成功后进入分配食堂的待接单列表；订单保留成交时餐品与价格快照。
- 本人订单筛选、详情、处理进度及已送达状态。
- 食堂分配订单列表、前台新单提醒、声音开关、接单、核对数量、出餐、确认送达。
- 包厢新增、编辑、搜索、二维码绑定界面。
- 餐品编辑、价格校验、图片选择、上下架，并同步到点餐菜单。
- KTV 订单搜索及筛选、支付记录、进度记录。
- 外包账号新增与状态管理、操作权限保存，前端操作前检查权限。
- 待确认的取消、退款、复杂分配规则保留为说明入口。
- 订单与管理设置由后端保存；刷新、重启后端后仍可继续处理，购物车按设备独立。
- 后端校验顾客归属、食堂分配、账号启用状态及操作权限；食堂接口本身不返回金额、顾客信息、其他食堂订单。
- 创建订单带幂等键，支付和状态更新可安全重试；数据库事务锁保护并发写入，配置版本校验防止覆盖其他管理端的修改。
- 餐品图片上传后保存为服务端图片地址，可在其他设备显示。

## 服务接入边界

共享模式通过 `common/live-store.js` 调用若依 `/ktv-api`。后端实现位于 `ktv-backend/ruoyi-admin/src/main/java/com/ruoyi/web/controller/ktv/`，使用数据库事务保存门店数据；同级 ktv-admin PC 管理界面未改动，本次管理端指设计稿中的 13–22 页。

1. **真实支付**：本地启动脚本显式启用 `KTV_DEMO_PAYMENT_ENABLED=true`，点击确认会说明是模拟支付，数据库事件也标记模拟支付。应用默认关闭该接口。真实微信支付仍需商户配置、签名下单与支付回调；不能直接将模拟接口用于真实收款。
2. **二维码**：包厢及启用状态已同步到数据库，顾客下单时后端检查包厢有效性。第 15 页仍显示设计示意码；真实微信小程序码生成需要 AppID 和微信接口。
3. **账号与权限**：管理员和食堂已使用服务端密码登录及不透明令牌（数据库只保存令牌摘要），每次操作再次校验权限。当前支持一个 KTV 门店；顾客使用设备访客身份，真实微信身份绑定、跨设备找回本人订单与多商户隔离仍需接入微信登录和商户体系。
4. **同步与提醒**：已实现前台轮询与新单声音提醒；没有关闭小程序后的推送。当前按首个启用且具备接单、送达权限的食堂分配；复杂分配、退款等规则仍未启用。
5. **图片**：管理员可上传 PNG / JPG，服务端验证、重新编码并保存，默认目录 `.local/uploads`。部署时须持久保存该目录，与数据库一起备份。
6. **设计场景**：固定示例与示例时间仅用于 design 模式。共享模式只使用服务端订单、时间与状态，不自动插入原稿中的虚拟订单。
7. **动态内容**：各张原稿的部分示例数据不一致（如 B03 餐品数量、餐品上下架状态）。当前列表、金额及状态使用同一份演示数据联动；这些动态值不会为了匹配不同截图而分别写死。

清除本地存储只会清除本设备购物车和会话，不会清除共享数据库。微信小程序接入时在 `.env.local` 设置 `VITE_KTV_API_ORIGIN=https://你的后端域名`，配置小程序 HTTPS 合法域名及 AppID；正式 H5 部署需配置 `/ktv-api` 反向代理或指定 API 域名。已验证浏览器三端互通，尚未进行微信真机联调。

## 项目结构与验证

- `pages/`：22 个实际页面入口。
- `views/`：顾客、食堂、管理端页面实现。
- `components/`：页面框架、图标、餐品图片、餐品清单、进度组件。
- `common/`：路由清单、演示状态、金额与订单状态规则。
- `common/api.js` / `common/live-store.js`：共享接口、会话、轮询、版本控制及业务写入；`design-store.js` 仅用于原稿评审。
- `styles/`：全局设计变量与页面样式。
- `design-reference/`：五张原始画布，第 5 张为日期修正版。
- `common/artwork.mjs`：逐页摄影素材与裁切坐标。
- `static/food/`：通过 `scripts/build-food.mjs` 从原始 PNG 无损提取的 40 个局部素材，界面文字和控件均是真实组件。
- `static/fonts/`：H5 字形子集及 OFL 许可证；对应 `scripts/build-font.py` 与 `styles/font.css`。
- `static/icons/`：Tabler 图标的本地 PNG 资源及许可证，含选中态实心图标；餐罩、配送袋图标由同一线宽的 SVG 生成。
- `tests/domain.test.mjs`：金额计算、状态转换和食堂字段隔离测试。
- `tests/visual-check.cjs`：22 页截图、资源错误、横向溢出和原稿首屏末尾内容可见性检查。
- `scripts/reference-review.cjs`：将最新页面截图汇总为五张对照用联系表，仅用于 QA。
- `scripts/design-compare.cjs`：生成 22 组同宽的原稿/实现并排对照，保存在 `qa/design-compare/`；运行时需 Sharp，也可通过 `SHARP_MODULE` 指向已安装模块。
- `tests/interaction-check.cjs`：点餐配送完整流程、管理操作及手机尺寸测试。
- `tests/regression-check.cjs`：窄屏摘要、不同餐品出餐、历史订单支付与购物车保留、已支付状态、餐品编辑图片、订单详情状态的六项回归检查。

浏览器检查需 Playwright 和 Chromium，可安装 `npm install --no-save playwright` 后运行 `npx playwright install chromium`，启动 H5 服务，再运行 `node tests/visual-check.cjs`、`node tests/interaction-check.cjs` 和 `node tests/regression-check.cjs`。也可通过环境变量 `PLAYWRIGHT_MODULE` 指向已安装的 Playwright。检查输出在 `qa/`，已加入忽略列表。

共享模式测试：`npm run test:shared-api`、`npm run test:shared-browser`、`npm run test:shared-resilience`，运行前启动 MySQL、Redis、后端与 H5；浏览器测试需配置 Playwright。这些测试会创建带明确联调标记的测试资源及模拟订单，只应在本地测试环境运行。检查记录和三端截图输出到 `qa/`。

原设计模式保留先前 22 页截图、四种屏宽、七项流程和六项回归检查；共享模式另行验证独立浏览器会话、服务端越权拒绝、金额计算、幂等、配置版本冲突、权限变更、断网恢复及数据持久化。微信开发者工具及真机验证仍需实际小程序环境。

## 简历描述示例

使用 UniApp 与 Vue 3 实现 KTV 点餐系统的 22 个页面，覆盖顾客点餐、食堂接单配送和移动管理流程。对接共享后端，完成多会话状态同步、权限反馈、断网恢复、餐品图片上传及订单状态联动，并保留独立设计评审模式。

## 资源说明

`static/fonts/` 保留 Noto Sans SC 字体子集的 SIL OFL 声明，`static/icons/` 保留图标许可证。设计画布、图片与业务代码的使用范围应遵循各自来源及授权。
