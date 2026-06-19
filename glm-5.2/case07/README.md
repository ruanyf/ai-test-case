# wordcloud-cli

一个 Node.js 命令行工具：读取一个文本文件，统计其中词汇的出现频率，并生成一张词云（word cloud）PNG 图片。

## 安装

```bash
npm install
```

依赖项：

- [`@napi-rs/canvas`](https://www.npmjs.com/package/@napi-rs/canvas) —— 预编译的 Canvas 实现（无需本地编译系统图形库）。
- [`d3-cloud`](https://www.npmjs.com/package/d3-cloud) —— 纯 JS 的词云布局算法（螺旋摆放、避免重叠）。
- [`minimist`](https://www.npmjs.com/package/minimist) —— 轻量命令行参数解析。

## 使用

```bash
node index.js <输入文件.txt> [选项]
```

默认输出文件为 `wordcloud.png`。可用 `-o` 指定文件名：

```bash
node index.js article.txt -o cloud.png
```

### 选项

| 选项 | 说明 | 默认值 |
| --- | --- | --- |
| `-o, --output <file>` | 输出 PNG 文件名 | `wordcloud.png` |
| `-w, --width <px>` | 画布宽度 | `1280` |
| `-h, --height <px>` | 画布高度 | `720` |
| `--max <n>` | 最多绘制的词数 | `200` |
| `--min-size <px>` | 最小字号 | `12` |
| `--max-size <px>` | 最大字号 | `96` |
| `--bg <color>` | 背景色（如 `#ffffff` 或 `black`） | `#ffffff` |
| `--help` | 显示帮助 | |

### 示例

```bash
node index.js sample.txt
node index.js sample.txt -o dark.png -w 1600 -h 900 --max 50 --bg "#101418"
```

## 工作原理

1. **分词**
   - 英文：按字母连续序列切词，转小写，过滤常见停用词。
   - 中文：对汉字连续段做 2 字滑动窗口（无需词典的轻量近似分词），并过滤常见停用词。
2. **统计频率**：用 `Map` 统计每个词的出现次数。
3. **布局**：取频率最高的前 N 个词，用 `d3-cloud` 的螺旋算法摆放，字号按频率的平方根映射（既突出高频词，又保证低频词可读）。
4. **渲染**：用 `@napi-rs/canvas` 绘制到画布并导出 PNG。
   - 字体：自动在系统中查找 CJK 字体（macOS 的 PingFang、Linux 的 Noto CJK / 文泉驿等），找到则注册使用，否则回退到 `sans-serif`。

## 说明

- 中文分词为 2-gram 近似，适用于词云这种可视化场景；如需精确分词，可接入 `nodejieba` 等。
- 输出为 8-bit RGBA PNG。
