# Spec: Admin AI Agent Console

> **Status: DRAFT — chờ review.** Chưa code cho đến khi được duyệt.

## 1. Mục tiêu

Thêm section **"Trợ lý AI"** vào admin console (`/admin`), cho phép admin:

1. Trò chuyện với AI quản trị trả lời dựa trên dữ liệu thật của hệ thống
2. Khi AI soạn một **hành động nguy hiểm** (duyệt/từ chối/xóa deck, đặt official, đổi roles), hiển thị thẻ xác nhận — hành động **không thực thi** cho đến khi admin bấm Xác nhận
3. Xem/xóa lịch sử hội thoại
4. Xem nhật ký kiểm toán (audit logs) các hành động AI đã thực hiện

## 2. Endpoint (theo docs/swagger.json)

| # | Method | Path | Body | Response |
|---|--------|------|------|----------|
| 1 | POST | `/admin/ai/chat` | `{ message (req), conversationId? }` | `AdminAiChatResponse` |
| 2 | POST | `/admin/ai/chat/confirm` | `{ actionId (req) }` | `AdminAiChatResponse` |
| 3 | POST | `/admin/ai/chat/confirm/cancel` | `{ actionId (req) }` | `AdminAiChatResponse` |
| 4 | GET | `/admin/ai/chat/history` | query `page` (default **1**), `size` (default 20) | `AdminAiChatHistoryResponse[]` |
| 5 | DELETE | `/admin/ai/chat/history` | — | void |
| 6 | GET | `/admin/ai/audit-logs` | query `page` (default **1**), `size` (default 10) | `PageResponse<AdminAiAuditLogResponse>` |

### Shape dữ liệu

```
AdminAiChatResponse {
  conversationId: string
  reply: string                    // câu trả lời của bot (markdown)
  pendingAction?: PendingActionResponse
  result: string
}

PendingActionResponse {           // hành động đã soạn, CHƯA thực thi
  actionId: string
  tool: string                    // ví dụ: approve_public_deck, delete_deck...
  summary: string                 // mô tả hành động bằng lời
  expiresAt: string               // ISO — hết hạn sau 5 phút
}

AdminAiChatHistoryResponse { role: "user"|"assistant"|"system", content: string }

AdminAiAuditLogResponse {
  id: number
  action: string                  // tên tool
  params: string                  // JSON string tham số đã gửi
  status: string                  // EXECUTED | CANCELLED | FAILED
  resultSummary: string
  referenceId: string             // id đối tượng bị tác động (vd deckId)
  createdAt: string
}
```

### Quy tắc nghiệp vụ từ mô tả API

- **Confirm**: lỗi **462** nếu `actionId` không tồn tại/đã xử lý; lỗi **463** nếu quá hạn 5 phút. Chỉ admin tạo hành động mới confirm được. Mỗi `actionId` dùng đúng một lần.
- **Cancel**: ghi audit log với status `CANCELLED`.
- **History**: thread bền vững theo admin hiện tại (JDBC chat memory).

⚠️ **Lưu ý phân trang**: hai endpoint GET dùng `page` bắt đầu từ **1** (default 1) — khác với `pending-public` (0-based) và `decks` (1-based). Cần verify live khi implement vì backend có tiền lệ lệch pageNo.

## 3. Thiết kế UI

### 3.1 Vị trí trong admin console

`components/app/admin-view.tsx`:

- Thêm `"ai"` vào `type Section` và `SECTIONS` với label **"Trợ lý AI"**, icon `Robot` (Phosphor)
- Render `{section === "ai" ? <AdminAiSection /> : null}`
- Header mô tả console cập nhật: thêm "trợ lý AI" vào câu mô tả

### 3.2 Component mới: `components/app/admin-ai-view.tsx`

```
AdminAiSection
├── Sub-tab switcher (cùng idiom với ModerationSection)
│   ├── "Trợ lý"     → AdminAiChatPanel
│   └── "Nhật ký"    → AdminAiAuditLogPanel
```

#### AdminAiChatPanel (trái tim của section)

- **Khởi tạo**: mount → `GET /admin/ai/chat/history?page=1&size=50` render thread cũ; lưu `conversationId` từ lần chat đầu tiên
- **Thread**: bubble user (phải, bg-accent) / assistant (trái, bg-surface-2), render markdown bằng pattern `FormattedMarkdown` (đã có trong `deck-ai-chat.tsx`, copy ra dùng chung — không import chéo vì component đó scoped deck)
- **Starter prompts** khi thread rỗng, ví dụ:
  - "Tổng quan hệ thống hôm nay"
  - "Có bộ thẻ nào đang chờ duyệt không?"
  - "Liệt kê 5 người dùng mới nhất"
- **Gửi tin**: POST `/admin/ai/chat` `{message, conversationId?}` → append 2 bubble; lưu `conversationId` trả về
- **Thẻ hành động chờ xác nhận** (khi `pendingAction` tồn tại) — phần quan trọng nhất:
  ```
  ┌─────────────────────────────────────────┐
  │ ⚠  Hành động chờ xác nhận                │  (viền amber/danger)
  │ Tool: approve_public_deck                │
  │ {summary}                                │
  │ Hết hạn sau 4:32                         │  (đếm ngược từ expiresAt)
  │                        [Huỷ]  [Xác nhận] │
  └─────────────────────────────────────────┘
  ```
  - **Xác nhận** → POST `confirm` → append reply mới vào thread; nếu thành công hiện kết quả; nếu 462/463 → inline error "Hành động đã xử lý/hết hạn", vô hiệu hoá nút
  - **Huỷ** → POST `confirm/cancel` → append note "Đã huỷ hành động"
  - Trong lúc action chờ: **disable ô nhập** (tránh gửi thêm lệnh khi chưa xử lý xong — an toàn hơn)
  - Đếm ngược update mỗi giây; đến 0 → nút chuyển disabled + nhãn "Đã hết hạn"
- **Xoá lịch sử**: nút "Xoá hội thoại" trên header panel → `ConfirmDialog` (destructive) → `DELETE /admin/ai/chat/history` → reset thread + conversationId
- **Đang gửi**: disabled input + "AI đang soạn..." như deck-ai-chat

#### AdminAiAuditLogPanel

- `GET /admin/ai/audit-logs?page=&size=10` + `Pager` dùng sẵn
- Mỗi dòng: action (font-mono), status badge — `EXECUTED` (emerald), `CANCELLED` (muted), `FAILED` (danger) — `resultSummary`, `referenceId`, thời gian `vi-VN`
- `params` hiển thị trong `<details>` thu gọn (JSON đẹp, font-mono, có thể dài)
- Empty state: "Chưa có hành động AI nào được thực hiện"

#### UI Audit Logs chi tiết

Đây là phần minh bạch/quan trọng nhất về mặt trách nhiệm — thiết kế chi tiết:

**Layout mỗi dòng (dạng card-list giống UsersSection):**
```
┌──────────────────────────────────────────────────────────────┐
│ [approve_public_deck]  ● EXECUTED          08/09/2026 14:32  │
│ Duyệt deck "Vocab LGBT" công khai                            │
│ ▸ Tham số & chi tiết (details thu gọn)                       │
└──────────────────────────────────────────────────────────────┘
```

- **Dòng 1**: `action` trong badge font-mono (bg-surface-2) + status badge có chấm màu:
  - `EXECUTED` → emerald dot + text
  - `CANCELLED` → muted dot + text
  - `FAILED` → danger dot + text
  - Status khác/unknown → neutral
  - Thời gian bên phải: `toLocaleString("vi-VN")` (ngày + giờ phút)
- **Dòng 2**: `resultSummary` — nội dung chính, text-ink/80; fallback "—" nếu rỗng
- **Dòng 3**: `<details><summary>Tham số & chi tiết</summary>`:
  - Bảng nhỏ: `referenceId` (nếu có, font-mono), `params` render JSON:
    - Thử `JSON.parse(params)` → render `<pre>` indent 2, font-mono, break-all
    - Parse fail → render nguyên chuỗi trong `<pre>` (server trả string tự do)
- **Pager**: dùng `Pager` có sẵn của admin-view, `last` = `content.length < PAGE_SIZE`
- **Phân trang**: gửi `page` bắt đầu từ **1**; response `PageResponse` chuẩn — render không dùng `pageNo` trả về (tiền lệ lệch pageNo)
- **Loading**: `RowSkeleton count={5}`; **Error**: `SectionError` (phân biệt access-denied như các section khác)
- **Empty**: `EmptyState` "Chưa có hành động AI nào được thực hiện"
- **Số liệu tổng**: hiển thị `totalElements` cạnh tiêu đề phụ của panel ("12 hành động")

### 3.3 API layer: `lib/api/admin-ai.ts` (file mới)

`admin.ts` đã 430+ dòng; tách module AI riêng cho gọn:

```
adminAiChat(body: AdminAiChatRequest, signal?)
adminAiConfirm(actionId: string, signal?)        // POST /confirm
adminAiConfirmCancel(actionId: string, signal?)  // POST /confirm/cancel
adminAiChatHistory(page, size, signal?)          // GET — gửi page bắt đầu từ 1
adminAiClearChatHistory(signal?)                 // DELETE
adminAiAuditLogs(page, size, signal?)            // GET — gửi page bắt đầu từ 1
```

### 3.4 Types: thêm vào `lib/api/types.ts`

```
AdminAiChatRequest, AdminAiChatResponse, AdminAiPendingAction,
AdminAiConfirmRequest, AdminAiChatHistory, AdminAiAuditLog,
AdminAiAuditLogStatus = "EXECUTED" | "CANCELLED" | "FAILED"
```

## 4. Điều ẩn đáng chú ý / rủi ro

1. **Server có thể chưa trả đủ field** — như bài `pendingPublic`, field tồn tại trong swagger nhưng response thiếu. Implement sẽ verify live trước, UI degrade an toàn (thẻ không render nếu thiếu field).
2. **462/463**: HTTP status ngoài chuẩn. `apiFetch` xử lý mọi non-2xx thành `ApiError(message)` — chỉ cần hiển thị `error.message`.
3. **Page 1-based**: nếu gửi `page=0` có thể mất trang đầu hoặc lỗi — sẽ verify live trong lúc implement.
4. **result vs reply**: response có cả hai; assumption = `reply` là nội dung chat, `result` là chuỗi kết quả khi có hành động. UI sẽ ưu tiên `reply`, dùng `result` làm phụ đề trên thẻ hành động.

## 5. Phạm vi KHÔNG làm (YAGNI)

- Streaming/SSE (API là request/response thuần)
- Tạo deck/user trực tiếp từ chat UI ngoài thẻ xác nhận
- Audit log filter/search (API chưa hỗ trợ param ngoài page/size)

## 6. Kiểm thử

### 6.1 Kiểm tra tĩnh (trước khi chạy)

| # | Lệnh | Kỳ vọng |
|---|------|----------|
| 1 | `npx tsc --noEmit` | 0 error |
| 2 | `npx eslint lib/api/admin-ai.ts components/app/admin-ai-view.tsx components/app/admin-view.tsx` | 0 error mới (warning cũ bỏ qua) |
| 3 | Kiểm tra `admin-view.tsx` render section: đăng nhập admin → `/admin` → nav có tab "Trợ lý AI", bấm vào thấy 2 sub-tab "Trợ lý" + "Nhật ký" | UI đúng |

### 6.2 Live API — thiết lập

- Backend: `https://fsoft-project-production.up.railway.app/fsoft`
- Admin: `admin@gmail.com` / `13456789` (đã có quyền ADMIN)
- User thường: `sakaka1@gmail.com` / `Sa123456@`
- Deck test sẵn có: **#24** (đang pendingPublic) — dùng cho test hành động; **#19** để test approve/reject
- Login lấy token: `POST /auth/login` → `data.token.accessToken`

### 6.3 Test API layer trực tiếp (PowerShell, trước khi test UI)

| # | Kịch bản | Request | Kỳ vọng |
|---|----------|---------|---------|
| A1 | `POST /admin/ai/chat` body `{"message":"Có bao nhiêu người dùng trong hệ thống?"}` | 200; `data.reply` không rỗng; `data.conversationId` là string; `data.pendingAction` = null |
| A2 | Chat tiếp `{"message":"...","conversationId":"<id A1>"}` | 200; context được nhớ (câu trả lời liên quan A1) |
| A3 | Yêu cầu hành động: `{"message":"Duyệt deck 24 lên public"}` | 200; `data.pendingAction` có đủ `actionId`, `tool` (string), `summary`, `expiresAt` (ISO, ~5 phút sau hiện tại); `reply` mô tả hành động |
| A4 | **Không confirm, chờ 5 phút**, chat lại A3 → lấy actionId cũ gọi `POST /admin/ai/chat/confirm` `{"actionId":"<expired>"}` | HTTP **463** → `ApiError` với message có nghĩa (không crash) |
| A5 | Gọi confirm với actionId **ngẫu nhiên** `"00000000-0000-0000-0000-000000000000"` | HTTP **462** → ApiError message |
| A6 | Gọi confirm 2 lần liên tiếp với cùng actionId hợp lệ | Lần 1: 200; lần 2: **462** (mỗi actionId dùng 1 lần) |
| A7 | Cancel: tạo pendingAction mới (lặp A3), gọi `POST /admin/ai/chat/confirm/cancel` | 200; deck 24 **vẫn pending** (chưa duyệt); audit log xuất hiện dòng `CANCELLED` |
| A8 | History: `GET /admin/ai/chat/history?page=1&size=20` | 200; mảng `{role, content}`; role chỉ là `user`/`assistant`/`system`; tin nhắn mới nhất... (xác định thứ tự: mới nhất trước hay sau — ghi lại) |
| A9 | History phân trang: `page=1` và `page=2` với `size=5` | Không trùng lặp giữa 2 trang; xác nhận **1-based** có đúng không (nếu `page=0` vẫn trả trang đầu → backend 0-based, cập nhật code) |
| A10 | Xoá history: `DELETE /admin/ai/chat/history` | 200; gọi lại GET → mảng rỗng; chat lại → thread mới (conversationId mới) |
| A11 | Audit logs: `GET /admin/ai/audit-logs?page=1&size=10` | 200; `PageResponse` chuẩn (`content`, `totalElements`, `totalPages`, `last`); mỗi dòng đủ 7 field của `AdminAiAuditLogResponse` |
| A12 | Audit phân trang 1-based như A9 | Xác nhận; nếu lệch → sửa code trước khi viết UI pager |
| A13 | Gọi `POST /admin/ai/chat` bằng **token user thường** (sakaka1) | 403/401/500 (backend dùng 500 cho denied) → `ApiError`; **UI phải hiện SectionError "không có quyền", không retry** |

**Ghi nhận sau A3–A13 (bắt buộc lưu lại vào code comments như các file API khác):**
- Status thực tế của 462/463 (HTTP status hay 200+error body?)
- Thứ tự history (mới nhất trước hay sau)
- Page 0 hay 1 based (thực hành)
- Field nào thiếu trong response thật (so với swagger) — tiền lệ `pendingPublic`

### 6.4 Test UI — kịch bản tay trên `/admin`

**Scenario 1 — Chat thường (5 phút)**
1. Đăng nhập admin → `/admin` → tab "Trợ lý AI"
2. Thread rỗng → thấy 3 starter prompts
3. Bấm starter "Có bộ thẻ nào đang chờ duyệt không?"
4. → bubble user (phải, accent) xuất hiện ngay; "AI đang soạn..." hiện
5. → reply assistant (trái, surface-2) render markdown; input enable lại
6. **Kỳ vọng**: không lỗi, conversationId được giữ cho lượt sau

**Scenario 2 — Vòng đời pendingAction (10 phút)**
1. Chat: "Duyệt deck 24 lên public"
2. → thẻ hành động amber hiện **trong luồng chat** với tool/summary/đếm ngược
3. → **ô nhập bị disabled** trong lúc hành động chờ
4. Bấm **Huỷ** → note "Đã huỷ hành động"; input enable; audit log có `CANCELLED`
5. Chat lại yêu cầu duyệt → thẻ mới → bấm **Xác nhận**
6. → reply kết quả vào thread; thẻ mất trạng thái pending
7. **Verify dữ liệu thật**: sang section "Bộ thẻ" → lọc PUBLIC → deck 24 xuất hiện (hoặc GET `/admin/decks?visibility=PUBLIC`)
8. Bấm Xác nhận lần thứ 2 trên cùng thẻ (nếu còn) → inline error 462, không crash

**Scenario 3 — Countdown hết hạn**
1. Tạo pendingAction, không thao tác
2. Xem đếm ngược chạy mỗi giây (4:59 → 0:00)
3. Hết hạn → nút disabled, nhãn "Đã hết hạn"; input unlock lại
4. Confirm sau hết hạn → inline error (463 message)

**Scenario 4 — Xoá hội thoại (2 phút)**
1. Sau vài lượt chat, bấm "Xoá hội thoại" → `ConfirmDialog` destructive
2. Xác nhận → thread rỗng, hiện lại starter prompts
3. GET history → rỗng (đối chiếu 6.3 A10)

**Scenario 5 — Audit logs (5 phút)**
1. Sub-tab "Nhật ký" → thấy các dòng từ Scenario 2 (EXECUTED + CANCELLED)
2. Dòng EXECUTED: chấm emerald; CANCELLED: chấm muted
3. Mở `<details>` → `params` JSON indent đẹp; `referenceId` = "24"
4. `totalElements` hiển thị đúng số; Pager: bấm trang 2 (cần ≥11 log) → danh sách khác, không trùng trang 1
5. Nếu params không parse được JSON → hiển thị raw string trong `<pre>` (không crash)

**Scenario 6 — Gate quyền (2 phút)**
1. Đăng nhập `sakaka1@gmail.com` → gõ tay `/admin`
2. → EmptyState "Khu vực quản trị" (AdminGate), **không** thấy tab AI
3. Đăng nhập admin lại → mọi thứ hoạt động

**Scenario 7 — Dark mode + responsive (3 phút)**
1. Toggle dark mode → thẻ amber, badge status, bubble chat vẫn đọc được (contrast)
2. Thu hẹp cửa sổ ~375px → thread, thẻ hành động, audit card không tràn ngang

### 6.5 Regression (sau khi xong)

| # | Kiểm tra | Vì sao |
|---|----------|--------|
| R1 | Tab khác admin (Users, Decks, Chờ duyệt) vẫn hoạt động | sửa `admin-view.tsx` có thể vỡ import |
| R2 | Duyệt/từ chối deck bằng tay ở "Chờ duyệt" vẫn hoạt động | không đụng tới `approvePublicDeck` |
| R3 | Chat AI thường (deck detail) vẫn hoạt động | không đụng tới `aiChat` trong `lib/api/ai.ts` |
| R4 | Chạy lại 6.1 | chốt |

## 7. Files sẽ tạo/sửa

| File | Hành động |
|------|-----------|
| `lib/api/types.ts` | thêm 6 types |
| `lib/api/admin-ai.ts` | tạo mới |
| `components/app/admin-ai-view.tsx` | tạo mới |
| `components/app/admin-view.tsx` | thêm section "ai" + 1 import |