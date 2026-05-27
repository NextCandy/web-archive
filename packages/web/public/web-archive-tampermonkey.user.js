// ==UserScript==
// @name         Web Archive 网页剪藏
// @namespace    https://github.com/NextCandy/web-archive
// @version      1.1.0-pi
// @description  一键保存网页到树莓派 Web Archive，支持 iOS/Android 手机端油猴插件
// @author       MeArchive / Web Archive Pi
// @match        http://*/*
// @match        https://*/*
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_registerMenuCommand
// @grant        GM_xmlhttpRequest
// @grant        GM_addStyle
// @connect      *
// @run-at       document-idle
// @noframes
// ==/UserScript==

/* eslint-disable */
(function () {
  'use strict';

  var KEY_SERVER = 'wa_server';
  var KEY_TOKEN = 'wa_token';
  var KEY_FOLDER = 'wa_folder';
  var KEY_TAGS = 'wa_tags';
  var KEY_SHOW_BTN = 'wa_show_btn';

  var DEFAULT_SERVER = 'http://192.168.50.180:48787';
  var FAB_ID = 'wa-fab';
  var TOAST_ID = 'wa-toast';

  function cfg() {
    return {
      server: String(GM_getValue(KEY_SERVER, DEFAULT_SERVER)).trim().replace(/\/$/, ''),
      token: String(GM_getValue(KEY_TOKEN, '')).trim(),
      folder: String(GM_getValue(KEY_FOLDER, '0')).trim(),
      tags: String(GM_getValue(KEY_TAGS, '')).trim(),
      showBtn: GM_getValue(KEY_SHOW_BTN, true),
    };
  }

  function promptSet(key, label, fallback) {
    var cur = String(GM_getValue(key, fallback || '')).trim();
    var value = window.prompt(label, cur);
    if (value !== null) {
      GM_setValue(key, value.trim());
      window.alert('已保存');
    }
  }

  function removeArchiveUi() {
    var fab = document.getElementById(FAB_ID);
    var toast = document.getElementById(TOAST_ID);
    if (fab) fab.remove();
    if (toast) toast.remove();
  }

  function grabHtml() {
    removeArchiveUi();
    var dt = document.doctype;
    var doctype = dt
      ? '<!DOCTYPE ' + dt.name + (dt.publicId ? ' PUBLIC "' + dt.publicId + '"' : '') + (dt.systemId ? ' "' + dt.systemId + '"' : '') + '>'
      : '<!DOCTYPE html>';
    return doctype + '\n' + document.documentElement.outerHTML;
  }

  function getMeta() {
    var el = document.querySelector('meta[name="description"]');
    return el ? (el.getAttribute('content') || '') : '';
  }

  function safeFileName(value) {
    return String(value || 'web-archive')
      .replace(/[<>:"/\\|?*\u0000-\u001F]/g, '_')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 80) || 'web-archive';
  }

  function save() {
    var c = cfg();
    if (!c.server || !c.token) {
      showToast('请先设置服务地址和 Token', 'warn');
      return;
    }

    var html = grabHtml();
    var title = document.title || location.href;
    var tags = c.tags ? c.tags.split(',').map(function (tag) { return tag.trim(); }).filter(Boolean) : [];
    showToast('正在保存...', 'info');

    var fd = new FormData();
    fd.append('title', title);
    fd.append('pageUrl', location.href);
    fd.append('pageDesc', getMeta());
    fd.append('folderId', c.folder || '0');
    fd.append('bindTags', JSON.stringify(tags));
    fd.append('isShowcased', '0');
    fd.append('pageFile', new Blob([html], { type: 'text/html' }), safeFileName(title) + '.html');

    GM_xmlhttpRequest({
      method: 'POST',
      url: c.server + '/api/pages/upload_new_page',
      headers: { Authorization: 'Bearer ' + c.token },
      data: fd,
      timeout: 300000,
      onload: function (response) {
        try {
          var payload = JSON.parse(response.responseText);
          if (response.status >= 200 && response.status < 300 && payload && payload.code === 200) {
            showToast('保存成功', 'ok');
          }
          else {
            showToast((payload && payload.message) || response.statusText || '保存失败', 'err');
          }
        }
        catch (error) {
          showToast(response.responseText || response.statusText || '保存失败', 'err');
        }
        if (cfg().showBtn) createFab();
      },
      onerror: function () {
        showToast('网络错误', 'err');
        if (cfg().showBtn) createFab();
      },
      ontimeout: function () {
        showToast('请求超时', 'err');
        if (cfg().showBtn) createFab();
      },
    });
  }

  GM_addStyle(
    '#' + FAB_ID + '{' +
    'position:fixed;bottom:80px;right:16px;z-index:2147483647;' +
    'width:48px;height:48px;border-radius:50%;border:none;' +
    'background:#2563eb;color:#fff;' +
    'font-size:22px;line-height:48px;text-align:center;cursor:pointer;' +
    'box-shadow:0 4px 14px rgba(37,99,235,.35);' +
    'user-select:none;-webkit-user-select:none;' +
    'touch-action:none;opacity:.9;transition:opacity .2s,transform .2s;' +
    '}' +
    '#' + FAB_ID + ':active{transform:scale(.92);}' +
    '#' + TOAST_ID + '{' +
    'position:fixed;top:0;left:0;right:0;z-index:2147483647;' +
    'display:flex;justify-content:center;pointer-events:none;' +
    '}' +
    '#' + TOAST_ID + ' .wa-msg{' +
    'margin-top:max(env(safe-area-inset-top,12px),12px);' +
    'padding:10px 18px;border-radius:12px;font-size:14px;line-height:1.4;' +
    'color:#fff;max-width:80vw;text-align:center;pointer-events:auto;' +
    'box-shadow:0 8px 22px rgba(15,23,42,.22);animation:wa-fade .25s ease;' +
    '}' +
    '.wa-msg.ok{background:rgba(22,163,74,.92);}' +
    '.wa-msg.err,.wa-msg.warn{background:rgba(220,38,38,.92);}' +
    '.wa-msg.info{background:rgba(37,99,235,.92);}' +
    '@keyframes wa-fade{from{opacity:0;transform:translateY(-8px);}to{opacity:1;transform:none;}}'
  );

  function ensureToastContainer() {
    var box = document.getElementById(TOAST_ID);
    if (box) return box;
    box = document.createElement('div');
    box.id = TOAST_ID;
    document.body.appendChild(box);
    return box;
  }

  function createFab() {
    if (!document.body || document.getElementById(FAB_ID)) return;
    var btn = document.createElement('div');
    btn.id = FAB_ID;
    btn.textContent = '📌';
    btn.title = 'Web Archive 剪藏';

    var sx;
    var sy;
    var ox;
    var oy;
    var moved;

    function start(event) {
      var point = event.touches ? event.touches[0] : event;
      sx = point.clientX;
      sy = point.clientY;
      var rect = btn.getBoundingClientRect();
      ox = rect.left;
      oy = rect.top;
      moved = false;
    }

    function move(event) {
      var point = event.touches ? event.touches[0] : event;
      var dx = point.clientX - sx;
      var dy = point.clientY - sy;
      if (Math.abs(dx) > 5 || Math.abs(dy) > 5) moved = true;
      if (!moved) return;
      event.preventDefault();
      var nx = Math.max(0, Math.min(window.innerWidth - 48, ox + dx));
      var ny = Math.max(0, Math.min(window.innerHeight - 48, oy + dy));
      btn.style.left = nx + 'px';
      btn.style.top = ny + 'px';
      btn.style.right = 'auto';
      btn.style.bottom = 'auto';
    }

    function end() {
      if (!moved) save();
    }

    btn.addEventListener('touchstart', start, { passive: true });
    btn.addEventListener('touchmove', move, { passive: false });
    btn.addEventListener('touchend', end);
    btn.addEventListener('mousedown', start);
    btn.addEventListener('mousemove', move);
    btn.addEventListener('mouseup', end);

    document.body.appendChild(btn);
    ensureToastContainer();
  }

  function showToast(message, type) {
    if (!document.body) return window.alert(message);
    var box = ensureToastContainer();
    var el = document.createElement('div');
    el.className = 'wa-msg ' + (type || 'info');
    el.textContent = message;
    box.appendChild(el);
    setTimeout(function () { el.remove(); }, 3000);
  }

  if (cfg().showBtn) {
    if (document.readyState === 'complete') createFab();
    else window.addEventListener('load', createFab);
  }

  GM_registerMenuCommand('保存当前网页', save);
  GM_registerMenuCommand('设置服务地址', function () {
    promptSet(KEY_SERVER, '请输入 Web Archive 服务地址\n例如 ' + DEFAULT_SERVER, DEFAULT_SERVER);
  });
  GM_registerMenuCommand('设置 Token', function () {
    promptSet(KEY_TOKEN, '请输入访问 Token（Web 端登录用的管理员 Token）');
  });
  GM_registerMenuCommand('设置默认文件夹 ID', function () {
    promptSet(KEY_FOLDER, '请输入默认文件夹 ID（数字，0=根目录）', '0');
  });
  GM_registerMenuCommand('设置默认标签', function () {
    promptSet(KEY_TAGS, '请输入默认标签（多个用英文逗号分隔）');
  });
  GM_registerMenuCommand('切换浮动按钮显示', function () {
    var show = !GM_getValue(KEY_SHOW_BTN, true);
    GM_setValue(KEY_SHOW_BTN, show);
    if (show) createFab();
    else removeArchiveUi();
    window.alert('浮动按钮: ' + (show ? '显示' : '隐藏') + '\n刷新页面后完全生效');
  });
})();
