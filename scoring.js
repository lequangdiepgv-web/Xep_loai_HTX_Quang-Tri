/*
 * scoring.js - Logic chấm điểm, xếp loại HTX nông nghiệp
 * Căn cứ: Văn bản hợp nhất số 85/VBHN-BNNMT (hợp nhất Thông tư 09/2017/TT-BNNPTNT
 * và Thông tư 13/2025/TT-BNNMT) - Phụ lục 1 (tiêu chí, cách chấm điểm) và Điều 6 (xếp loại).
 *
 * File này KHÔNG phụ thuộc giao diện: chạy được cả trên trình duyệt lẫn Node.js (để kiểm thử).
 * Đơn vị tiền: TRIỆU ĐỒNG.
 */
(function (root) {
  'use strict';

  function num(v) {
    if (v === null || v === undefined || v === '') return null;
    var n = typeof v === 'number' ? v : parseFloat(String(v).trim().replace(/\s/g, '').replace(',', '.'));
    return isFinite(n) ? n : null;
  }
  function r6(x) { return Math.round(x * 1e6) / 1e6; }
  function r2(x) { return Math.round(x * 100) / 100; }
  function f1(x) { return (Math.round(x * 10) / 10).toString().replace('.', ','); }
  function fn(x) { return r2(x).toString().replace('.', ','); }

  var RANKS = {
    tot: 'Hợp tác xã hoạt động tốt',
    kha: 'Hợp tác xã hoạt động khá',
    tb: 'Hợp tác xã hoạt động trung bình',
    yeu: 'Hợp tác xã hoạt động yếu',
    none: 'Không xếp loại'
  };
  var RANK_SHORT = { tot: 'Tốt', kha: 'Khá', tb: 'Trung bình', yeu: 'Yếu', none: 'Không xếp loại' };

  var CRITERIA = [
    { no: 1, name: 'Doanh thu và kết quả hoạt động sản xuất kinh doanh trong năm', max: 38 },
    { no: 2, name: 'Lợi ích của các thành viên hợp tác xã', max: 16 },
    { no: 3, name: 'Vốn hoạt động của hợp tác xã', max: 17 },
    { no: 4, name: 'Quy mô thành viên ảnh hưởng tích cực đến cộng đồng', max: 8 },
    { no: 5, name: 'Hợp tác xã được khen thưởng trong năm', max: 6 },
    { no: 6, name: 'Mức độ hài lòng của thành viên đối với hợp tác xã', max: 15 }
  ];

  // Phiếu hợp lệ: đủ 3 chỉ tiêu, mỗi chỉ tiêu 1 điểm nguyên từ 1 đến 5 (Phụ lục 2)
  function validBallot(b) {
    if (!Array.isArray(b) || b.length !== 3) return false;
    for (var i = 0; i < 3; i++) {
      var x = num(b[i]);
      if (x === null || Math.floor(x) !== x || x < 1 || x > 5) return false;
    }
    return true;
  }

  // Điểm hài lòng bình quân/phiếu hợp lệ
  function satisfaction(ev) {
    if (ev.hlMode === 'tong') {
      var c = num(ev.hlCount), s = num(ev.hlSum);
      if (c === null || s === null || c <= 0) return null;
      return { count: c, sum: s, avg: s / c, invalid: 0 };
    }
    var all = Array.isArray(ev.phieu) ? ev.phieu : [];
    var valid = all.filter(validBallot);
    if (!valid.length) return null;
    var sum = 0;
    valid.forEach(function (b) { sum += num(b[0]) + num(b[1]) + num(b[2]); });
    return { count: valid.length, sum: sum, avg: sum / valid.length, invalid: all.length - valid.length };
  }

  function rankFromTotal(t) {
    if (t >= 80) return 'tot';
    if (t >= 65) return 'kha';
    if (t >= 50) return 'tb';
    return 'yeu';
  }

  function scoreEvaluation(ev) {
    ev = ev || {};
    var items = [];
    var missing = [];

    function add(code, crit, label, max, score, hint, isMissing) {
      items.push({
        code: code, crit: crit, label: label, max: max,
        score: isMissing ? 0 : score, hint: hint || '', missing: !!isMissing
      });
      if (isMissing) missing.push(code);
    }

    var act = num(ev.dtThucHien), plan = num(ev.dtKeHoach);
    var income = num(ev.thuNhap), members = num(ev.soThanhVien);

    // ---- Tiêu chí 1: Doanh thu và kết quả SXKD (38 điểm)
    var m = act === null || plan === null || plan <= 0;
    var ratio = m ? 0 : r6(act / plan * 100);
    add('1.a', 1, 'Tỷ lệ doanh thu thực hiện / doanh thu kế hoạch', 8,
      ratio >= 120 ? 8 : ratio >= 100 ? 4 : 0,
      m ? (plan !== null && plan <= 0 ? 'Doanh thu kế hoạch phải lớn hơn 0' : 'Nhập doanh thu thực hiện và kế hoạch') : 'Tỷ lệ thực hiện: ' + f1(ratio) + '%', m);

    m = act === null;
    var tyDong = m ? 0 : act / 1000;
    add('1.b', 1, 'Tổng doanh thu năm của hợp tác xã', 10,
      tyDong >= 10 ? 10 : tyDong >= 5 ? 8 : tyDong >= 1 ? 6 : 4,
      m ? 'Nhập doanh thu thực hiện' : 'Doanh thu: ' + fn(tyDong) + ' tỷ đồng', m);

    var m1c = income === null || (income > 0 && (members === null || members <= 0));
    var per = (!m1c && income > 0) ? income / members : 0;
    var s1c = income !== null && income <= 0 ? 0 : per >= 10 ? 10 : per >= 5 ? 7 : per >= 1 ? 4 : 2;
    add('1.c', 1, 'Thu nhập bình quân đầu thành viên sau khi hoàn thành nghĩa vụ tài chính', 10, s1c,
      m1c ? (income === null ? 'Nhập thu nhập sau nghĩa vụ tài chính' : 'Nhập số thành viên (mục Thông tin chung)')
        : income <= 0 ? 'Không có lợi nhuận sau thuế' : 'Bình quân: ' + fn(per) + ' triệu đồng/thành viên', m1c);

    var qpt = num(ev.quyPT);
    var m1d = income === null || (income > 0 && qpt === null);
    var p1d = (!m1d && income > 0) ? r6(qpt / income * 100) : 0;
    add('1.d', 1, 'Trích quỹ đầu tư phát triển không thấp hơn 20% trên thu nhập', 5,
      p1d >= 20 ? 5 : 0,
      m1d ? 'Nhập số trích quỹ đầu tư phát triển' : income <= 0 ? 'Không có thu nhập để trích quỹ' : 'Tỷ lệ trích: ' + f1(p1d) + '% thu nhập', m1d);

    var qdp = num(ev.quyDP);
    var m1e = income === null || (income > 0 && qdp === null);
    var p1e = (!m1e && income > 0) ? r6(qdp / income * 100) : 0;
    add('1.đ', 1, 'Trích quỹ dự phòng tài chính không thấp hơn 5% trên thu nhập', 5,
      p1e >= 5 ? 5 : 0,
      m1e ? 'Nhập số trích quỹ dự phòng tài chính' : income <= 0 ? 'Không có thu nhập để trích quỹ' : 'Tỷ lệ trích: ' + f1(p1e) + '% thu nhập', m1e);

    // ---- Tiêu chí 2: Lợi ích của thành viên (16 điểm)
    m = ev.uuTienGia !== 'co' && ev.uuTienGia !== 'khong';
    add('2.a', 2, 'Ưu tiên giá dịch vụ cho thành viên so với khách hàng không là thành viên', 8,
      ev.uuTienGia === 'co' ? 8 : 0,
      m ? 'Chọn có / không ưu tiên giá' : ev.uuTienGia === 'co' ? 'Có ưu tiên giá cho thành viên' : 'Không ưu tiên giá cho thành viên', m);

    var pp = num(ev.phanPhoiPct);
    m = pp === null;
    add('2.b', 2, 'Ưu tiên phân phối thu nhập cho thành viên theo mức độ sử dụng sản phẩm, dịch vụ', 8,
      pp !== null && pp >= 50 ? 8 : 0,
      m ? 'Nhập tỷ lệ % thu nhập còn lại phân phối theo mức độ sử dụng' : 'Phân phối theo mức độ sử dụng: ' + f1(pp) + '%', m);

    // ---- Tiêu chí 3: Vốn hoạt động (17 điểm)
    var vNow = num(ev.vonNamNay), vPrev = num(ev.vonNamTruoc);
    m = vNow === null || vPrev === null;
    var g = 0, hint3a = 'Nhập vốn góp và huy động từ thành viên năm nay và năm trước';
    if (!m) {
      if (vPrev <= 0) { g = vNow > 0 ? 100 : 0; hint3a = vNow > 0 ? 'Năm trước không có, năm nay có: tính 100%' : 'Không tăng vốn'; }
      else { g = r6((vNow - vPrev) / vPrev * 100); hint3a = (g <= 0 ? 'Giảm hoặc không tăng: ' : 'Tăng ') + f1(g) + '%'; }
    }
    add('3.a', 3, 'Tỷ lệ tăng vốn góp và huy động từ thành viên', 7,
      g >= 50 ? 7 : g >= 20 ? 5 : g > 0 ? 3 : 0, hint3a, m);

    var von = num(ev.vonHoatDong);
    m = von === null;
    add('3.b', 3, 'Vốn hoạt động của hợp tác xã', 10,
      von >= 10000 ? 10 : von >= 1000 ? 7 : von >= 500 ? 5 : 1,
      m ? 'Nhập vốn hoạt động' : 'Vốn hoạt động: ' + fn(von / 1000) + ' tỷ đồng', m);

    // ---- Tiêu chí 4: Quy mô thành viên (8 điểm)
    m = members === null || members < 0;
    var s4 = members >= 500 ? 8 : members >= 100 ? 6 : members >= 30 ? 4 : 2;
    add('4', 4, 'Quy mô thành viên hợp tác xã ảnh hưởng tích cực đến cộng đồng', 8, s4,
      m ? 'Nhập số thành viên (mục Thông tin chung)'
        : members + ' thành viên' + (members === 500 ? ' (văn bản không nêu rõ mốc đúng 500, tạm tính mức từ 500 trở lên)' : ''), m);

    // ---- Tiêu chí 5: Khen thưởng (6 điểm)
    var kt = ev.khenThuong;
    m = kt !== 'none' && kt !== 'huyen' && kt !== 'tinh';
    add('5', 5, 'Hợp tác xã được khen thưởng trong năm', 6,
      kt === 'tinh' ? 6 : kt === 'huyen' ? 3 : 0,
      m ? 'Chọn mức khen thưởng' : kt === 'tinh' ? 'Được cấp tỉnh khen thưởng trở lên' : kt === 'huyen' ? 'Được cấp xã khen thưởng' : 'Không được khen thưởng', m);

    // ---- Tiêu chí 6: Mức độ hài lòng (15 điểm)
    var sat = satisfaction(ev);
    m = sat === null;
    var s6 = m ? 0 : Math.min(15, r2(sat.avg));
    var h6 = m ? 'Nhập phiếu đánh giá hài lòng của thành viên'
      : sat.count + ' phiếu hợp lệ, bình quân ' + fn(sat.avg) + ' điểm/phiếu'
        + (sat.invalid ? ' (' + sat.invalid + ' phiếu không hợp lệ bị loại)' : '')
        + (sat.avg > 15 ? ' - vượt 15 điểm, kiểm tra lại số liệu' : '');
    add('6', 6, 'Mức độ hài lòng của thành viên đối với hợp tác xã', 15, s6, h6, m);

    // ---- Tổng hợp
    var criteria = CRITERIA.map(function (c) {
      var sc = 0;
      items.forEach(function (it) { if (it.crit === c.no) sc += it.score; });
      return { no: c.no, name: c.name, max: c.max, score: r2(sc) };
    });
    var total = 0;
    criteria.forEach(function (c) { total += c.score; });
    total = r2(total);

    var notes = [];
    var rank = rankFromTotal(total);
    if (ev.phat) { rank = 'yeu'; notes.push('Trong năm bị xử phạt vi phạm hành chính: xếp loại yếu theo Điều 6'); }
    if (ev.moiThanhLap) { rank = 'none'; notes.push('HTX mới thành lập, SXKD chưa đủ 12 tháng: không tự chấm điểm, không xếp loại'); }

    return {
      items: items,
      criteria: criteria,
      total: total,
      rank: rank,
      rankLabel: RANKS[rank],
      rankShort: RANK_SHORT[rank],
      missing: missing,
      complete: missing.length === 0,
      // final = đủ căn cứ để xếp loại chính thức
      final: missing.length === 0 || !!ev.moiThanhLap || !!ev.phat,
      notes: notes
    };
  }

  var api = {
    scoreEvaluation: scoreEvaluation,
    satisfaction: satisfaction,
    validBallot: validBallot,
    rankFromTotal: rankFromTotal,
    RANKS: RANKS,
    RANK_SHORT: RANK_SHORT,
    CRITERIA: CRITERIA,
    num: num
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Scoring = api;
})(typeof window !== 'undefined' ? window : this);
