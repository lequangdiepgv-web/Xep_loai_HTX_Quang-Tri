# Xếp loại HTX nông nghiệp

Công cụ chấm điểm, xếp loại hợp tác xã nông nghiệp theo **Văn bản hợp nhất số 85/VBHN-BNNMT** (6 tiêu chí, 100 điểm, 4 mức xếp loại).
Chạy trên trình duyệt và **cài được như app** trên Android, iPhone/iPad, máy tính (PWA). Không cần máy chủ; dữ liệu lưu ngay trên thiết bị.

## Tính năng

- **Danh sách HTX** theo xã, lĩnh vực (7 loại theo Điều 3).
- **Chấm điểm** 12 chỉ tiêu của 6 tiêu chí, tính điểm và xếp loại ngay khi nhập; nhập phiếu hài lòng từng phiếu hoặc tổng hợp.
- **Tổng hợp theo xã**: số HTX tốt / khá / trung bình / yếu / không xếp loại / chưa xong, điểm trung bình, biểu đồ.
- **Xuất CSV** (mở bằng Excel) bảng tổng hợp và chi tiết từng HTX.
- **In Bảng tự chấm điểm** theo mẫu Phụ lục 3.
- **Sao lưu / gộp dữ liệu** bằng tệp .json (xã gửi tệp lên tỉnh để gộp).
- Chạy offline sau lần mở đầu tiên.

## Cấu trúc thư mục

| Tệp | Vai trò |
|---|---|
| `index.html` | Khung trang |
| `styles.css` | Giao diện |
| `scoring.js` | **Logic chấm điểm, xếp loại** (sửa tại đây nếu văn bản thay đổi) |
| `app.js` | Xử lý giao diện, lưu dữ liệu, xuất/nhập, in |
| `manifest.webmanifest`, `sw.js`, `icons/` | Để cài như app và chạy offline |
| `test-scoring.js` | Kiểm thử logic chấm điểm: chạy `node test-scoring.js` |

## Bước 1: Chạy thử trên máy

Giải nén, bấm đúp `index.html`. App chạy được ngay (chưa cài được lên điện thoại ở bước này).
Bấm **Dữ liệu & Cài đặt → Nạp dữ liệu mẫu** để xem thử.

## Bước 2: Đưa lên GitHub Pages (để dùng trên điện thoại)

1. Đăng nhập github.com → **New repository** → đặt tên, ví dụ `xep-loai-htx` → **Public** → Create.
2. Bấm **uploading an existing file**, kéo thả **toàn bộ nội dung** thư mục (gồm cả thư mục `icons`) vào → **Commit changes**.
3. Vào **Settings → Pages** → mục *Branch* chọn `main`, thư mục `/ (root)` → **Save**.
4. Sau 1-2 phút, địa chỉ app là `https://<tên-tài-khoản>.github.io/xep-loai-htx/`.

> Lưu ý: GitHub Pages công khai là *mã nguồn app*. Dữ liệu HTX nhập vào chỉ nằm trên từng thiết bị, không đưa lên GitHub.

## Bước 3: Cài lên điện thoại

- **Android (Chrome):** mở địa chỉ app → menu ⋮ → **Cài đặt ứng dụng**.
- **iPhone/iPad (Safari):** mở địa chỉ app → nút **Chia sẻ** → **Thêm vào MH chính**.
- **Máy tính (Chrome/Edge):** biểu tượng cài đặt ở cuối thanh địa chỉ.

## Cách dùng

1. **Danh sách HTX → + Thêm HTX**: nhập tên, xã, lĩnh vực, địa chỉ, người đại diện, điện thoại. Nút **Xem** (hoặc **Xem thông tin HTX** trong màn chấm điểm) hiện nhanh thông tin và kết quả năm.
2. Chọn HTX → nhập số liệu của năm đánh giá (chọn năm ở góc trên bên phải). Đơn vị tiền: **triệu đồng**.
3. Xem kết quả ở thanh xanh phía dưới; bấm **In bảng tự chấm điểm** nếu cần ký, đóng dấu.
4. Tab **Tổng hợp** cho bảng theo xã và nút xuất CSV.

## Quy ước tính điểm (nên đối chiếu với đơn vị)

- Tiêu chí 1 = 38 điểm, 2 = 16, 3 = 17, 4 = 8, 5 = 6, 6 = 15 (tổng 100 theo Phụ lục 1).
- 1.b (tổng doanh thu) lấy theo doanh thu thực hiện; tỷ lệ trích quỹ (1.d, 1.đ) tính trên số thu nhập ở 1.c.
- Đúng 500 thành viên: văn bản không nêu rõ, app tính 8 điểm.
- Tiêu chí 5: mức 3 điểm hiển thị là "Được cấp xã khen thưởng" (văn bản gốc ghi cấp huyện).
- Bị xử phạt vi phạm hành chính trong năm → xếp loại yếu; HTX mới thành lập chưa đủ 12 tháng → không xếp loại.

## Đồng bộ Google Sheets (nhiều cán bộ cùng nhập)

App có sẵn chức năng đồng bộ về một Google Sheets chung bằng Google Apps Script. Mã máy chủ và hướng dẫn từng bước nằm ở thư mục **`htx-apps-script`** (cùng cấp với thư mục `htx-app` trong tệp zip): `Code.gs` và `HUONG-DAN-DONG-BO.md`.
**Không đưa thư mục `htx-apps-script` lên GitHub** vì `Code.gs` chứa mã khóa riêng.
Sau khi triển khai, nhập địa chỉ Web app và mã khóa trong app: **Dữ liệu & Cài đặt → Đồng bộ Google Sheets**.

## Cập nhật app

Sau khi sửa code và tải lại lên GitHub, hãy tăng số phiên bản trong `sw.js` (`htx-app-v1` → `htx-app-v2`) để thiết bị nhận bản mới.

## Hướng phát triển

- Đóng gói lên App Store / Google Play (Capacitor) nếu cần.
