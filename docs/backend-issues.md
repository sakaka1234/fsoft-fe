# Báo cáo vấn đề Backend

**Ngày:** 2026-08-26
**Người báo:** team Frontend
**Môi trường:** `https://fsoft-project-production.up.railway.app/fsoft`
**Đối chiếu với:** `docs/swagger.json` (75 path, 117 schema)

Mọi mục trong tài liệu này đều được **gọi thật lên môi trường production**, không suy diễn từ spec. Chỗ nào chưa kiểm chứng được đều ghi rõ là **CHƯA KIỂM**.

Token dùng để kiểm là tài khoản thường, scope `ROLE_USER CREATE_USER`. Không có token admin, nên phần admin chỉ kiểm được phía request.

---

## Tóm tắt

| # | Vấn đề | Mức | Ảnh hưởng |
|---|---|---|---|
| 1 | `POST /api/ai/chat` luôn 500 | **P0** | Tính năng hỏi đáp AI không dùng được |
| 2 | `POST /api/ai/quiz` luôn 500 | **P0** | Quiz AI không dùng được |
| 3 | 3 endpoint `extract/*` luôn trả mảng rỗng | **P0** | Import thẻ bằng AI không ra kết quả |
| 4 | Thiếu quyền trả HTTP 500 chứ không phải 403 | **P1** | Client không phân biệt được "thiếu quyền" với "server lỗi" |
| 5 | Route không tồn tại trả 500 chứ không phải 404 | **P1** | Nt |
| 6 | Tra từ điển không thấy trả HTTP 500 | **P1** | Gõ sai chính tả bị báo thành "server sập" |
| 7 | Thiếu field bắt buộc gây NPE 500 thay vì 400 | **P1** | Không phân biệt được lỗi nhập liệu với lỗi server |
| 8 | `extract/file` văng stack trace Java ra response | **P1** | Lộ nội bộ + sập với file PDF hợp lệ |
| 9 | `share-link/toggle` không lật cờ | **P1** | Tính năng chia sẻ link hỏng |
| 10 | `/api/ai/search` trả card của deck người gọi không có quyền | **P1** | Rò rỉ dữ liệu |
| 11 | `/api/ai/search` không index card của chính người gọi | **P1** | Tìm kiếm vô dụng với dữ liệu người dùng |
| 12 | Nhóm extraction dùng camelCase, ngược với nhóm AI còn lại | **P2** | Sai kiểu chữ bị **bỏ qua âm thầm** |
| 13 | `isOfficial` khi ghi / `official` khi đọc | **P2** | Round-trip phải dịch tên field |
| 14 | `AdminUserResponse.roles` khai `string[]`, thực tế là object | **P2** | CHƯA KIỂM |
| 15 | Spec ghi optional nhưng thực tế bắt buộc | **P2** | Sinh code từ spec sẽ sai |
| 16 | `status` trong body không khớp HTTP status | **P3** | Client buộc phải bỏ qua `status` |
| 17 | Tiền tố route không nhất quán (`/api` vs không) | **P3** | Dễ gọi nhầm |
| 18 | Bug `phone IS NULL` khi đăng ký | **P2** | Đã báo, chưa sửa |
| 19 | Validation chạy trước phân quyền | **P3** | Lộ tên field cho người không có quyền |
| 20 | `/oauth2/callback` trả envelope của Google, không phải của API | **P2** | Client mất thông tin lỗi đăng nhập Google |

---

## P0 — Chặn tính năng

### 1. `POST /api/ai/chat` luôn trả 500

Mọi body đều lỗi, **kể cả body rỗng và body rác**. Vì lỗi xảy ra **trước cả bước validate**, nguyên nhân nằm ở phía provider (hết quota hoặc sai API key), không phải ở request.

```bash
curl -X POST "$BASE/api/ai/chat" -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' -d '{}'
# HTTP 500, body status 429, message "Lỗi hỏi đáp AI"
```

**Mong đợi:** 200 với câu trả lời, hoặc 429 thật kèm thông tin quota nếu hết hạn mức.

---

### 2. `POST /api/ai/quiz` luôn trả 500

Kể cả khi gửi `use_ai_context: false`, tức là đường đi lẽ ra **không cần gọi LLM**.

```bash
curl -X POST "$BASE/api/ai/quiz" -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"deck_id":2,"question_count":5,"use_ai_context":false}'
# HTTP 500 (đã thấy cả body status 430 và 422)
```

**Mong đợi:** nhánh `use_ai_context:false` phải sinh câu hỏi tất định từ dữ liệu thẻ mà không phụ thuộc provider.

---

### 3. Cả 3 endpoint `extract/*` trả 200 nhưng mảng luôn rỗng

Đây là vấn đề **lớn nhất** trong đợt này: endpoint sống, trả đúng envelope, nhưng `data` luôn là `[]`.

Đã thử **11 lần** với: văn xuôi thường, câu nhiều từ vựng, danh sách từ ngăn cách bởi dấu phẩy, một từ đơn (`apple`), chuỗi rỗng, giá trị số, các category khác nhau (`VOCABULARY`, `vocabulary`, `Technology`), không truyền `deckId`, `deckId` không tồn tại, và **deck thật đang có 5 thẻ** (deck 2 — "Từ vựng Du lịch"). **Không lần nào ra được dù một thẻ.**

```bash
curl -X POST "$BASE/api/ai/extract/text" -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"text":"The deadline is tomorrow. Please review the document.","category":"VOCABULARY"}'
# HTTP 200 -> {"status":200,"message":"...","data":[]}
```

**Hệ quả:** không có mẫu response nào để FE xác nhận shape của `CardCreationRequest`. Toàn bộ type phía FE hiện đang theo spec, **chưa từng được đối chiếu với dữ liệu thật**.

**Thêm hai điểm về hiệu năng:**

- **Thời gian phản hồi 1,5s đến 49,7s**, trung vị khoảng 13–20s (13 lần đo).
- **Khoảng 15% số lần thất bại** ở mốc ~47,5s với `HTTP 500` / body status **434** `"Lỗi trích xuất AI"` — trông giống timeout của provider.

**Đề xuất:** đặt timeout rõ ràng phía server và trả mã lỗi riêng cho trường hợp timeout, thay vì để client tự đoán qua thời gian chờ.

---

## P1 — Sai nghiêm trọng, gây bug phía client

### 4. Thiếu quyền trả HTTP 500 thay vì 403

`AccessDeniedException` của Spring Security đang bị global exception handler gói thành **HTTP 500**.

```bash
curl "$BASE/admin/dashboard/stats" -H "Authorization: Bearer $USER_TOKEN"
# HTTP 500
# {"status":500,"message":"Something went wrong: Access Denied",
#  "data":{"path":"/fsoft/admin/dashboard/stats","timestamp":"2026-08-25T23:54:06"}}
```

**Vì sao nghiêm trọng:** client không thể phân biệt "bạn không có quyền" với "server đang lỗi". Màn admin nào kiểm `httpStatus === 403` sẽ **không bao giờ chạy đúng**. Hiện FE buộc phải **so khớp chuỗi** `"Access Denied"` trong message — rất dễ vỡ nếu backend đổi câu chữ hoặc dịch sang tiếng Việt.

**Mong đợi:** HTTP **403**.

---

### 5. Route không tồn tại trả HTTP 500 thay vì 404

```bash
curl "$BASE/admin/totally-not-a-route" -H "Authorization: Bearer $TOKEN"
# HTTP 500, message "No static resource admin/totally-not-a-route for request '/fsoft/...'"
```

Cộng với mục 4, **HTTP 500 hiện mang ba ý nghĩa khác nhau**: thiếu quyền, sai đường dẫn, và lỗi server thật. Đây là lý do FE phải viết hai hàm phân loại dựa trên chuỗi message.

Trường hợp đặc biệt — **thêm dấu `/` ở cuối cũng làm vỡ route**:

```bash
curl "$BASE/api/dictionary/lookup/?word=run" -H "Authorization: Bearer $TOKEN"
# HTTP 500 "No static resource api/dictionary/lookup"   (mong đợi: 404 hoặc redirect)
```

**Mong đợi:** HTTP **404**.

---

### 6. Tra từ điển không thấy từ trả HTTP 500

```bash
curl "$BASE/api/dictionary/lookup?word=zzqqxxvv" -H "Authorization: Bearer $TOKEN"
# HTTP 500 -> {"status":431,"message":"Lỗi tra từ điển"}      (KHÔNG có key "data")
```

**Vì sao nghiêm trọng:** người dùng gõ sai một chữ cái là app báo "server sập". Tệ hơn, **provider từ điển chết cũng trả y hệt**, nên không thể giám sát được sự cố thật.

Ngoài ra **không có bất kỳ validation nào** trên giá trị `word`. Tất cả các trường hợp sau đều trả 500 giống nhau:

| Giá trị | Kết quả |
|---|---|
| `word=` (rỗng) | HTTP 500 / 431 |
| `word=%20` (khoảng trắng) | HTTP 500 / 431 |
| `word=123` | HTTP 500 / 431 |
| `word=chạy` (tiếng Việt) | HTTP 500 / 431 |
| chuỗi rác 80 ký tự | HTTP 500 / 431 |
| **bỏ hẳn tham số** | HTTP 400 `"Miss argument require: word"` ← trường hợp duy nhất đúng |

**Mong đợi:** HTTP **404** khi không tìm thấy từ, HTTP **400** khi giá trị không hợp lệ, và HTTP **502/503** khi provider phía trên chết. Ba trường hợp này cần phân biệt được.

---

### 7. Thiếu field bắt buộc gây NPE trần, trả 500 thay vì 400

Spec khai **tất cả** field của `TextExtractionRequest` và `UrlExtractionRequest` là optional. Thực tế không phải vậy, và khi thiếu thì server ném NPE chưa bắt:

```bash
# thiếu category
curl -X POST "$BASE/api/ai/extract/text" -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' -d '{"text":"hello world"}'
# HTTP 500 "Something went wrong: null"        <- trả về trong ~0.36s, chưa hề gọi model

# thiếu text
curl -X POST "$BASE/api/ai/extract/text" -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' -d '{"category":"VOCABULARY"}'
# HTTP 500 'Cannot invoke "String.length()" because "text" is null'

# extract/url thiếu category
curl -X POST "$BASE/api/ai/extract/url" -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' -d '{"url":"https://example.com"}'
# HTTP 500 / body status 433 "Lỗi đọc URL"     <- 3/3 lần, và sai nhãn:
#                                                 lỗi là thiếu category, không phải đọc URL
```

**Mong đợi:** đánh dấu `@NotBlank` và trả **400** kèm tên field. Đồng thời sửa spec cho khớp.

---

### 8. `extract/file` phân loại theo Content-Type và văng stack trace Java

Endpoint quyết định cách xử lý file dựa trên **Content-Type khai trong phần multipart**, hoàn toàn **không đọc tên file**. Cùng một file PDF hợp lệ:

| Khai Content-Type | Kết quả |
|---|---|
| `application/pdf` | HTTP 200 |
| `application/octet-stream` | **`java.lang.NoSuchMethodError`** — stack trace Java thô trong response |
| `text/plain` | **`java.lang.NoSuchMethodError`** — nt |

Lỗi cụ thể: `PDDocument.load(InputStream, String, MemoryUsageSetting)` không tồn tại — nghĩa là **phiên bản PDFBox trong classpath không khớp với code**. Đây là bug thật sự, không chỉ là vấn đề định tuyến.

**Vì sao ảnh hưởng trực tiếp tới FE:** đối tượng `File` của trình duyệt **thường có `.type` rỗng**, và khi đó nó được serialize thành `application/octet-stream`. Nghĩa là **người dùng chọn file PDF theo cách bình thường nhất sẽ làm sập endpoint**. FE hiện phải tự gán MIME theo đuôi file để né.

**Hai đề nghị:**
1. Nâng/sửa phiên bản PDFBox cho khớp.
2. Nhận diện loại file theo **magic bytes** hoặc đuôi file, đừng tin Content-Type do client khai.
3. Bọc mọi lỗi xử lý file lại — **không bao giờ trả stack trace Java ra response**.

**Giới hạn dung lượng chưa được ghi ở đâu cả:** đo được **1.048.000 B được nhận**, **1.100.000 B bị từ chối**, và có lần **đứt kết nối giữa chừng** thay vì trả lỗi. Đề nghị ghi rõ giới hạn vào spec và trả 413 đàng hoàng.

---

### 9. `share-link/toggle` không lật cờ `shareLinkEnabled`

Đã báo từ trước, **chưa sửa**. Endpoint trả về thành công, nhưng đọc lại deck thì cờ không đổi. Phát hiện được nhờ đọc lại deck chứ không tin response của chính lệnh toggle.

---

### 10. `/api/ai/search` trả card thuộc deck mà người gọi không có quyền xem

Cùng một token: search trả về một card, nhưng `GET /decks/2` và `GET /cards/201` đều trả **404** cho token đó.

**Đây là rò rỉ dữ liệu.** Kết quả search cần được lọc theo quyền của người gọi.

---

### 11. `/api/ai/search` không index card của chính người gọi

Bốn card vừa tạo vài giây trước **không tìm thấy**. Chỉ số dường như chỉ phủ dữ liệu seed sẵn.

Ngoài ra tên gọi "search" gây hiểu nhầm: nó **không phải tìm kiếm ngữ nghĩa**. `deadline` khớp với `match_type: EXACT`, còn `work schedule` và `talking to coworkers` không khớp gì, dù trong deck có sẵn `commute` và `colleague`.

---

## P2 — Spec lệch thực tế

### 12. Nhóm extraction dùng camelCase, ngược với nhóm AI còn lại

Cùng tiền tố `/api/ai`, nhưng:

| Endpoint | Kiểu chữ |
|---|---|
| `/api/ai/chat`, `/api/ai/quiz`, `/api/ai/search` | **snake_case** (`scope_deck_id`, `max_output_tokens`, `card_id`) |
| `/api/ai/extract/text`, `/url`, `/file` | **camelCase** (`deckId`) |

**Nguy hiểm ở chỗ sai thì không báo lỗi.** Controller bỏ qua field lạ (`FAIL_ON_UNKNOWN_PROPERTIES` đang tắt), nên gửi `deck_id` thì được nhận, bị vứt đi, và `deckId` vào tới service là `null` — **không có bất kỳ cảnh báo nào**.

Cách duy nhất chứng minh được tên field thật là gửi **sai kiểu dữ liệu**:

```bash
-d '{"text":"x","category":"y","deckId":"abc"}'
# HTTP 400 "Cannot deserialize ... TextExtractionRequest[\"deckId\"]"   <- lộ tên thật

-d '{"text":"x","category":"y","deck_id":"abc"}'
# HTTP 200                                                             <- bị bỏ qua âm thầm
```

**Đề nghị:** thống nhất một kiểu chữ cho toàn bộ API, hoặc ít nhất trong cùng một nhóm controller. Và bật `FAIL_ON_UNKNOWN_PROPERTIES` để lỗi lộ ra sớm.

---

### 13. `isOfficial` khi ghi, `official` khi đọc

Bất đối xứng này đã tồn tại từ lâu và **vẫn còn**, giờ lan sang cả DTO admin:

```bash
# ĐỌC: GET /decks/public -> deck object có "official", KHÔNG BAO GIỜ có "isOfficial"

# GHI:
curl -X PATCH "$BASE/admin/decks/1/official" -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' -d '{"official":true}'
# HTTP 400 "isOfficial flag is required"      <- bắt buộc phải là isOfficial
```

Điều tương tự với `DeckCreateRequest`: `isOfficial` là **primitive boolean**, nên bỏ trống không phải là "dùng mặc định" mà là **500** `"Cannot map null into type boolean"`.

**Đề nghị:** thống nhất một tên. Nếu đọc là `official` thì ghi cũng nên là `official`.

---

### 14. `AdminUserResponse.roles` khai `string[]`, mọi payload khác lại là object — **CHƯA KIỂM**

Spec khai:
```
AdminUserResponse.roles: string[]
```

Nhưng thực tế mọi chỗ khác trả về object:
```bash
curl -X POST "$BASE/auth/register" ... 
# "roles":[{"name":"USER"}]        <- object, không phải string
```

Không có token admin nên **chưa xác nhận được** phía admin trả gì. Nếu spec đúng thì cùng một khái niệm đang có hai shape khác nhau trong một API — nên thống nhất.

---

### 15. Nhiều field spec ghi optional nhưng thực tế bắt buộc

Tổng hợp:

| Endpoint | Field | Spec | Thực tế |
|---|---|---|---|
| `/api/ai/extract/text` | `text` | optional | **bắt buộc** (NPE nếu thiếu) |
| `/api/ai/extract/text` | `category` | optional | **bắt buộc** (NPE nếu thiếu) |
| `/api/ai/extract/url` | `url` | optional | **bắt buộc** |
| `/api/ai/extract/url` | `category` | optional | **bắt buộc** |
| `/api/ai/extract/file` | `deckId` | — | **bắt buộc** (400 "Miss argument require: deckId") |
| `/auth/register` | `phone` | optional | **bắt buộc trên thực tế** (xem mục 18) |

Ngược lại, `deckId` ở `extract/text` và `extract/url` được **nhận rồi bỏ qua hoàn toàn**: truyền id không tồn tại, id của người khác, hay không truyền gì — kết quả **giống hệt nhau**. Nếu chưa dùng tới thì nên bỏ khỏi spec, hoặc hiện thực nốt.

---

### 18. Bug `phone IS NULL` khi đăng ký

Đã báo từ trước, **chưa sửa**. Email hoàn toàn mới nhưng không gửi `phone` vẫn trả:

```
HTTP 400 "Email or Phone already exists"
```

Nguyên nhân: câu kiểm trùng biến `phone` null thành `phone IS NULL`, và khớp với **mọi bản ghi cũ không có số điện thoại**. FE hiện phải bắt buộc người dùng nhập số điện thoại để né bug này.

Liên quan: `/auth/register` dùng field `passWord` (chữ **W** hoa), trong khi `/auth/login` dùng `password`. Nên thống nhất.

---

## P3 — Nhất quán và đề xuất

### 16. `status` trong body không khớp HTTP status

| HTTP | `status` trong body |
|---|---|
| 200 | 200 ✔ |
| 400 | 400 ✔ |
| **401** | **207** ✘ |
| **500** (tra từ điển hụt) | **431** ✘ |
| **500** (extract lỗi) | **434** ✘ |
| **500** (đọc URL lỗi) | **433** ✘ |
| **500** (quiz lỗi) | **430 / 422** ✘ |
| 200 (đăng ký) | **201** ✘ |

Hệ quả: **client buộc phải bỏ qua `status` và chỉ tin HTTP status**, khiến trường này gần như vô dụng.

Ngoài ra, envelope lỗi **không có key `data`** (không phải `null`, mà là không tồn tại), trong khi envelope thành công luôn có. FE phải khai `data?: T`.

**Đề nghị:** hoặc cho `status` khớp HTTP status, hoặc tách hẳn thành một trường mã lỗi nghiệp vụ có tên khác (ví dụ `errorCode`) và **ghi bảng mã đó vào tài liệu** — hiện các mã 207/430/431/433/434 không có ở đâu cả.

---

### 17. Tiền tố route không nhất quán

| Nhóm | Đường dẫn |
|---|---|
| Decks, cards, tags, srs, auth, profiles | `/decks`, `/cards`, … (không tiền tố) |
| AI | **`/api`**`/ai/...` |
| Dictionary | **`/api`**`/dictionary/...` |
| Admin | `/admin/...` (**không** có `/api`) |

Đã kiểm: `/api/admin/dashboard/stats` trả "No static resource", còn `/admin/dashboard/stats` trả "Access Denied". Nghĩa là admin **không** nằm dưới `/api`, dù AI thì có.

**Đề nghị:** gom về một quy ước.

---

### 19. Validation chạy trước phân quyền

Một tài khoản **không có quyền admin** vẫn có thể suy ra cấu trúc DTO của admin, bằng cách gửi body sai và đọc thông báo 400 — vì validation chạy trước, phân quyền chạy sau.

Thực tế điều này **giúp ích cho FE** trong lần này (nhờ nó mà xác nhận được `isOfficial`, `roleNames` mà không cần token admin). Nhưng về nguyên tắc, người không có quyền **không nên nhận được thông tin gì về endpoint đó**, kể cả tên field.

**Đề nghị:** đưa filter phân quyền chạy trước bước bind/validate.

---

### Vài ghi chú nhỏ khác

**Phân trang có hai quy ước.** Route card dùng Spring `Pageable` (**0-based**), route deck dùng `page`/`size` phẳng (**1-based**, server tự kẹp về 1 nếu nhỏ hơn). Nhóm admin khai `pageable`, và dò gián tiếp cho thấy đang bind `Pageable` (0-based) — nhưng **CHƯA KIỂM trực tiếp** vì 403 không cho payload nào lọt qua. Nếu được, xin xác nhận giúp.

**`/admin/games/records`:** `deckId` là `Long` chứ không phải UUID. Còn `role` (ở `/admin/users`) và `gameType` là **String không validate** — giá trị vô nghĩa vẫn qua được bind.

**Tra từ điển bắt buộc đăng nhập** dù đây là dữ liệu tra cứu công khai. Không có header thì trả 401. Nếu cố ý thì bỏ qua mục này.

**Tra từ điển là passthrough nguyên văn** của Free Dictionary API (dữ liệu Wiktionary): URL audio trỏ thẳng về `api.dictionaryapi.dev`, `sourceUrls` trỏ về `en.wiktionary.org`, và mỗi entry mang khối license **CC BY-SA**. Hai hệ quả: (a) shape có thể đổi mà không cần deploy backend, (b) **nghĩa vụ ghi nguồn CC BY-SA** cần được xác nhận là ai chịu trách nhiệm hiển thị.

**`totalCards` trên deck không được backfill.** Deck tạo trước khi sửa vẫn báo 0 dù đang có thẻ.

**Enum trạng thái SRS:** spec ghi `NEW | LEARNING | REVIEW | LAPSED`, nhưng có nhánh code phía backend dùng `RELEARNING`. Xin xác nhận giá trị đúng.

---

### 20. `/oauth2/callback` trả envelope của Google thay vì envelope chuẩn

Đây là endpoint **duy nhất** trong API không dùng envelope `{status, message, data}`. Nó truyền thẳng body lỗi của Google token endpoint ra ngoài:

```bash
curl -X POST "$BASE/oauth2/callback?code=fake_code_probe"
# HTTP 400
# {"error":"invalid_grant","error_description":"Malformed auth code."}
```

So với mọi endpoint khác:

```bash
curl -X POST "$BASE/auth/login" -H 'Content-Type: application/json'   -d '{"email":"nobody@example.com","password":"wrong"}'
# {"status":400,"message":"Validation error","data":{...}}
```

**Hệ quả:** client đọc `payload.message` để dựng thông báo lỗi. Với endpoint này `message` không tồn tại, nên người dùng thấy **"Request failed with status 400"** thay vì lý do thật (`"Malformed auth code."`). Mọi lỗi đăng nhập Google — code hết hạn, code dùng lại, sai client secret — đều hiện ra như nhau và không debug được.

FE đã tạm xử lý bằng cách đọc thêm `error_description`, nhưng đúng ra nên sửa ở BE cho nhất quán.

**Mong đợi:** bọc lại thành `{status, message, data}` như các endpoint khác, giữ `error_description` của Google trong `message`.

---

## Phụ lục — Cách tái hiện

```bash
BASE="https://fsoft-project-production.up.railway.app/fsoft"

# Tạo tài khoản. Lưu ý: phải gửi phone duy nhất, xem mục 18.
# Và field là passWord, chữ W hoa.
curl -X POST "$BASE/auth/register" -H 'Content-Type: application/json' -d '{
  "fullName":"Probe","email":"probe1@example.com",
  "phone":"0900000001","passWord":"ProbePass123!"
}'

# Lấy token. Ở đây field lại là password, chữ thường.
TOKEN=$(curl -s -X POST "$BASE/auth/login" -H 'Content-Type: application/json' \
  -d '{"email":"probe1@example.com","password":"ProbePass123!"}' \
  | python -c "import sys,json;print(json.load(sys.stdin)['data']['token']['accessToken'])")

# Từ đây dùng: -H "Authorization: Bearer $TOKEN"
```

Mọi lệnh `curl` trong tài liệu này chạy được trực tiếp sau bước trên.
