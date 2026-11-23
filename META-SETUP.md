# Đồng bộ Meta Insights

Dashboard là GitHub Pages nên không được gọi Meta API trực tiếp. Workflow `.github/workflows/sync-meta-insights.yml` chạy lúc 09:20 giờ Việt Nam, lấy dữ liệu của các ngày đã hoàn tất và chỉ commit tệp tổng hợp `data/meta-insights.json`. Access token không được ghi vào Git, JSON công khai hay mã frontend.

## 1. Chuẩn bị quyền trong Meta

1. Dùng tài khoản có vai trò quản trị viên đối với Facebook Page DNY và ad account DNY trong Meta Business Manager.
2. Tạo Meta app loại Business, thêm Facebook Login hoặc luồng token phù hợp với mô hình Business Manager của DNY.
3. Cấp cho system user/tài khoản tạo token các quyền tối thiểu:
   - `pages_show_list`, `pages_read_engagement` và `read_insights` để đọc Page Insights;
   - `ads_read` để đọc Ads Insights;
   - quyền truy cập Page và ad account tương ứng trong Business Settings.
4. Dùng system-user token được phê duyệt cho môi trường production. Workflow dùng token này để lấy Page access token nội bộ cho đúng Page, rồi dùng Page token đó chỉ cho Page Insights; Ads Insights vẫn dùng system-user token. Không dùng token cá nhân ngắn hạn cho lịch tự động. Thiết lập lịch xoay token, ghi chủ sở hữu và ngày hết hạn nội bộ.

Meta có thể yêu cầu App Review/Business Verification tùy app, vai trò người dùng và môi trường. Kiểm tra token bằng công cụ Access Token Debugger; chỉ kiểm tra quyền và ngày hết hạn, không dán token vào issue, chat hay log.

## 2. Cấu hình GitHub

Trong repository: **Settings → Secrets and variables → Actions → Secrets**, thêm:

| Secret | Giá trị |
| --- | --- |
| `META_ACCESS_TOKEN` | Token Meta có quyền tối thiểu ở trên |
| `META_PAGE_ID` | ID số của Facebook Page DNY |
| `META_AD_ACCOUNT_ID` | ID tài khoản quảng cáo, có hoặc không có tiền tố `act_` |

Tùy chọn trong **Variables** (không phải Secrets):

| Variable | Mặc định | Dùng khi |
| --- | --- | --- |
| `META_GRAPH_API_VERSION` | `v25.0` | Meta yêu cầu phiên bản Graph mới hơn |
| `META_PAGE_METRICS` | `page_impressions,page_post_engagements,page_follows` | Cần thay tên chỉ số do thay đổi API/quyền |

Giữ Actions log ở mức bình thường: workflow không in token, URL có token hay payload thô. Chỉ người cần vận hành mới có quyền đọc/cập nhật Secrets. Bật branch protection cho `main` và giới hạn ai có thể sửa workflow.

## 3. Chạy và xác thực lần đầu

1. Vào **Actions → Sync Meta Insights → Run workflow**, giữ `days = 14`.
2. Xác nhận job thành công, commit chỉ thay đổi `data/meta-insights.json`, và tệp không có token/ID nhạy cảm ngoài các số liệu đã chọn công khai.
3. Mở dashboard, phần **Meta API và đối chiếu GA4** phải hiển thị kỳ dữ liệu, Page Insights và Ads Insights.
4. Đối chiếu một ngày với Meta Business Suite/Ads Manager. Lưu ý múi giờ của ad account và `Asia/Ho_Chi_Minh` phải được thống nhất trước khi so sánh.
5. Đối chiếu phiên Facebook với GA4 theo cùng ngày, cùng UTM (`utm_source=facebook`, `utm_medium=organic_social` hoặc `paid_social`). Meta link clicks và GA4 sessions là hai cách đo khác nhau; không suy ra chênh lệch là lỗi nếu chưa kiểm tra chuyển hướng, consent và thời điểm ghi nhận.

Nếu một page metric không được Meta trả về, chạy lại với `META_PAGE_METRICS` chỉ gồm metric được quyền hỗ trợ; không nới quyền token chỉ để thử.
