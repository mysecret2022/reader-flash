/**
 * reader-flash 动态中文字体切片按需加载引擎
 * 默认使用系统原生字体（0 流量、0 白屏、秒级冷启）
 * 仅在用户主动点选书法字体时才按需异步注入切片 CSS，兼顾极致性能与书法排版美学
 */

export const FONT_OPTIONS = [
  { id: 0, name: '系统原生 (极速0流量)', family: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif', cssPath: null },
  { id: 1, name: '霞鹜文楷 (出版级典雅)', family: '"LXGW WenKai", "霞鹜文楷", kaiti, STKaiti, KaiTi, serif', cssPath: '/fonts/kaiti/kaiti.css' },
  { id: 2, name: '思源宋体 (纸书韵味)', family: '"Noto Serif SC", "思源宋体", songti, SimSun, serif', cssPath: '/fonts/songti/songti.css' },
  { id: 3, name: '清秀手书 (舒心随性)', family: '"ShouTi", cursive, serif', cssPath: '/fonts/shouti/shouti.css' }
];

const LINK_ID = 'reader-flash-font-slice';

export function applyFont(fontId) {
  const selected = FONT_OPTIONS.find(f => f.id === Number(fontId)) || FONT_OPTIONS[0];

  let existingLink = document.getElementById(LINK_ID);

  if (selected.cssPath) {
    if (!existingLink) {
      existingLink = document.createElement('link');
      existingLink.id = LINK_ID;
      existingLink.rel = 'stylesheet';
      existingLink.type = 'text/css';
      document.head.appendChild(existingLink);
    }
    if (existingLink.getAttribute('href') !== selected.cssPath) {
      existingLink.setAttribute('href', selected.cssPath);
    }
  } else {
    // 选回系统原生字体时，卸载切片链接释放资源
    if (existingLink && existingLink.parentNode) {
      existingLink.parentNode.removeChild(existingLink);
    }
  }

  // 设置 CSS 变量，供正文和界面即时继承
  document.documentElement.style.setProperty('--reader-font-family', selected.family);
  return selected;
}
