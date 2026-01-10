// MarkdownファイルをHTMLに変換して表示するスクリプト

function convertMarkdown() {
  // Chromeがテキストファイルとして表示している場合、
  // 内容は通常 <pre> タグの中ラップされているか、あるいは body 直下にテキストとして存在します。
  // Chromeの仕様上、ローカルファイルを開くと <pre style="word-wrap: break-word; white-space: pre-wrap;">...</pre> となることが多いです。

  const pre = document.querySelector('body > pre');
  let markdownText = '';

  if (pre) {
    markdownText = pre.innerText;
  } else {
    // preがない場合（念のため）、bodyのテキストを取得
    markdownText = document.body.innerText;
  }

  // marked.js は manifest.json で読み込まれているため、グローバルに `marked` が存在することを期待します。
  if (typeof marked === 'undefined') {
    console.error('Error: marked object is not found. marked.js might have failed to load.');
    return;
  }

  // markedの設定（必要に応じてオプションを追加）
  // Custom renderer to add file extensions to links
  const renderer = new marked.Renderer();
  const originalLink = renderer.link.bind(renderer);

  renderer.link = (href, title, text) => {
    // 拡張子を取得する簡易ロジック
    // URLでない、かつ末尾がスラッシュでない、かつHTML系でない場合に拡張子を表示
    try {
      // URLオブジェクトにしてパス部分のみを検証（相対パス対応のためダミーオリジンを使用）
      const url = new URL(href, 'http://dummy.com');
      const pathname = url.pathname;

      // 最後がスラッシュで終わる場合はディレクトリとみなしてスキップ
      if (!pathname.endsWith('/')) {
        const parts = pathname.split('.');
        if (parts.length > 1) {
          const ext = parts.pop().toLowerCase();
          // 表示しない拡張子リスト（Web標準的なもの）
          const ignoreExts = ['html', 'htm', 'php', 'jsp', 'asp', 'aspx'];

          if (!ignoreExts.includes(ext)) {
            // テキストに既に [ext] が含まれていないか確認（念のため）
            const extLabel = `[${ext}]`;
            if (!text.includes(extLabel)) {
              return `<a href="${href}" title="${title || ''}">${text} <span class="file-ext">${extLabel}</span></a>`;
            }
          }
        }
      }
    } catch (e) {
      // URL解析エラー等の場合は何もしない
      console.error('URL parsing error', e);
    }

    return originalLink(href, title, text);
  };

  marked.use({ renderer });

  // HTMLに変換
  // 相対パス（画像など）を正しく解決するために baseUrl を設定する
  const currentUrl = window.location.href;
  const baseUrl = currentUrl.substring(0, currentUrl.lastIndexOf('/') + 1);

  // [Pre-process]
  // 画像ファイル名にスペースが含まれていると marked.js が正しく認識しない場合があるため、
  // ![]() の中身のスペースを %20 に置換しておく
  // 簡易的な正規表現: !\[任意の文字\]\(任意の文字\)
  const preProcessedText = markdownText.replace(/!\[(.*?)\]\((.*?)\)/g, (match, alt, src) => {
    // srcの中にスペースがあればエンコード
    if (src.includes(' ')) {
      const encodedSrc = src.trim().split(' ').join('%20');
      return `![${alt}](${encodedSrc})`;
    }
    return match;
  });

  const htmlContent = marked.parse(preProcessedText, { baseUrl: baseUrl });

  // ページの書き換え
  // github-markdown-css を適用するために .markdown-body クラスを持つコンテナでラップします。
  // スタイルを見やすくするために、viewportの設定なども追加したほうが良いですが、
  // Content Scriptでは head の操作も可能です。

  document.body.innerHTML = `
    <div class="main-container">
      <div class="markdown-body">
        ${htmlContent}
      </div>
    </div>
  `;

  // タイトルをファイル名などに設定すると親切かもしれないが、今回はシンプルに。
  document.title = 'Markdown Viewer';

  // コピーボタンを追加
  addCopyButtons();

  // 目次を生成
  generateTOC();

  // テーマ機能の初期化
  initTheme();
}

function initTheme() {
  // 保存されたテーマを取得 (デフォルトは light)
  const savedTheme = localStorage.getItem('mdviewer-theme') || 'light';
  applyTheme(savedTheme);

  // トグルボタンを作成
  const btn = document.createElement('div');
  btn.className = 'theme-toggle-btn';
  updateThemeIcon(btn, savedTheme);

  btn.addEventListener('click', () => {
    const currentTheme = document.body.classList.contains('theme-dark') ? 'dark' : 'light';
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    applyTheme(newTheme);
    updateThemeIcon(btn, newTheme);
    localStorage.setItem('mdviewer-theme', newTheme);
  });

  document.body.appendChild(btn);
}

function applyTheme(theme) {
  const lightId = 'theme-css-light';
  const darkId = 'theme-css-dark';

  // 既存のタグを探す
  let lightLink = document.getElementById(lightId);
  let darkLink = document.getElementById(darkId);

  // Chrome ExtensionのURLを取得
  const lightUrl = chrome.runtime.getURL('github-markdown-light.css');
  const darkUrl = chrome.runtime.getURL('github-markdown-dark.css');

  if (theme === 'dark') {
    document.body.classList.add('theme-dark');
    document.body.classList.remove('theme-light');

    // Dark用CSSを読み込む
    if (!darkLink) {
      darkLink = document.createElement('link');
      darkLink.id = darkId;
      darkLink.rel = 'stylesheet';
      darkLink.href = darkUrl;
      document.head.appendChild(darkLink);
    }

    // Light用は削除 (競合回避のため)
    if (lightLink) {
      lightLink.remove();
    }

  } else {
    document.body.classList.remove('theme-dark');
    document.body.classList.add('theme-light');

    // Light用CSSを読み込む
    if (!lightLink) {
      lightLink = document.createElement('link');
      lightLink.id = lightId;
      lightLink.rel = 'stylesheet';
      lightLink.href = lightUrl;
      document.head.appendChild(lightLink);
    }

    // Dark用は削除
    if (darkLink) {
      darkLink.remove();
    }
  }
}

function updateThemeIcon(btn, theme) {
  // 月と太陽のアイコン (Unicode)
  // 🌙 (Moon): &#x1F319; 
  // ☀️ (Sun): &#x2600;&#xFE0F;
  if (theme === 'dark') {
    btn.innerHTML = '&#x1F319;'; // Moon
  } else {
    btn.innerHTML = '&#x2600;&#xFE0F;'; // Sun
  }
}

function generateTOC() {
  const headings = document.querySelectorAll('h1, h2, h3, h4, h5, h6');
  if (headings.length === 0) return;

  const sidebar = document.createElement('div');
  sidebar.className = 'toc-sidebar';

  const title = document.createElement('h2');
  title.innerText = 'Table of Contents';
  sidebar.appendChild(title);

  const list = document.createElement('ul');
  list.className = 'toc-list';

  headings.forEach((heading, index) => {
    // IDがない場合は自動付与
    if (!heading.id) {
      heading.id = `heading-${index}`;
    }

    const li = document.createElement('li');
    li.className = `toc-item toc-level-${heading.tagName[1]}`;

    // リンククリック時のスクロール位置調整などはCSSかここで制御
    const a = document.createElement('a');
    a.href = `#${heading.id}`;
    a.innerText = heading.innerText;

    li.appendChild(a);
    list.appendChild(li);
  });

  sidebar.appendChild(list);
  document.body.appendChild(sidebar);
}

function addCopyButtons() {
  const blocks = document.querySelectorAll('pre');
  blocks.forEach(block => {
    // 既にボタンがある場合はスキップ（念のため）
    if (block.querySelector('.copy-button')) return;

    const button = document.createElement('button');
    button.className = 'copy-button';
    button.textContent = 'Copy';
    button.type = 'button';
    button.addEventListener('click', () => {
      const code = block.querySelector('code');
      const text = code ? code.innerText : block.innerText;

      navigator.clipboard.writeText(text).then(() => {
        const originalText = button.textContent;
        button.textContent = 'Copied!';
        button.classList.add('success');
        setTimeout(() => {
          button.textContent = originalText;
          button.classList.remove('success');
        }, 2000);
      }).catch(err => {
        console.error('Failed to copy: ', err);
        button.textContent = 'Error';
      });
    });

    block.appendChild(button);
  });
}

// DOMContentLoaded などを待つ必要性について:
// "run_at": "document_idle" がデフォルトなので、DOMは構築済みのはず。
convertMarkdown();
