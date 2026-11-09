/**
 * reader-flash 唯美金句书摘卡片生成器
 * 纯客户端 2x Retina 高清 Canvas 离屏渲染
 * 支持【拍立得质感】与【极简毛玻璃名片】双模板，支持长按或一键下载高清图片
 */

export async function generateQuoteCard({
  quoteText = '',
  bookName = '未知书目',
  author = '',
  chapterTitle = '',
  template = 'polaroid', // 'polaroid' | 'business_card'
  isDark = false
}) {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  const dpr = 2; // 2x 高清

  const width = 640;
  const padding = template === 'polaroid' ? 48 : 40;
  const contentWidth = width - padding * 2;

  // 测量并排版文字
  ctx.font = '22px "LXGW WenKai", "霞鹜文楷", kaiti, STKaiti, serif';
  const lineHeight = 38;
  const lines = wrapText(ctx, quoteText, contentWidth);

  // 动态计算卡片高度
  const textBlockHeight = lines.length * lineHeight;
  const headerHeight = template === 'polaroid' ? 80 : 60;
  const footerHeight = template === 'polaroid' ? 140 : 100;
  const height = Math.max(480, headerHeight + textBlockHeight + footerHeight);

  canvas.width = width * dpr;
  canvas.height = height * dpr;
  ctx.scale(dpr, dpr);

  if (template === 'polaroid') {
    // 1. 拍立得经典相纸模板
    drawPolaroid(ctx, width, height, padding, lines, lineHeight, bookName, author, chapterTitle, isDark);
  } else {
    // 2. 极简毛玻璃微光名片
    drawBusinessCard(ctx, width, height, padding, lines, lineHeight, bookName, author, chapterTitle, isDark);
  }

  return canvas.toDataURL('image/png');
}

function wrapText(ctx, text, maxWidth) {
  const words = text.split('');
  const lines = [];
  let currentLine = '';

  for (let i = 0; i < words.length; i++) {
    const testLine = currentLine + words[i];
    const metrics = ctx.measureText(testLine);
    if (metrics.width > maxWidth && i > 0) {
      lines.push(currentLine);
      currentLine = words[i];
    } else {
      currentLine = testLine;
    }
  }
  if (currentLine) {
    lines.push(currentLine);
  }
  return lines;
}

function drawPolaroid(ctx, w, h, pad, lines, lh, bookName, author, chapterTitle, isDark) {
  // 底色与纸质纹理
  const bgColor = isDark ? '#1e293b' : '#faf8f5';
  const textColor = isDark ? '#e2e8f0' : '#27272a';
  const subColor = isDark ? '#94a3b8' : '#71717a';
  const borderColor = isDark ? '#334155' : '#e4e4e7';

  // 相纸白边
  ctx.fillStyle = bgColor;
  ctx.fillRect(0, 0, w, h);

  // 相纸相框内阴影微框
  ctx.strokeStyle = borderColor;
  ctx.lineWidth = 1;
  ctx.strokeRect(16, 16, w - 32, h - 32);

  // 优雅双引号标识
  ctx.fillStyle = isDark ? 'rgba(52, 211, 153, 0.4)' : 'rgba(16, 185, 129, 0.3)';
  ctx.font = 'bold 56px Georgia, serif';
  ctx.fillText('“', pad, pad + 32);

  // 金句正文排版（典雅文楷）
  ctx.fillStyle = textColor;
  ctx.font = '22px "LXGW WenKai", "霞鹜文楷", kaiti, STKaiti, serif';
  let y = pad + 60;
  for (const line of lines) {
    ctx.fillText(line, pad, y);
    y += lh;
  }

  // 右下角闭合双引号
  ctx.fillStyle = isDark ? 'rgba(52, 211, 153, 0.4)' : 'rgba(16, 185, 129, 0.3)';
  ctx.font = 'bold 56px Georgia, serif';
  ctx.fillText('”', w - pad - 28, y + 10);

  // 分隔虚线
  const lineY = h - 110;
  ctx.strokeStyle = isDark ? '#334155' : '#e2e8f0';
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  ctx.moveTo(pad, lineY);
  ctx.lineTo(w - pad, lineY);
  ctx.stroke();
  ctx.setLineDash([]);

  // 书籍与章节出处信息
  ctx.fillStyle = isDark ? '#34d399' : '#059669';
  ctx.font = 'bold 18px "LXGW WenKai", "霞鹜文楷", kaiti, serif';
  ctx.fillText(`《${bookName}》`, pad, lineY + 36);

  ctx.fillStyle = subColor;
  ctx.font = '14px system-ui, sans-serif';
  const metaText = [author ? `作者: ${author}` : '', chapterTitle].filter(Boolean).join(' · ');
  ctx.fillText(metaText, pad, lineY + 62);

  // 极简印章水印
  ctx.fillStyle = isDark ? '#64748b' : '#a1a1aa';
  ctx.font = '12px system-ui, sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText('reader-flash 甄选书摘', w - pad, lineY + 62);
  ctx.textAlign = 'left';
}

function drawBusinessCard(ctx, w, h, pad, lines, lh, bookName, author, chapterTitle, isDark) {
  // 极光渐变深色背景
  const grad = ctx.createLinearGradient(0, 0, w, h);
  if (isDark) {
    grad.addColorStop(0, '#0f172a');
    grad.addColorStop(1, '#022c22');
  } else {
    grad.addColorStop(0, '#f8fafc');
    grad.addColorStop(1, '#ecfdf5');
  }
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  // 微光边框
  ctx.strokeStyle = isDark ? 'rgba(52, 211, 153, 0.25)' : 'rgba(16, 185, 129, 0.3)';
  ctx.lineWidth = 2;
  ctx.strokeRect(1, 1, w - 2, h - 2);

  // 极光薄荷荧光光晕小点
  ctx.fillStyle = '#10b981';
  ctx.beginPath();
  ctx.arc(pad, pad + 10, 4, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = isDark ? '#94a3b8' : '#059669';
  ctx.font = 'bold 13px system-ui, sans-serif';
  ctx.fillText('EXCERPT · 阅读随想', pad + 14, pad + 15);

  // 正文
  ctx.fillStyle = isDark ? '#f1f5f9' : '#0f172a';
  ctx.font = '22px "LXGW WenKai", "霞鹜文楷", kaiti, serif';
  let y = pad + 60;
  for (const line of lines) {
    ctx.fillText(line, pad, y);
    y += lh;
  }

  // 底部极简卡片标签
  const bottomY = h - 60;
  ctx.fillStyle = isDark ? '#e2e8f0' : '#1e293b';
  ctx.font = 'bold 16px "LXGW WenKai", "霞鹜文楷", kaiti, serif';
  ctx.fillText(`《${bookName}》`, pad, bottomY);

  ctx.fillStyle = isDark ? '#64748b' : '#64748b';
  ctx.font = '13px system-ui, sans-serif';
  ctx.fillText(chapterTitle || (author ? `作: ${author}` : ''), pad, bottomY + 22);

  ctx.textAlign = 'right';
  ctx.fillStyle = isDark ? '#34d399' : '#059669';
  ctx.fillText('✦ reader-flash', w - pad, bottomY + 22);
  ctx.textAlign = 'left';
}
