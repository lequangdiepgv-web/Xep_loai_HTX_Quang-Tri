// Chạy: node test-scoring.js
const S = require('./scoring.js');
let fail = 0;
function eq(name, got, want) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) fail++;
  console.log((ok ? 'OK   ' : 'FAIL ') + name + (ok ? '' : '  got=' + JSON.stringify(got) + ' want=' + JSON.stringify(want)));
}

// Tổng thang điểm phải đúng 100 (khớp Phụ lục 1)
const r0 = S.scoreEvaluation({});
eq('tổng thang điểm các chỉ tiêu = 100', r0.items.reduce((t, i) => t + i.max, 0), 100);
eq('tổng thang điểm 6 tiêu chí = 100', S.CRITERIA.reduce((t, c) => t + c.max, 0), 100);
eq('mỗi chỉ tiêu có đủ 12 dòng', r0.items.length, 12);
eq('chưa nhập gì: thiếu cả 12 chỉ tiêu', r0.missing.length, 12);

const best = {
  dtThucHien: 12000, dtKeHoach: 10000, thuNhap: 3000, soThanhVien: 300,
  quyPT: 600, quyDP: 150, uuTienGia: 'co', phanPhoiPct: 60,
  vonNamNay: 6000, vonNamTruoc: 3000, vonHoatDong: 15000, khenThuong: 'tinh',
  hlMode: 'tong', hlCount: 10, hlSum: 150
};
let r = S.scoreEvaluation(best);
// 38 (TC1) + 16 (TC2) + 17 (TC3) + 6 (TC4: 300 thành viên) + 6 (TC5) + 15 (TC6) = 98
eq('HTX tốt: tổng điểm', r.total, 98);
eq('HTX tốt: xếp loại', r.rank, 'tot');
eq('HTX tốt: đủ dữ liệu', r.complete, true);

// Ngưỡng từng chỉ tiêu
const one = (patch) => S.scoreEvaluation(Object.assign({}, best, patch));
const sc = (res, code) => res.items.find(i => i.code === code).score;

eq('1.a = 99,99% → 0', sc(one({ dtThucHien: 9999, dtKeHoach: 10000 }), '1.a'), 0);
eq('1.a = 100% → 4', sc(one({ dtThucHien: 10000, dtKeHoach: 10000 }), '1.a'), 4);
eq('1.a = 119,9% → 4', sc(one({ dtThucHien: 11990, dtKeHoach: 10000 }), '1.a'), 4);
eq('1.a = 120% → 8', sc(one({ dtThucHien: 12000, dtKeHoach: 10000 }), '1.a'), 8);
eq('1.b < 1 tỷ → 4', sc(one({ dtThucHien: 999 }), '1.b'), 4);
eq('1.b = 1 tỷ → 6', sc(one({ dtThucHien: 1000 }), '1.b'), 6);
eq('1.b = 5 tỷ → 8', sc(one({ dtThucHien: 5000 }), '1.b'), 8);
eq('1.b = 10 tỷ → 10', sc(one({ dtThucHien: 10000 }), '1.b'), 10);
eq('1.c không lợi nhuận → 0', sc(one({ thuNhap: 0 }), '1.c'), 0);
eq('1.c lỗ → 0', sc(one({ thuNhap: -50 }), '1.c'), 0);
eq('1.c 0,5 tr/tv → 2', sc(one({ thuNhap: 150, soThanhVien: 300 }), '1.c'), 2);
eq('1.c 1 tr/tv → 4', sc(one({ thuNhap: 300, soThanhVien: 300 }), '1.c'), 4);
eq('1.c 5 tr/tv → 7', sc(one({ thuNhap: 1500, soThanhVien: 300 }), '1.c'), 7);
eq('1.c 10 tr/tv → 10', sc(one({ thuNhap: 3000, soThanhVien: 300 }), '1.c'), 10);
eq('1.d đúng 20% → 5', sc(one({ thuNhap: 1000, quyPT: 200 }), '1.d'), 5);
eq('1.d 19,9% → 0', sc(one({ thuNhap: 1000, quyPT: 199 }), '1.d'), 0);
eq('1.đ đúng 5% → 5', sc(one({ thuNhap: 1000, quyDP: 50 }), '1.đ'), 5);
eq('1.đ 4,9% → 0', sc(one({ thuNhap: 1000, quyDP: 49 }), '1.đ'), 0);
eq('2.a không ưu tiên → 0', sc(one({ uuTienGia: 'khong' }), '2.a'), 0);
eq('2.b 49% → 0', sc(one({ phanPhoiPct: 49 }), '2.b'), 0);
eq('2.b 50% → 8', sc(one({ phanPhoiPct: 50 }), '2.b'), 8);
eq('3.a giảm vốn → 0', sc(one({ vonNamNay: 900, vonNamTruoc: 1000 }), '3.a'), 0);
eq('3.a không tăng → 0', sc(one({ vonNamNay: 1000, vonNamTruoc: 1000 }), '3.a'), 0);
eq('3.a tăng 10% → 3', sc(one({ vonNamNay: 1100, vonNamTruoc: 1000 }), '3.a'), 3);
eq('3.a tăng 20% → 5', sc(one({ vonNamNay: 1200, vonNamTruoc: 1000 }), '3.a'), 5);
eq('3.a tăng 49% → 5', sc(one({ vonNamNay: 1490, vonNamTruoc: 1000 }), '3.a'), 5);
eq('3.a tăng 50% → 7', sc(one({ vonNamNay: 1500, vonNamTruoc: 1000 }), '3.a'), 7);
eq('3.a năm trước 0, năm nay có → 7', sc(one({ vonNamNay: 100, vonNamTruoc: 0 }), '3.a'), 7);
eq('3.a cả hai bằng 0 → 0', sc(one({ vonNamNay: 0, vonNamTruoc: 0 }), '3.a'), 0);
eq('3.b < 500 tr → 1', sc(one({ vonHoatDong: 499 }), '3.b'), 1);
eq('3.b 500 tr → 5', sc(one({ vonHoatDong: 500 }), '3.b'), 5);
eq('3.b 1 tỷ → 7', sc(one({ vonHoatDong: 1000 }), '3.b'), 7);
eq('3.b 10 tỷ → 10', sc(one({ vonHoatDong: 10000 }), '3.b'), 10);
eq('4 : 29 TV → 2', sc(one({ soThanhVien: 29 }), '4'), 2);
eq('4 : 30 TV → 4', sc(one({ soThanhVien: 30 }), '4'), 4);
eq('4 : 100 TV → 6', sc(one({ soThanhVien: 100 }), '4'), 6);
eq('4 : 499 TV → 6', sc(one({ soThanhVien: 499 }), '4'), 6);
eq('4 : 501 TV → 8', sc(one({ soThanhVien: 501 }), '4'), 8);
eq('5 : không → 0', sc(one({ khenThuong: 'none' }), '5'), 0);
eq('5 : huyện → 3', sc(one({ khenThuong: 'huyen' }), '5'), 3);
eq('5 : tỉnh → 6', sc(one({ khenThuong: 'tinh' }), '5'), 6);

// Hài lòng: tính theo phiếu
const ph = S.scoreEvaluation({
  hlMode: 'phieu',
  phieu: [[5, 5, 5], [4, 4, 4], [3, 3, 3], [0, 5, 5], [5, 5]]   // 2 phiếu cuối không hợp lệ
});
eq('6 : bình quân phiếu hợp lệ = (15+12+9)/3 = 12', ph.items.find(i => i.code === '6').score, 12);
eq('6 : phiếu không hợp lệ bị loại', S.satisfaction({ hlMode: 'phieu', phieu: [[5, 5, 5], [0, 5, 5], [5, 5]] }).invalid, 2);

// Xếp loại theo Điều 6
eq('79,99 → khá', S.rankFromTotal(79.99), 'kha');
eq('80 → tốt', S.rankFromTotal(80), 'tot');
eq('65 → khá', S.rankFromTotal(65), 'kha');
eq('64,99 → trung bình', S.rankFromTotal(64.99), 'tb');
eq('50 → trung bình', S.rankFromTotal(50), 'tb');
eq('49,99 → yếu', S.rankFromTotal(49.99), 'yeu');
eq('bị xử phạt → yếu dù điểm cao', S.scoreEvaluation(Object.assign({}, best, { phat: true })).rank, 'yeu');
eq('mới thành lập → không xếp loại', S.scoreEvaluation({ moiThanhLap: true }).rank, 'none');
eq('mới thành lập → coi như xong (final)', S.scoreEvaluation({ moiThanhLap: true }).final, true);

// Số thập phân kiểu Việt Nam
eq('nhập "12,5" hiểu là 12.5', S.num('12,5'), 12.5);

console.log(fail ? '\n' + fail + ' LỖI' : '\nTất cả đạt');
process.exit(fail ? 1 : 0);
