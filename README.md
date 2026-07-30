# Markdown to CV(Curriculum Vitae) HTML Converter

マークダウン形式で記述された職務経歴書テキストを構造解析（AST変換）し、キレイなレイアウトのHTMLファイルへ変換するCLIツールです。

## 特徴

- **構造認識パーサー**: 見出し（`#`, `##`）やリストインデントから構造化ツリー（AST）を構築。
- **柔軟なインデント制御**: CLIオプションで出力HTMLのインデント（スペース数やタブ）を自在に変更可能。
- **詳細ログ機能**: ASTの構築結果をツリー表示してマークダウンの解釈結果を確認可能。

## 動作要件

- Node.js (v18以上推奨)
- `ts-node` または TypeScript 実行環境

## 使い方

### 基本コマンド

```bash
npx ts-node converter.ts [input.md] [output.html] [options]
```

- 第1引数: 入力マークダウンファイルパス（省略時: `input.md`）
- 第2引数: 出力HTMLファイルパス（省略時: `output.html`）

### コマンド例

```bash
# デフォルト実行（input.md を読み込み output.html に出力）
npx ts-node converter.ts

# 入出力ファイルを指定
npx ts-node converter.ts resume.md index.html

# インデントをスペース2個に変更
npx ts-node converter.ts resume.md index.html -i 2

# インデントにタブ文字を使用し、ASTログを表示
npx ts-node converter.ts -v --indent tab
```

## CLI オプション

| オプション | 短縮形 | 説明 | デフォルト |
| --- | --- | --- | --- |
| `--indent <num\|tab>` | `-i` | 出力HTMLのインデントを指定（数値または `tab`） | `4` (スペース4個) |
| `--verbose` | `-v` | AST構造のログを出力します | `false` |
| `--help` | `-h` | ヘルプメッセージを表示します | - |

## 入力マークダウンの記述例

```markdown
# 職務経歴書

## {Signature}
* 2026/07/24 現在
* 山田 太郎
* <yamada@example.com>

## 職務経歴
* {table-header}
  * 参加期間
  * 業務内容
  * 環境・言語など
  * 職位など
* {table-body}
  * {row}
    * 2023年4月~現在
    * {paragraph}
      * 株式会社サンプル
      * 【担当フェーズ】開発リーダー
    * TypeScript, React, Node.js
    * 正社員
```

## ライセンス

[MIT License](LICENSE)