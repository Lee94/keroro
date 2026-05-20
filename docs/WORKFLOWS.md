# Workflows

本地开发、构建、发布的具体命令与背后机理。

## 本地开发

```bash
pnpm install          # 首次或 lockfile 变更后
pnpm tauri dev        # 前端 Vite (1420) + Rust 后端,热重载
```

- Vite dev server 跑 1420(`tauri.conf.json:devUrl`)。
- Rust 改动会重新编译并重启窗口;TS / CSS 改动走 HMR。
- 第一次 `cargo build` 慢,后续增量编译。

只想跑前端(用浏览器调样式):
```bash
pnpm dev              # Vite 单跑;不能 invoke,Tauri API 全部失败
```

## 仅前端构建

```bash
pnpm build            # tsc 类型检查 + vite build,产物在 dist/
```

CI / 打包前的快速验证,不需要 Rust 工具链。

## 打包桌面应用

```bash
pnpm tauri build                                # 当前平台默认 target
pnpm tauri build --target aarch64-apple-darwin   # macOS Apple Silicon
pnpm tauri build --target x86_64-pc-windows-msvc # Windows x64
```

产物路径:
- macOS: `src-tauri/target/<triple>/release/bundle/{dmg,macos}/`
- Windows: `src-tauri/target/<triple>/release/bundle/{nsis,msi}/`

`tauri.conf.json` 里 `bundle.targets = "all"` 意味着会同时尝试构建该平台所有可用格式(dmg + app / nsis + msi 等)。

## 发布

`.github/workflows/release.yml` 控制。两种触发方式:

### 推 tag(创建公开 release)
```bash
git tag v0.1.1
git push origin v0.1.1
```

会:
1. 在 macos-14 (arm64) 和 windows-latest 上并行构建。
2. 创建/更新名为 `keroro vX.Y.Z` 的 GitHub Release(`releaseDraft: false`,直接公开)。
3. 把 dmg / app.tar.gz / msi / nsis 安装包附加到 release。
4. 同时把产物上传到 workflow run 的 Artifacts 区(保留 30 天)。

### 手动触发(只产 artifacts,不发 release)
GitHub → Actions → "release" → Run workflow。

适合预览构建、临时给人下载未发布的版本。

## CI 关键文件

- `.github/workflows/release.yml` — 唯一的 workflow,见 [release.yml](../.github/workflows/release.yml)。
- 缓存:
  - `pnpm/action-setup@v4` + `actions/setup-node@v4` 的 `cache: pnpm` 缓存依赖
  - `Swatinem/rust-cache@v2` 缓存 `src-tauri/target`

如果改了 `Cargo.toml` 或 `pnpm-lock.yaml`,**缓存键会自动失效**——预期下一次 CI 会慢。

## 已知坑

### macOS 未签名的 .dmg
Release 里的 macOS 包**没做代码签名/公证**。下载者第一次打开会被 Gatekeeper 拦:
- 临时方案:右键 → 打开,或系统设置 → 隐私与安全性 → "仍要打开"。
- 长期方案需要 Apple Developer ID + `notarytool`,目前没做。

### Windows 的 webview2
Tauri 2 在 Windows 上依赖系统 WebView2 runtime。Win10 老版本可能没装,首次启动会提示下载——属于 Tauri 默认行为,不是我们的 bug。

### 图标
`src-tauri/icons/` 下的多分辨率图标和 `.icns` / `.ico` 必须保持一致。重新生成时用 Tauri CLI:
```bash
pnpm tauri icon path/to/source.png
```
不要手动编辑 `.icns` / `.ico`。

## 调试

- 前端 DevTools:`pnpm tauri dev` 启动后右键窗口 → Inspect(dev 默认开,prod 关)。
- Rust `eprintln!` 会写到启动 `tauri dev` 的终端 stderr。
- xterm 内容是 binary,**不要**直接 print PTY 字节;要 dump 的时候先 `String::from_utf8_lossy`。

## 一些不存在的事

为了避免 agent 浪费时间寻找:

- **没有单元测试 / 集成测试 / e2e 测试**。`cargo test` 和 `pnpm test` 都会跑出空集。
- **没有 lint / format CI gate**。本地需要的话:`cargo fmt`、`cargo clippy`、`pnpm exec tsc --noEmit`。
- **没有 staging 环境 / 远程后端**。所有数据本地存。
- **没有遥测 / crash 上报**。
