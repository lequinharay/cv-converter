import * as fs from 'fs';
import * as path from 'path';

// --- AST Node の定義 ---
interface ASTNode {
  indent: number;
  headingLevel: number; // 0: 通常行, 1: H1, 2: H2, ...
  text: string;
  children: ASTNode[];
}

// --- インデント設定のグローバル状態（デフォルト: スペース 4個） ---
let indentUnit: string = '    ';

// インデント（スペース2〜4個またはタブ）からレベルを計算
function getIndentLevel(line: string): number {
  const match = line.match(/^(\s*)/);
  if (!match) return 0;
  const spaces = match[1].replace(/\t/g, '  '); // タブはスペース4個換算
  return Math.floor(spaces.length / 4);
}

function getHeadingLevel(text: string): number {
  const match = text.match(/^(#{1,6})\s/);
  return match ? match[1].length : 0;
}

/**
 * テキストを行解析してAST（木構造）に変換
 */
function buildAST(input: string): ASTNode[] {
  const lines = input.split(/\r?\n/);
  const rootNodes: ASTNode[] = [];
  const stack: ASTNode[] = [];

  for (const rawLine of lines) {
    if (!rawLine.trim()) continue; // 空行スキップ

    const indent = getIndentLevel(rawLine);
    let text = rawLine.trim();

    // 見出しレベルの判定 (# = 1, ## = 2)
    const headingLevel = getHeadingLevel(text);

    // 見出しでない場合のみ、先頭の箇条書き記号（* や -）を除去
    if (headingLevel === 0) {
      if (text.startsWith('* ') || text.startsWith('- ')) {
        text = text.slice(2).trim();
      } else if (text === '*' || text === '-') {
        text = '';
      }
    }

    const node: ASTNode = { indent, headingLevel, text, children: [] };

    if (headingLevel > 0) {
      // 見出しの場合：自分と同等以上の見出し、または通常ノードをスタックから除く
      while (
        stack.length > 0 &&
        (stack[stack.length - 1].headingLevel >= headingLevel || stack[stack.length - 1].headingLevel === 0)
      ) {
        stack.pop();
      }
    } else {
      // 通常ノードの場合：
      // 直近の親見出しの中にいる前提で、自分以上のインデントを持つ「通常ノード」のみスタックから除く
      while (
        stack.length > 0 &&
        stack[stack.length - 1].headingLevel === 0 &&
        stack[stack.length - 1].indent >= indent
      ) {
        stack.pop();
      }
    }

    if (stack.length === 0) {
      rootNodes.push(node);
    } else {
      stack[stack.length - 1].children.push(node);
    }

    stack.push(node);
  }

  return rootNodes;
}

// AST を視覚的にツリー出力するデバッグ関数
function printAST(nodes: ASTNode[], depth: number = 0): void {
  for (const node of nodes) {
    const indentStr = '  '.repeat(depth);
    const textPreview = node.text.length > 40 ? `${node.text.slice(0, 40)}...` : node.text;
    console.log(`${indentStr}- [L${node.indent}] "${textPreview}" (${node.children.length} children)`);
    if (node.children.length > 0) {
      printAST(node.children, depth + 1);
    }
  }
}

// 日付表記の「2026年4月~2023年4月」を<br>｜<br>形式に変換するヘルパー
function formatPeriod(text: string): string {
  if (text.includes('~')) {
    const parts = text.split('~').map((s) => s.trim());
    return `${parts[0]}<br>\n${t(7)}｜<br>\n${t(7)}${parts[1]}`;
  }
  return text;
}

/*
 * ASTからHTMLへの変換レンダラー
 */
function renderHTML(rootNodes: ASTNode[]): string {
  // H1 ノードを取得（ルート直下の最初のH1ノード、なければルート自身を対象にする）
  const h1Node = rootNodes.find(n => n.headingLevel === 1);
  const title = h1Node ? h1Node.text.replace(/^#\s*/, '') : '職務経歴書';

  // H2などのセクション群は H1 の children 内に格納されている
  const topSections = h1Node ? h1Node.children : rootNodes;

  let signatureHtml = '';
  const sectionsHtml: string[] = [];

  // 各 H2 セクションの処理
  for (const sectionNode of topSections) {
    const rawTitle = sectionNode.text;
    const cleanTitle = rawTitle.replace(/^##\s*/, '').trim();

    if (cleanTitle === '{Signature}') {
      signatureHtml = renderSignatureSection(sectionNode.children);
    } else if (cleanTitle === '職務経歴') {
      sectionsHtml.push(renderCareerSection(cleanTitle, sectionNode.children));
    } else if (cleanTitle === 'スキル等') {
      sectionsHtml.push(renderSkillSection(cleanTitle, sectionNode.children));
    } else if (cleanTitle === '資格等') {
      sectionsHtml.push(renderQualificationSection(cleanTitle, sectionNode.children));
    } else if (cleanTitle === '自己PR') {
      sectionsHtml.push(renderPRSection(cleanTitle, sectionNode.children));
    } else {
      // 汎用セクション（もし存在する場合）
      sectionsHtml.push(renderGenericSection(cleanTitle, sectionNode.children));
    }
  }

  // 3. HTMLテンプレートの組み立て
  return `<!DOCTYPE html>
<html>
<head>
${t(1)}<meta charset="utf-8">
${t(1)}<meta http-equiv="X-UA-Compatible" content="IE=edge">
${t(1)}<title>${title}</title>
${t(1)}<link rel="stylesheet" href="style.css">
</head>
<body>
${t(1)}<div class="wrapper">
${t(2)}<h1 class="title">${title}</h1>
${signatureHtml}
${t(2)}<article class="content">
${sectionsHtml.join('\n')}
${t(2)}</article>
${t(1)}</div>
</body>
</html>`;
}

// --- セクション別レンダラー ---

// Signature セクション
function renderSignatureSection(children: ASTNode[]): string {
  let html = `${t(2)}<div class="signature">\n`;
  for (const child of children) {
    if (child.text.includes('現在')) {
      html += `${t(3)}<div class="date">${child.text}</div>\n`;
    } else if (child.text.includes('@') || child.text.startsWith('<')) {
      const email = child.text.replace(/[<>]/g, '');
      html += `${t(3)}<div class="email">${email}</div>\n`;
    } else {
      html += `${t(3)}<div class="name">${child.text}</div>\n`;
    }
  }
  html += `${t(2)}</div>\n`;
  return html;
}

// 職務経歴テーブル
function renderCareerSection(title: string, children: ASTNode[]): string {
  let out = `${t(3)}<section class="career">\n${t(4)}<h2 class="subTitle">${title}</h2>\n${t(4)}<table>\n`;

  for (const child of children) {
    if (child.text === '{table-header}') {
      out += `${t(5)}<thead>\n${t(6)}<tr>\n`;
      for (const th of child.children) {
        out += `${t(7)}<th>${th.text}</th>\n`;
      }
      out += `${t(6)}</tr>\n${t(5)}</thead>\n`;
    } else if (child.text === '{table-body}') {
      out += `${t(5)}<tbody>\n`;
      for (const row of child.children) {
        if (row.text.startsWith('{row}')) {
          out += `${t(6)}<tr>\n`;
          const cols = row.children;

          // Col 0: 期間
          if (cols[0]) {
            out += `${t(7)}<td class="tableCenter">\n${t(8)}${formatPeriod(cols[0].text)}\n${t(7)}</td>\n`;
          }

          // Col 1: 業務内容 (paragraph)
          if (cols[1]) {
            out += `${t(7)}<td>\n`;
            for (const pNode of cols[1].children) {
              if (pNode.text === '{paragraph}') {
                out += `${t(8)}<section>\n`;
                for (const item of pNode.children) {
                  out += `${t(9)}<p>\n${t(10)}${item.text}\n${t(9)}</p>\n`;
                }
                out += `${t(9)}</section>\n`;
              } else {
                out += `${t(8)}<section>\n${t(9)}${pNode.text}\n${t(8)}</section>\n`;
              }
            }
            out += `${t(7)}</td>\n`;
          }

          // Col 2: 環境・言語
          if (cols[2]) {
            out += `${t(7)}<td>\n`;
            if (cols[2].children.length > 0) {
              for (const c of cols[2].children) {
                out += `${t(8)}<p>${c.text}</p>\n`;
              }
            } else {
              out += `${t(8)}${cols[2].text}\n`;
            }
            out += `${t(7)}</td>\n`;
          }

          // Col 3: 職位など
          if (cols[3]) {
            out += `${t(7)}<td>\n${t(8)}${cols[3].text}\n${t(7)}</td>\n`;
          }

          out += `${t(6)}</tr>\n`;
        }
      }
      out += `${t(5)}</tbody>\n`;
    }
  }

  out += `${t(4)}</table>\n${t(3)}</section>\n`;
  return out;
}

// スキル等テーブル
function renderSkillSection(title: string, children: ASTNode[]): string {
  let out = `${t(3)}<section class="advantage">\n${t(4)}<h2 class="subTitle">${title}</h2>\n${t(4)}<table>\n`;

  for (const child of children) {
    if (child.text === '{table-header}') {
      out += `${t(5)}<thead>\n${t(6)}<tr>\n`;
      for (const th of child.children) {
        out += `${t(7)}<th>${th.text}</th>\n`;
      }
      out += `${t(6)}</tr>\n${t(5)}</thead>\n`;
    } else if (child.text === '{table-body}') {
      out += `${t(5)}<tbody>\n`;
      for (const row of child.children) {
        if (row.text.startsWith('{row}')) {
          out += `${t(6)}<tr>\n`;
          const cols = row.children;

          // 先頭に余分なテキストがついている場合（例: {row} ミドルウェア）の補正
          let firstColText = cols[0] ? cols[0].text : '';
          if (row.text.replace('{row}', '').trim()) {
            firstColText = row.text.replace('{row}', '').trim();
          }

          // Col 0: スキル名
          out += `${t(7)}<td>${firstColText}</td>\n`;

          // Col 1: 詳細
          out += `${t(7)}<td>\n`;
          if (cols[1]) {
            if (cols[1].text === '{paragraph}') {
              for (const dlNode of cols[1].children) {
                out += `${t(8)}<dl>\n${t(9)}<dt>${dlNode.text}</dt>\n`;
                for (const ddNode of dlNode.children) {
                  out += `${t(9)}<dd>${ddNode.text}</dd>\n`;
                }
                out += `${t(8)}</dl>\n`;
              }
            } else if (cols[1].children.length > 0) {
              for (const pNode of cols[1].children) {
                if (pNode.text === '{paragraph}') {
                  for (const item of pNode.children) {
                    out += `${t(8)}<p>${item.text}</p>\n`;
                  }
                } else {
                  out += `${t(8)}<p>${pNode.text}</p>\n`;
                }
              }
            } else {
              out += `${t(8)}${cols[1].text}\n`;
            }
          }
          out += `${t(7)}</td>\n`;

          // Col 2: 経験年数など
          out += `${t(7)}<td>\n`;
          if (cols[2]) {
            if (cols[2].children.length > 0) {
              for (const pNode of cols[2].children) {
                out += `${t(8)}<p>${pNode.text}</p>\n`;
              }
            } else {
              out += `${t(8)}${cols[2].text}\n`;
            }
          }
          out += `${t(7)}</td>\n`;

          out += `${t(4)}${t(2)}</tr>\n`;
        }
      }
      out += `${t(5)}</tbody>\n`;
    }
  }

  out += `${t(4)}</table>\n${t(3)}</section>\n`;
  return out;
}

// 資格等
function renderQualificationSection(title: string, children: ASTNode[]): string {
  let out = `${t(3)}<div class="qualification">\n${t(3)}<h2 class="subTitle">${title}</h2>\n${t(4)}<section>\n${t(5)}<ul>\n`;

  for (const item of children) {
    let text = item.text;
    if (text.startsWith('*')) text = text.slice(1).trim();
    out += `${t(6)}<li>${text}</li>\n`;
  }

  out += `${t(5)}</ul>\n${t(4)}</section>\n${t(3)}</div>\n`;
  return out;
}

// 4. 自己PR
function renderPRSection(title: string, children: ASTNode[]): string {
  let out = `${t(3)}<div class="pr">\n${t(4)}<h2 class="subTitle">${title}</h2>\n${t(4)}<section>\n`;

  for (const child of children) {
    if (child.text === '{paragraph}') {
      for (const item of child.children) {
        out += `${t(5)}<p>\n${t(6)}${item.text}\n${t(5)}</p>\n`;
      }
    }
  }

  out += `${t(4)}</section>\n${t(3)}</div>\n`;
  return out;
}

/**
 * `--indent` の入力値を解析して単位インデント文字列（indentUnit）を設定
 */
function setIndentOption(val: string): void {
  if (val.toLowerCase() === 'tab' || val === '\\t' || val === '\t') {
    indentUnit = '\t';
  } else {
    const num = parseInt(val, 10);
    if (!isNaN(num) && num >= 0) {
      indentUnit = ' '.repeat(num);
    } else {
      console.warn(`[Warning] 無効なインデント指定 "${val}" です。デフォルト (スペース 4個) を使用します。`);
    }
  }
}

// 指定した数のタブ文字を返す
function t(n: number): string {
  return indentUnit.repeat(n);
}

/**
 * ヘルプメッセージの表示
 */
function showHelp(): void {
  console.log(`
使用方法:
  npx ts-node converter.ts [options] [input.md] [output.html]

引数:
  input.md              変換対象のマークダウンファイル (デフォルト: input.md)
  output.html           出力先のHTMLファイル (デフォルト: output.html)

オプション:
  -i, --indent <num|tab> インデントを指定します (デフォルト: 4)
                        ・数値 (例: -i 2) : 指定した個数のスペース
                        ・'tab' (例: -i tab) : タブ文字 (\\t)
  -v, --verbose         AST構造のログを出力します
  -h, --help            ヘルプメッセージを表示します
`);
}

/**
 * CLI引数の解析処理
 */
function parseArgs(args: string[]): {
  verbose: boolean;
  inputFile: string;
  outputFile: string;
} {
  let verbose = false;
  const positionalArgs: string[] = [];

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--help' || arg === '-h') {
      showHelp();
      process.exit(0);
    } else　if (arg === '--verbose' || arg === '-v') {
      verbose = true;
    } else if (arg === '--indent' || arg === '-i') {
      const val = args[++i]; // 次の要素を値として取得
      if (val) {
        setIndentOption(val);
      }
    } else if (!arg.startsWith('-')) {
      positionalArgs.push(arg);
    }
  }

  const inputFile = positionalArgs[0] || 'input.md';
  const outputFile = positionalArgs[1] || 'output.html';

  return { verbose, inputFile, outputFile };
}

// --- メイン実行処理 ---
function main() {
  const { verbose, inputFile, outputFile } = parseArgs(process.argv.slice(2));

  const inputPath = path.resolve(process.cwd(), inputFile);
  const outputPath = path.resolve(process.cwd(), outputFile);

  if (!fs.existsSync(inputPath)) {
    console.error(`エラー: ファイルが見つかりません: ${inputPath}`);
    process.exit(1);
  }

  const markdownText = fs.readFileSync(inputPath, 'utf-8');
  const ast = buildAST(markdownText);

  if (verbose) {
    console.log('=== AST Structure ===');
    printAST(ast);
    console.log('=====================\n');
  }

  const resultHtml = renderHTML(ast);

  fs.writeFileSync(outputPath, resultHtml, 'utf-8');
  console.log(`✅ 変換完了: ${outputFile}`);
}

main();