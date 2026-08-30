# Báo cáo vấn đề Backend

**Ngày:** 2026-08-28 (thay thế bản 2026-08-26)
**Người báo:** team Frontend
**Môi trường:** `https://fsoft-project-production.up.railway.app/fsoft`
**Đối chiếu với:** `docs/swagger.json` (93 path / 106 operation / 142 schema) và `docs/ai-testing-guide.md`

Mọi mục đều **gọi thật lên production** với hai tài khoản: một `ROLE_USER` và một `ROLE_ADMIN`. Không suy diễn từ spec. Chỗ nào chưa kiểm được đều ghi rõ **CHƯA KIỂM**.

---

## Đã sửa từ bản báo cáo trước

Ba lỗi P0 của bản trước **nay đã hết**. Ghi lại để không ai đuổi theo vấn đề cũ:

| Vấn đề cũ | Trạng thái hiện tại |
|---|---|
| `POST /api/ai/chat` luôn 500 | **Chạy.** Trả lời có trích dẫn trong ~6s |
| `POST /api/ai/quiz` luôn 500 | **Chạy.** Nhánh tất định trả 10 câu trong 0,47s, tốn 0 token LLM |
| 3 endpoint `extract/*` luôn trả mảng rỗng | **Chạy.** Trả về thẻ thật |

Ba lỗi cũ vẫn **chưa sửa**: `share-link/toggle` không lật cờ, `PATCH /admin/decks/{id}/official` không lật cờ, và bug `phone IS NULL` khi đăng ký.

---

## Tóm tắt

| # | Vấn đề | Mức |
|---|---|---|
| 1 | `POST /notifications` cho phép ghi thông báo vào hộp thư **bất kỳ ai** | **P0 bảo mật** |
| 2 | Lịch sử `/api/ai/roleplay/history` **không giới hạn theo người dùng** | **P0 bảo mật** |
| 3 | `PUT` và `DELETE /tags/{id}` **đã bị xoá** mà không báo | **P1** |
| 4 | `GET /api/ai/extract/suggestions` hỏng hoàn toàn, 9/9 lần 500 | **P1** |
| 5 | `export/excel` sập vì lỗi font JVM headless | **P1** |
| 6 | `POST /api/ai/auto-deck` báo "tạo thành công" nhưng **không lưu gì** | **P1** |
| 7 | Trường `read` của notification **luôn false** | **P1** |
| 8 | `GET /cards/starred?sort=...` trả 500 và **lộ nguyên câu JPQL** | **P1** |
| 9 | `PATCH /admin/decks/{id}/official` không lật cờ (đã báo, chưa sửa) | **P1** |
| 10 | `share-link/toggle` không lật cờ (đã báo, chưa sửa) | **P1** |
| 11 | `DeckResponse.totalCards` sai lệch tới một bậc độ lớn | **P1** |
| 12 | Một endpoint AI có **ba kiểu envelope lỗi** khác nhau | **P2** |
| 13 | `docs/ai-testing-guide.md` sai đường dẫn và sai shape ở nhiều mục | **P2** |
| 14 | Trường bắt buộc bị spec đánh dấu optional (nhiều chỗ) | **P2** |
| 15 | Sinh nội dung AI trả về `imageUrl`/`audioUrl` **bịa** | **P2** |
| 16 | `conversationId` bị cắt còn 36 ký tự **âm thầm** | **P2** |
| 17 | `/srs/mastery?deckId` không kiểm quyền sở hữu | **P2** |
| 18 | `last` trong `PageResponse` **luôn false** | **P2** |
| 19 | Phân trang giờ có **ba** quy ước khác nhau | **P2** |
| 20 | `/notifications` trả mảng phẳng, không có tổng số | **P3** |
| 21 | `POST /api/ai/story` với danh sách rỗng trả `status 403 "Invalid key"` | **P3** |
| 22 | Bug `phone IS NULL` khi đăng ký (đã báo, chưa sửa) | **P2** |
| 23 | Thiếu quyền trả 500 chứ không phải 403 (đã báo, chưa sửa) | **P1** |
| 24 | `export/pdf` **mất toàn bộ dấu tiếng Việt** vì font Helvetica + WinAnsi | **P1** |
| 25 | `space-striker/rooms/{code}/answer` **không idempotent**, nộp lại là trừ máu tiếp | **P1** |

---

## P0 — Bảo mật

### 1. Bất kỳ ai cũng ghi được thông báo vào hộp thư người khác

`POST /notifications` **không kiểm tra** `recipientId` có phải chính người gọi hay không.

```bash
curl -X POST "$BASE/notifications" -H "Authorization: Bearer $USER_TOKEN" \
  -H 'Content-Type: application/json' -d '{
    "recipientId":"<uuid của người khác>",
    "title":"...","content":"...","type":"SYSTEM"}'
# HTTP 200 — thông báo nằm trong hộp thư của người đó
```

Một tài khoản `ROLE_USER` bình thường có thể spam thông báo vào bất kỳ ai. FE **cố ý không đưa endpoint này lên giao diện** vì làm vậy là dựng sẵn công cụ spam trên một lỗi backend.

**Mong đợi:** chỉ cho tự gửi cho chính mình, hoặc giới hạn ở `ROLE_ADMIN`.

---

### 2. Lịch sử hội thoại roleplay đọc được bởi bất kỳ ai biết id

`GET /api/ai/roleplay/history?conversationId=...` **không lọc theo người gọi**. Bất kỳ tài khoản đã đăng nhập nào đoán hoặc biết được `conversationId` đều đọc được toàn bộ nội dung hội thoại.

Nguy hiểm hơn vì `conversationId` là chuỗi tự do do client đặt, nên các id dễ đoán (`session-interview-01`, tên người dùng, ngày tháng) là chuyện đương nhiên xảy ra.

FE hiện **không gửi `conversationId`**, để server tự khoá theo id tài khoản — nhưng đó chỉ là né, không phải sửa.

**Mong đợi:** lọc theo chủ sở hữu, và kiểm tương tự cho `DELETE`.

---

## P1 — Hỏng hoặc gây bug nghiêm trọng

### 3. `PUT` và `DELETE /tags/{id}` đã bị xoá

```bash
curl -X PUT "$BASE/tags/999999" -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' -d '{"name":"x"}'
# HTTP 500 "Something went wrong: No static resource tags/999999"
```

Đây là cách backend này báo 404. Hai route đó biến mất khỏi swagger giữa hai lần cập nhật, và **màn Tags của FE đã hỏng** cho tới khi chúng tôi phát hiện: bấm sửa tên hay xoá tag đều ra lỗi 500 khó hiểu.

Chức năng đã chuyển sang `/admin/tags/{id}`, tức chỉ admin làm được. FE đã sửa theo hướng đó.

**Đề nghị:** khi xoá route công khai, báo trước. Nếu là cố ý thì nói rõ để FE gỡ đúng chỗ thay vì để người dùng gặp 500.

---

### 4. `GET /api/ai/extract/suggestions` hỏng hoàn toàn

```bash
curl "$BASE/api/ai/extract/suggestions?query=meet" -H "Authorization: Bearer $TOKEN"
# HTTP 500 "Something went wrong: Failed to read resource"   (~0,4s)
```

**9/9 lần thất bại**, với cả token user lẫn admin, năm truy vấn khác nhau. Chưa lần nào trả về body thành công, nên **shape response chưa từng được nhìn thấy**.

Thông báo "Failed to read resource" và độ trễ 0,4s cho thấy lỗi khi nạp file prompt template, không phải lỗi gọi model.

**FE bỏ qua endpoint này.** Đây đúng ra là tính năng gợi ý gõ-tới-đâu-hiện-tới-đó cho form thêm thẻ, rất đáng làm, nhưng không thể viết client cho thứ chưa bao giờ trả về gì.

---

### 5. `export/excel` sập vì lỗi font JVM

```bash
curl "$BASE/cards/deck/11/export/excel" -H "Authorization: Bearer $TOKEN"
# HTTP 500 "Handler dispatch failed:
#   java.lang.NoClassDefFoundError: Could not initialize class sun.awt.X11FontManager"
```

JVM chạy headless nhưng thư viện Excel vẫn cố khởi tạo font system. **Cách sửa thường là thêm `-Djava.awt.headless=true`** vào tham số khởi động.

Bản PDF cùng nhóm (`export/pdf`) trả về file PDF hợp lệ kèm `Content-Disposition`, nên FE đã ghép PDF và bỏ Excel. Nhưng nội dung bên trong file thì **mất hết dấu tiếng Việt** — xem mục 24.

---

### 6. `POST /api/ai/auto-deck` báo tạo thành công nhưng không lưu gì

Response trả `message: "Tạo bộ thẻ thành công"` và `status: 201`, nhưng **không có `deckId`, không có `cardId`**, và không có bộ thẻ nào được tạo ra.

Kiểm chứng: danh sách deck của tài khoản **không đổi** trước và sau ba lần sinh.

Nó thực chất là **API xem trước**, không phải API tạo. Câu chữ trong response nói ngược lại và sẽ khiến người tích hợp tưởng đã lưu xong.

**Mong đợi:** hoặc đổi message thành "sinh nội dung thành công", hoặc lưu thật và trả `deckId`. FE hiện phải tự tạo deck rồi `POST` từng thẻ một.

---

### 7. Trường `read` của notification luôn false

Đánh dấu đã đọc **có lưu thật** (số đếm chưa đọc giảm đúng), nhưng mọi response từ **mọi endpoint** trong nhóm đều trả `read: false`, kể cả ngay sau khi vừa đánh dấu.

**Hệ quả:** không thể vẽ trạng thái đã đọc/chưa đọc cho từng dòng — làm vậy thì mọi thứ sẽ hiện "chưa đọc" vĩnh viễn. FE vì thế chỉ dùng **số đếm** (chính xác) cho badge chuông, và không tô màu từng dòng.

---

### 8. `GET /cards/starred?sort=...` trả 500 và lộ nguyên câu truy vấn

```bash
curl "$BASE/cards/starred?sort=word" -H "Authorization: Bearer $TOKEN"
# HTTP 500, message chứa nguyên văn:
#   SELECT ucs.card FROM UserCardStar ucs WHERE ucs.profile.id = :profileId
#   AND (:deckId IS NULL OR ucs.card.deck.id = :deckId)
#   ORDER BY ucs.createdAt DESC, ucs.word asc
```

Hai vấn đề: khoá sắp xếp phân giải vào entity join `UserCardStar` chứ không vào `Card`, nên mọi khoá hữu ích (`word`, `meaning`, `position`) đều 500. Và **thông báo lỗi trả nguyên câu JPQL ra ngoài** — không nên lộ cấu trúc CSDL cho client.

FE **không expose tham số `sort`** cho endpoint này.

---

### 9, 10. Hai toggle vẫn không lật cờ (đã báo, chưa sửa)

`PATCH /admin/decks/{id}/official` và `POST /decks/{id}/share-link/toggle` đều trả **200** nhưng cờ không đổi. Kiểm bằng cách **đọc lại** đối tượng sau khi ghi, chứ không tin response của chính lệnh ghi.

Riêng `official` khiến bộ lọc `isOfficial` ở `GET /admin/decks` cũng vô dụng, vì không bao giờ có bộ thẻ nào được đánh dấu.

---

### 11. `DeckResponse.totalCards` sai lệch một bậc độ lớn

Deck 9 báo `totalCards: 6` từ cả `/decks/public` và `/decks/9`, nhưng:

- `GET /cards/deck/9` trả `totalElements: 68`
- `GET /srs/mastery?deckId=9` trả `newCardsCount: 68`

Sai gấp hơn 11 lần. FE không dùng trường này làm số liệu, chỉ dùng làm nhãn ước lượng.

---

### 23. Thiếu quyền trả HTTP 500 thay vì 403 (đã báo, chưa sửa)

`AccessDeniedException` bị gói thành **HTTP 500** `"Something went wrong: Access Denied"`, còn route không tồn tại thành **HTTP 500** `"No static resource ..."`. Mã trạng thái vô dụng; chỉ chuỗi message phân biệt được. FE phải so khớp chuỗi, rất dễ vỡ nếu backend đổi câu chữ.

---

### 24. `export/pdf` mất toàn bộ dấu tiếng Việt

File PDF tải về đọc được, nhưng mọi chữ cái riêng của tiếng Việt **biến mất không dấu vết**: `BỘ BÀI` in ra thành `B BÀI`, `TỔNG SỐ THẺ` thành `TNG S TH`, `quê hương, nơi sinh ra` thành `quê hng, ni sinh ra`, `trung tâm thành phố` thành `trung tâm thành ph`.

Nguyên nhân nằm ngay trong file PDF:

```bash
curl -s "$BASE/cards/deck/19/export/pdf" -H "Authorization: Bearer $TOKEN" -o deck.pdf
strings deck.pdf | grep -i "BaseFont\|Producer\|FontFile"
# /Subtype/Type1 /Type/Font /BaseFont/Helvetica /Encoding/WinAnsiEncoding
# /Producer(OpenPDF 1.3.39)
# (khong co /FontFile => khong font nao duoc nhung)
```

`WinAnsiEncoding` là Windows-1252, một bảng **256 ký tự**. Nó có `ê â à ô í ì ú ó` nên các chữ đó sống sót, nhưng **không có** `ă ơ ư đ` và toàn bộ tổ hợp thanh điệu `ộ ổ ố ẻ ế ệ ị ạ ấ ậ ụ …`. OpenPDF gặp ký tự ngoài bảng thì **bỏ qua trong im lặng**, không ném lỗi — nên response vẫn là HTTP 200 và file vẫn mở được.

Đối chiếu từng ký tự trong bản in thử: **mọi** chữ còn hiện đều nằm trong Windows-1252, **mọi** chữ bị mất đều nằm ngoài. Tương quan 1:1, không ngoại lệ.

**Cách sửa:** nhúng một font Unicode có bộ chữ Việt (DejaVu Sans, Noto Sans, Arial Unicode) và tạo `BaseFont` với `IDENTITY_H` cùng `EMBEDDED`:

```java
BaseFont bf = BaseFont.createFont(
    "fonts/DejaVuSans.ttf", BaseFont.IDENTITY_H, BaseFont.EMBEDDED);
Font font = new Font(bf, 10);
```

`IDENTITY_H` bỏ giới hạn 256 ký tự, `EMBEDDED` đảm bảo máy người đọc không cần cài font. Nhớ đóng gói file `.ttf` vào resources của image, vì container không có sẵn font nào — đây cũng chính là gốc rễ của mục 5.

Trong lúc chờ, chức năng xuất PDF trên FE vẫn để nguyên: file tải về được, và với deck toàn tiếng Anh thì không sao. FE không thể tự vá, vì nó chỉ nhận `response.blob()` rồi lưu xuống, không hề đụng vào bytes.

---

### 25. `POST /games/space-striker/rooms/{code}/answer` không idempotent

Nộp **cùng một đáp án sai, cho cùng một câu, từ cùng một người** hai lần thì bị trừ máu hai lần. Server không ghi nhận rằng người đó đã trả lời câu này rồi.

Kiểm chứng trên server thật, phòng `KVDQYD`, hai tài khoản:

```bash
# tạo phòng, người thứ hai join, host start -> cả hai đều lives = 3
curl -X POST "$BASE/games/space-striker/rooms/$CODE/answer"   -H "Authorization: Bearer $T2" -H 'Content-Type: application/json'   -d '{"cardId":271}'      # 271 là đáp án SAI
# -> Admin lives = 2, questionResolved = false

curl -X POST "$BASE/games/space-striker/rooms/$CODE/answer"   -H "Authorization: Bearer $T2" -H 'Content-Type: application/json'   -d '{"cardId":271}'      # y hệt lần trên
# -> Admin lives = 1
```

Hai lần gọi, HTTP 200 cả hai, máu tụt **3 -> 2 -> 1**.

Hệ quả trực tiếp: client hiện gửi mỗi phát bắn **hai lần** — một qua STOMP `/app/space-room/{code}/answer`, một qua REST ngay sau đó. Nên trong game thật, bắn trượt một lần mất **hai mạng**, người chơi bị loại sau một lần rưỡi thay vì ba lần. Khuôn gửi hai lần này có ở cả `audio-reflex-multiplayer` lẫn `space-striker`.

FE có thể vá bằng cách chỉ gửi một đường, nhưng chỗ sửa đúng là ở server: một người chơi chỉ được tính một lần cho mỗi `currentQuestionIndex`. Nếu không, chỉ cần bấm nhanh hai lần là tự trừ máu mình, và ngược lại có thể spam đáp án đúng để ăn điểm nhiều lần.

Cũng nên kiểm luôn `audio-reflex` cùng nhóm, nhiều khả năng dính y hệt.

---

## P2 — Spec lệch thực tế

### 12. Một endpoint AI có ba kiểu envelope lỗi khác nhau

`POST /api/ai/quiz` trả về **ba shape body khác nhau** tuỳ tình huống:

| Tình huống | HTTP | Body |
|---|---|---|
| Thành công | 200 | `{status, message, data}` — envelope Java |
| Thiếu field | 422 | `{"detail":[{"type":"missing","loc":["body","deck_id"]}]}` — FastAPI/Pydantic |
| Lỗi nghiệp vụ | 400 | `{"error":{"code":"INVALID_REQUEST","message":"..."}}` |

Nguyên nhân: nhóm chat/quiz được proxy sang một service Python riêng, còn phần còn lại do Spring xử lý. Client không thể parse lỗi một cách nhất quán.

**Đề nghị:** gateway Java bọc lại lỗi của service Python về đúng envelope chung.

---

### 13. `docs/ai-testing-guide.md` sai ở nhiều chỗ quan trọng

Tài liệu hướng dẫn tích hợp đang **sai đường dẫn và sai shape**. Người đọc nó sẽ viết code không chạy:

| Guide nói | Thực tế |
|---|---|
| `/api/ai-extraction/text`, `/url`, `/file`, `/magic-sort`, `/suggestions` | **Cả 5 đều không tồn tại.** Đường thật là `/api/ai/extract/*` |
| `/api/ai/situational-learning` | Không tồn tại. Đường thật: `/api/v1/ai/situational-learning/text` |
| Response situational có `scenarioDescription`, `dialogue`, `vocabulary`, `quizOptions` | **Không trường nào tồn tại.** Thật là `mainActions`, `interactions`, `emotions`, `shortCaptions`, `vocabularies` — và **không có quiz** |
| `MagicSortRequest` = `{cardIds, deckIds}` | Thật là `{words: string[], decks?: {id: name}}` |
| `TextExtractionRequest` = `{text, targetLanguage, topic}` | Thật là `{text, category}` |
| `ExtractedCardResponse` có 4 trường | Schema này không có trong swagger; response thật có 11 trường |
| Situational request không nhắc `cefrLevel` | `cefrLevel` **bắt buộc** |
| auto-deck xong trong 3s, AI text dưới 1,5s | Đo thực tế: từ 2s đến hơn 78s |

**Đề nghị:** sinh tài liệu từ swagger thay vì viết tay, hoặc ghi rõ ngày cập nhật cuối.

---

### 14. Trường bắt buộc bị spec đánh dấu optional

| Endpoint | Trường | Spec | Thực tế |
|---|---|---|---|
| `/api/ai/auto-deck` | `cardCount` | optional, mặc định 15 | **Bắt buộc.** Kiểu `int` nguyên thuỷ, thiếu là 400 |
| `/api/v1/ai/situational-learning/text` | `cefrLevel` | guide không nhắc | **Bắt buộc** |
| `/api/ai/extract/text` | `category` | optional | **Bắt buộc**, thiếu là NPE 500 |
| `/api/ai/extract/url` | `category` | optional | **Bắt buộc** |
| `/api/ai/extract/file` | `category` | — | **Bắt buộc** (query param) |
| `/cards/starred` | `pageable` | required | Thực ra optional |

Ngoài ra `cardCount` **vượt 30 là hỏng**: `cardCount: 31` trả 500 sau 9 giây. Spec ghi max 30 nhưng không có validation, nên vượt là chờ lâu rồi lỗi thay vì bị từ chối ngay.

---

### 15. Sinh nội dung AI trả về `imageUrl` và `audioUrl` bịa đặt

Cả `auto-deck` lẫn `extract/*` đều trả về đường dẫn kiểu:

```
https://example.com/images/engineer.jpg
https://example.com/audio/velocity.mp3
```

Đây là model tự bịa, không phải file có thật. FE **không render và không lưu** hai trường này.

**Đề nghị:** trả `null` thay vì bịa, hoặc lọc ở server trước khi trả.

---

### 16. `conversationId` bị cắt còn 36 ký tự âm thầm

Server cắt chuỗi mà không báo. Hệ quả: hai id khác nhau nhưng **trùng 36 ký tự đầu** sẽ gộp thành một hội thoại, và người dùng thấy tin nhắn của phiên khác lẫn vào.

FE tự cắt trước khi gửi để id nó giữ khớp id server giữ.

**Đề nghị:** trả 400 khi vượt độ dài, thay vì cắt im lặng.

---

### 17. `/srs/mastery?deckId` không kiểm quyền sở hữu

Truyền `deckId` của bộ thẻ **thuộc người khác** vẫn trả 200 kèm số liệu của bộ đó, thay vì 404. Deck đem thử là PUBLIC nên mức rò rỉ thực tế chỉ là số lượng thẻ, nhưng **chưa kiểm với deck PRIVATE** — cần backend tự xác nhận.

---

### 18. `last` trong `PageResponse` luôn false

Kể cả khi `totalPages` là 1 và đang ở trang 0. Quan sát trên nhiều endpoint.

**Hệ quả:** cuộn vô hạn dựa trên `last` sẽ lặp mãi. Phải dùng `pageNo + 1 >= totalPages`.

---

### 19. Phân trang giờ có ba quy ước khác nhau

| Nhóm | Quy ước |
|---|---|
| `/cards/*`, `/admin/users`, `/admin/decks`, `/admin/games`, `/notifications`, `/cards/starred` | **0-based**, `pageNo` khớp giá trị gửi |
| `/decks/*` | **1-based**, server tự kẹp giá trị dưới 1 |
| `/admin/decks/pending-public` | Gửi `page=N` → trả **`pageNo=N+1`** |

Cái thứ ba là mới. Kiểm ba giá trị liên tiếp đều lệch đúng 1. Hiển thị thẳng `pageNo` sẽ lệch một trang so với mọi danh sách admin khác.

**Đề nghị:** thống nhất một quy ước.

---

### 22. Bug `phone IS NULL` khi đăng ký (đã báo, chưa sửa)

Email hoàn toàn mới nhưng không gửi `phone` vẫn trả `400 "Email or Phone already exists"`, vì câu kiểm trùng biến `phone` null thành `phone IS NULL` và khớp mọi bản ghi cũ không có số.

---

## P3 — Nhỏ hơn

### 20. `/notifications` trả mảng phẳng, không có metadata phân trang

Endpoint nhận `page` và `size` nhưng response là **mảng thuần**, không có `totalElements`, `totalPages`, `hasNext`, và không có header đếm.

**Hệ quả:** không dựng được phân trang đánh số. Chỉ làm được "tải thêm", dừng khi nhận về một trang ngắn. Tham số `sort` cũng bị bỏ qua, danh sách luôn mới-nhất-trước.

---

### 21. `POST /api/ai/story` với danh sách rỗng trả `status 403 "Invalid key"`

```bash
curl -X POST "$BASE/api/ai/story" -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' -d '{"words":[]}'
# HTTP 400, body {"status":403,"message":"Invalid key"}   (không có key "data")
```

Thông báo đọc như lỗi phân quyền nhưng thực ra là lỗi đầu vào. Client nào branch theo `body.status` sẽ hiểu nhầm thành hết phiên đăng nhập và đá người dùng ra màn hình đăng nhập.

---

## Điểm làm tốt

Không phải mục nào cũng là lỗi, nên ghi lại vài chỗ **làm đúng**:

- **`/internal/cards/*` được bảo vệ đúng cách.** Cần header bí mật `X-Internal-Token`; token user, token admin, và không token đều bị chặn 401 như nhau, bởi một filter chạy **trước** cả bearer auth. Đã thử 5 kiểu, không rò rỉ. FE **không ghép** hai route này vì đưa secret xuống trình duyệt là sai nguyên tắc.
- **`/cards/starred` scope đúng theo người dùng.** Token admin thấy danh sách rỗng trong khi token user thấy đúng thẻ của mình.
- **`POST /cards/{id}/toggle-star` lật cờ thật**, khác hai toggle hỏng ở mục 9 và 10.
- **Nhánh quiz tất định không tốn token LLM**: trả 10 câu trong 0,47s với `deterministic_count: 10, llm_count: 0`.

---

## Endpoint FE cố ý không ghép

| Endpoint | Lý do |
|---|---|
| `GET /api/ai/extract/suggestions` | Hỏng hoàn toàn, xem mục 4 |
| `GET /cards/deck/{id}/export/excel` | Sập vì lỗi font JVM, xem mục 5 |
| `POST /notifications` | Đã viết hàm nhưng **không đưa lên UI**: lỗi bảo mật mục 1 |
| `GET /internal/cards/ids` | Cần secret dùng chung, không được đưa xuống trình duyệt |
| `GET /internal/cards/changed-since` | Nt |
| `POST /auth/introspect` | Chỉ trả `{result: boolean}`, không có exp/subject/scope. Giá trị mỏng, và câu trả lời "false" bị chia làm hai shape khác nhau |
| `GET /api/chat-ai/test` | Endpoint smoke-test, trả `void` |

---

## Phụ lục — Cách tái hiện

```bash
BASE="https://fsoft-project-production.up.railway.app/fsoft"

# Lưu ý: field là passWord (chữ W hoa) khi đăng ký, password (thường) khi đăng nhập.
# Và phải gửi phone duy nhất, xem mục 22.

TOKEN=$(curl -s -X POST "$BASE/auth/login" -H 'Content-Type: application/json' \
  -d '{"email":"<email>","password":"<mật khẩu>"}' \
  | python -c "import sys,json;print(json.load(sys.stdin)['data']['token']['accessToken'])")
```

Mọi lệnh `curl` trong tài liệu chạy được trực tiếp sau bước trên.
