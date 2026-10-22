/* app.js - Giao diện ứng dụng Xếp loại HTX nông nghiệp (không cần máy chủ, dữ liệu lưu trên thiết bị) */
(function () {
  'use strict';

  var KEY = 'htx-app-v1';
  var LINH_VUC = ['Trồng trọt', 'Chăn nuôi', 'Lâm nghiệp', 'Thủy sản', 'Diêm nghiệp', 'Nước sạch nông thôn', 'Nông nghiệp tổng hợp'];
  var CLASSES = ['tot', 'kha', 'tb', 'yeu', 'none'];
  var DEF_YEAR = new Date().getFullYear() - 1; // hằng năm đánh giá kết quả của năm trước

  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  var nfmt = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 2 });
  function nf(x) { return nfmt.format(x); }
  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }

  /* ---------- Dữ liệu ---------- */
  function fresh() { return { ver: 1, year: DEF_YEAR, htx: [], evals: {}, dels: [] }; }
  function load() {
    try {
      var d = JSON.parse(localStorage.getItem(KEY));
      if (d && Array.isArray(d.htx)) return Object.assign(fresh(), d, { evals: d.evals || {} });
    } catch (e) { /* bỏ qua */ }
    return fresh();
  }
  var S = load();
  var SYNC = loadSync();
  function loadSync() {
    var d; try { d = JSON.parse(localStorage.getItem('htx-sync-v1')); } catch (e) { /* bỏ qua */ }
    return Object.assign({ url: '', key: '', by: '', auto: true, since: '', last: '', err: '' }, d || {});
  }
  function saveSync() { try { localStorage.setItem('htx-sync-v1', JSON.stringify(SYNC)); } catch (e) { /* bỏ qua */ } }
  var ui = { tab: 'dash', q: '', xa: '', cls: '', evalId: null };
  var saveTimer = null;

  function saveNow() {
    clearTimeout(saveTimer);
    try { localStorage.setItem(KEY, JSON.stringify(S)); }
    catch (e) { toast('Không lưu được dữ liệu (bộ nhớ thiết bị đầy hoặc bị chặn).'); }
    updateSyncBtn();
    if (SYNC.auto && syncReady() && pendingCount()) scheduleAuto(20000);
  }
  function save() { clearTimeout(saveTimer); saveTimer = setTimeout(saveNow, 300); }
  window.addEventListener('pagehide', saveNow);
  document.addEventListener('visibilitychange', function () { if (document.hidden) saveNow(); });

  function evKey(id, year) { return id + '|' + (year || S.year); }
  function getEv(id) { return S.evals[evKey(id)]; }
  function getHtx(id) { return S.htx.filter(function (h) { return h.id === id; })[0]; }

  function status(h) {
    var ev = getEv(h.id);
    if (!ev) return { k: 'chua', label: 'Chưa chấm', r: null };
    var r = Scoring.scoreEvaluation(ev);
    if (!r.final) return { k: 'dang', label: 'Đang nhập', r: r };
    return { k: r.rank, label: r.rankShort, r: r };
  }

  /* ---------- Tiện ích giao diện ---------- */
  var toastTimer;
  function toast(msg) {
    var t = $('#toast'); t.textContent = msg; t.classList.add('on');
    clearTimeout(toastTimer); toastTimer = setTimeout(function () { t.classList.remove('on'); }, 2600);
  }
  function badge(k, label) { return '<span class="badge ' + k + '">' + esc(label) + '</span>'; }

  function fillYearSelect() {
    var sel = $('#yearSel'), cy = new Date().getFullYear(), html = '';
    var from = Math.min(2024, S.year), to = Math.max(cy, S.year);
    for (var y = to; y >= from; y--) html += '<option value="' + y + '"' + (y === S.year ? ' selected' : '') + '>' + y + '</option>';
    sel.innerHTML = html;
  }

  function xaList() {
    var m = {};
    S.htx.forEach(function (h) { if (h.xa) m[h.xa.trim()] = 1; });
    return Object.keys(m).sort(function (a, b) { return a.localeCompare(b, 'vi'); });
  }

  /* ---------- Điều hướng ---------- */
  function go(tab, id) {
    ui.tab = tab; ui.evalId = id || null;
    render(); window.scrollTo(0, 0);
  }
  function render() {
    $$('#nav button').forEach(function (b) {
      var t = b.getAttribute('data-tab');
      b.classList.toggle('on', t === ui.tab || (ui.tab === 'eval' && t === 'list'));
    });
    var v = $('#view');
    if (ui.tab === 'dash') v.innerHTML = viewDash();
    else if (ui.tab === 'list') { v.innerHTML = viewList(); renderListBody(); }
    else if (ui.tab === 'eval') { v.innerHTML = viewEval(); updateScores(); }
    else v.innerHTML = viewSettings();
    renderSyncStatus();
  }

  /* ---------- Tab: Tổng hợp ---------- */
  function groupStats() {
    var by = {};
    S.htx.forEach(function (h) {
      var xa = (h.xa || '').trim() || '(Chưa ghi xã)';
      var g = by[xa] || (by[xa] = { xa: xa, n: 0, tot: 0, kha: 0, tb: 0, yeu: 0, none: 0, chua: 0, sum: 0, cnt: 0 });
      var st = status(h); g.n++;
      if (CLASSES.indexOf(st.k) >= 0) {
        g[st.k]++;
        if (st.k !== 'none') { g.sum += st.r.total; g.cnt++; }
      } else g.chua++;
    });
    return Object.keys(by).map(function (k) { return by[k]; })
      .sort(function (a, b) { return a.xa.localeCompare(b.xa, 'vi'); });
  }
  function sumGroups(gs) {
    var t = { xa: 'Toàn tỉnh', n: 0, tot: 0, kha: 0, tb: 0, yeu: 0, none: 0, chua: 0, sum: 0, cnt: 0 };
    gs.forEach(function (g) { Object.keys(t).forEach(function (k) { if (k !== 'xa') t[k] += g[k]; }); });
    return t;
  }

  function viewDash() {
    if (!S.htx.length) {
      return '<div class="card empty"><h2>Chưa có hợp tác xã nào</h2>' +
        '<p>Thêm hợp tác xã đầu tiên, hoặc nạp dữ liệu mẫu để dùng thử.</p>' +
        '<div class="btnrow" style="justify-content:center">' +
        '<button class="btn primary" data-act="add-htx">+ Thêm HTX</button>' +
        '<button class="btn" data-act="demo">Nạp dữ liệu mẫu</button></div></div>';
    }
    var gs = groupStats(), t = sumGroups(gs);
    var h = '<div class="cards">' +
      stat('all', t.n, 'Tổng số HTX') +
      stat('tot', t.tot, 'Hoạt động tốt') + stat('kha', t.kha, 'Hoạt động khá') +
      stat('tb', t.tb, 'Trung bình') + stat('yeu', t.yeu, 'Yếu') +
      stat('none', t.none, 'Không xếp loại') + stat('', t.chua, 'Chưa chấm xong') + '</div>';

    h += '<div class="card"><h2>Tổng hợp xếp loại theo xã - năm ' + S.year + '</h2><div class="tablewrap"><table><thead><tr>' +
      '<th>Xã / phường</th><th>Số HTX</th><th>Tốt</th><th>Khá</th><th>TB</th><th>Yếu</th><th>Không XL</th><th>Chưa xong</th><th>Điểm TB</th></tr></thead><tbody>';
    gs.forEach(function (g) { h += trow(g); });
    h += '</tbody><tfoot>' + trow(t) + '</tfoot></table></div>' +
      '<p class="note">Điểm TB tính trên các HTX đã xếp loại (không gồm HTX không xếp loại). Đây là nội dung báo cáo theo Bước 4 và Bước 5 (Điều 5).</p>' +
      '<div class="btnrow"><button class="btn primary" data-act="export-sum">Xuất bảng tổng hợp (CSV)</button>' +
      '<button class="btn" data-act="export-detail">Xuất chi tiết từng HTX (CSV)</button></div></div>';

    h += '<div class="card"><h2>Cơ cấu xếp loại theo xã</h2><div class="bars">';
    gs.forEach(function (g) {
      var seg = function (k, c) { return g[k] ? '<i class="' + c + '" style="width:' + (g[k] / g.n * 100) + '%" title="' + g[k] + '"></i>' : ''; };
      h += '<div class="bar"><span class="lbl">' + esc(g.xa) + '</span><div class="trk">' +
        seg('tot', 'c-tot') + seg('kha', 'c-kha') + seg('tb', 'c-tb') + seg('yeu', 'c-yeu') + seg('none', 'c-none') + seg('chua', 'c-chua') +
        '</div><b>' + g.n + '</b></div>';
    });
    h += '</div><div class="legend"><span><i class="c-tot"></i>Tốt</span><span><i class="c-kha"></i>Khá</span><span><i class="c-tb"></i>Trung bình</span>' +
      '<span><i class="c-yeu"></i>Yếu</span><span><i class="c-none"></i>Không xếp loại</span><span><i class="c-chua"></i>Chưa chấm xong</span></div></div>';

    h += '<div class="card"><h2>Lịch thực hiện hằng năm (Điều 5)</h2><ol class="steps small">' +
      '<li><b>Quý I:</b> HĐQT lấy ý kiến hài lòng của thành viên tại đại hội thành viên (Phụ lục 2).</li>' +
      '<li>HĐQT tự chấm điểm, Ban kiểm soát kiểm tra (Phụ lục 3).</li>' +
      '<li><b>Trước 01/4:</b> HTX gửi bảng tự chấm điểm cho UBND cấp xã.</li>' +
      '<li><b>Trước 10/4:</b> UBND cấp xã báo cáo Sở Nông nghiệp và Môi trường.</li>' +
      '<li><b>Đến hết 15/4:</b> HĐQT công khai kết quả cho thành viên (nếu UBND xã không có ý kiến khác).</li>' +
      '<li><b>Trước 15/4:</b> Sở báo cáo Bộ Nông nghiệp và Môi trường (Cục Kinh tế hợp tác và Phát triển nông thôn).</li></ol></div>';
    return h;
  }
  function stat(c, n, l) { return '<div class="stat ' + c + '"><b>' + n + '</b><span>' + l + '</span></div>'; }
  function trow(g) {
    return '<tr><td>' + esc(g.xa) + '</td><td>' + g.n + '</td><td>' + g.tot + '</td><td>' + g.kha + '</td><td>' + g.tb + '</td><td>' + g.yeu +
      '</td><td>' + g.none + '</td><td>' + g.chua + '</td><td>' + (g.cnt ? nf(Math.round(g.sum / g.cnt * 100) / 100) : '–') + '</td></tr>';
  }

  /* ---------- Tab: Danh sách ---------- */
  function viewList() {
    var xs = xaList();
    var h = '<div class="toolbar"><input id="q" type="search" placeholder="Tìm theo tên HTX..." value="' + esc(ui.q) + '">' +
      '<select id="fxa"><option value="">Tất cả xã</option>' + xs.map(function (x) { return '<option' + (x === ui.xa ? ' selected' : '') + '>' + esc(x) + '</option>'; }).join('') + '</select>' +
      '<select id="fcls"><option value="">Mọi trạng thái</option>' +
      [['tot', 'Tốt'], ['kha', 'Khá'], ['tb', 'Trung bình'], ['yeu', 'Yếu'], ['none', 'Không xếp loại'], ['dang', 'Đang nhập'], ['chua', 'Chưa chấm']]
        .map(function (c) { return '<option value="' + c[0] + '"' + (ui.cls === c[0] ? ' selected' : '') + '>' + c[1] + '</option>'; }).join('') + '</select>' +
      '<button class="btn primary" data-act="add-htx">+ Thêm HTX</button></div><div id="listBody"></div>';
    return h;
  }
  function renderListBody() {
    var el = $('#listBody'); if (!el) return;
    var q = ui.q.trim().toLowerCase();
    var rows = S.htx.filter(function (h) {
      if (q && (h.ten || '').toLowerCase().indexOf(q) < 0) return false;
      if (ui.xa && (h.xa || '').trim() !== ui.xa) return false;
      if (ui.cls && status(h).k !== ui.cls) return false;
      return true;
    }).sort(function (a, b) {
      return (a.xa || '').localeCompare(b.xa || '', 'vi') || (a.ten || '').localeCompare(b.ten || '', 'vi');
    });
    if (!rows.length) { el.innerHTML = '<div class="card empty">' + (S.htx.length ? 'Không có HTX phù hợp bộ lọc.' : 'Chưa có HTX nào. Bấm "+ Thêm HTX".') + '</div>'; return; }
    el.innerHTML = rows.map(function (h) {
      var st = status(h);
      return '<div class="item" data-act="open-eval" data-id="' + h.id + '"><div class="main"><b>' + esc(h.ten) + '</b><small>' +
        esc(h.xa || '') + ' · ' + esc(h.linhVuc || '') + '</small></div><div class="pts">' +
        (st.r ? '<b>' + nf(st.r.total) + '</b>' : '') + badge(st.k, st.label) + '</div>' +
        '<button class="btn sm" data-act="view-htx" data-id="' + h.id + '">Xem</button></div>';
    }).join('');
  }

  /* ---------- Chấm điểm một HTX ---------- */
  var YN = [['', '- chọn -'], ['co', 'Có'], ['khong', 'Không']];
  var KT = [['', '- chọn -'], ['none', 'Không được khen thưởng'], ['huyen', 'Được cấp xã khen thưởng'], ['tinh', 'Được cấp tỉnh khen thưởng trở lên']];
  var FORM = [
    { no: 1, rows: [
      { code: '1.a', fields: [['dtThucHien', 'Doanh thu thực hiện trong năm (triệu đồng)'], ['dtKeHoach', 'Doanh thu kế hoạch (triệu đồng)']] },
      { code: '1.b', fields: [], note: 'Tự tính từ "Doanh thu thực hiện" ở trên.' },
      { code: '1.c', fields: [['thuNhap', 'Thu nhập cả năm sau khi hoàn thành nghĩa vụ tài chính (triệu đồng)']], note: 'Chia cho số thành viên ở mục "Thông tin chung". Nếu không có lợi nhuận sau thuế, nhập 0.' },
      { code: '1.d', fields: [['quyPT', 'Số trích quỹ đầu tư phát triển (triệu đồng)']], note: 'Tỷ lệ = số trích quỹ / thu nhập (cùng số thu nhập ở dòng 1.c).' },
      { code: '1.đ', fields: [['quyDP', 'Số trích quỹ dự phòng tài chính / rủi ro (triệu đồng)']], note: 'Tỷ lệ = số trích quỹ / thu nhập (cùng số thu nhập ở dòng 1.c).' }
    ] },
    { no: 2, rows: [
      { code: '2.a', fields: [['uuTienGia', 'Có ưu tiên giá dịch vụ cho thành viên không? (HTX chỉ cung ứng cho thành viên: chọn Có)', 'yn']] },
      { code: '2.b', fields: [['phanPhoiPct', 'Tỷ lệ % thu nhập còn lại (sau khi trích các quỹ) phân phối theo mức độ sử dụng sản phẩm, dịch vụ (hoặc công sức lao động)', 'pct']] }
    ] },
    { no: 3, rows: [
      { code: '3.a', fields: [['vonNamNay', 'Vốn góp và huy động từ thành viên - năm nay (triệu đồng)'], ['vonNamTruoc', 'Vốn góp và huy động từ thành viên - năm trước (triệu đồng)']] },
      { code: '3.b', fields: [['vonHoatDong', 'Vốn hoạt động của HTX (triệu đồng): vốn góp, vốn huy động, vốn tích lũy, các quỹ, trợ cấp/hỗ trợ, tặng cho, nguồn thu hợp pháp khác']] }
    ] },
    { no: 4, rows: [{ code: '4', fields: [], note: 'Tự tính từ "Số thành viên" ở mục Thông tin chung.' }] },
    { no: 5, rows: [{ code: '5', fields: [['khenThuong', 'Mức khen thưởng trong năm', 'kt']] }] },
    { no: 6, rows: [{ code: '6', custom: true }] }
  ];

  function fieldHTML(k, label, kind, ev) {
    var v = ev[k] == null ? '' : ev[k];
    var inner;
    if (kind === 'yn' || kind === 'kt') {
      inner = '<select data-f="' + k + '">' + (kind === 'yn' ? YN : KT).map(function (o) {
        return '<option value="' + o[0] + '"' + (String(v) === o[0] ? ' selected' : '') + '>' + o[1] + '</option>';
      }).join('') + '</select>';
    } else {
      inner = '<input data-f="' + k + '" inputmode="decimal" autocomplete="off" value="' + esc(v) + '"' + (kind === 'pct' ? ' placeholder="0 - 100"' : '') + '>';
    }
    return '<label class="fld"><span>' + esc(label) + '</span>' + inner + '</label>';
  }

  function satHTML(ev) {
    var mode = ev.hlMode === 'tong' ? 'tong' : 'phieu';
    var h = '<div class="seg"><label><input type="radio" name="hlm" data-f="hlMode" value="phieu"' + (mode === 'phieu' ? ' checked' : '') + '><span>Nhập từng phiếu</span></label>' +
      '<label><input type="radio" name="hlm" data-f="hlMode" value="tong"' + (mode === 'tong' ? ' checked' : '') + '><span>Nhập tổng hợp</span></label></div>';
    if (mode === 'tong') {
      h += '<div class="grid">' + fieldHTML('hlCount', 'Số phiếu hợp lệ', '', ev) + fieldHTML('hlSum', 'Tổng điểm của các phiếu hợp lệ (mỗi phiếu tối đa 15 điểm)', '', ev) + '</div>';
    } else {
      var p = ev.phieu || [];
      h += '<div class="ballots"><div class="ballot head"><span></span><span>Thông tin</span><span>Chất lượng</span><span>Kịp thời</span><span></span></div>';
      p.forEach(function (b, i) {
        var bad = !Scoring.validBallot(b) && b.some(function (x) { return x !== ''; });
        h += '<div class="ballot"><span class="muted small">' + (i + 1) + '</span>' + [0, 1, 2].map(function (j) {
          return '<input data-b="' + i + '.' + j + '" inputmode="numeric" maxlength="1" value="' + esc(b[j]) + '"' + (bad ? ' class="bad"' : '') + '>';
        }).join('') + '<button class="x" data-act="del-ballot" data-i="' + i + '" aria-label="Xóa phiếu">✕</button></div>';
      });
      h += '</div><button class="btn sm" data-act="add-ballot">+ Thêm phiếu</button>' +
        '<p class="note">Mỗi phiếu gồm 3 chỉ tiêu, mỗi chỉ tiêu chấm từ 1 đến 5 điểm (Phụ lục 2): (1) cung cấp thông tin, (2) chất lượng sản phẩm và dịch vụ, (3) tính kịp thời. ' +
        'Phiếu thiếu chỉ tiêu hoặc điểm ngoài 1-5 là không hợp lệ và bị loại.</p>';
    }
    return h;
  }

  function viewEval() {
    var h0 = getHtx(ui.evalId);
    if (!h0) return '<div class="card empty">Không tìm thấy HTX.</div>';
    var ev = getEv(h0.id) || {};
    var h = '<div class="topline"><button class="btn ghost sm" data-act="back">← Danh sách</button><h1>' + esc(h0.ten) + '</h1>' +
      '<button class="btn sm" data-act="view-htx" data-id="' + h0.id + '">Xem thông tin HTX</button>' +
      '<button class="btn sm" data-act="edit-htx" data-id="' + h0.id + '">Sửa thông tin</button></div>' +
      '<p class="muted small" style="margin-top:-6px">' + esc(h0.xa || '') + ' · ' + esc(h0.linhVuc || '') + ' · Năm đánh giá <b>' + S.year + '</b> (đổi năm ở góc trên bên phải)</p>';

    h += '<div class="card"><h2>Thông tin chung</h2><div class="grid">' + fieldHTML('soThanhVien', 'Số thành viên hợp tác xã', '', ev) + '</div>' +
      '<label class="chk"><input type="checkbox" data-f="moiThanhLap"' + (ev.moiThanhLap ? ' checked' : '') + '><span>HTX mới thành lập và SXKD chưa đủ 12 tháng trong năm <span class="muted small">(không tự chấm điểm, không xếp loại)</span></span></label>' +
      '<label class="chk"><input type="checkbox" data-f="phat"' + (ev.phat ? ' checked' : '') + '><span>Trong năm bị cơ quan có thẩm quyền xử phạt vi phạm hành chính trong hoạt động của HTX <span class="muted small">(xếp loại yếu)</span></span></label></div>';

    var labels = {}; var res = Scoring.scoreEvaluation({});
    res.items.forEach(function (it) { labels[it.code] = it; });
    FORM.forEach(function (c) {
      var cc = Scoring.CRITERIA[c.no - 1];
      h += '<div class="crit"><h3><span>Tiêu chí ' + c.no + ': ' + esc(cc.name) + '</span><span class="cmax" data-crit="' + c.no + '">0/' + cc.max + '</span></h3>';
      c.rows.forEach(function (row) {
        var it = labels[row.code];
        h += '<div class="row"><div class="rowhead"><div class="code">' + esc(row.code) + '</div><div class="rl">' + esc(it.label) +
          '</div><div class="sc" data-sc="' + row.code + '">–/' + it.max + '</div></div>';
        if (row.custom) h += '<div id="satBox">' + satHTML(ev) + '</div>';
        else if (row.fields.length) h += '<div class="grid">' + row.fields.map(function (f) { return fieldHTML(f[0], f[1], f[2], ev); }).join('') + '</div>';
        if (row.note) h += '<p class="note">' + esc(row.note) + '</p>';
        h += '<div class="hint" data-hint="' + row.code + '"></div></div>';
      });
      h += '</div>';
    });

    h += '<div class="totalbar"><div><span class="big" id="totalVal">0</span> <span>/ 100 điểm</span><small id="missingTxt"></small></div><div id="rankBox"></div></div>' +
      '<div class="btnrow"><button class="btn primary" data-act="print" data-id="' + h0.id + '">In bảng tự chấm điểm (Phụ lục 3)</button>' +
      '<button class="btn danger" data-act="del-eval" data-id="' + h0.id + '">Xóa kết quả chấm năm ' + S.year + '</button></div>';
    return h;
  }

  function updateScores() {
    var h0 = getHtx(ui.evalId); if (!h0) return;
    var r = Scoring.scoreEvaluation(getEv(h0.id) || {});
    r.items.forEach(function (it) {
      var s = $('[data-sc="' + it.code + '"]');
      if (s) { s.textContent = (it.missing ? '–' : nf(it.score)) + '/' + it.max; s.classList.toggle('miss', it.missing); }
      var hh = $('[data-hint="' + it.code + '"]'); if (hh) hh.textContent = it.hint;
    });
    r.criteria.forEach(function (c) { var e = $('[data-crit="' + c.no + '"]'); if (e) e.textContent = nf(c.score) + '/' + c.max; });
    $('#totalVal').textContent = nf(r.total);
    $('#missingTxt').textContent = r.complete ? 'Đã nhập đủ các chỉ tiêu' : (r.final ? '' : 'Còn thiếu ' + r.missing.length + ' chỉ tiêu: ' + r.missing.join(', '));
    $('#rankBox').innerHTML = (r.final ? '' : '<span class="badge prov">Tạm tính</span> ') + badge(r.rank, r.rankLabel) +
      (r.notes.length ? '<small>' + esc(r.notes.join('. ')) + '</small>' : '');
  }

  function ensureEv() {
    var k = evKey(ui.evalId);
    if (!S.evals[k]) S.evals[k] = { phieu: [] };
    stamp(S.evals[k]);
    return S.evals[k];
  }

  /* ---------- Hộp thoại HTX ---------- */
  function openDlg(id) {
    var f = $('#htxForm'), h = id ? getHtx(id) : null;
    $('#dlgTitle').textContent = h ? 'Sửa thông tin HTX' : 'Thêm hợp tác xã';
    f.elements.ten.value = h ? h.ten : '';
    f.elements.xa.value = h ? h.xa : (ui.xa || '');
    f.elements.diaChi.value = h ? (h.diaChi || '') : '';
    f.elements.nguoiDaiDien.value = h ? (h.nguoiDaiDien || h.lienHe || '') : '';
    f.elements.dienThoai.value = h ? (h.dienThoai || '') : '';
    f.elements.linhVuc.innerHTML = LINH_VUC.map(function (l) { return '<option' + (h && h.linhVuc === l ? ' selected' : '') + '>' + l + '</option>'; }).join('');
    $('#xaList').innerHTML = xaList().map(function (x) { return '<option value="' + esc(x) + '">'; }).join('');
    $('#dlgDel').hidden = !h;
    f.dataset.id = id || '';
    $('#dlg').showModal();
  }
  $('#htxForm').addEventListener('submit', function (e) {
    e.preventDefault();
    var f = e.target, id = f.dataset.id, d = {
      ten: f.elements.ten.value.trim(), xa: f.elements.xa.value.trim(), linhVuc: f.elements.linhVuc.value,
      diaChi: f.elements.diaChi.value.trim(), nguoiDaiDien: f.elements.nguoiDaiDien.value.trim(), dienThoai: f.elements.dienThoai.value.trim()
    };
    if (!d.ten || !d.xa) return;
    if (id) { var hh = getHtx(id); Object.assign(hh, d); delete hh.lienHe; stamp(hh); } else { d.id = uid(); stamp(d); S.htx.push(d); }
    saveNow(); $('#dlg').close(); render(); toast('Đã lưu hợp tác xã');
  });
  $('#dlgCancel').addEventListener('click', function () { $('#dlg').close(); });
  $('#dlgDel').addEventListener('click', function () {
    var id = $('#htxForm').dataset.id, h = getHtx(id);
    if (!h || !confirm('Xóa hợp tác xã "' + h.ten + '" và toàn bộ kết quả chấm điểm các năm?')) return;
    if (!h.demo) S.dels.push({ t: 'htx', id: id, at: new Date().toISOString() });
    S.htx = S.htx.filter(function (x) { return x.id !== id; });
    Object.keys(S.evals).forEach(function (k) { if (k.indexOf(id + '|') === 0) delete S.evals[k]; });
    saveNow(); $('#dlg').close();
    go(ui.tab === 'eval' ? 'list' : ui.tab);
    toast('Đã xóa');
  });

  /* ---------- Xem thông tin HTX ---------- */
  function openInfo(id) {
    var h = getHtx(id); if (!h) return;
    var ev = getEv(id), st = status(h), nd = h.nguoiDaiDien || h.lienHe || '', dt = h.dienThoai || '';
    var row = function (l, v) { return '<tr><th>' + l + '</th><td>' + (v ? v : '<span class="muted">Chưa có</span>') + '</td></tr>'; };
    $('#infoBody').innerHTML = '<h2>' + esc(h.ten) + '</h2><table class="info">' +
      row('Xã / phường', esc(h.xa)) + row('Lĩnh vực', esc(h.linhVuc)) + row('Địa chỉ', esc(h.diaChi)) +
      row('Người đại diện', esc(nd)) +
      row('Điện thoại', dt ? '<a href="tel:' + esc(dt.replace(/[^0-9+]/g, '')) + '">' + esc(dt) + '</a>' : '') +
      row('Số thành viên (' + S.year + ')', ev && ev.soThanhVien ? esc(ev.soThanhVien) : '') +
      row('Kết quả năm ' + S.year, st.r ? '<b>' + nf(st.r.total) + '/100</b> ' + badge(st.k, st.label) : badge(st.k, st.label)) + '</table>' +
      '<div class="dlgbtns"><button class="btn sm" data-act="info-edit" data-id="' + h.id + '">Sửa</button><span class="grow"></span>' +
      '<button class="btn primary" data-act="info-close">Đóng</button></div>';
    $('#infoDlg').showModal();
  }

  /* ---------- Xuất / nhập dữ liệu ---------- */
  function vn(x) { return typeof x === 'number' ? String(x).replace('.', ',') : x; }
  function csv(rows) {
    // "sep=;" để Excel mở đúng cột bất kể cài đặt vùng; BOM để hiển thị đúng tiếng Việt
    return '﻿sep=;\r\n' + rows.map(function (r) {
      return r.map(function (c) { c = String(vn(c == null ? '' : c)); return /[;"\r\n]/.test(c) ? '"' + c.replace(/"/g, '""') + '"' : c; }).join(';');
    }).join('\r\n');
  }
  function download(name, text, type) {
    var a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type: type || 'text/csv;charset=utf-8' }));
    a.download = name; document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }
  function exportSummary() {
    var gs = groupStats(), t = sumGroups(gs);
    var rows = [['STT', 'Xã / phường', 'Số HTX', 'Tốt', 'Khá', 'Trung bình', 'Yếu', 'Không xếp loại', 'Chưa chấm xong', 'Điểm TB (năm ' + S.year + ')']];
    gs.concat([t]).forEach(function (g, i) {
      rows.push([g === t ? '' : i + 1, g.xa, g.n, g.tot, g.kha, g.tb, g.yeu, g.none, g.chua, g.cnt ? Math.round(g.sum / g.cnt * 100) / 100 : '']);
    });
    download('tong-hop-xep-loai-HTX-' + S.year + '.csv', csv(rows));
  }
  function exportDetail() {
    var rows = [['STT', 'Xã / phường', 'Tên HTX', 'Lĩnh vực', 'Số thành viên', 'TC1 (38)', 'TC2 (16)', 'TC3 (17)', 'TC4 (8)', 'TC5 (6)', 'TC6 (15)', 'Tổng điểm (100)', 'Xếp loại', 'Ghi chú']];
    S.htx.slice().sort(function (a, b) { return (a.xa || '').localeCompare(b.xa || '', 'vi') || (a.ten || '').localeCompare(b.ten || '', 'vi'); })
      .forEach(function (h, i) {
        var st = status(h), ev = getEv(h.id) || {};
        var c = st.r ? st.r.criteria.map(function (x) { return x.score; }) : ['', '', '', '', '', ''];
        rows.push([i + 1, h.xa, h.ten, h.linhVuc, ev.soThanhVien || '']
          .concat(c, [st.r ? st.r.total : '', st.k === 'dang' ? 'Đang nhập' : st.label, st.r ? st.r.notes.join('. ') : '']));
      });
    download('chi-tiet-xep-loai-HTX-' + S.year + '.csv', csv(rows));
  }
  function backup() {
    download('sao-luu-HTX-' + new Date().toISOString().slice(0, 10) + '.json', JSON.stringify(S, null, 1), 'application/json');
  }
  function importFile(file, replace) {
    var rd = new FileReader();
    rd.onload = function () {
      try {
        var d = JSON.parse(rd.result);
        if (!d || !Array.isArray(d.htx)) throw new Error('sai định dạng');
        if (replace) { S = Object.assign(fresh(), d, { evals: d.evals || {}, dels: [] }); SYNC.since = ''; saveSync(); markAllDirty(); }
        else {
          var have = {}; S.htx.forEach(function (h) { have[h.id] = 1; });
          d.htx.forEach(function (h) {
            var cur = have[h.id] ? getHtx(h.id) : null;
            if (!cur) { h._d = 1; if (!h.updatedAt) h.updatedAt = new Date().toISOString(); S.htx.push(h); }
            else if ((h.updatedAt || '') > (cur.updatedAt || '')) { Object.assign(cur, h, { _d: 1 }); }
          });
          Object.keys(d.evals || {}).forEach(function (k) {
            var a = S.evals[k], b = d.evals[k];
            if (!a || (b.updatedAt || '') > (a.updatedAt || '')) { b._d = 1; if (!b.updatedAt) b.updatedAt = new Date().toISOString(); S.evals[k] = b; }
          });
        }
        saveNow(); fillYearSelect(); go('dash'); toast('Đã nhập dữ liệu');
      } catch (e) { toast('Không đọc được tệp: ' + e.message); }
    };
    rd.readAsText(file);
  }
  function loadDemo() {
    var y = S.year, mk = function (ten, xa, lv) { return { id: uid(), ten: ten, xa: xa, linhVuc: lv, diaChi: '', nguoiDaiDien: '', dienThoai: '', demo: 1 }; };
    var a = mk('HTX Nông nghiệp Tân Lập', 'Xã Mẫu A', 'Trồng trọt'), b = mk('HTX Chăn nuôi Hòa Bình', 'Xã Mẫu A', 'Chăn nuôi'),
      c = mk('HTX Dịch vụ Nông nghiệp Đồng Xanh', 'Xã Mẫu B', 'Nông nghiệp tổng hợp'), d = mk('HTX Thủy sản Sông Hương', 'Xã Mẫu B', 'Thủy sản');
    S.htx.push(a, b, c, d);
    // n phiếu hài lòng mẫu, mỗi phiếu có điểm [lo, lo, 5]
    var ph = function (n, lo) { var r = []; for (var i = 0; i < n; i++) r.push([lo, lo, 5]); return r; };
    S.evals[evKey(a.id, y)] = { soThanhVien: 320, dtThucHien: 12000, dtKeHoach: 10000, thuNhap: 3100, quyPT: 650, quyDP: 160, uuTienGia: 'co', phanPhoiPct: 60,
      vonNamNay: 6000, vonNamTruoc: 3500, vonHoatDong: 15000, khenThuong: 'tinh', hlMode: 'phieu', phieu: ph(6, 4), updatedAt: new Date().toISOString() };
    S.evals[evKey(b.id, y)] = { soThanhVien: 45, dtThucHien: 2400, dtKeHoach: 2300, thuNhap: 180, quyPT: 36, quyDP: 9, uuTienGia: 'co', phanPhoiPct: 55,
      vonNamNay: 1250, vonNamTruoc: 1000, vonHoatDong: 1800, khenThuong: 'huyen', hlMode: 'phieu', phieu: ph(5, 3), updatedAt: new Date().toISOString() };
    S.evals[evKey(c.id, y)] = { soThanhVien: 18, dtThucHien: 700, dtKeHoach: 900, thuNhap: 0, quyPT: 0, quyDP: 0, uuTienGia: 'khong', phanPhoiPct: 20,
      vonNamNay: 400, vonNamTruoc: 400, vonHoatDong: 450, khenThuong: 'none', hlMode: 'phieu', phieu: ph(4, 2), updatedAt: new Date().toISOString() };
    saveNow(); render(); toast('Đã nạp 4 HTX mẫu (dữ liệu giả để dùng thử)');
  }

  /* ---------- In Phụ lục 3 ---------- */
  function printSheet(id) {
    var h0 = getHtx(id), ev = getEv(id) || {}, r = Scoring.scoreEvaluation(ev);
    var letter = { '1.a': 'a', '1.b': 'b', '1.c': 'c', '1.d': 'd', '1.đ': 'đ', '2.a': 'a', '2.b': 'b', '3.a': 'a', '3.b': 'b' };
    var rows = '';
    Scoring.CRITERIA.forEach(function (c) {
      var cs = r.criteria[c.no - 1];
      var its = r.items.filter(function (x) { return x.crit === c.no; });
      var single = its.length === 1; // tiêu chí 4, 5, 6 chỉ có một chỉ tiêu
      rows += '<tr><td class="n"><b>' + c.no + '</b></td><td><b>' + esc(c.name) + '</b></td><td class="n"><b>' + c.max + '</b></td><td class="n"><b>' +
        nf(cs.score) + '</b></td><td>' + (single ? esc(its[0].hint) : '') + '</td></tr>';
      if (!single) {
        its.forEach(function (it) {
          rows += '<tr><td class="n">' + letter[it.code] + '</td><td>' + esc(it.label) + '</td><td class="n">' + it.max + '</td><td class="n">' +
            (it.missing ? '' : nf(it.score)) + '</td><td>' + esc(it.hint) + '</td></tr>';
        });
      }
    });
    $('#printArea').innerHTML = '<div class="pa"><p><b>CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</b></p><p><b>Độc lập - Tự do - Hạnh phúc</b></p>' +
      '<h2 style="margin-top:12px">BẢNG TỰ CHẤM ĐIỂM HỢP TÁC XÃ HOẠT ĐỘNG TRONG LĨNH VỰC NÔNG NGHIỆP</h2><p>Năm ' + S.year + '</p>' +
      '<p style="text-align:left">Tên hợp tác xã: <b>' + esc(h0.ten) + '</b><br>Địa chỉ: ' + esc(h0.diaChi || h0.xa || '') +
      '<br>Phân loại theo lĩnh vực hoạt động: Hợp tác xã ' + esc((h0.linhVuc || '').toLowerCase()) +
      '<br>Kết quả tự đánh giá của Hội đồng quản trị: Hợp tác xã tự nhận đạt loại <b>' + esc(r.final ? r.rankShort : '…………') + '</b>' +
      ' (tổng ' + nf(r.total) + '/100 điểm)</p>' +
      '<table><thead><tr><th class="n">STT</th><th>Tiêu chí và chỉ tiêu đánh giá</th><th class="n">Thang điểm tối đa</th><th class="n">Điểm HTX tự chấm</th><th>Diễn giải</th></tr></thead><tbody>' + rows +
      '<tr><td></td><td><b>Tổng điểm</b></td><td class="n"><b>100</b></td><td class="n"><b>' + nf(r.total) + '</b></td><td></td></tr></tbody></table>' +
      (r.notes.length ? '<p style="text-align:left">Ghi chú: ' + esc(r.notes.join('. ')) + '</p>' : '') +
      '<div class="sign"><div><b>BAN KIỂM SOÁT KIỂM TRA</b><br><i>(ký, ghi rõ họ tên)</i></div><div>........, ngày..... tháng..... năm .........<br><b>HỘI ĐỒNG QUẢN TRỊ HỢP TÁC XÃ</b><br><i>(ký, ghi rõ họ tên và đóng dấu)</i></div></div></div>';
    window.print();
  }

  /* ---------- Tab: Cài đặt ---------- */
  var deferredInstall = null;
  window.addEventListener('beforeinstallprompt', function (e) { e.preventDefault(); deferredInstall = e; if (ui.tab === 'settings') render(); });
  function viewSettings() {
    return syncCard() + '<div class="card"><h2>Sao lưu &amp; chuyển dữ liệu</h2>' +
      '<p class="small muted">Dữ liệu được lưu ngay trên thiết bị này (không gửi đi đâu). Hãy sao lưu định kỳ. Cán bộ xã có thể gửi tệp sao lưu lên cấp tỉnh để <b>gộp</b> vào bảng tổng hợp.</p>' +
      '<div class="btnrow"><button class="btn primary" data-act="backup">Sao lưu ra tệp (.json)</button>' +
      '<label class="btn">Nhập &amp; gộp tệp<input type="file" accept=".json,application/json" data-import="merge" hidden></label>' +
      '<label class="btn">Nhập &amp; thay thế toàn bộ<input type="file" accept=".json,application/json" data-import="replace" hidden></label></div></div>' +

      '<div class="card"><h2>Cài app lên điện thoại</h2>' +
      (deferredInstall ? '<div class="btnrow"><button class="btn primary" data-act="install">Cài đặt ứng dụng</button></div>' : '') +
      '<ul class="steps small"><li><b>Android (Chrome):</b> menu ⋮ → "Cài đặt ứng dụng" (hoặc "Thêm vào màn hình chính").</li>' +
      '<li><b>iPhone/iPad (Safari):</b> nút Chia sẻ → "Thêm vào MH chính".</li>' +
      '<li><b>Máy tính (Chrome/Edge):</b> biểu tượng cài đặt ở cuối thanh địa chỉ.</li></ul>' +
      '<p class="note">Cần mở app từ địa chỉ https (ví dụ GitHub Pages) thì mới cài được và chạy offline. Xem README.md.</p></div>' +

      '<div class="card"><h2>Dữ liệu</h2><p class="small muted">Hiện có ' + S.htx.length + ' HTX, ' + Object.keys(S.evals).length + ' bản chấm điểm.</p>' +
      '<div class="btnrow"><button class="btn" data-act="demo">Nạp dữ liệu mẫu</button>' +
      (S.htx.some(function (h) { return h.demo; }) ? '<button class="btn" data-act="rm-demo">Xóa dữ liệu mẫu</button>' : '') +
      '<button class="btn danger" data-act="wipe">Xóa toàn bộ dữ liệu</button></div></div>' +

      '<div class="card"><h2>Căn cứ &amp; lưu ý</h2><ul class="steps small">' +
      '<li>Văn bản hợp nhất số 85/VBHN-BNNMT ngày 26/12/2025 (Thông tư 09/2017/TT-BNNPTNT, sửa đổi bởi Thông tư 13/2025/TT-BNNMT): 6 tiêu chí, 100 điểm.</li>' +
      '<li>Xếp loại: Tốt 80-100; Khá 65 đến dưới 80; Trung bình 50 đến dưới 65; Yếu dưới 50 hoặc bị xử phạt vi phạm hành chính trong năm. HTX mới thành lập chưa đủ 12 tháng: không xếp loại.</li>' +
      '<li>Đơn vị tiền nhập vào là <b>triệu đồng</b>. "Tổng doanh thu năm" (1.b) lấy theo doanh thu thực hiện; các tỷ lệ trích quỹ (1.d, 1.đ) tính trên số thu nhập ở 1.c.</li>' +
      '<li>Văn bản ghi "từ 100 đến dưới 500 thành viên" và "trên 500"; riêng đúng 500 thành viên app tạm tính 8 điểm.</li>' +
      '<li>Công cụ hỗ trợ tính toán; kết quả chính thức do HTX tự chấm và UBND cấp xã rà soát theo Điều 5.</li></ul></div>';
  }

  /* ---------- Sự kiện ---------- */
  document.addEventListener('click', function (e) {
    var t = e.target.closest('[data-act]'); if (!t) return;
    var act = t.getAttribute('data-act'), id = t.getAttribute('data-id');
    if (act === 'tab') go(t.getAttribute('data-tab'));
    else if (act === 'sync') { if (syncReady()) doSync({ manual: true }); else { go('settings'); toast('Nhập địa chỉ Web app và mã khóa để bật đồng bộ'); } }
    else if (act === 'sync-now') doSync({ manual: true });
    else if (act === 'sync-test') syncTest();
    else if (act === 'sync-full') { if (confirm('Gửi lại TOÀN BỘ dữ liệu trên máy này lên Google Sheets? (Bản nào trên Sheets mới hơn vẫn được giữ.)')) doSync({ manual: true, full: true }); }
    else if (act === 'sync-reload') doSync({ manual: true, reload: true });
    else if (act === 'rm-demo') {
      var dm = {}; S.htx.forEach(function (h) { if (h.demo) dm[h.id] = 1; });
      S.htx = S.htx.filter(function (h) { return !dm[h.id]; });
      Object.keys(S.evals).forEach(function (k) { if (dm[k.split('|')[0]]) delete S.evals[k]; });
      saveNow(); render(); toast('Đã xóa dữ liệu mẫu');
    }
    else if (act === 'add-htx') openDlg(null);
    else if (act === 'edit-htx') openDlg(id);
    else if (act === 'view-htx') openInfo(id);
    else if (act === 'info-close') $('#infoDlg').close();
    else if (act === 'info-edit') { $('#infoDlg').close(); openDlg(id); }
    else if (act === 'open-eval') go('eval', id);
    else if (act === 'back') go('list');
    else if (act === 'export-sum') exportSummary();
    else if (act === 'export-detail') exportDetail();
    else if (act === 'backup') backup();
    else if (act === 'demo') loadDemo();
    else if (act === 'print') printSheet(id);
    else if (act === 'install' && deferredInstall) { deferredInstall.prompt(); deferredInstall = null; }
    else if (act === 'wipe') {
      if (confirm('Xóa TOÀN BỘ dữ liệu trên thiết bị này? Hãy sao lưu trước nếu cần.')) { S = fresh(); SYNC.since = ''; saveSync(); saveNow(); fillYearSelect(); go('dash'); toast('Đã xóa dữ liệu'); }
    }
    else if (act === 'del-eval') {
      if (confirm('Xóa kết quả chấm điểm năm ' + S.year + ' của HTX này?')) {
        var hx = getHtx(id); if (hx && !hx.demo) S.dels.push({ t: 'ev', key: evKey(id), at: new Date().toISOString() });
        delete S.evals[evKey(id)]; saveNow(); render();
      }
    }
    else if (act === 'add-ballot') {
      var ev = ensureEv(); (ev.phieu = ev.phieu || []).push(['', '', '']); save();
      $('#satBox').innerHTML = satHTML(ev);
      var ins = $$('#satBox .ballot:last-child input'); if (ins[0]) ins[0].focus();
    }
    else if (act === 'del-ballot') {
      var ev2 = ensureEv(); ev2.phieu.splice(+t.getAttribute('data-i'), 1); save();
      $('#satBox').innerHTML = satHTML(ev2); updateScores();
    }
  });

  document.addEventListener('input', function (e) {
    var t = e.target;
    if (t.id === 'q') { ui.q = t.value; renderListBody(); return; }
    if (t.hasAttribute('data-b')) {
      var p = t.getAttribute('data-b').split('.'), ev = ensureEv();
      ev.phieu[+p[0]][+p[1]] = t.value.replace(/[^0-9]/g, ''); t.value = ev.phieu[+p[0]][+p[1]];
      t.classList.toggle('bad', t.value !== '' && !/^[1-5]$/.test(t.value));
      // nhảy sang ô kế tiếp khi đã nhập 1 chữ số
      if (/^[1-5]$/.test(t.value)) { var nx = t.nextElementSibling; if (nx && nx.tagName === 'INPUT') nx.focus(); }
      save(); updateScores(); return;
    }
    if (t.hasAttribute('data-f') && ui.tab === 'eval') {
      var ev3 = ensureEv(), k = t.getAttribute('data-f');
      if (t.type === 'checkbox') ev3[k] = t.checked;
      else if (t.type === 'radio') { ev3[k] = t.value; $('#satBox').innerHTML = satHTML(ev3); }
      else ev3[k] = t.value;
      save(); updateScores();
    }
  });

  document.addEventListener('change', function (e) {
    var t = e.target;
    if (t.id === 'syUrl') { SYNC.url = t.value.trim(); SYNC.since = ''; saveSync(); renderSyncStatus(); }
    else if (t.id === 'syKey') { SYNC.key = t.value.trim(); SYNC.since = ''; saveSync(); renderSyncStatus(); }
    else if (t.id === 'syBy') { SYNC.by = t.value.trim(); saveSync(); }
    else if (t.id === 'syAuto') { SYNC.auto = t.checked; saveSync(); }
    else if (t.id === 'fxa') { ui.xa = t.value; renderListBody(); }
    else if (t.id === 'fcls') { ui.cls = t.value; renderListBody(); }
    else if (t.id === 'yearSel') { S.year = +t.value; saveNow(); render(); }
    else if (t.hasAttribute('data-import') && t.files[0]) {
      var rep = t.getAttribute('data-import') === 'replace';
      if (!rep || confirm('Thay thế toàn bộ dữ liệu hiện tại bằng nội dung tệp?')) importFile(t.files[0], rep);
      t.value = '';
    }
  });

  /* ---------- Đồng bộ Google Sheets ---------- */
  var syncing = false, autoTimer = null;

  function stamp(rec) { rec.updatedAt = new Date().toISOString(); rec._d = 1; }
  function syncReady() { return /^https:\/\/script\.google\.com\/.+\/exec$/.test(SYNC.url || '') && !!SYNC.key; }
  function pushableKey(k) { var h = getHtx(k.split('|')[0]); return !!h && !h.demo; }

  function pendingCount() {
    var n = S.dels.length;
    S.htx.forEach(function (h) { if (h._d && !h.demo) n++; });
    Object.keys(S.evals).forEach(function (k) { if (S.evals[k]._d && pushableKey(k)) n++; });
    return n;
  }
  function markAllDirty() {
    var now = new Date().toISOString();
    S.htx.forEach(function (h) { if (!h.demo) { h._d = 1; if (!h.updatedAt) h.updatedAt = now; } });
    Object.keys(S.evals).forEach(function (k) { var e = S.evals[k]; e._d = 1; if (!e.updatedAt) e.updatedAt = now; });
  }
  function sumOf(ev) {
    var r = Scoring.scoreEvaluation(ev);
    return { soThanhVien: ev.soThanhVien || '', total: r.total, rank: r.final ? r.rankShort : '',
      status: r.final ? 'Hoàn tất' : 'Đang nhập', crit: r.criteria.map(function (c) { return c.score; }) };
  }

  function buildPayload(full) {
    var now = new Date().toISOString(), htx = [], evals = [], sent = { h: {}, e: {} };
    S.htx.forEach(function (h) {
      if (h.demo || !(full || h._d)) return;
      if (!h.updatedAt) h.updatedAt = now;
      sent.h[h.id] = h.updatedAt;
      htx.push({ id: h.id, ten: h.ten, xa: h.xa, linhVuc: h.linhVuc, diaChi: h.diaChi || '',
        nguoiDaiDien: h.nguoiDaiDien || h.lienHe || '', dienThoai: h.dienThoai || '', updatedAt: h.updatedAt });
    });
    Object.keys(S.evals).forEach(function (k) {
      var e = S.evals[k];
      if (!pushableKey(k) || !(full || e._d)) return;
      if (!e.updatedAt) e.updatedAt = now;
      sent.e[k] = e.updatedAt;
      var data = JSON.parse(JSON.stringify(e)); delete data._d; delete data.updatedAt;
      var p = k.split('|');
      evals.push({ key: k, htxId: p[0], year: +p[1], data: data, sum: sumOf(e), updatedAt: e.updatedAt });
    });
    return { htx: htx, evals: evals, dels: S.dels.slice(), sent: sent, n: htx.length + evals.length + S.dels.length };
  }

  function api(payload) {
    if (!syncReady()) return Promise.reject(new Error('Chưa nhập đúng địa chỉ Web app (kết thúc bằng /exec) và mã khóa'));
    return fetch(SYNC.url, {
      method: 'POST', redirect: 'follow',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },   // không gây yêu cầu kiểm tra trước (CORS preflight)
      body: JSON.stringify(Object.assign({ key: SYNC.key, by: SYNC.by }, payload))
    }).then(function (r) {
      if (!r.ok) throw new Error('Máy chủ trả mã lỗi ' + r.status);
      return r.text();
    }).then(function (t) {
      var j;
      try { j = JSON.parse(t); }
      catch (e) { throw new Error('Phản hồi không đúng. Kiểm tra địa chỉ Web app và quyền truy cập "Bất kỳ ai" khi triển khai.'); }
      if (!j.ok) throw new Error(j.error || 'Lỗi không rõ');
      return j;
    });
  }

  // Áp dụng dữ liệu từ máy chủ: bản có giờ sửa mới hơn thắng
  function applyServer(res, hold) {
    var changed = 0, held = false;
    var cur = ui.tab === 'eval' ? evKey(ui.evalId) : null;
    (res.htx || []).forEach(function (r) {
      var l = getHtx(r.id);
      if (r.deleted) {
        if (l && !l.demo && (l.updatedAt || '') <= r.updatedAt) {
          S.htx = S.htx.filter(function (x) { return x.id !== r.id; });
          Object.keys(S.evals).forEach(function (k) { if (k.indexOf(r.id + '|') === 0) delete S.evals[k]; });
          changed++;
        }
        return;
      }
      var rec = { id: r.id, ten: r.ten, xa: r.xa, linhVuc: r.linhVuc, diaChi: r.diaChi, nguoiDaiDien: r.nguoiDaiDien, dienThoai: r.dienThoai, updatedAt: r.updatedAt };
      if (!l) { S.htx.push(rec); changed++; }
      else if (!l.demo && (l.updatedAt || '') < r.updatedAt) { delete l.lienHe; Object.assign(l, rec); delete l._d; changed++; }
    });
    (res.evals || []).forEach(function (r) {
      var h = getHtx(r.htxId); if (!h || h.demo) return;
      var l = S.evals[r.key];
      if (r.deleted) {
        if (l && (l.updatedAt || '') <= r.updatedAt) {
          if (hold && r.key === cur) { held = true; return; }
          delete S.evals[r.key]; changed++;
        }
        return;
      }
      if (!l || (l.updatedAt || '') < r.updatedAt) {
        if (hold && r.key === cur) { held = true; return; }   // đang mở nhập: không ghi đè giữa chừng
        var d = r.data || {}; d.updatedAt = r.updatedAt; S.evals[r.key] = d; changed++;
      }
    });
    return { changed: changed, held: held };
  }

  function doSync(opts) {
    opts = opts || {};
    if (syncing) return Promise.resolve();
    if (!syncReady()) { if (opts.manual) toast('Chưa cấu hình đồng bộ: nhập địa chỉ Web app và mã khóa.'); return Promise.resolve(); }
    if (!opts.manual && navigator.onLine === false) return Promise.resolve();
    syncing = true; renderSyncStatus();
    var p = buildPayload(!!opts.full);
    return api({ action: 'sync', since: opts.reload ? '' : SYNC.since, htx: p.htx, evals: p.evals, dels: p.dels })
      .then(function (res) {
        Object.keys(p.sent.h).forEach(function (id) { var h = getHtx(id); if (h && h.updatedAt === p.sent.h[id]) delete h._d; });
        Object.keys(p.sent.e).forEach(function (k) { var e = S.evals[k]; if (e && e.updatedAt === p.sent.e[k]) delete e._d; });
        S.dels.splice(0, p.dels.length);
        var r = applyServer(res, !opts.manual && ui.tab === 'eval');
        if (!r.held) SYNC.since = res.serverTime;
        SYNC.last = new Date().toISOString(); SYNC.err = ''; saveSync(); saveNow();
        if (ui.tab === 'eval' && !getHtx(ui.evalId)) ui.tab = 'list';
        var ae = document.activeElement, typing = ae && /^(INPUT|SELECT|TEXTAREA)$/.test(ae.tagName);
        if (r.changed && (opts.manual || (ui.tab !== 'eval' && !typing))) render();
        if (opts.manual) toast('Đã đồng bộ: gửi ' + p.n + ', nhận ' + r.changed + ' bản ghi');
      })
      .catch(function (e) {
        var m = (e && e.message) || String(e);
        if (/Failed to fetch|NetworkError|Load failed/i.test(m)) m = 'Không kết nối được (kiểm tra mạng hoặc địa chỉ Web app).';
        SYNC.err = m; saveSync();
        if (opts.manual) toast('Đồng bộ lỗi: ' + m);
      })
      .then(function () { syncing = false; renderSyncStatus(); });
  }

  function syncTest() {
    api({ action: 'ping' }).then(function (j) {
      SYNC.err = ''; saveSync(); renderSyncStatus();
      toast('Kết nối thành công. Google Sheets đang có ' + j.htx + ' HTX, ' + j.evals + ' bản chấm điểm.');
    }).catch(function (e) { toast('Không kết nối được: ' + e.message); });
  }

  function scheduleAuto(ms) {
    clearTimeout(autoTimer);
    autoTimer = setTimeout(function () { doSync({}); }, ms);
  }

  function updateSyncBtn() {
    var b = $('#syncBtn'); if (!b) return;
    var n = pendingCount();
    b.classList.toggle('spin', syncing);
    b.classList.toggle('err', !!SYNC.err);
    b.querySelector('.n').textContent = n ? String(n) : '';
    b.title = syncReady() ? (n ? n + ' bản ghi chưa gửi' : 'Đã đồng bộ') + (SYNC.err ? ' - ' + SYNC.err : '') : 'Chưa cấu hình đồng bộ';
  }
  function renderSyncStatus() {
    updateSyncBtn();
    var el = $('#syncStatus'); if (!el) return;
    if (!syncReady()) { el.innerHTML = '<span class="muted">Chưa cấu hình. Nhập địa chỉ Web app và mã khóa ở trên.</span>'; return; }
    var n = pendingCount();
    el.innerHTML = (syncing ? 'Đang đồng bộ...<br>' : '') +
      (SYNC.last ? 'Lần đồng bộ cuối: <b>' + esc(new Date(SYNC.last).toLocaleString('vi-VN')) + '</b><br>' : 'Chưa đồng bộ lần nào.<br>') +
      'Chưa gửi lên Sheets: <b>' + n + '</b> bản ghi' +
      (SYNC.err ? '<br><span style="color:var(--yeu)">Lỗi gần nhất: ' + esc(SYNC.err) + '</span>' : '');
  }

  function syncCard() {
    return '<div class="card"><h2>Đồng bộ Google Sheets</h2>' +
      '<p class="small muted">Gửi dữ liệu lên một Google Sheets chung và nhận dữ liệu do cán bộ khác nhập. Cách tạo địa chỉ Web app: xem tệp HUONG-DAN-DONG-BO.md.</p>' +
      '<label class="fld"><span>Địa chỉ Web app (dạng https://script.google.com/.../exec)</span><input id="syUrl" inputmode="url" autocomplete="off" value="' + esc(SYNC.url) + '"></label>' +
      '<label class="fld"><span>Mã khóa (giống SECRET_KEY trong Apps Script)</span><input id="syKey" type="password" autocomplete="off" value="' + esc(SYNC.key) + '"></label>' +
      '<label class="fld"><span>Tên cán bộ nhập (để biết ai cập nhật)</span><input id="syBy" autocomplete="off" value="' + esc(SYNC.by) + '"></label>' +
      '<label class="chk"><input type="checkbox" id="syAuto"' + (SYNC.auto ? ' checked' : '') + '><span>Tự động đồng bộ (khi mở app, sau khi sửa, và mỗi 3 phút)</span></label>' +
      '<div id="syncStatus" class="note"></div>' +
      '<div class="btnrow"><button class="btn primary" data-act="sync-now">Đồng bộ ngay</button>' +
      '<button class="btn" data-act="sync-test">Kiểm tra kết nối</button>' +
      '<button class="btn" data-act="sync-full">Gửi lại toàn bộ dữ liệu trên máy</button>' +
      '<button class="btn" data-act="sync-reload">Tải lại toàn bộ từ Sheets</button></div></div>';
  }

  /* ---------- Khởi động ---------- */
  fillYearSelect();
  render();
  updateSyncBtn();
  setTimeout(function () { if (SYNC.auto && syncReady()) doSync({}); }, 1500);
  setInterval(function () { if (SYNC.auto && syncReady() && !document.hidden) doSync({}); }, 180000);
  window.addEventListener('online', function () { if (SYNC.auto && syncReady()) doSync({}); });
  document.addEventListener('visibilitychange', function () {
    if (!document.hidden && SYNC.auto && syncReady() && (!SYNC.last || Date.now() - new Date(SYNC.last).getTime() > 60000)) doSync({});
  });
  if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
    window.addEventListener('load', function () { navigator.serviceWorker.register('sw.js').catch(function () { /* bỏ qua */ }); });
  }
})();
