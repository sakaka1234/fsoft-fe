# Báo cáo Backend Issues — lần test 2026-09-09

Test bằng tài khoản admin (`admin@gmail.com`) và user thường (`sakaka1@gmail.com` — lưu ý tài khoản này thực ra có scope `ROLE_ADMIN`, đã xác minh lại quyền bằng `sakaka2@gmail.com` là USER thuần).

## 1. 🔴 P0 — `PUT /admin/users/{userId}/ban` không chặn login của user bị ban

**Các bước tái hiện:**
1. Admin ban user `sakaka2@gmail.com` với `{"reason":"Test ban tu FE","banDurationDays":1}` → 200, response `banned: true, bannedUntil: "2026-09-10T02:58:05"`
2. User bị ban vẫn đăng nhập thành công:
   ```
   POST /auth/login (email=sakaka2@gmail.com)
   → 200 "Đăng nhập thành công"
   ```

**Kỳ vọng:** user bị ban phải bị chặn ở `/auth/login` (401/403) và mọi endpoint dùng token cũ phải trả 401/403 sau khi token được introspect.

**Phát hiện thêm:** `POST /auth/introspect` với token của user đang bị ban vẫn trả `{"result": true}` — introspect không xét trạng thái ban.

**Ảnh hưởng:** tính năng ban hiện chỉ là cờ hiển thị, không chặn được ai cả. Token đang lưu ở client của user bị ban vẫn dùng được cho tới khi hết hạn tự nhiên.

## 2. 🔴 P0 — `POST /srs/review` lỗi 500 (SpEL reflection)

**Các bước tái hiện:**
```
POST /srs/review  {"cardId":1,"rating":3}
→ 500: "EL1008E: Property or field 'deckId' cannot be found on object of type
   com.fivetuat.fsoftprojectserver.dtos.request.SrsReviewRequest"
```
Bổ sung `"deckId":27` vào body → 500 generic (`{"path":"/fsoft/srs/review"}`).

**Kỳ vọng:** `SrsReviewRequest` theo swagger chỉ có `cardId` + `rating`; server phải nhận đúng 2 field đó. Hiện server đang dùng SpEL/reflection đọc field không tồn tại → 500 với mọi request review, **toàn bộ tính năng ôn tập FSRS bị hỏng**.

## 3. 🟡 P1 — POST `/community-posts/{id}/comments` trả 500 khi gửi JSON thuần

**Các bước tái hiện:**
```
POST /community-posts/1/comments   Content-Type: application/json
→ 500: "Something went wrong: Content-Type 'application/json' is not supported"
```
Endpoint đã chuyển sang `multipart/form-data` (đúng như swagger mới), nhưng **không trả 415 Unsupported Media Type** mà trả 500 kèm stack-message — khó debug cho client cũ đang cache JSON body. Nên trả 415.

(Multipart hoạt động đúng: 201, `parentCommentId` nhận đúng, file đính kèm lên S3.)

## 4. 🟡 P1 — `GET /community-posts/comments/{commentId}/replies` trả 451 cho comment vốn là reply

**Các bước tái hiện:**
- Comment 2 là một **reply** của comment 1 (`parentCommentId=1`), tồn tại trong DB.
- `GET /community-posts/comments/2/replies` → `451 "Bình luận không tồn tại"`.

Đồng thời `POST /comments` với `parentCommentId=2` cũng 451. Nghĩa là **cây comment chỉ cho phép 2 cấp** (gốc → reply); reply vào reply bị chặn ở tầng validation bằng thông báo "không tồn tại" (451) — message này sai thực chất (comment 2 có tồn tại).

**Kỳ vọng:** hoặc (a) cho phép reply-of-reply bằng cách flat vào cùng cấp, hoặc (b) trả 400 với message rõ ràng "Chỉ được phản hồi bình luận gốc". Front-end hiện đã tuân theo (b) — chỉ render nút Reply ở comment gốc.

## 5. 🟢 Đã verify hoạt động đúng (không phải lỗi)

| Endpoint | Kết quả |
|---|---|
| `POST /community-posts/{id}/like` (toggle) | 200, `liked`/`likeCount` trả đúng, persist đúng qua GET list |
| `POST /community-posts` multipart + file | 201, `attachmentUrl` S3 + `attachmentName` |
| `POST /community-posts/{id}/comments` multipart + file | 201, attachment OK |
| `DELETE /community-posts/comments/{commentId}` phân quyền | author ✅ / chủ post ✅ / admin ✅ / user khác ❌ 455 "Bạn không có quyền xóa bình luận này" |
| `PUT /admin/users/{userId}/ban` + `/unban` | 200, `banned`/`bannedUntil`/`banReason` đúng |
| Phân quyền admin cho user thường (`sakaka2`, scope chỉ `ROLE_USER`) | `PUT /admin/users/{id}/ban` → **403** đúng |
| `POST /cards/{id}/toggle-star` | 200 `{"cardId":1108,"isStarred":true}` |
| `GET /cards/starred?deckId=50&page=0` | 200, trả đúng card đã star (page bắt đầu từ 0) |
| `POST /api/user/ai/chat` | 200, AI trả lời + toolsCalled |
| `GET /api/user/ai/chat/history` | 200, 16 turns |
| STOMP `/ws-chat` | 101 handshake OK; `/topic/community` nhận broadcast chat messages |
| `POST /community-posts` tạo bài → status PENDING cho user thường, APPROVED với admin | đúng spec |

## 6. 🟡 P2 — Không tìm thấy WebSocket topic cho post updates

Đã probe STOMP subscribe trên `/ws-chat` với các topic: `/topic/community/posts`, `/topic/community-posts`, `/topic/posts`, `/topic/post`, `/topic/community-post`, `/topic/like`, `/topic/community/like`, `/topic/community/comments`, `/topic/post/1`, `/topic/community-post-1` — kích hoạt like/comment thật sau khi subscribe, **không topic nào nhận event**.

Chỉ `/topic/community` (chat messages) hoạt động.

**Đề xuất:** BE bổ sung broadcast real-time cho post updates (like/comment) — ví dụ `/topic/community/posts` với payload `{postId, likeCount, commentCount, likedByCurrentUser}` — để FE hoàn thành task "Community UI real-time". Hiện FE đã cắm sẵn `lib/community-ws.ts` subscribe topic này; khi BE bật thì FE tự nhận, không cần đổi code.

## 7. 🟡 P2 — `POST /api/user/ai/chat` trả HTTP 436 với request tạo bộ thẻ (không có body)

**Các bước tái hiện:**
```
POST /api/user/ai/chat  {"message":"Tao bo the tieng Nhat N5"}
→ HTTP 436, body rỗng (không envelope, không message)
```
Câu hỏi trò chuyện thường ("hom nay buon qua") trả 200 bình thường với reply đầy đủ.

**Kỳ vọng:** mọi response đều phải có envelope `{status, message, data}` — kể cả lỗi. HTTP 436 không phải status code chuẩn (bảng RFC không định nghĩa 436), và body rỗng khiến client không biết lỗi gì. Nghỉ hoặc là model timeout phải trả 504 + envelope, hoặc 200 với reply lỗi khéo léo.

## 8. 🟢 Ghi nhận hành vi đặc biệt (đã ghi chú trong code)

- `AdminUserResponse.roles` là `string[]` (khác `RoleResponse[]` ở session) — cả 2 shape đều current.
- `deckTotalCards` của post không có deck trả `0` thay vì `null`; `tags`/`replies` rỗng trả `null` thay vì `[]`.
- `nextReviewDate` của study-queue trả **date-only** (`"2026-09-09"`) dù swagger khai `date-time` — FE parse cả 2 dạng.